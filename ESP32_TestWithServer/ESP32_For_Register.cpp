#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>

#define SS_PIN 5
#define RST_PIN 21

MFRC522 mfrc522(SS_PIN, RST_PIN);

const char *ssid = "ADF";
const char *password = "ADF12345";
const char *apiIPAddress = "http://10.123.96.16:5000"; // แก้ไขทุครั้งที่เทส

void sendUUIDToAPI(const String &uuid)
{
  HTTPClient http;
  String url = String(apiIPAddress) + "/api/send_uuid";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"uuid\": \"" + uuid + "\"}";
  int httpResponseCode = http.POST(payload);
  Serial.print("RFID READ: ");
  Serial.println(payload);

  if (httpResponseCode > 0)
  {
    String response = http.getString();
    Serial.print("API response: ");
    Serial.println(response);
  }
  else
  {
    Serial.print("HTTP POST failed. Code: ");
    Serial.println(httpResponseCode);
  }
  http.end();
}

void setup()
{
  Serial.begin(115200);

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected.");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  // Init SPI RFID
  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("Scan your RFID card...");
}

void loop()
{
  if (!mfrc522.PICC_IsNewCardPresent() ||
      !mfrc522.PICC_ReadCardSerial())
    return;

  String uuid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    uuid.concat(String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : ""));
    uuid.concat(String(mfrc522.uid.uidByte[i], HEX));
  }
  uuid.toUpperCase();

  Serial.print("Scanned UID: ");
  Serial.println(uuid);

  // ส่ง UUID ไป API เพื่อ register
  sendUUIDToAPI(uuid);

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(2000); // ป้องกันอ่านซ้ำ
}
