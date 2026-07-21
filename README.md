# 내 표정에 반응하는 AI 무드등과 웹 디지털 트윈

공업고 학생이 아두이노 센서, 웹 대시보드, 표정 분류 AI, 디지털 트윈을 단계적으로 결합하는 프로젝트입니다.

학생은 Part마다 다른 완성 코드를 실행하지 않습니다. Part 2에서 만든 Arduino 파일과 Part 5에서 만든 웹 파일을 계속 수정하며, 함수와 화면 요소가 하나씩 늘어나는 과정을 직접 경험합니다. 각 Part의 GitHub 링크는 활동 뒤 자신의 코드와 비교하는 누적 모범답안·기능 참고 자료입니다.

## 최종 결과

- 키트 센서값을 웹 대시보드에 실시간 표시
- 웹 화면과 실제 네오픽셀 무드등을 양방향으로 제어
- 웹캠 표정을 브라우저에서 분류해 조명색에 반영
- 실제 장치 상태와 화면 속 가상 장치를 동기화

## 실습 단계

학생 배포용 전체 목차와 Part 4~10 차시 구성은 [`lessons/README.md`](lessons/README.md)에서 확인합니다.

| 단계 | 학생이 만드는 결과 | 저장 위치 |
|---|---|---|
| 01 | 프로젝트 이해와 완성 모습 | [`lessons/01_project_overview`](lessons/01_project_overview) |
| 02 | 코드 뼈대와 부품 초기화 | [`arduino/02_component_test`](arduino/02_component_test) |
| 03 | 센서 입력 함수 누적 | [`arduino/03_sensor_basics`](arduino/03_sensor_basics) |
| 04 | 모듈형 아두이노 코드 | [`arduino/04_modular_controller`](arduino/04_modular_controller) |
| 05 | 아두이노와 웹 연결 | [`arduino/05_web_serial`](arduino/05_web_serial), [`web/05_web_serial`](web/05_web_serial) |
| 06 | 실시간 센서 대시보드 | [`web/06_dashboard`](web/06_dashboard) |
| 07 | 웹에서 무드등 제어 | [`arduino/07_light_control`](arduino/07_light_control), [`web/07_light_control`](web/07_light_control) |
| 08 | 웹캠과 AI 표정 분류 | [`web/08_expression_ai`](web/08_expression_ai) |
| 09 | AI 자동 조명과 디지털 트윈 | [`web/09_digital_twin`](web/09_digital_twin) |
| 10 | 실제 센서·AI·조명 최종 통합과 전시 준비 | [`arduino/10_final_integration`](arduino/10_final_integration), [`final/10_exhibition`](final/10_exhibition) |

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

| 단계 | 코드·수업자료 | 실제 키트 검증 |
|---:|---|---|
| 01 | 프로젝트 이해 자료 완성 | 해당 없음 |
| 02 | 선언·초기화 누적 모범답안과 자료 완성 | 통과 |
| 03 | 센서 입력 누적 모범답안·독립 참고 예제 완성 | 통과 |
| 04 | 모듈형 통합 코드와 매뉴얼 완성 | 통과 |
| 05 | Web Serial 코드·매뉴얼 완성 | 통과 |
| 06 | 실시간 대시보드·파서 테스트 완성 | 통과 |
| 07 | 웹 제어·Arduino 명령 수신·매뉴얼 완성 | 통과 |
| 08 | AI 특징 분류·분류기 테스트·매뉴얼 완성 | 통과(입꼬리 내려감 특징은 개인차 확인) |
| 09 | 자동 조명 정책·디지털 트윈·경계값 테스트 완성 | 통과 |
| 10 | 최종 Arduino·웹 통합 실행본과 전시 자료 완성 | 통과 |

실물 확인 결과 조도센서는 밝을 때 약 15, 가렸을 때 약 850으로 값이 클수록 어둡고, 터치센서는 접촉 중 HIGH입니다. 가변저항은 0~1023, 초음파센서는 10cm·30cm 구간에서 실제 거리와 대략 일치했습니다.

최종 통합본은 센서 4종 수신, 웹캠 표정 분류, AUTO/MANUAL 전환, 네오픽셀 제어, 자동 조명 판단, 실제 조명과 디지털 트윈 동기화까지 실물 검증을 통과했습니다.

학생용 설명은 [`lessons`](lessons)에서, 실행 코드는 `arduino`, `web`, `final` 폴더에서 확인합니다.

키트를 연결할 때는 [`HARDWARE_TEST.md`](HARDWARE_TEST.md)의 순서와 기록표를 사용합니다.
