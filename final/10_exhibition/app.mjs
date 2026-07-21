import {
  DEMO_SAMPLES,
  FEATURES,
  KnnClassifier,
  LABELS,
  PredictionStabilizer,
  blendshapesToFeatures
} from "../../web/08_expression_ai/classifier.mjs";
import { commandLine, decideAutomaticLight } from "../../web/09_digital_twin/policy.mjs";
import {
  commandSignature,
  nextModeFromTouch,
  parseDeviceLine,
  serializeLightCommand,
  shouldSendAutomaticCommand
} from "./integration-core.mjs";

const MEDIAPIPE_VERSION = "0.10.35";
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/+esm`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const BAUD_RATE = 115200;
const SENSOR_STALE_MS = 1600;
const FACE_STALE_MS = 1200;
const MAX_HISTORY = 60;

const $ = (selector) => document.querySelector(selector);
const elements = {
  serialStatus: $("#serialStatus"),
  modelStatus: $("#modelStatus"),
  connectButton: $("#connectButton"),
  disconnectButton: $("#disconnectButton"),
  pingButton: $("#pingButton"),
  loadModelButton: $("#loadModelButton"),
  cameraButton: $("#cameraButton"),
  systemMessage: $("#systemMessage"),
  packetStatus: $("#packetStatus"),
  faceStatus: $("#faceStatus"),
  webcam: $("#webcam"),
  cameraPlaceholder: $("#cameraPlaceholder"),
  featureBars: $("#featureBars"),
  trainingGrid: $("#trainingGrid"),
  classifyButton: $("#classifyButton"),
  demoSamplesButton: $("#demoSamplesButton"),
  clearSamplesButton: $("#clearSamplesButton"),
  predictionIcon: $("#predictionIcon"),
  predictionLabel: $("#predictionLabel"),
  confidenceValue: $("#confidenceValue"),
  rawPrediction: $("#rawPrediction"),
  sampleCount: $("#sampleCount"),
  modeInputs: [...document.querySelectorAll('input[name="mode"]')],
  modeBadge: $("#modeBadge"),
  manualControls: $("#manualControls"),
  autoControls: $("#autoControls"),
  manualColor: $("#manualColor"),
  manualBrightness: $("#manualBrightness"),
  manualBrightnessOut: $("#manualBrightnessOut"),
  sendManualButton: $("#sendManualButton"),
  decisionReason: $("#decisionReason"),
  decisionCommand: $("#decisionCommand"),
  pixelRing: $("#pixelRing"),
  twinMode: $("#twinMode"),
  twinBrightness: $("#twinBrightness"),
  actualRgb: $("#actualRgb"),
  actualBrightness: $("#actualBrightness"),
  actualMode: $("#actualMode"),
  lastAck: $("#lastAck"),
  ackStatus: $("#ackStatus"),
  clearLogButton: $("#clearLogButton"),
  eventLog: $("#eventLog")
};

const sensorElements = {
  pot: { value: $("#potValue"), chart: $("#potChart"), max: 1023, color: "#6da8ff" },
  light: { value: $("#lightValue"), chart: $("#lightChart"), max: 1023, color: "#ffd166" },
  touch: { value: $("#touchValue"), chart: $("#touchChart"), max: 1, color: "#ff82b7" },
  distance: { value: $("#distanceValue"), chart: $("#distanceChart"), max: 250, color: "#60e6a8" }
};

const classifier = new KnnClassifier(5);
const stabilizer = new PredictionStabilizer(7, 0.6, 3);
const featureElements = new Map();

const state = {
  port: null,
  reader: null,
  readTask: null,
  keepReading: false,
  serialBuffer: "",
  writeChain: Promise.resolve(),
  connected: false,
  sensor: { pot: undefined, light: undefined, touch: undefined, distance: undefined },
  history: { pot: [], light: [], touch: [], distance: [] },
  packetCount: 0,
  lastSensorAt: 0,
  previousTouch: null,
  mode: "MANUAL",
  actualLight: { r: 0, g: 0, b: 0, brightness: 0, mode: "MANUAL" },
  lastAutoSignature: null,
  faceLandmarker: null,
  stream: null,
  cameraRunning: false,
  classifying: false,
  currentFeatures: Object.fromEntries(FEATURES.map(({ key }) => [key, 0])),
  lastVideoTime: -1,
  lastFaceAt: 0,
  stablePrediction: { label: null, confidence: 0 },
  logCount: 1
};

buildFeatureBars();
buildTrainingCards();
buildPixelRing();
bindEvents();
renderSensorValues();
renderActualLight();
renderMode();
updateSampleDisplay();
window.setInterval(updateHealth, 500);

function bindEvents() {
  elements.connectButton.addEventListener("click", connectArduino);
  elements.disconnectButton.addEventListener("click", () => disconnectArduino(true));
  elements.pingButton.addEventListener("click", () => { void enqueueWrite("PING\n", "PING").catch(() => {}); });
  elements.loadModelButton.addEventListener("click", loadModel);
  elements.cameraButton.addEventListener("click", toggleCamera);
  elements.classifyButton.addEventListener("click", toggleClassification);
  elements.demoSamplesButton.addEventListener("click", loadDemoSamples);
  elements.clearSamplesButton.addEventListener("click", clearSamples);
  elements.modeInputs.forEach((input) => input.addEventListener("change", () => {
    if (input.checked) void setMode(input.value, "화면");
  }));
  elements.manualBrightness.addEventListener("input", () => {
    elements.manualBrightnessOut.value = elements.manualBrightness.value;
  });
  elements.sendManualButton.addEventListener("click", sendManualLight);
  elements.clearLogButton.addEventListener("click", () => {
    elements.eventLog.innerHTML = "";
    state.logCount = 0;
    addLog("동작 기록을 지웠습니다.");
  });
  navigator.serial?.addEventListener("disconnect", handleSerialDisconnect);
  window.addEventListener("resize", drawAllCharts);
  window.addEventListener("beforeunload", () => {
    stopCamera();
    if (state.connected) void disconnectArduino(false);
  });
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
    card.innerHTML = `<span class="emoji">${icon}</span><div><strong>${name}</strong><small><span data-count="${id}">0</span>개</small></div><button data-train="${id}">3초 학습</button>`;
    card.querySelector("button").addEventListener("click", () => collectSamples(id));
    elements.trainingGrid.append(card);
  });
}

function buildPixelRing() {
  for (let index = 0; index < 8; index += 1) {
    const pixel = document.createElement("span");
    pixel.className = "pixel";
    pixel.style.setProperty("--angle", `${index * 45}deg`);
    pixel.setAttribute("aria-hidden", "true");
    elements.pixelRing.append(pixel);
  }
}

async function connectArduino() {
  if (state.connected) return;
  if (!("serial" in navigator)) {
    setSystemMessage("이 브라우저는 Web Serial을 지원하지 않습니다. Chrome 또는 Edge의 localhost에서 여세요.", true);
    return;
  }

  setSerialStatus("loading", "Arduino 연결 중");
  elements.connectButton.disabled = true;
  try {
    state.port = await navigator.serial.requestPort();
    await state.port.open({ baudRate: BAUD_RATE });
    state.connected = true;
    state.keepReading = true;
    state.serialBuffer = "";
    state.readTask = readSerialLoop();
    renderConnectionControls();
    setSerialStatus("ready", "Arduino 연결됨");
    setSystemMessage("Arduino가 연결되었습니다. 센서 JSON을 기다리는 중입니다.");
    addLog("Arduino USB를 115200 baud로 연결했습니다.");
  } catch (error) {
    console.error(error);
    state.port = null;
    state.connected = false;
    renderConnectionControls();
    setSerialStatus("error", "Arduino 연결 실패");
    setSystemMessage(`Arduino 연결 실패: ${error.message}`, true);
  }
}

async function disconnectArduino(userRequested) {
  if (!state.port) return;
  state.keepReading = false;
  try {
    await state.reader?.cancel();
  } catch (_) {
    // 이미 분리된 포트는 취소할 읽기 작업이 없습니다.
  }
  try {
    await state.readTask;
    await state.writeChain.catch(() => {});
    if (state.port.readable || state.port.writable) await state.port.close();
  } catch (error) {
    if (userRequested) console.warn(error);
  } finally {
    state.port = null;
    state.reader = null;
    state.readTask = null;
    state.connected = false;
    state.lastAutoSignature = null;
    renderConnectionControls();
    setSerialStatus("idle", "Arduino 연결 안 됨");
    setSystemMessage(userRequested ? "Arduino 연결을 해제했습니다." : "Arduino 연결이 끊겼습니다.", !userRequested);
    addLog(userRequested ? "Arduino 연결을 해제했습니다." : "Arduino USB 연결이 예기치 않게 끊겼습니다.");
  }
}

function handleSerialDisconnect(event) {
  if (event.port !== state.port && event.target !== state.port) return;
  void disconnectArduino(false);
}

async function readSerialLoop() {
  const decoder = new TextDecoder();
  state.reader = state.port.readable.getReader();
  try {
    while (state.keepReading) {
      const { value, done } = await state.reader.read();
      if (done) break;
      state.serialBuffer += decoder.decode(value, { stream: true });
      const lines = state.serialBuffer.split(/\r?\n/);
      state.serialBuffer = lines.pop() || "";
      lines.forEach((line) => {
        if (line.trim()) handleDeviceLine(line);
      });
    }
  } catch (error) {
    if (state.keepReading) {
      console.error(error);
      setSystemMessage(`수신 오류: ${error.message}`, true);
    }
  } finally {
    try {
      state.reader.releaseLock();
    } catch (_) {
      // 포트가 먼저 분리되었을 수 있습니다.
    }
    state.reader = null;
  }
}

function handleDeviceLine(line) {
  const parsed = parseDeviceLine(line);
  if (!parsed.ok) {
    setSystemMessage(`${parsed.error} · ${String(line).slice(0, 80)}`, true);
    addLog(`수신 데이터 오류: ${parsed.error}`);
    return;
  }

  const message = parsed.message;
  if (message.type === "sensor") receiveSensor(message);
  else if (message.type === "light_state") receiveLightState(message);
  else if (message.type === "status") {
    setSystemMessage(`Arduino 응답: ${message.message || "상태 확인"}`);
    addLog(`Arduino 상태 응답: ${message.message || "확인"}`);
  } else if (message.type === "error") {
    setSystemMessage(`Arduino 오류: ${message.message || "알 수 없음"}`, true);
    addLog(`Arduino가 명령 오류를 보냈습니다: ${message.message || "알 수 없음"}`);
  }
}

function receiveSensor(message) {
  const nextMode = nextModeFromTouch(state.previousTouch, message.touch, state.mode);
  state.previousTouch = message.touch;
  state.sensor = { pot: message.pot, light: message.light, touch: message.touch, distance: message.distance };
  Object.entries(state.sensor).forEach(([key, value]) => {
    state.history[key].push(key === "touch" ? Number(value) : value);
    if (state.history[key].length > MAX_HISTORY) state.history[key].shift();
  });
  state.packetCount += 1;
  state.lastSensorAt = Date.now();
  renderSensorValues();
  drawAllCharts();
  elements.packetStatus.textContent = `${state.packetCount.toLocaleString("ko-KR")}개 수신`;

  if (nextMode !== state.mode) {
    void setMode(nextMode, "터치센서");
  } else {
    void evaluateAutomaticLight();
  }
}

function receiveLightState(message) {
  state.actualLight = {
    r: message.r,
    g: message.g,
    b: message.b,
    brightness: message.brightness,
    mode: message.mode
  };
  renderActualLight();
  elements.ackStatus.textContent = "실제 적용 확인";
  elements.lastAck.textContent = new Date().toLocaleTimeString("ko-KR", { hour12: false });
}

function enqueueWrite(payload, label) {
  if (!state.connected || !state.port?.writable) {
    const error = new Error("Arduino가 연결되어 있지 않습니다.");
    setSystemMessage(error.message, true);
    return Promise.reject(error);
  }

  state.writeChain = state.writeChain.catch(() => {}).then(async () => {
    const writer = state.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(payload));
      if (label) addLog(`${label} 전송: ${payload.trim()}`);
    } finally {
      writer.releaseLock();
    }
  });
  return state.writeChain.catch((error) => {
    setSystemMessage(`명령 전송 실패: ${error.message}`, true);
    throw error;
  });
}

function sendLightCommand(command, label) {
  return enqueueWrite(serializeLightCommand(command), label);
}

async function setMode(mode, source) {
  if (!["AUTO", "MANUAL"].includes(mode) || state.mode === mode) return;
  state.mode = mode;
  state.lastAutoSignature = null;
  renderMode();
  addLog(`${source}에서 ${mode} 모드로 전환했습니다.`);

  if (!state.connected) {
    void evaluateAutomaticLight();
    return;
  }

  try {
    if (mode === "MANUAL") {
      await sendManualLight();
      await evaluateAutomaticLight();
    } else {
      await sendLightCommand({ ...state.actualLight, mode: "AUTO" }, "AUTO 제어권 전환");
      await evaluateAutomaticLight();
    }
  } catch (_) {
    state.lastAutoSignature = null;
  }
}

async function sendManualLight() {
  const rgb = hexToRgb(elements.manualColor.value);
  const command = { ...rgb, brightness: Number(elements.manualBrightness.value), mode: "MANUAL" };
  try {
    await sendLightCommand(command, "수동 조명");
  } catch (_) {
    // enqueueWrite가 화면에 오류를 표시합니다.
  }
}

async function evaluateAutomaticLight() {
  const decision = decideAutomaticLight({
    mode: state.mode,
    distance: state.sensor.distance,
    pot: state.sensor.pot,
    light: state.sensor.light,
    expression: state.stablePrediction.label,
    confidence: state.stablePrediction.confidence
  }, { lightDirection: "lower_is_brighter" });

  const line = commandLine(decision);
  elements.decisionReason.textContent = decision.reason;
  elements.decisionCommand.textContent = line?.trim() || "명령을 보내지 않고 이전 상태 유지";
  if (state.mode !== "AUTO" || !state.connected || !line) return;

  const command = decision.action === "off"
    ? { r: 0, g: 0, b: 0, brightness: 0, mode: "AUTO" }
    : { color: decision.color, brightness: decision.brightness, mode: "AUTO" };

  if (!shouldSendAutomaticCommand(state.lastAutoSignature, command)) return;
  state.lastAutoSignature = commandSignature(command);
  try {
    await sendLightCommand(command, `자동 판단(${decision.reason})`);
  } catch (_) {
    state.lastAutoSignature = null;
  }
}

function renderMode() {
  elements.modeInputs.forEach((input) => { input.checked = input.value === state.mode; });
  const auto = state.mode === "AUTO";
  elements.modeBadge.textContent = state.mode;
  elements.modeBadge.classList.toggle("auto", auto);
  elements.manualControls.hidden = auto;
  elements.autoControls.hidden = !auto;
  renderConnectionControls();
}

function renderConnectionControls() {
  elements.connectButton.disabled = state.connected;
  elements.disconnectButton.disabled = !state.connected;
  elements.pingButton.disabled = !state.connected;
  elements.sendManualButton.disabled = !state.connected || state.mode !== "MANUAL";
}

function renderSensorValues() {
  const { pot, light, touch, distance } = state.sensor;
  sensorElements.pot.value.textContent = Number.isFinite(pot) ? String(pot) : "---";
  sensorElements.light.value.textContent = Number.isFinite(light) ? String(light) : "---";
  sensorElements.touch.value.textContent = typeof touch === "boolean" ? (touch ? "감지" : "없음") : "---";
  sensorElements.distance.value.textContent = distance === null ? "측정 실패" : Number.isFinite(distance) ? `${distance.toFixed(1)} cm` : "---";
}

function drawAllCharts() {
  Object.keys(sensorElements).forEach(drawChart);
}

function drawChart(key) {
  const config = sensorElements[key];
  const canvas = config.chart;
  const width = Math.max(120, canvas.clientWidth);
  const height = Math.max(54, canvas.clientHeight);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(159,179,201,.16)";
  context.beginPath();
  context.moveTo(0, height - .5);
  context.lineTo(width, height - .5);
  context.stroke();

  const values = state.history[key];
  if (values.length < 2) return;
  context.strokeStyle = config.color;
  context.lineWidth = 2;
  context.beginPath();
  let drawing = false;
  values.forEach((rawValue, index) => {
    if (!Number.isFinite(rawValue)) {
      drawing = false;
      return;
    }
    const x = index / Math.max(1, MAX_HISTORY - 1) * width;
    const y = height - Math.max(0, Math.min(1, rawValue / config.max)) * (height - 4) - 2;
    if (!drawing) context.moveTo(x, y);
    else context.lineTo(x, y);
    drawing = true;
  });
  context.stroke();
}

function renderActualLight() {
  const { r, g, b, brightness, mode } = state.actualLight;
  const strength = brightness / 80;
  const color = brightness === 0 ? "#26384c" : `rgb(${r}, ${g}, ${b})`;
  elements.pixelRing.style.setProperty("--pixel-color", color);
  elements.pixelRing.style.setProperty("--pixel-glow", `${Math.round(strength * 18)}px`);
  elements.pixelRing.style.setProperty("--glow", `${Math.round(strength * 42)}px`);
  elements.twinMode.textContent = mode;
  elements.twinBrightness.textContent = brightness;
  elements.actualRgb.textContent = `${r}, ${g}, ${b}`;
  elements.actualBrightness.textContent = `${brightness} / 80`;
  elements.actualMode.textContent = mode;
  elements.pixelRing.setAttribute("aria-label", `RGB ${r}, ${g}, ${b}, 밝기 ${brightness}, ${mode} 모드`);
}

async function loadModel() {
  setModelStatus("loading", "AI 모델 준비 중");
  setSystemMessage("MediaPipe 얼굴 특징 모델을 불러오는 중입니다.");
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
      state.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, options);
    } catch (gpuError) {
      console.warn("GPU를 사용할 수 없어 CPU로 다시 준비합니다.", gpuError);
      options.baseOptions.delegate = "CPU";
      state.faceLandmarker = await vision.FaceLandmarker.createFromOptions(fileset, options);
    }
    elements.cameraButton.disabled = false;
    setModelStatus("ready", "AI 모델 준비 완료");
    setSystemMessage("AI 모델이 준비되었습니다. 웹캠을 시작하세요.");
    addLog("MediaPipe 얼굴 특징 모델을 준비했습니다.");
  } catch (error) {
    console.error(error);
    elements.loadModelButton.disabled = false;
    setModelStatus("error", "AI 모델 준비 실패");
    setSystemMessage("AI 모델을 불러오지 못했습니다. 인터넷 연결을 확인하세요.", true);
  }
}

async function toggleCamera() {
  if (state.cameraRunning) {
    stopCamera();
    return;
  }
  if (!state.faceLandmarker) return;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false });
    elements.webcam.srcObject = state.stream;
    await elements.webcam.play();
    state.cameraRunning = true;
    state.lastVideoTime = -1;
    elements.cameraPlaceholder.hidden = true;
    elements.cameraButton.textContent = "웹캠 중지";
    updateClassificationButton();
    setSystemMessage("웹캠이 시작되었습니다. 얼굴을 화면 중앙에 맞추세요.");
    addLog("웹캠을 시작했습니다.");
    requestAnimationFrame(predictWebcamFrame);
  } catch (error) {
    console.error(error);
    setSystemMessage("웹캠 권한이 거부되었거나 다른 앱에서 사용 중입니다.", true);
  }
}

function stopCamera() {
  state.cameraRunning = false;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  elements.webcam.srcObject = null;
  elements.cameraPlaceholder.hidden = false;
  elements.cameraPlaceholder.textContent = "웹캠이 꺼져 있습니다.";
  elements.cameraButton.textContent = "웹캠 시작";
  elements.faceStatus.textContent = "얼굴 대기";
  state.stablePrediction = { label: null, confidence: 0 };
  stabilizer.clear();
  renderPrediction(null, null, 0);
  updateClassificationButton();
  void evaluateAutomaticLight();
}

function predictWebcamFrame() {
  if (!state.cameraRunning || !state.faceLandmarker) return;
  if (elements.webcam.currentTime !== state.lastVideoTime) {
    const result = state.faceLandmarker.detectForVideo(elements.webcam, performance.now());
    state.lastVideoTime = elements.webcam.currentTime;
    const categories = result.faceBlendshapes?.[0]?.categories;
    if (categories?.length) {
      state.lastFaceAt = Date.now();
      elements.faceStatus.textContent = "얼굴 감지됨";
      state.currentFeatures = blendshapesToFeatures(categories);
      updateFeatureDisplay();
      if (state.classifying) classifyCurrentFeatures();
    } else if (state.lastFaceAt && Date.now() - state.lastFaceAt > FACE_STALE_MS && state.stablePrediction.label) {
      elements.faceStatus.textContent = "얼굴 놓침";
      state.stablePrediction = { label: null, confidence: 0 };
      stabilizer.clear();
      renderPrediction(null, null, 0);
      void evaluateAutomaticLight();
    }
  }
  requestAnimationFrame(predictWebcamFrame);
}

async function collectSamples(label) {
  if (!state.cameraRunning) {
    setSystemMessage("웹캠을 먼저 시작하세요.", true);
    return;
  }
  if (!state.lastFaceAt || Date.now() - state.lastFaceAt > FACE_STALE_MS) {
    setSystemMessage("얼굴이 감지된 상태에서 다시 학습하세요.", true);
    return;
  }
  const buttons = [...elements.trainingGrid.querySelectorAll("button")];
  buttons.forEach((button) => { button.disabled = true; });
  for (let seconds = 3; seconds > 0; seconds -= 1) {
    setSystemMessage(`${labelName(label)} 표정을 ${seconds}초 유지하세요.`);
    for (let sample = 0; sample < 5; sample += 1) {
      classifier.addSample(label, state.currentFeatures);
      await wait(200);
    }
  }
  buttons.forEach((button) => { button.disabled = false; });
  updateSampleDisplay();
  setSystemMessage(`${labelName(label)} 샘플 15개를 추가했습니다.`);
  addLog(`${labelName(label)} 표정 샘플 15개를 학습했습니다.`);
}

function loadDemoSamples() {
  classifier.clear();
  Object.entries(DEMO_SAMPLES).forEach(([label, samples]) => {
    for (let repeat = 0; repeat < 8; repeat += 1) classifier.addSamples(label, samples);
  });
  stabilizer.clear();
  updateSampleDisplay();
  setSystemMessage("예시 특징 데이터로 기능 시험을 시작할 수 있습니다.");
  addLog("네 표정 범주의 예시 학습 데이터를 불러왔습니다.");
}

function clearSamples() {
  classifier.clear();
  stabilizer.clear();
  state.classifying = false;
  state.stablePrediction = { label: null, confidence: 0 };
  elements.classifyButton.textContent = "분류 시작";
  renderPrediction(null, null, 0);
  updateSampleDisplay();
  void evaluateAutomaticLight();
  setSystemMessage("학습 특징값을 모두 지웠습니다.");
}

function toggleClassification() {
  state.classifying = !state.classifying;
  stabilizer.clear();
  state.stablePrediction = { label: null, confidence: 0 };
  elements.classifyButton.textContent = state.classifying ? "분류 멈춤" : "분류 시작";
  if (state.classifying) {
    setSystemMessage("표정 특징 분류를 시작했습니다.");
    classifyCurrentFeatures();
  } else {
    renderPrediction(null, null, 0);
    void evaluateAutomaticLight();
  }
}

function classifyCurrentFeatures() {
  const result = classifier.predict(state.currentFeatures);
  if (!result) return;
  const stableLabel = stabilizer.push(result.label);
  const stableConfidence = stableLabel === result.label ? result.confidence : 0;
  state.stablePrediction = { label: stableLabel, confidence: stableConfidence };
  renderPrediction(result.label, stableLabel, stableConfidence || result.confidence);
  void evaluateAutomaticLight();
}

function renderPrediction(rawLabel, stableLabel, confidence) {
  const raw = LABELS.find(({ id }) => id === rawLabel);
  const stable = LABELS.find(({ id }) => id === stableLabel);
  elements.rawPrediction.textContent = raw?.name || "-";
  elements.predictionIcon.textContent = stable?.icon || "…";
  elements.predictionLabel.textContent = stable?.name || (state.classifying ? "최근 결과 확인 중" : "분류 중지");
  elements.confidenceValue.textContent = `${Math.round((confidence || 0) * 100)}%`;
}

function updateFeatureDisplay() {
  FEATURES.forEach(({ key }) => {
    const value = Math.max(0, Math.min(1, state.currentFeatures[key] || 0));
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
  elements.sampleCount.textContent = `${total}개`;
  elements.clearSamplesButton.disabled = total === 0;
  updateClassificationButton();
}

function updateClassificationButton() {
  elements.classifyButton.disabled = !classifier.hasEveryLabel() || !state.cameraRunning;
}

function updateHealth() {
  if (state.connected && state.lastSensorAt && Date.now() - state.lastSensorAt > SENSOR_STALE_MS) {
    elements.packetStatus.textContent = "센서 데이터 멈춤";
    setSerialStatus("error", "Arduino 데이터 지연");
  } else if (state.connected && state.lastSensorAt) {
    setSerialStatus("ready", "Arduino 연결됨");
  }

  if (state.cameraRunning && state.lastFaceAt && Date.now() - state.lastFaceAt > FACE_STALE_MS) {
    elements.faceStatus.textContent = "얼굴 놓침";
  }
}

function setSerialStatus(status, text) {
  elements.serialStatus.dataset.state = status;
  elements.serialStatus.textContent = text;
}

function setModelStatus(status, text) {
  elements.modelStatus.dataset.state = status;
  elements.modelStatus.textContent = text;
}

function setSystemMessage(message, isError = false) {
  elements.systemMessage.textContent = message;
  elements.systemMessage.style.color = isError ? "var(--danger)" : "";
}

function addLog(message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  item.append(time, ` · ${message}`);
  elements.eventLog.prepend(item);
  state.logCount += 1;
  while (elements.eventLog.children.length > 30) elements.eventLog.lastElementChild.remove();
}

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error("올바른 색상을 선택하세요.");
  const value = Number.parseInt(match[1], 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}

function labelName(label) {
  return LABELS.find(({ id }) => id === label)?.name || label;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
