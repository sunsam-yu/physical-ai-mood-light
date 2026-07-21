# 8단계 웹 코드: 웹캠 표정 특징과 AI 분류

MediaPipe Face Landmarker가 얼굴 사진 자체가 아니라 표정 특징값(blendshape)을 만들고, 학생이 모은 특징값을 K-최근접 이웃(KNN)으로 네 범주에 분류하는 예제입니다.

## 실행

GitHub Pages 또는 로컬 웹 서버에서 `index.html`을 엽니다. 웹캠은 보안 연결(HTTPS 또는 localhost)에서만 사용할 수 있습니다.

```bash
python3 -m http.server 8000 --directory web/08_expression_ai
```

Chrome 또는 Edge에서 `http://localhost:8000`을 열고 다음 순서로 실습합니다.

1. `AI 모델 준비`를 누릅니다.
2. `웹캠 시작`을 누르고 카메라 권한을 허용합니다.
3. 미소·중립·놀란 표정·찡그린 표정을 각각 유지하며 `3초 학습`을 누릅니다.
4. 각 범주에 15개 이상의 샘플이 모이면 `분류 시작`을 누릅니다.
5. 예측 범주, 신뢰도, 최근 결과의 안정성을 비교합니다.

웹캠을 사용할 수 없을 때는 `가상 특징 모드`에서 준비된 예시를 불러와 KNN 분류 과정을 먼저 시험할 수 있습니다.

## 파일

- `index.html`: 화면 구조와 개인정보 안내
- `styles.css`: 반응형 화면과 특징 막대
- `classifier.mjs`: 특징 선택, KNN 분류, 최근 결과 안정화
- `app.mjs`: MediaPipe·웹캠·가상 특징 연결
- `tests/classifier.test.mjs`: 분류 로직 자동 검사

## 개인정보 원칙

- 웹캠 영상과 얼굴 사진을 서버에 전송하거나 저장하지 않습니다.
- 학습 샘플은 표정 특징 숫자만 브라우저 메모리에 보관합니다.
- 새로고침하면 학습 샘플이 사라집니다.
- 출력은 실제 감정 판정이 아니라 네 가지 표정 모양의 분류입니다.

## 외부 구성요소

- `@mediapipe/tasks-vision` 0.10.35를 고정 버전으로 불러옵니다.
- Face Landmarker 모델은 Google의 공개 MediaPipe 모델 주소에서 불러옵니다.
- 처음 실행할 때 인터넷 연결이 필요합니다.

## 정적 검사

```bash
node --check app.mjs
node --check classifier.mjs
node --test tests/classifier.test.mjs
```

## 아직 실제 화면에서 확인할 것

- 학교 네트워크에서 CDN과 모델 파일 접근 가능 여부
- 교실 조명과 웹캠 위치에 따른 특징값 변화
- 학생 1명당 필요한 학습 샘플 수
- 신뢰도 기준과 최근 프레임 안정화 개수

