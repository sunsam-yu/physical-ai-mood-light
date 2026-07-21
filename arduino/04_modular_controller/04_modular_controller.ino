#include <Adafruit_NeoPixel.h>

// ===== 학생이 확인하거나 바꿀 설정 =====
const int POT_PIN = A0;
const int LIGHT_PIN = A5;
const int TOUCH_PIN = 13;
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;
const int LED_PIN = 7;
const int LED_COUNT = 8;

const bool TOUCH_ACTIVE_HIGH = true;
const int MAX_LED_BRIGHTNESS = 80;
const unsigned long TOUCH_DEBOUNCE_MS = 50;
const unsigned long DISTANCE_INTERVAL_MS = 100;
const unsigned long PRINT_INTERVAL_MS = 200;
const unsigned long ECHO_TIMEOUT_US = 25000UL;

Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

const uint8_t COLORS[][3] = {
  {0, 80, 255},
  {255, 120, 0},
  {170, 60, 255},
  {0, 200, 100}
};
const int COLOR_COUNT = sizeof(COLORS) / sizeof(COLORS[0]);

int potValue = 0;
int lightValue = 0;
bool rawTouchDetected = false;
bool lastRawTouchDetected = false;
bool stableTouchDetected = false;
bool touchPressedEvent = false;
float distanceCm = -1.0;

int colorIndex = 0;
int targetBrightness = 0;
int appliedBrightness = -1;
int appliedColorIndex = -1;

unsigned long lastTouchChangeMs = 0;
unsigned long lastDistanceMs = 0;
unsigned long lastPrintMs = 0;

void setup() {
  Serial.begin(115200);
  setupPins();
  setupNeoPixel();
  initializeTouchState();
}

void loop() {
  readPotentiometer();
  readLightSensor();
  readTouchSensor();
  readDistanceSensor();
  updateColorFromTouch();
  decideLightOutput();
  updateNeoPixel();
  printSystemState();
}

void setupPins() {
  pinMode(TOUCH_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);
}

void setupNeoPixel() {
  pixels.begin();
  pixels.clear();
  pixels.show();
}

void initializeTouchState() {
  bool pinHigh = digitalRead(TOUCH_PIN) == HIGH;
  rawTouchDetected = TOUCH_ACTIVE_HIGH ? pinHigh : !pinHigh;
  lastRawTouchDetected = rawTouchDetected;
  stableTouchDetected = rawTouchDetected;
}

void readPotentiometer() {
  potValue = analogRead(POT_PIN);
}

void readLightSensor() {
  lightValue = analogRead(LIGHT_PIN);
}

// 짧은 신호 흔들림을 제거하고 한 번 누른 순간만 이벤트로 저장합니다.
void readTouchSensor() {
  bool pinHigh = digitalRead(TOUCH_PIN) == HIGH;
  rawTouchDetected = TOUCH_ACTIVE_HIGH ? pinHigh : !pinHigh;

  if (rawTouchDetected != lastRawTouchDetected) {
    lastRawTouchDetected = rawTouchDetected;
    lastTouchChangeMs = millis();
  }

  if (millis() - lastTouchChangeMs < TOUCH_DEBOUNCE_MS) return;
  if (rawTouchDetected == stableTouchDetected) return;

  stableTouchDetected = rawTouchDetected;
  if (stableTouchDetected) touchPressedEvent = true;
}

void readDistanceSensor() {
  unsigned long now = millis();
  if (now - lastDistanceMs < DISTANCE_INTERVAL_MS) return;
  lastDistanceMs = now;

  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  distanceCm = durationUs == 0 ? -1.0 : durationUs * 0.0343 / 2.0;
}

void updateColorFromTouch() {
  if (!touchPressedEvent) return;
  touchPressedEvent = false;
  colorIndex = (colorIndex + 1) % COLOR_COUNT;
}

// 실제 키트 보정 전에는 가변저항만 밝기 결정에 사용합니다.
void decideLightOutput() {
  targetBrightness = map(potValue, 0, 1023, 0, MAX_LED_BRIGHTNESS);
}

// 밝기나 색이 달라졌을 때만 네오픽셀에 새 값을 보냅니다.
void updateNeoPixel() {
  if (targetBrightness == appliedBrightness && colorIndex == appliedColorIndex) return;

  appliedBrightness = targetBrightness;
  appliedColorIndex = colorIndex;

  pixels.setBrightness(appliedBrightness);
  pixels.fill(pixels.Color(
      COLORS[colorIndex][0],
      COLORS[colorIndex][1],
      COLORS[colorIndex][2]));
  pixels.show();
}

void printSystemState() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  Serial.print(F("가변저항: "));
  Serial.print(potValue);
  Serial.print(F(" | 조도: "));
  Serial.print(lightValue);
  Serial.print(F(" | 터치: "));
  Serial.print(stableTouchDetected ? F("감지") : F("없음"));
  Serial.print(F(" | 거리(cm): "));

  if (distanceCm < 0) {
    Serial.print(F("측정 실패"));
  } else {
    Serial.print(distanceCm, 1);
  }

  Serial.print(F(" | 밝기: "));
  Serial.print(targetBrightness);
  Serial.print(F(" | 색 번호: "));
  Serial.println(colorIndex);
}
