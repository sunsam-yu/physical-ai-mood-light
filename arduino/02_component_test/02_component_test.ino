#include <Adafruit_NeoPixel.h>

// Part 2까지의 누적 모범답안: 선언과 초기화 뼈대
const int POT_PIN = A0;
const int LIGHT_PIN = A5;
const int TOUCH_PIN = 13;
const int TRIG_PIN = 2;
const int ECHO_PIN = 3;
const int LED_PIN = 7;
const int LED_COUNT = 8;

Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  setupPins();
  setupNeoPixel();
  showTestColor();
}

void loop() {
  // Part 3부터 센서 입력 함수가 한 줄씩 늘어납니다.
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

void showTestColor() {
  pixels.setBrightness(20);
  pixels.fill(pixels.Color(0, 80, 255));
  pixels.show();
}

