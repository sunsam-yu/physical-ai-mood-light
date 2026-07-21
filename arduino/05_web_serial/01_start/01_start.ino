// ===== 학생이 확인하거나 바꿀 설정 =====
const int POT_PIN = A0;
const unsigned long SEND_INTERVAL_MS = 200;

unsigned long lastSendMs = 0;
char commandBuffer[32];
uint8_t commandLength = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  readWebCommand();
  sendPotentiometerData();
}

void readWebCommand() {
  while (Serial.available() > 0) {
    char received = Serial.read();

    if (received == '\r') continue;

    if (received == '\n') {
      commandBuffer[commandLength] = '\0';
      if (strcmp(commandBuffer, "PING") == 0) {
        Serial.println(F("{\"type\":\"status\",\"message\":\"pong\"}"));
      }
      commandLength = 0;
      continue;
    }

    if (commandLength < sizeof(commandBuffer) - 1) {
      commandBuffer[commandLength++] = received;
    }
  }
}

void sendPotentiometerData() {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) return;
  lastSendMs = now;

  Serial.print(F("{\"type\":\"sensor\",\"pot\":"));
  Serial.print(analogRead(POT_PIN));
  Serial.println(F("}"));
}

