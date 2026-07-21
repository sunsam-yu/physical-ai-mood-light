#include <Adafruit_NeoPixel.h>

// ===== 학생이 확인하거나 바꿀 설정 =====
const int LED_PIN = 7;
const int LED_COUNT = 8;
const int BRIGHTNESS = 50;
const unsigned long COLOR_INTERVAL_MS = 1000;

Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

const uint8_t COLORS[][3] = {
  {255, 0, 0},
  {0, 255, 0},
  {0, 0, 255},
  {255, 120, 0},
  {255, 255, 255}
};

const int COLOR_COUNT = sizeof(COLORS) / sizeof(COLORS[0]);
int colorIndex = 0;
unsigned long lastColorChangeMs = 0;

void setup() {
  Serial.begin(115200);
  pixels.begin();
  pixels.setBrightness(BRIGHTNESS);
  showCurrentColor();
}

void loop() {
  changeColorAtInterval();
}

// 일정한 시간마다 다음 RGB 색으로 바꿉니다.
void changeColorAtInterval() {
  unsigned long now = millis();
  if (now - lastColorChangeMs < COLOR_INTERVAL_MS) return;
  lastColorChangeMs = now;

  colorIndex = (colorIndex + 1) % COLOR_COUNT;
  showCurrentColor();
}

void showCurrentColor() {
  int red = COLORS[colorIndex][0];
  int green = COLORS[colorIndex][1];
  int blue = COLORS[colorIndex][2];

  pixels.fill(pixels.Color(red, green, blue));
  pixels.show();

  Serial.print("RGB: ");
  Serial.print(red);
  Serial.print(", ");
  Serial.print(green);
  Serial.print(", ");
  Serial.println(blue);
}
