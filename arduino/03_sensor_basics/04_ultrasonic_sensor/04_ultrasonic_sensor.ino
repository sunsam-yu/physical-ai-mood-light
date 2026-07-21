// ===== 학생이 확인하거나 바꿀 설정 =====
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;
const unsigned long ECHO_TIMEOUT_US = 25000UL;
const unsigned long PRINT_INTERVAL_MS = 200;

unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
}

void loop() {
  printDistance();
}

// 초음파의 왕복 시간을 이용해 거리를 계산합니다.
float measureDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  if (durationUs == 0) return -1.0;

  return durationUs * 0.0343 / 2.0;
}

void printDistance() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  float distanceCm = measureDistanceCm();

  Serial.print("거리(cm): ");
  if (distanceCm < 0) {
    Serial.println("측정 실패");
  } else {
    Serial.println(distanceCm, 1);
  }
}
