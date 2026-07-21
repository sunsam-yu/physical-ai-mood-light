// ===== 학생이 확인하거나 바꿀 설정 =====
const int POT_PIN = A0;
const unsigned long PRINT_INTERVAL_MS = 200;

unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
}

void loop() {
  printPotentiometerValue();
}

// 가변저항의 위치를 0~1023 범위로 읽어 출력합니다.
void printPotentiometerValue() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  int potValue = analogRead(POT_PIN);
  int percent = map(potValue, 0, 1023, 0, 100);

  Serial.print("가변저항: ");
  Serial.print(potValue);
  Serial.print(" | 비율(%): ");
  Serial.println(percent);
}
