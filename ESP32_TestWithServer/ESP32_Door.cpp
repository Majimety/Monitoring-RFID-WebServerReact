#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#define SS_PIN    5
#define RST_PIN   21
#define RELAY_PIN 26
#define DOOR_OPEN  LOW
#define DOOR_CLOSE HIGH

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char *ssid         = "ADF";
const char *password     = "ADF12345";
const char *apiIPAddress = "http://10.53.39.157:5000"; // แก้ไขทุกครั้งที่เทส
const char *roomName     = "EN4101";                   // ชื่อห้องของ ESP32 ตัวนี้

// =====================
// Timing
// =====================
unsigned long lastPoll            = 0;
unsigned long lastWhitelistRefresh = 0;

const unsigned long pollInterval            = 1000;        // poll door command ทุก 1 วิ
const unsigned long whitelistRefreshInterval = 5UL * 60UL * 1000UL; // refresh whitelist ทุก 5 นาที
const unsigned long whitelistRetryInterval   = 30UL * 1000UL;       // retry ถ้าโหลดไม่ได้ ทุก 30 วิ

// =====================
// Admin Whitelist (เก็บใน RAM — โหลดจาก server)
//
// Flow:
//   boot  → setup() เรียก loadWhitelistFromServer()
//             → สำเร็จ: เก็บใน adminWhitelist[]
//             → ล้มเหลว (server ยังไม่พร้อม): adminWhitelistCount = 0
//                        loop() จะ retry ทุก 30 วิ จนกว่าจะได้
//   ทุก 5 นาที → loop() โหลดใหม่อัตโนมัติ (ดึง admin เพิ่มใหม่)
//   server ล่ม → ใช้ค่าใน RAM ที่โหลดล่าสุด (ไม่หาย จนกว่าบอร์ด reset)
// =====================
#define MAX_WHITELIST 50
String adminWhitelist[MAX_WHITELIST];
int    adminWhitelistCount = 0;

// โหลด whitelist จาก server — คืน true ถ้าสำเร็จ
bool loadWhitelistFromServer()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[WHITELIST] WiFi not connected — skip");
    return false;
  }

  HTTPClient http;
  String url = String(apiIPAddress) + "/api/whitelist";
  http.begin(url);
  http.setTimeout(5000);
  int code = http.GET();

  if (code != 200)
  {
    Serial.print("[WHITELIST] HTTP GET failed. Code: ");
    Serial.println(code);
    http.end();
    return false;
  }

  String body = http.getString();
  http.end();

  // Parse JSON: {"success":true,"admins":[{"uuid":"AABBCCDD","name":"Firstname Lastname"},...]}
  StaticJsonDocument<4096> doc;
  DeserializationError err = deserializeJson(doc, body);
  if (err)
  {
    Serial.print("[WHITELIST] JSON parse error: ");
    Serial.println(err.c_str());
    return false;
  }

  // โหลดสำเร็จ → อัปเดต whitelist ใน RAM
  int newCount = 0;
  for (JsonObject admin : doc["admins"].as<JsonArray>())
  {
    if (newCount >= MAX_WHITELIST) break;
    String uuid = admin["uuid"].as<String>();
    uuid.toUpperCase();
    adminWhitelist[newCount++] = uuid;
    Serial.print("[WHITELIST]  + ");
    Serial.print(uuid);
    Serial.print("  (");
    Serial.print(admin["name"].as<String>());
    Serial.println(")");
  }
  adminWhitelistCount = newCount;

  Serial.print("[WHITELIST] Loaded ");
  Serial.print(adminWhitelistCount);
  Serial.println(" admin(s) into RAM");
  return true;
}

// ตรวจสอบว่า UUID นี้อยู่ใน whitelist RAM หรือไม่
bool isAdminUUID(const String &uuid)
{
  for (int i = 0; i < adminWhitelistCount; i++)
    if (uuid.equalsIgnoreCase(adminWhitelist[i]))
      return true;
  return false;
}

// =====================
// Door Control
// =====================
void openDoor()
{
  Serial.println(">>> Opening door...");
  digitalWrite(RELAY_PIN, DOOR_OPEN);
  delay(5000);
  digitalWrite(RELAY_PIN, DOOR_CLOSE);
  Serial.println(">>> Door closed.");
}

// =====================
// Online Mode: ส่ง UUID ไป API
// คืนค่า true  = server ตอบกลับ (granted หรือ denied)
//         false = ติดต่อ server ไม่ได้ → ใช้ fallback
// =====================
bool sendUUIDToAPI(const String &uuid)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[API] WiFi not connected — offline mode.");
    return false;
  }

  HTTPClient http;
  String url = String(apiIPAddress) + "/api/send_uuid";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000);

  String payload = "{\"uuid\":\"" + uuid + "\",\"room\":\"" + String(roomName) + "\"}";
  int code = http.POST(payload);

  if (code > 0)
  {
    String response = http.getString();
    Serial.print("[API] Code: ");
    Serial.print(code);
    Serial.print("  Body: ");
    Serial.println(response);

    if (code == 200)
    {
      Serial.println("[API] Access granted.");
      openDoor();
    }
    else
    {
      Serial.println("[API] Access denied.");
    }
    http.end();
    return true;
  }

  Serial.print("[API] POST failed. Code: ");
  Serial.println(code);
  http.end();
  return false;
}

// =====================
// Offline Fallback: เช็ค whitelist ใน RAM
// =====================
void handleOfflineFallback(const String &uuid)
{
  Serial.println("[OFFLINE] Server unreachable — checking RAM whitelist...");

  if (adminWhitelistCount == 0)
  {
    Serial.println("[OFFLINE] Whitelist empty — access denied.");
    Serial.println("[OFFLINE] Will retry loading whitelist soon.");
    return;
  }

  if (isAdminUUID(uuid))
  {
    Serial.println("[OFFLINE] Admin matched — opening door.");
    openDoor();
  }
  else
  {
    Serial.println("[OFFLINE] Not in whitelist — access denied.");
  }
}

// =====================
// Poll door command จาก server (open/close จาก web)
// =====================
void checkDoorCommand()
{
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(apiIPAddress) + "/api/door/command?room=" + String(roomName);
  http.begin(url);
  http.setTimeout(2000);
  int code = http.GET();

  if (code == 200)
  {
    String payload = http.getString();
    if (payload.indexOf("\"command\": \"open\"") != -1)
    {
      Serial.println("[CMD] Web command: OPEN");
      openDoor();
    }
    else if (payload.indexOf("\"command\": \"close\"") != -1)
    {
      Serial.println("[CMD] Web command: CLOSE");
      digitalWrite(RELAY_PIN, DOOR_CLOSE);
    }
  }
  http.end();
}

// =====================
// Setup — ทำงานครั้งเดียวตอนบอร์ดมีไฟ / reset
// =====================
void setup()
{
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, DOOR_CLOSE);

  // ต่อ WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected — IP: " + WiFi.localIP().toString());

  // Init RFID
  SPI.begin();
  mfrc522.PCD_Init();

  // โหลด whitelist ครั้งแรกทันที
  Serial.println("[WHITELIST] Initial load from server...");
  bool ok = loadWhitelistFromServer();
  if (!ok)
    Serial.println("[WHITELIST] Initial load failed — will retry in 30s via loop()");

  // ตั้ง timer ให้ refresh ครั้งถัดไปใน 5 นาที
  lastWhitelistRefresh = millis();

  Serial.println("=================================");
  Serial.println("System ready. Scan RFID card...");
  Serial.print("RAM whitelist entries: ");
  Serial.println(adminWhitelistCount);
  Serial.println("=================================");
}

// =====================
// Loop — วนซ้ำตลอดเวลา
// =====================
void loop()
{
  unsigned long now = millis();

  // --- 1. Poll door command จาก web ทุก 1 วิ ---
  if (now - lastPoll >= pollInterval)
  {
    lastPoll = now;
    checkDoorCommand();
  }

  // --- 2. Refresh whitelist ---
  //   กรณี A: โหลดสำเร็จแล้ว → refresh ทุก 5 นาที (ดึง admin เพิ่มใหม่)
  //   กรณี B: ยังโหลดไม่ได้   → retry ทุก 30 วิ (server อาจยังไม่พร้อม)
  unsigned long refreshInterval = (adminWhitelistCount > 0)
                                    ? whitelistRefreshInterval
                                    : whitelistRetryInterval;

  if (now - lastWhitelistRefresh >= refreshInterval)
  {
    Serial.println("[WHITELIST] Refreshing...");
    bool ok = loadWhitelistFromServer();
    if (ok) Serial.println("[WHITELIST] Refresh OK");
    else    Serial.println("[WHITELIST] Refresh failed — will retry");
    lastWhitelistRefresh = now;
  }

  // --- 3. รับบัตร RFID ---
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial())
    return;

  String uuid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    if (mfrc522.uid.uidByte[i] < 0x10) uuid += "0";
    uuid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uuid.toUpperCase();

  Serial.print("\nScanned UUID: ");
  Serial.println(uuid);

  bool serverReached = sendUUIDToAPI(uuid);
  if (!serverReached)
    handleOfflineFallback(uuid);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
  delay(3000);
}