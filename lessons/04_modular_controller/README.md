# 4단계. 기능을 함수로 나눈 모듈형 코드

[이전 단계: 센서별 기본 실습](../03_sensor_basics/README.md) · [프로젝트 전체 보기](../../README.md) · [다음 단계: 아두이노와 웹 연결](../05_web_serial/README.md)

## 이번 단계에서 만들 것

3단계에서 따로 실행한 센서와 네오픽셀을 하나의 프로그램으로 합칩니다. 센서 읽기, 상태 결정, LED 출력, 시리얼 출력을 각각 함수로 나누어 기능을 찾고 수정하기 쉬운 구조로 만듭니다.

## 학습목표

- 여러 부품의 코드를 하나의 프로그램으로 통합할 수 있다.
- `setup()`, `loop()`, 기능 함수의 역할을 구분할 수 있다.
- `delay()`를 줄이고 `millis()`로 실행 주기를 관리하는 이유를 설명할 수 있다.
- 입력값, 결정값, 출력값을 구분해 프로그램 흐름을 설명할 수 있다.

## 핵심 질문

프로그램의 기능을 함수로 나누면 무엇이 쉬워질까?

## 완성 결과

- 가변저항을 돌리면 네오픽셀 밝기가 바뀝니다.
- 터치센서를 누를 때마다 네오픽셀 색이 바뀝니다.
- 조도와 초음파 거리는 계속 측정되어 시리얼 모니터에 표시됩니다.
- 조도와 거리의 자동 조명 기준은 실제 측정값을 확인한 뒤 추가합니다.

## 코드의 전체 흐름

`loop()`에는 다음 함수 호출만 순서대로 놓습니다.

```cpp
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
```

| 구분 | 함수 | 역할 |
|---|---|---|
| 입력 | `readPotentiometer()` | 가변저항값 읽기 |
| 입력 | `readLightSensor()` | 조도값 읽기 |
| 입력 | `readTouchSensor()` | 흔들림을 제거한 터치 상태 읽기 |
| 입력 | `readDistanceSensor()` | 초음파 왕복 시간으로 거리 계산 |
| 결정 | `updateColorFromTouch()` | 터치 이벤트가 있으면 다음 색 선택 |
| 결정 | `decideLightOutput()` | 가변저항값으로 목표 밝기 결정 |
| 출력 | `updateNeoPixel()` | 결정된 색과 밝기를 실제 LED에 적용 |
| 확인 | `printSystemState()` | 입력·결정·출력 상태를 한 줄로 표시 |

## 왜 긴 `delay()`를 사용하지 않을까?

`delay(1000)`을 실행하면 아두이노는 1초 동안 다른 일을 하지 못합니다. 그러면 터치를 놓치거나 웹 통신이 끊기는 것처럼 보일 수 있습니다. 이 코드에서는 `millis()`로 시간이 지났는지만 확인해 여러 기능이 번갈아 빠르게 실행되도록 합니다.

초음파센서의 `delayMicroseconds()`는 신호 한 번을 만들기 위한 몇 마이크로초의 짧은 대기이므로 그대로 사용합니다.

## 실행 순서

1. [`04_modular_controller.ino`](../../arduino/04_modular_controller/04_modular_controller.ino)를 엽니다.
2. `Adafruit NeoPixel` 라이브러리를 설치했는지 확인합니다.
3. Arduino Uno와 포트를 선택해 업로드합니다.
4. 시리얼 모니터를 `115200 baud`로 엽니다.
5. 가변저항, 터치, 조도, 거리를 하나씩 바꾸며 전체 상태를 확인합니다.

## 학생이 수정할 부분

처음에는 코드 위쪽의 설정만 수정합니다.

| 설정 | 의미 | 처음 권장값 |
|---|---|---:|
| `TOUCH_ACTIVE_HIGH` | 터치할 때 HIGH가 되는 센서인지 여부 | `true` |
| `MAX_LED_BRIGHTNESS` | USB 전원에서 사용할 최대 밝기 | `80` |
| `TOUCH_DEBOUNCE_MS` | 터치 신호 흔들림 제거 시간 | `50` |
| `DISTANCE_INTERVAL_MS` | 거리 측정 간격 | `100` |
| `PRINT_INTERVAL_MS` | 시리얼 출력 간격 | `200` |

`COLORS` 표의 RGB 값을 바꾸면 터치할 때 순환하는 색을 바꿀 수 있습니다.

## 정상 작동 확인표

- [ ] 시리얼 모니터에 네 종류 입력값이 한 줄로 표시된다.
- [ ] 가변저항을 돌리면 `밝기`와 실제 LED 밝기가 함께 변한다.
- [ ] 터치 한 번마다 `색 번호`가 한 단계만 증가한다.
- [ ] 손을 계속 대고 있어도 색이 빠르게 반복 변경되지 않는다.
- [ ] 조도와 거리값이 바뀌어도 다른 센서 입력이 멈추지 않는다.

## 오류를 찾는 순서

1. 시리얼 모니터에서 해당 입력값이 변하는지 확인합니다.
2. 입력값은 변하지만 LED가 바뀌지 않으면 `결정 함수`를 확인합니다.
3. 결정값은 변하지만 실제 LED가 바뀌지 않으면 `updateNeoPixel()`과 결선을 확인합니다.
4. 터치가 반대로 표시되면 `TOUCH_ACTIVE_HIGH`를 `false`로 바꿉니다.

이 순서는 문제를 입력, 결정, 출력 중 한 부분으로 좁혀 줍니다.

## 아직 적용하지 않은 자동 기능

조도센서의 변화 방향과 실제 실내 범위, 초음파센서의 안정적인 접근 거리를 아직 측정하지 않았습니다. 따라서 이 단계에서는 두 값을 출력만 하고 조명 결정에는 사용하지 않습니다. 키트 확인 후 다음을 추가합니다.

- 조도가 어두울수록 조명을 밝게 보정하는 규칙
- 사람이 일정 거리 안에 있을 때만 자동 모드를 실행하는 규칙
- 경계값 부근에서 켜짐과 꺼짐이 반복되지 않도록 하는 여유 구간

## 도전과제

1. `COLORS` 배열에 원하는 RGB 색을 하나 추가합니다.
2. 시리얼 출력 주기를 바꾸고 센서 조작감이 달라지는지 비교합니다.
3. 함수 하나를 주석 처리해 그 기능만 멈추는지 확인한 뒤 다시 복원합니다.

## GitHub 자료

- [4단계 Arduino 완성 코드](https://github.com/sunsam-yu/physical-ai-mood-light/blob/main/arduino/04_modular_controller/04_modular_controller.ino)
- [4단계 학습자료](https://github.com/sunsam-yu/physical-ai-mood-light/tree/main/lessons/04_modular_controller)

## 다음 단계

5단계에서는 사람이 읽는 한글 상태 문장 대신 웹이 해석하기 쉬운 데이터 형식으로 센서값을 전송합니다. 브라우저의 연결 버튼을 눌러 Arduino Uno의 직렬 포트를 선택하고, 수신된 값을 웹 화면에 표시합니다.
