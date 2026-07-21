#include <Adafruit_NeoPixel.h>

// ===== 실물 키트에서 확정한 설정 =====
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

int potValue = 0;
int lightValue = 0;
bool rawTouchDetected = false;
bool lastRawTouchDetected = false;
bool stableTouchDetected = false;
float distanceCm = -1.0;

int currentR = 0;
int currentG = 0;
int currentB = 0;
int currentBrightness = 0;
bool autoMode = false;

unsigned long lastTouchChangeMs = 0;
unsigned long lastDistanceMs = 0;
unsigned long lastSendMs = 0;

char commandBuffer[64];
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
  stableTouchDetected = rawTouchDetected;
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

void readWebCommand() {
  while (Serial.available() > 0) {
    char received = Serial.read();
    if (received == '\r') continue;

    if (received == '\n') {
      finishWebCommand();
    } else if (commandLength < sizeof(commandBuffer) - 1) {
      commandBuffer[commandLength++] = received;
    } else {
      commandOverflow = true;
    }
  }
}

void finishWebCommand() {
  if (commandOverflow) {
    sendError("command_too_long");
  } else {
    commandBuffer[commandLength] = '\0';
    handleWebCommand(commandBuffer);
  }
  commandLength = 0;
  commandOverflow = false;
}

void handleWebCommand(char* command) {
  if (command[0] == '\0') return;

  if (strcmp(command, "PING") == 0) {
    Serial.println(F("{\"type\":\"status\",\"message\":\"pong\"}"));
    return;
  }
  if (strcmp(command, "GET") == 0) {
    sendSensorData();
    return;
  }
  if (strcmp(command, "GET_LIGHT") == 0) {
    sendLightState();
    return;
  }

  char copy[64];
  strncpy(copy, command, sizeof(copy));
  copy[sizeof(copy) - 1] = '\0';

  char* fields[6];
  int fieldCount = splitCsv(copy, fields, 6);
  if (fieldCount != 6 || strcmp(fields[0], "LIGHT") != 0) {
    sendError("invalid_format");
    return;
  }

  long r, g, b, brightness;
  if (!parseInteger(fields[1], r) || !parseInteger(fields[2], g) ||
      !parseInteger(fields[3], b) || !parseInteger(fields[4], brightness)) {
    sendError("not_integer");
    return;
  }
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 ||
      brightness < 0 || brightness > MAX_LED_BRIGHTNESS) {
    sendError("out_of_range");
    return;
  }
  if (strcmp(fields[5], "MANUAL") != 0 && strcmp(fields[5], "AUTO") != 0) {
    sendError("invalid_mode");
    return;
  }

  currentR = (int)r;
  currentG = (int)g;
  currentB = (int)b;
  currentBrightness = (int)brightness;
  autoMode = strcmp(fields[5], "AUTO") == 0;
  applyLight();
  sendLightState();
}

int splitCsv(char* text, char* fields[], int maxFields) {
  int count = 0;
  char* token = strtok(text, ",");
  while (token != NULL && count < maxFields) {
    fields[count++] = token;
    token = strtok(NULL, ",");
  }
  if (token != NULL) return maxFields + 1;
  return count;
}

bool parseInteger(const char* text, long& value) {
  if (text == NULL || text[0] == '\0') return false;
  char* endPointer;
  value = strtol(text, &endPointer, 10);
  return *endPointer == '\0';
}

void applyLight() {
  pixels.setBrightness(currentBrightness);
  pixels.fill(pixels.Color(currentR, currentG, currentB));
  pixels.show();
}

void sendSensorDataAtInterval() {
  unsigned long now = millis();
  if (now - lastSendMs < SEND_INTERVAL_MS) return;
  lastSendMs = now;
  sendSensorData();
}

void sendSensorData() {
  Serial.print(F("{\"type\":\"sensor\",\"pot\":"));
  Serial.print(potValue);
  Serial.print(F(",\"light\":"));
  Serial.print(lightValue);
  Serial.print(F(",\"touch\":"));
  Serial.print(stableTouchDetected ? F("true") : F("false"));
  Serial.print(F(",\"distance\":"));
  if (distanceCm < 0) Serial.print(F("null"));
  else Serial.print(distanceCm, 1);
  Serial.print(F(",\"brightness\":"));
  Serial.print(currentBrightness);
  Serial.print(F(",\"mode\":\""));
  Serial.print(autoMode ? F("AUTO") : F("MANUAL"));
  Serial.println(F("\"}"));
}

void sendLightState() {
  Serial.print(F("{\"type\":\"light_state\",\"r\":"));
  Serial.print(currentR);
  Serial.print(F(",\"g\":"));
  Serial.print(currentG);
  Serial.print(F(",\"b\":"));
  Serial.print(currentB);
  Serial.print(F(",\"brightness\":"));
  Serial.print(currentBrightness);
  Serial.print(F(",\"mode\":\""));
  Serial.print(autoMode ? F("AUTO") : F("MANUAL"));
  Serial.println(F("\"}"));
}

void sendError(const char* message) {
  Serial.print(F("{\"type\":\"error\",\"message\":\""));
  Serial.print(message);
  Serial.println(F("\"}"));
}
