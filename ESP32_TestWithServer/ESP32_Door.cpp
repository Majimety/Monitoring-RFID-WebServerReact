#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define SS_PIN 5
#define RST_PIN 21
#define RELAY_PIN 26
#define DOOR_OPEN LOW
#define DOOR_CLOSE HIGH

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char *ssid = "ADF";
const char *password = "ADF12345";
const char *apiIPAddress = "http://10.53.39.157:5000"; // แก้ไขทุกครั้งที่เทส
const char *roomName = "EN4101";                       // ชื่อห้องของ ESP32 ตัวนี้

unsigned long lastPoll = 0;
const unsigned long pollInterval = 1000;

// =====================
// Admin Whitelist (Offline Fallback)
// อัปเดตให้ตรงกับ admins.csv เสมอ
// =====================
const char *adminUUIDs[] = {
    "54F2427E", // Chatchai Khunboa
    "631FBF15", // Admin
    "XXXXXXXX", // เพิ่ม admin ใหม่ตรงนี้
};
const int adminCount = sizeof(adminUUIDs) / sizeof(adminUUIDs[0]);

// ตรวจสอบว่า UUID นี้เป็น admin หรือไม่
bool isAdminUUID(const String &uuid)
{
  for (int i = 0; i < adminCount; i++)
  {
    if (uuid.equalsIgnoreCase(adminUUIDs[i]))
    {
      return true;
    }
  }
  return false;
}

// =====================
// Door Control
// =====================
void openDoor()
{
  Serial.println(">>> Opening door...");
  digitalWrite(RELAY_PIN, DOOR_OPEN);
  delay(5000); // เปิดค้างไว้ 5 วินาที
  digitalWrite(RELAY_PIN, DOOR_CLOSE);
  Serial.println(">>> Door closed.");
}

// =====================
// Online Mode: ส่ง UUID ไป API
// คืนค่า true = server ตอบกลับแล้ว (ไม่ว่าจะ ok หรือ denied)
//            false = ติดต่อ server ไม่ได้ (ให้ใช้ fallback)
// =====================
bool sendUUIDToAPI(const String &uuid)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[API] WiFi not connected — switching to offline mode.");
    return false;
  }

  HTTPClient http;
  String url = String(apiIPAddress) + "/api/send_uuid";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000); // timeout 3 วิ ไม่รอนาน

  String payload = "{\"uuid\":\"" + uuid + "\"}";
  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0)
  {
    String response = http.getString();
    Serial.print("[API] Response code: ");
    Serial.println(httpResponseCode);
    Serial.print("[API] Body: ");
    Serial.println(response);

    if (httpResponseCode == 200)
    {
      Serial.println("[API] Access granted by server.");
      openDoor();
    }
    else
    {
      Serial.println("[API] Access denied by server.");
    }

    http.end();
    return true; // server ตอบแล้ว ไม่ต้องใช้ fallback
  }

  Serial.print("[API] HTTP POST failed. Code: ");
  Serial.println(httpResponseCode);
  http.end();
  return false; // server ตอบไม่ได้ → ใช้ fallback
}

// =====================
// Offline Fallback: เช็ค admin whitelist
// =====================
void handleOfflineFallback(const String &uuid)
{
  Serial.println("[OFFLINE] Server unreachable — checking admin whitelist...");

  if (isAdminUUID(uuid))
  {
    Serial.println("[OFFLINE] Admin UUID matched. Opening door.");
    openDoor();
  }
  else
  {
    Serial.println("[OFFLINE] UUID not in admin whitelist. Access denied.");
  }
}

// =====================
// Poll door command จาก server (open/close จาก web)
// =====================
void checkDoorCommand()
{
  if (WiFi.status() != WL_CONNECTED)
    return;

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
// Setup
// =====================
void setup()
{
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, DOOR_CLOSE); // เริ่มต้นล็อกประตู

  // เชื่อม WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Init RFID
  SPI.begin();
  mfrc522.PCD_Init();

  Serial.println("=================================");
  Serial.println("System ready. Scan RFID card...");
  Serial.print("Admin whitelist loaded: ");
  Serial.print(adminCount);
  Serial.println(" entries");
  Serial.println("=================================");
}

// =====================
// Loop
// =====================
void loop()
{
  // Poll door command จาก web ทุก 1 วิ
  if (millis() - lastPoll > pollInterval)
  {
    lastPoll = millis();
    checkDoorCommand();
  }

  // ตรวจสอบการ์ด RFID
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial())
    return;

  // อ่าน UUID
  String uuid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    if (mfrc522.uid.uidByte[i] < 0x10)
      uuid += "0";
    uuid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uuid.toUpperCase();

  Serial.print("\nScanned UUID: ");
  Serial.println(uuid);

  // ลอง API ก่อน ถ้าไม่ได้ค่อย fallback
  bool serverReached = sendUUIDToAPI(uuid);
  if (!serverReached)
  {
    handleOfflineFallback(uuid);
  }

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(3000); // ป้องกันอ่านซ้ำ
}