#include <Adafruit_NeoPixel.h>

// ===== 학생이 확인하거나 바꿀 설정 =====
const int POT_PIN = A0;
const int LIGHT_PIN = A5;
const int TOUCH_PIN = 13;
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;
const int LED_PIN = 7;
const int LED_COUNT = 8;

const unsigned long PRINT_INTERVAL_MS = 200;

Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

int potValue = 0;
int lightValue = 0;
bool touchDetected = false;
float distanceCm = -1.0;
unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
  setupPins();
  setupNeoPixel();
}

void loop() {
  readPotentiometer();
  readLightSensor();
  readTouchSensor();
  readDistanceSensor();
  updateTestLight();
  printSensorValues();
}

// 핀의 입력·출력 상태를 준비합니다.
void setupPins() {
  pinMode(TOUCH_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
}

// 네오픽셀을 준비하고 모든 LED를 끕니다.
void setupNeoPixel() {
  pixels.begin();
  pixels.clear();
  pixels.show();
}

void readPotentiometer() {
  potValue = analogRead(POT_PIN);
}

void readLightSensor() {
  lightValue = analogRead(LIGHT_PIN);
}

void readTouchSensor() {
  touchDetected = digitalRead(TOUCH_PIN) == HIGH;
}

void readDistanceSensor() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 25000UL);
  distanceCm = duration == 0 ? -1.0 : duration * 0.0343 / 2.0;
}

// 가변저항은 밝기, 터치는 색상 변화에 사용합니다.
void updateTestLight() {
  int brightness = map(potValue, 0, 1023, 0, 80);
  pixels.setBrightness(brightness);

  uint32_t color = touchDetected
      ? pixels.Color(255, 120, 0)
      : pixels.Color(0, 80, 255);

  pixels.fill(color);
  pixels.show();
}

// 0.2초마다 센서값을 한 줄로 출력합니다.
void printSensorValues() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  Serial.print("가변저항: ");
  Serial.print(potValue);
  Serial.print(" | 조도: ");
  Serial.print(lightValue);
  Serial.print(" | 터치: ");
  Serial.print(touchDetected ? "감지" : "없음");
  Serial.print(" | 거리(cm): ");

  if (distanceCm < 0) {
    Serial.println("측정 실패");
  } else {
    Serial.println(distanceCm, 1);
  }
}

