# 내 표정에 반응하는 AI 무드등과 웹 디지털 트윈

공업고 학생이 아두이노 센서, 웹 대시보드, 표정 분류 AI, 디지털 트윈을 단계적으로 결합하는 프로젝트입니다.

## 최종 결과

- 키트 센서값을 웹 대시보드에 실시간 표시
- 웹 화면과 실제 네오픽셀 무드등을 양방향으로 제어
- 웹캠 표정을 브라우저에서 분류해 조명색에 반영
- 실제 장치 상태와 화면 속 가상 장치를 동기화

## 실습 단계

| 단계 | 학생이 만드는 결과 | 저장 위치 |
|---|---|---|
| 01 | 프로젝트 이해와 완성 모습 | [`lessons/01_project_overview`](lessons/01_project_overview) |
| 02 | 키트 조립 및 부품 점검 | [`arduino/02_component_test`](arduino/02_component_test) |
| 03 | 센서별 기본 실습 | [`arduino/03_sensor_basics`](arduino/03_sensor_basics) |
| 04 | 모듈형 아두이노 코드 | [`arduino/04_modular_controller`](arduino/04_modular_controller) |
| 05 | 아두이노와 웹 연결 | [`arduino/05_web_serial`](arduino/05_web_serial), [`web/05_web_serial`](web/05_web_serial) |
| 06 | 실시간 센서 대시보드 | [`web/06_dashboard`](web/06_dashboard) |
| 07 | 웹에서 무드등 제어 | [`web/07_light_control`](web/07_light_control) |
| 08 | 웹캠과 AI 표정 분류 | [`web/08_expression_ai`](web/08_expression_ai) |
| 09 | AI 자동 조명과 디지털 트윈 | [`web/09_digital_twin`](web/09_digital_twin) |
| 10 | 통합 테스트와 전시 준비 | [`final/10_exhibition`](final/10_exhibition) |

## 기본 핀 배치

| 부품 | 핀 |
|---|---|
| 가변저항 | A0 |
| 조도센서 | A5 |
| 터치센서 | D13 |
| 초음파 TRIG | D2 |
| 초음파 ECHO | D3 |
| 네오픽셀 8구 | D7 |

## 코드 작성 규칙

- `loop()`에는 기능 함수 호출만 배치합니다.
- 학생이 수정할 값은 코드 위쪽의 설정 영역에 모읍니다.
- 센서 읽기, 출력, 통신 기능은 각각 `void 함수`로 분리합니다.
- 한글 주석은 함수 역할과 학생이 수정할 값에만 사용합니다.
- 여러 기능이 동시에 동작하도록 긴 `delay()` 사용을 피합니다.

## 현재 진행 상태

- 1단계 프로젝트 이해 자료: 초안 완성
- 2단계 키트 점검 자료와 Arduino 코드: 초안 완성
- 3~10단계: 수업 골격 생성, 단계별 개발 예정

학생용 설명은 [`lessons`](lessons)에서, 실행 코드는 `arduino`, `web`, `final` 폴더에서 확인합니다.
