// ===== 학생이 확인하거나 바꿀 설정 =====
const int LIGHT_PIN = A5;
const unsigned long PRINT_INTERVAL_MS = 200;

unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  printLightValue();
}

// 조도센서의 값을 출력합니다. 밝을 때 값의 방향은 실측으로 확인합니다.
void printLightValue() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  int lightValue = analogRead(LIGHT_PIN);

  Serial.print("조도센서: ");
  Serial.println(lightValue);
}
