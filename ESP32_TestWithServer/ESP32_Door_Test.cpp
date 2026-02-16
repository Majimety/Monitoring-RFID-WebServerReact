#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define SS_PIN 5
#define RST_PIN 21
#define RELAY_PIN 26
#define DOOR_OPEN HIGH
#define DOOR_CLOSE LOW

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char *ssid = "ADF";
const char *password = "ADF12345";
const char *apiIPAddress = "http://10.33.184.16:5000";
const char *roomName = "4101";  // ชื่อห้องของ ESP32 ตัวนี้
unsigned long lastPoll = 0;
const unsigned long pollInterval = 1000;

// ฟังก์ชันเปิดประตู
void openDoor()
{
  digitalWrite(RELAY_PIN, DOOR_OPEN);
  delay(1000);
  digitalWrite(RELAY_PIN, DOOR_CLOSE);
}

// ส่ง UUID ไป API แล้วเช็ค response
void sendUUIDToAPI(const String &uuid)
{
  HTTPClient http;
  String url = String(apiIPAddress) + "/api/send_uuid";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"uuid\":\"" + uuid + "\"}";
  int httpResponseCode = http.POST(payload);

  if (httpResponseCode > 0)
  {
    String response = http.getString();
    Serial.print("Server Response: ");
    Serial.println(response);

    // ตรวจสอบ status
    if (response.indexOf("\"status\":\"ok\"") != -1)
    {
      Serial.println("UUID recognized. Opening door...");
      openDoor();
    }
    else
    {
      Serial.println("UUID not recognized. Door remains closed.");
    }
  }
  else
  {
    Serial.print("HTTP POST failed. Code: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}

void checkDoorCommand()
{
  HTTPClient http;
  String url = String(apiIPAddress) + "/api/door/command?room=" + String(roomName);
  http.begin(url);
  int code = http.GET();

  if (code == 200)
  {
    String payload = http.getString();

    if (payload.indexOf("\"command\":\"open\"") != -1)
    {
      Serial.println("Web command: OPEN");
      openDoor();
    }
    else if (payload.indexOf("\"command\":\"close\"") != -1)
    {
      Serial.println("Web command: CLOSE");
      digitalWrite(RELAY_PIN, DOOR_CLOSE);
    }
  }
  http.end();
}

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
  Serial.println("Scan your RFID card...");
}

void loop()
{
  if (millis() - lastPoll > pollInterval)
  {
    lastPoll = millis();
    checkDoorCommand();
  }
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial())
    return;

  String uuid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    if (mfrc522.uid.uidByte[i] < 0x10)
      uuid += "0";
    uuid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uuid.toUpperCase();

  Serial.print("Scanned UUID: ");
  Serial.println(uuid);

  sendUUIDToAPI(uuid);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(3000); // ป้องกันอ่านซ้ำ
}