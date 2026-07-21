// ===== 학생이 확인하거나 바꿀 설정 =====
const int TOUCH_PIN = 13;
const unsigned long PRINT_INTERVAL_MS = 100;

unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TOUCH_PIN, INPUT);
}

void loop() {
  printTouchState();
}

// 디지털 입력을 읽어 터치 여부를 출력합니다.
void printTouchState() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  bool touched = digitalRead(TOUCH_PIN) == HIGH;

  Serial.print("터치센서: ");
  Serial.println(touched ? "감지" : "없음");
}
