import {
  DEMO_SAMPLES,
  FEATURES,
  KnnClassifier,
  LABELS,
  PredictionStabilizer,
  blendshapesToFeatures
} from "./classifier.mjs";

const MEDIAPIPE_VERSION = "0.10.35";
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const classifier = new KnnClassifier(5);
const stabilizer = new PredictionStabilizer(7, 0.6);
const featureElements = new Map();
const simulationInputs = new Map();
let faceLandmarker = null;
let stream = null;
let cameraRunning = false;
let simulationMode = false;
let classifying = false;
let currentFeatures = Object.fromEntries(FEATURES.map(({ key }) => [key, 0]));
let lastVideoTime = -1;

const elements = {
  modelStatus: document.querySelector("#modelStatus"),
  loadModelButton: document.querySelector("#loadModelButton"),
  cameraButton: document.querySelector("#cameraButton"),
  simulationButton: document.querySelector("#simulationButton"),
  message: document.querySelector("#message"),
  webcam: document.querySelector("#webcam"),
  cameraPlaceholder: document.querySelector("#cameraPlaceholder"),
  inputMode: document.querySelector("#inputMode"),
  featureBars: document.querySelector("#featureBars"),
  classifyButton: document.querySelector("#classifyButton"),
  clearSamplesButton: document.querySelector("#clearSamplesButton"),
  predictionIcon: document.querySelector("#predictionIcon"),
  predictionLabel: document.querySelector("#predictionLabel"),
  confidenceValue: document.querySelector("#confidenceValue"),
  rawPrediction: document.querySelector("#rawPrediction"),
  stablePrediction: document.querySelector("#stablePrediction"),
  totalSamples: document.querySelector("#totalSamples"),
  trainingCards: document.querySelector("#trainingCards"),
  simulationPanel: document.querySelector("#simulationPanel"),
  simulationSliders: document.querySelector("#simulationSliders"),
  loadDemoSamplesButton: document.querySelector("#loadDemoSamplesButton")
};

buildFeatureBars();
buildTrainingCards();
buildSimulationSliders();
updateFeatureDisplay();
updateSampleDisplay();

elements.loadModelButton.addEventListener("click", loadModel);
elements.cameraButton.addEventListener("click", toggleCamera);
elements.simulationButton.addEventListener("click", enableSimulationMode);
elements.classifyButton.addEventListener("click", toggleClassification);
elements.clearSamplesButton.addEventListener("click", clearSamples);
elements.loadDemoSamplesButton.addEventListener("click", loadDemoSamples);

async function loadModel() {
  setMessage("MediaPipe 모듈과 얼굴 특징 모델을 불러오는 중입니다…");
  setModelStatus("loading", "모델 불러오는 중");
  elements.loadModelButton.disabled = true;
  try {
    const vision = await import(VISION_URL);
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const options = {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    };
    try {
      faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, options);
    } catch (gpuError) {
      console.warn("GPU delegate를 사용할 수 없어 CPU로 다시 준비합니다.", gpuError);
      options.baseOptions.delegate = "CPU";
      faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, options);
    }
    elements.cameraButton.disabled = false;
    setModelStatus("ready", "모델 준비 완료");
    setMessage("웹캠을 시작하고 각 표정의 특징값을 학습시키세요.");
  } catch (error) {
    console.error(error);
    elements.loadModelButton.disabled = false;
    setModelStatus("error", "모델 준비 실패");
    setMessage("모델을 불러오지 못했습니다. 인터넷 연결을 확인하거나 가상 특징 모드를 사용하세요.");
  }
}

async function toggleCamera() {
  if (cameraRunning) {
    stopCamera();
    return;
  }
  if (!faceLandmarker) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    setMessage("이 브라우저에서는 웹캠을 사용할 수 없습니다. HTTPS 또는 localhost에서 다시 실행하세요.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
    elements.webcam.srcObject = stream;
    await elements.webcam.play();
    cameraRunning = true;
    simulationMode = false;
    elements.simulationPanel.hidden = true;
    elements.cameraPlaceholder.hidden = true;
    elements.cameraButton.textContent = "웹캠 중지";
    elements.inputMode.textContent = "웹캠";
    setMessage("얼굴이 화면 중앙에 오도록 맞추세요.");
    requestAnimationFrame(predictWebcamFrame);
  } catch (error) {
    console.error(error);
    setMessage("웹캠 권한이 거부되었거나 다른 프로그램이 카메라를 사용 중입니다.");
  }
}

function stopCamera() {
  cameraRunning = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  elements.webcam.srcObject = null;
  elements.cameraPlaceholder.hidden = false;
  elements.cameraButton.textContent = "웹캠 시작";
  elements.inputMode.textContent = "입력 없음";
}

function predictWebcamFrame() {
  if (!cameraRunning || !faceLandmarker) return;
  if (elements.webcam.currentTime !== lastVideoTime) {
    const result = faceLandmarker.detectForVideo(elements.webcam, performance.now());
    lastVideoTime = elements.webcam.currentTime;
    const categories = result.faceBlendshapes?.[0]?.categories;
    if (categories?.length) {
      currentFeatures = blendshapesToFeatures(categories);
      updateFeatureDisplay();
      if (classifying) showPrediction();
    }
  }
  requestAnimationFrame(predictWebcamFrame);
}

function enableSimulationMode() {
  stopCamera();
  simulationMode = true;
  elements.simulationPanel.hidden = false;
  elements.inputMode.textContent = "가상 특징";
  elements.cameraPlaceholder.hidden = false;
  elements.cameraPlaceholder.textContent = "아래 슬라이더로 얼굴 특징값을 가상으로 입력하고 분류 과정을 확인합니다.";
  syncSimulationInputs();
  setMessage("가상 특징값을 바꾸거나 예시 학습 데이터를 불러오세요.");
}

function buildFeatureBars() {
  FEATURES.forEach(({ key, label }) => {
    const row = document.createElement("div");
    row.className = "feature-row";
    row.innerHTML = `<span>${label}</span><span class="bar"><span></span></span><output>0.00</output>`;
    featureElements.set(key, { fill: row.querySelector(".bar span"), output: row.querySelector("output") });
    elements.featureBars.append(row);
  });
}

function buildTrainingCards() {
  LABELS.forEach(({ id, name, icon }) => {
    const card = document.createElement("article");
    card.className = "training-card";
    card.innerHTML = `<span class="emoji" aria-hidden="true">${icon}</span><h3>${name}</h3><p><span data-count="${id}">0</span>개 샘플</p><button data-train="${id}">3초 학습</button>`;
    card.querySelector("button").addEventListener("click", () => collectSamples(id));
    elements.trainingCards.append(card);
  });
}

function buildSimulationSliders() {
  FEATURES.forEach(({ key, label }) => {
    const row = document.createElement("label");
    row.className = "slider-control";
    row.innerHTML = `<span>${label}</span><input type="range" min="0" max="1" step="0.01" value="0"><output>0.00</output>`;
    const input = row.querySelector("input");
    const output = row.querySelector("output");
    simulationInputs.set(key, { input, output });
    input.addEventListener("input", () => {
      currentFeatures[key] = Number(input.value);
      output.value = Number(input.value).toFixed(2);
      updateFeatureDisplay();
      if (classifying) showPrediction();
    });
    elements.simulationSliders.append(row);
  });
}

async function collectSamples(label) {
  if (!cameraRunning && !simulationMode) {
    setMessage("웹캠 또는 가상 특징 모드를 먼저 시작하세요.");
    return;
  }
  const buttons = [...elements.trainingCards.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  for (let seconds = 3; seconds > 0; seconds -= 1) {
    setMessage(`${labelName(label)} 학습: ${seconds}초 동안 표정을 유지하세요.`);
    for (let sample = 0; sample < 5; sample += 1) {
      classifier.addSample(label, currentFeatures);
      await wait(200);
    }
  }
  buttons.forEach((button) => { button.disabled = false; });
  updateSampleDisplay();
  setMessage(`${labelName(label)} 샘플 15개를 추가했습니다.`);
}

function loadDemoSamples() {
  Object.entries(DEMO_SAMPLES).forEach(([label, samples]) => {
    for (let repeat = 0; repeat < 8; repeat += 1) classifier.addSamples(label, samples);
  });
  updateSampleDisplay();
  setMessage("네 범주의 예시 특징 데이터를 불러왔습니다. 슬라이더를 움직이며 분류해 보세요.");
}

function toggleClassification() {
  classifying = !classifying;
  stabilizer.clear();
  elements.classifyButton.textContent = classifying ? "분류 멈춤" : "분류 시작";
  if (classifying) showPrediction();
}

function showPrediction() {
  const result = classifier.predict(currentFeatures);
  if (!result) return;
  const stableLabel = stabilizer.push(result.label);
  const raw = LABELS.find(({ id }) => id === result.label);
  const stable = LABELS.find(({ id }) => id === stableLabel);
  elements.rawPrediction.textContent = raw?.name || "-";
  elements.stablePrediction.textContent = stable?.name || "확인 중";
  elements.predictionIcon.textContent = stable?.icon || "…";
  elements.predictionLabel.textContent = stable?.name || "최근 결과 확인 중";
  elements.confidenceValue.textContent = `${Math.round(result.confidence * 100)}%`;
}

function clearSamples() {
  classifier.clear();
  stabilizer.clear();
  classifying = false;
  elements.classifyButton.textContent = "분류 시작";
  elements.predictionIcon.textContent = "?";
  elements.predictionLabel.textContent = "학습 전";
  elements.confidenceValue.textContent = "0%";
  elements.rawPrediction.textContent = "-";
  elements.stablePrediction.textContent = "-";
  updateSampleDisplay();
  setMessage("학습 특징값을 모두 지웠습니다. 영상이나 사진은 저장된 적이 없습니다.");
}

function updateFeatureDisplay() {
  FEATURES.forEach(({ key }) => {
    const value = Math.max(0, Math.min(1, currentFeatures[key] || 0));
    const parts = featureElements.get(key);
    parts.fill.style.width = `${value * 100}%`;
    parts.output.value = value.toFixed(2);
  });
}

function updateSampleDisplay() {
  let total = 0;
  LABELS.forEach(({ id }) => {
    const count = classifier.count(id);
    total += count;
    document.querySelector(`[data-count="${id}"]`).textContent = count;
  });
  elements.totalSamples.textContent = `${total}개`;
  elements.clearSamplesButton.disabled = total === 0;
  elements.classifyButton.disabled = !classifier.hasEveryLabel();
}

function syncSimulationInputs() {
  FEATURES.forEach(({ key }) => {
    const parts = simulationInputs.get(key);
    parts.input.value = currentFeatures[key];
    parts.output.value = Number(currentFeatures[key]).toFixed(2);
  });
}

function setMessage(message) {
  elements.message.textContent = message;
}

function setModelStatus(state, message) {
  elements.modelStatus.dataset.state = state;
  elements.modelStatus.textContent = message;
}

function labelName(label) {
  return LABELS.find(({ id }) => id === label)?.name || label;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

window.addEventListener("beforeunload", stopCamera);
