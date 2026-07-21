# 5단계 Arduino 코드

Arduino UNO가 센서값을 한 줄씩 웹에 보내고, 웹이 보낸 명령을 한 줄씩 읽는 예제입니다.

## 코드 선택

- [`01_start/01_start.ino`](01_start/01_start.ino): 가변저항값 하나를 JSON Lines로 보내며 통신 형식을 익히는 시작 코드
- [`02_complete/02_complete.ino`](02_complete/02_complete.ino): 센서 4종과 조명 상태를 보내고 `PING`, `GET` 명령을 처리하는 완성 코드

먼저 시작 코드로 웹 연결을 확인한 다음 완성 코드를 업로드합니다. 두 코드 모두 시리얼 속도는 `115200 baud`입니다.

## 데이터 형식

Arduino에서 웹으로 보내는 한 줄은 다음과 같습니다.

```json
{"type":"sensor","pot":512,"light":640,"touch":false,"distance":31.4,"brightness":40,"color":1}
```

초음파센서가 거리를 읽지 못하면 `distance`는 `null`입니다. 각 JSON 뒤에는 줄바꿈 문자(`\n`)가 붙습니다. 웹은 줄바꿈을 기준으로 한 데이터씩 나눠 읽습니다.

웹에서 Arduino로 보내는 명령도 줄바꿈으로 끝납니다.

| 명령 | Arduino의 응답 |
|---|---|
| `PING` | `{"type":"status","message":"pong"}` |
| `GET` | 현재 센서값 한 줄 |
| 그 밖의 문자열 | `{"type":"error","message":"unknown_command"}` |

조명 색과 밝기를 웹에서 바꾸는 명령은 7단계에서 추가합니다. 5단계에서는 통신 연결과 데이터 구분에 집중합니다.

## 안정적으로 통신하기 위한 규칙

- JSON 객체 하나를 반드시 한 줄에 보냅니다.
- `Serial.print()`의 설명 문장과 JSON을 섞지 않습니다.
- 웹에서 보낸 명령은 31글자까지만 저장합니다.
- 센서 데이터는 `200 ms`마다 보내 과도한 통신을 피합니다.
- ArduinoJson 라이브러리 없이 출력해 UNO의 메모리 사용량을 줄입니다.

## 키트 확인 후 보정할 값

- `TOUCH_ACTIVE_HIGH`: 터치할 때 센서 출력이 HIGH인지 확인
- `MAX_LED_BRIGHTNESS`: 네오픽셀의 적정 최대 밝기
- 조도센서값의 증가 방향과 초음파센서 오차
