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
const unsigned long SEND_INTERVAL_MS = 200;
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
unsigned long lastSendMs = 0;

char commandBuffer[32];
uint8_t commandLength = 0;
bool commandOverflow = false;

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
  readWebCommand();
  sendSensorDataAtInterval();
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

void decideLightOutput() {
  targetBrightness = map(potValue, 0, 1023, 0, MAX_LED_BRIGHTNESS);
}

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

// 웹 명령 한 줄을 읽어 PING 또는 GET을 처리합니다.
void readWebCommand() {
  while (Serial.available() > 0) {
    char received = Serial.read();

    if (received == '\r') continue;

    if (received == '\n') {
      finishWebCommand();
      continue;
    }

    if (commandLength < sizeof(commandBuffer) - 1) {
      commandBuffer[commandLength++] = received;
    } else {
      commandOverflow = true;
    }
  }
}

void finishWebCommand() {
  if (commandOverflow) {
    Serial.println(F("{\"type\":\"error\",\"message\":\"command_too_long\"}"));
  } else {
    commandBuffer[commandLength] = '\0';
    handleWebCommand(commandBuffer);
  }

  commandLength = 0;
  commandOverflow = false;
}

void handleWebCommand(const char* command) {
  if (command[0] == '\0') return;

  if (strcmp(command, "PING") == 0) {
    Serial.println(F("{\"type\":\"status\",\"message\":\"pong\"}"));
  } else if (strcmp(command, "GET") == 0) {
    sendSensorData();
  } else {
    Serial.println(F("{\"type\":\"error\",\"message\":\"unknown_command\"}"));
  }
}

void sendSensorDataAtInterval() {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) return;
  lastSendMs = now;
  sendSensorData();
}

// JSON 객체 하나를 줄바꿈으로 끝내 웹이 한 데이터씩 나눠 읽게 합니다.
void sendSensorData() {
  Serial.print(F("{\"type\":\"sensor\",\"pot\":"));
  Serial.print(potValue);
  Serial.print(F(",\"light\":"));
  Serial.print(lightValue);
  Serial.print(F(",\"touch\":"));
  Serial.print(stableTouchDetected ? F("true") : F("false"));
  Serial.print(F(",\"distance\":"));

  if (distanceCm < 0) {
    Serial.print(F("null"));
  } else {
    Serial.print(distanceCm, 1);
  }

  Serial.print(F(",\"brightness\":"));
  Serial.print(targetBrightness);
  Serial.print(F(",\"color\":"));
  Serial.print(colorIndex);
  Serial.println(F("}"));
}

