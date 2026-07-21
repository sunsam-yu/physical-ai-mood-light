#include <Adafruit_NeoPixel.h>

// Part 3까지의 누적 모범답안: Part 2 뼈대 + 센서 입력 함수
const int POT_PIN = A0;
const int LIGHT_PIN = A5;
const int TOUCH_PIN = 13;
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;
const int LED_PIN = 7;
const int LED_COUNT = 8;

const unsigned long PRINT_INTERVAL_MS = 200;
const unsigned long ECHO_TIMEOUT_US = 25000UL;

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
  printSensorValues();
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

  unsigned long durationUs = pulseIn(ECHO_PIN, HIGH, ECHO_TIMEOUT_US);
  distanceCm = durationUs == 0 ? -1.0 : durationUs * 0.0343 / 2.0;
}

void printSensorValues() {
  unsigned long now = millis();
  if (now - lastPrintMs < PRINT_INTERVAL_MS) return;
  lastPrintMs = now;

  Serial.print(F("pot="));
  Serial.print(potValue);
  Serial.print(F(" | light="));
  Serial.print(lightValue);
  Serial.print(F(" | touch="));
  Serial.print(touchDetected ? F("HIGH") : F("LOW"));
  Serial.print(F(" | distance="));
  if (distanceCm < 0) Serial.println(F("failed"));
  else Serial.println(distanceCm, 1);
}

