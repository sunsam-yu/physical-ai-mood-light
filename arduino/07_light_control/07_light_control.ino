#include <Adafruit_NeoPixel.h>

// ===== 학생이 확인하거나 바꿀 설정 =====
const int LED_PIN = 7;
const int LED_COUNT = 8;
const int MAX_LED_BRIGHTNESS = 80;

Adafruit_NeoPixel pixels(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

char commandBuffer[64];
uint8_t commandLength = 0;
bool commandOverflow = false;

int currentR = 59;
int currentG = 130;
int currentB = 246;
int currentBrightness = 40;
bool autoMode = false;

void setup() {
  Serial.begin(115200);
  pixels.begin();
  applyLight();
  sendLightState();
}

void loop() {
  readWebCommand();
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
  if (strcmp(command, "PING") == 0) {
    Serial.println(F("{\"type\":\"status\",\"message\":\"pong\"}"));
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

  // 모든 필드가 정상일 때만 상태를 한 번에 바꿉니다.
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
