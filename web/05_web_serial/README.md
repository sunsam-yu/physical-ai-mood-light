# 5단계 웹 코드

Chrome 또는 Edge에서 Arduino UNO와 USB 시리얼 통신을 확인하는 웹 예제입니다. 키트가 없을 때는 가상 센서 모드로 같은 화면을 시험할 수 있습니다.

## 코드 선택

- [`starter/index.html`](starter/index.html): 연결과 원문 수신만 구현된 학생용 시작 코드
- [`index.html`](index.html): JSON 해석, 센서 카드, PING, 가상 센서까지 구현된 완성 코드

## 실행 방법

Web Serial은 보안 연결에서만 작동합니다. 다음 중 하나로 실행합니다.

1. GitHub Pages의 `https://` 주소를 Chrome 또는 Edge에서 엽니다.
2. VS Code Live Server 같은 로컬 서버로 엽니다.
3. 이 폴더에서 `python3 -m http.server 8000`을 실행하고 `http://localhost:8000`을 엽니다.

파일을 더블 클릭해 `file://` 주소로 열면 연결 버튼이 작동하지 않을 수 있습니다.

## 실제 Arduino 연결

1. Arduino에 [`02_complete/02_complete.ino`](../../arduino/05_web_serial/02_complete/02_complete.ino)를 업로드합니다.
2. Arduino IDE의 시리얼 모니터를 닫습니다.
3. 웹에서 `Arduino 연결`을 누르고 Arduino UNO의 포트를 선택합니다.
4. 센서 카드가 바뀌는지 확인합니다.
5. `PING 보내기`를 눌러 `pong` 응답을 확인합니다.

한 포트는 한 프로그램만 사용할 수 있으므로 웹에 연결하기 전에 시리얼 모니터를 반드시 닫습니다.

## 키트 없이 확인

`가상 센서 시작`을 누르면 200 ms마다 예제 JSON이 생성됩니다. 실제 Arduino에서 받은 데이터와 똑같은 처리 함수를 사용하므로 다음 기능을 먼저 확인할 수 있습니다.

- JSON 한 줄 해석
- 센서 카드 갱신
- 거리 측정 실패(`null`) 표시
- 최근 수신 원문 표시

가상 센서는 UI 개발용이며 실제 핀, 센서값 방향, 통신 상태를 검증하지는 않습니다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 화면 구조 |
| `styles.css` | 화면 디자인과 반응형 배치 |
| `app.js` | Web Serial, JSON 해석, 가상 센서 |
| `starter/` | 학생이 기능을 추가할 시작 코드 |

## 자주 생기는 오류

| 현상 | 확인할 내용 |
|---|---|
| 연결 버튼이 비활성화됨 | Chrome·Edge인지, `https://` 또는 `localhost`인지 확인 |
| 포트를 열 수 없음 | Arduino IDE 시리얼 모니터와 다른 웹페이지를 닫기 |
| 글자는 들어오지만 카드가 안 바뀜 | Arduino 코드가 JSON 한 줄 뒤에 줄바꿈을 보내는지 확인 |
| `JSON 형식 오류` 표시 | 시리얼에 설명 문장이나 잘린 데이터가 섞였는지 확인 |
| 연결 직후 잠깐 값이 없음 | 포트를 열 때 Arduino가 재시작될 수 있으므로 1~2초 기다리기 |
