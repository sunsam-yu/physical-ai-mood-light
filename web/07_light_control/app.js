"use strict";

const CONFIG = Object.freeze({
  baudRate: 115200,
  ledCount: 8,
  maxBrightness: 80,
});

/**
 * Stage 5의 Arduino 수신 규격이 바뀌면 이 함수만 수정합니다.
 * 현재 기대 규격: UTF-8 CSV 명령 한 줄(마지막에 \n)
 */
function serializeLightCommand(command) {
  return `LIGHT,${command.r},${command.g},${command.b},${command.brightness},${command.mode}\n`;
}

class MockTransport {
  constructor() {
    this.name = "가상 연결";
    this.connected = false;
  }

  async connect() {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async write(payload) {
    if (!this.connected) throw new Error("가상 연결이 끊어졌습니다.");
    await new Promise((resolve) => window.setTimeout(resolve, 80));
    if (!payload.endsWith("\n")) throw new Error("명령 끝에 줄바꿈 문자가 없습니다.");
  }
}

class WebSerialTransport {
  constructor(onUnexpectedDisconnect) {
    this.name = "Arduino USB";
    this.port = null;
    this.writer = null;
    this.connected = false;
    this.onUnexpectedDisconnect = onUnexpectedDisconnect;
    this.handleSerialDisconnect = this.handleSerialDisconnect.bind(this);
  }

  static isSupported() {
    return "serial" in navigator;
  }

  async connect() {
    if (!WebSerialTransport.isSupported()) {
      throw new Error("이 브라우저는 Web Serial을 지원하지 않습니다. Chrome 또는 Edge에서 HTTPS/localhost로 여세요.");
    }

    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: CONFIG.baudRate });
    navigator.serial.addEventListener("disconnect", this.handleSerialDisconnect);
    this.connected = true;
  }

  async disconnect() {
    navigator.serial?.removeEventListener("disconnect", this.handleSerialDisconnect);
    try {
      await this.releaseWriter();

      if (this.port?.readable || this.port?.writable) {
        await this.port.close();
      }
    } finally {
      this.port = null;
      this.connected = false;
    }
  }

  async write(payload) {
    if (!this.connected || !this.port?.writable) {
      throw new Error("Arduino가 연결되어 있지 않습니다.");
    }

    try {
      this.writer = this.port.writable.getWriter();
      await this.writer.write(new TextEncoder().encode(payload));
    } catch (error) {
      this.connected = false;
      this.onUnexpectedDisconnect(error);
      throw new Error("명령을 보내는 중 Arduino 연결이 끊어졌습니다.");
    } finally {
      await this.releaseWriter();
    }
  }

  async releaseWriter() {
    if (!this.writer) return;

    try {
      this.writer.releaseLock();
    } finally {
      this.writer = null;
    }
  }

  handleSerialDisconnect(event) {
    if (event.port !== this.port && event.target !== this.port) return;
    this.connected = false;
    this.onUnexpectedDisconnect(new Error("USB 연결이 해제되었습니다."));
  }
}

/**
 * UI는 이 어댑터의 sendCommand(command)만 호출합니다.
 * Transport와 직렬화 형식을 바꿔도 조명 제어 UI는 그대로 유지됩니다.
 */
class LightCommandAdapter {
  constructor(transport) {
    this.transport = transport;
  }

  setTransport(transport) {
    this.transport = transport;
  }

  get connected() {
    return Boolean(this.transport?.connected);
  }

  async connect() {
    if (!this.transport) throw new Error("전송 방법을 먼저 선택하세요.");
    await this.transport.connect();
  }

  async disconnect() {
    await this.transport?.disconnect();
  }

  async sendCommand(rawCommand) {
    if (!this.connected) throw new Error("연결 후 명령을 보내세요.");

    const { command, warnings } = normalizeLightCommand(rawCommand);
    await this.transport.write(serializeLightCommand(command));
    return { command, warnings };
  }
}

function normalizeLightCommand(raw) {
  if (!raw || typeof raw !== "object") throw new Error("조명 명령이 비어 있습니다.");
  if (raw.type !== "light") throw new Error("명령 type은 light여야 합니다.");

  const r = parseRgbChannel(raw.r, "R");
  const g = parseRgbChannel(raw.g, "G");
  const b = parseRgbChannel(raw.b, "B");
  const mode = String(raw.mode ?? "").toUpperCase();

  if (!["AUTO", "MANUAL"].includes(mode)) {
    throw new Error("모드는 AUTO 또는 MANUAL이어야 합니다.");
  }

  const rawBrightness = Number(raw.brightness);
  if (!Number.isFinite(rawBrightness)) throw new Error("밝기를 숫자로 입력하세요.");

  const roundedBrightness = Math.round(rawBrightness);
  const brightness = clamp(roundedBrightness, 0, CONFIG.maxBrightness);
  const warnings = [];

  if (brightness !== rawBrightness) {
    warnings.push(`밝기를 안전 범위 0~${CONFIG.maxBrightness}로 보정했습니다.`);
  }

  return {
    command: { type: "light", r, g, b, brightness, mode },
    warnings,
  };
}

function parseRgbChannel(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 255) {
    throw new Error(`${label} 값은 0~255의 정수여야 합니다.`);
  }
  return number;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error("올바른 6자리 색상 코드를 선택하세요.");
  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

const elements = {
  connectionBadge: document.querySelector("#connectionBadge"),
  connectionText: document.querySelector("#connectionText"),
  transportHint: document.querySelector("#transportHint"),
  transportSelect: document.querySelector("#transportSelect"),
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  connectionHelp: document.querySelector("#connectionHelp"),
  modeBadge: document.querySelector("#modeBadge"),
  modeInputs: [...document.querySelectorAll('input[name="mode"]')],
  manualControls: document.querySelector("#manualControls"),
  autoNotice: document.querySelector("#autoNotice"),
  colorPicker: document.querySelector("#colorPicker"),
  redInput: document.querySelector("#redInput"),
  greenInput: document.querySelector("#greenInput"),
  blueInput: document.querySelector("#blueInput"),
  presetButtons: [...document.querySelectorAll(".preset")],
  brightnessSlider: document.querySelector("#brightnessSlider"),
  brightnessInput: document.querySelector("#brightnessInput"),
  feedback: document.querySelector("#feedback"),
  sendButton: document.querySelector("#sendButton"),
  pixelRing: document.querySelector("#pixelRing"),
  twinStage: document.querySelector(".twin-stage"),
  twinMode: document.querySelector("#twinMode"),
  twinBrightness: document.querySelector("#twinBrightness"),
  rgbState: document.querySelector("#rgbState"),
  brightnessState: document.querySelector("#brightnessState"),
  modeState: document.querySelector("#modeState"),
  sendState: document.querySelector("#sendState"),
  commandLog: document.querySelector("#commandLog"),
  clearLogButton: document.querySelector("#clearLogButton"),
};

const state = {
  connecting: false,
  sending: false,
  lastSentCommand: null,
  logLines: [],
};

const adapter = new LightCommandAdapter(createTransport(elements.transportSelect.value));
window.lightCommandAdapter = adapter;

initializePixelRing();
bindEvents();
updateTransportDescription();
renderPreviewFromInputs();
renderConnectionState("offline");

function createTransport(type) {
  if (type === "serial") return new WebSerialTransport(handleUnexpectedDisconnect);
  return new MockTransport();
}

function bindEvents() {
  elements.transportSelect.addEventListener("change", () => {
    adapter.setTransport(createTransport(elements.transportSelect.value));
    updateTransportDescription();
    renderConnectionState("offline");
  });

  elements.connectButton.addEventListener("click", connectSelectedTransport);
  elements.disconnectButton.addEventListener("click", disconnectTransport);
  elements.sendButton.addEventListener("click", sendCurrentCommand);
  elements.clearLogButton.addEventListener("click", clearLog);

  elements.colorPicker.addEventListener("input", () => {
    const { r, g, b } = hexToRgb(elements.colorPicker.value);
    setRgbInputs(r, g, b);
    renderPreviewFromInputs();
  });

  [elements.redInput, elements.greenInput, elements.blueInput].forEach((input) => {
    input.addEventListener("input", () => {
      syncColorPickerFromRgb();
      renderPreviewFromInputs();
    });
  });

  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.colorPicker.value = button.dataset.color;
      const { r, g, b } = hexToRgb(button.dataset.color);
      setRgbInputs(r, g, b);
      renderPreviewFromInputs();
    });
  });

  elements.brightnessSlider.addEventListener("input", () => {
    elements.brightnessInput.value = elements.brightnessSlider.value;
    renderPreviewFromInputs();
  });

  elements.brightnessInput.addEventListener("input", renderPreviewFromInputs);

  elements.modeInputs.forEach((input) => input.addEventListener("change", handleModeChange));

  window.addEventListener("beforeunload", () => {
    if (adapter.connected) void adapter.disconnect();
  });
}

function initializePixelRing() {
  for (let index = 0; index < CONFIG.ledCount; index += 1) {
    const pixel = document.createElement("span");
    pixel.className = "pixel";
    pixel.style.setProperty("--angle", `${index * (360 / CONFIG.ledCount)}deg`);
    pixel.setAttribute("aria-hidden", "true");
    elements.pixelRing.append(pixel);
  }
}

async function connectSelectedTransport() {
  if (state.connecting || adapter.connected) return;

  state.connecting = true;
  renderConnectionState("connecting");
  setFeedback("연결을 준비하고 있습니다…", "neutral");

  try {
    await adapter.connect();
    renderConnectionState("online");
    setFeedback(`${adapter.transport.name} 연결이 완료되었습니다.`, "success");
  } catch (error) {
    renderConnectionState("offline");
    const message = error?.name === "NotFoundError"
      ? "장치 선택을 취소했습니다. 다시 연결을 눌러 선택하세요."
      : error.message;
    setFeedback(message, "error");
  } finally {
    state.connecting = false;
    updateActionAvailability();
  }
}

async function disconnectTransport() {
  try {
    await adapter.disconnect();
    setFeedback("연결을 해제했습니다. 디지털 트윈 미리보기는 계속 사용할 수 있습니다.", "neutral");
  } catch (error) {
    setFeedback(`연결 해제 중 오류: ${error.message}`, "error");
  } finally {
    renderConnectionState("offline");
  }
}

async function sendCurrentCommand() {
  if (state.sending) return;

  state.sending = true;
  updateActionAvailability();
  elements.sendState.textContent = "전송 중";

  try {
    const result = await adapter.sendCommand(readCommandFromInputs());
    state.lastSentCommand = result.command;
    applyNormalizedCommandToInputs(result.command);
    renderTwin(result.command);
    appendLog(serializeLightCommand(result.command).trim());
    elements.sendState.textContent = "완료";

    if (result.warnings.length > 0) {
      setFeedback(`명령을 보냈습니다. ${result.warnings.join(" ")}`, "warning");
    } else {
      setFeedback(`${result.command.mode} 조명 명령을 보냈습니다.`, "success");
    }
  } catch (error) {
    elements.sendState.textContent = "실패";
    setFeedback(error.message, "error");
    if (!adapter.connected) renderConnectionState("offline");
  } finally {
    state.sending = false;
    updateActionAvailability();
  }
}

function readCommandFromInputs() {
  return {
    type: "light",
    r: elements.redInput.value,
    g: elements.greenInput.value,
    b: elements.blueInput.value,
    brightness: elements.brightnessInput.value,
    mode: getSelectedMode(),
  };
}

function applyNormalizedCommandToInputs(command) {
  setRgbInputs(command.r, command.g, command.b);
  elements.colorPicker.value = rgbToHex(command.r, command.g, command.b);
  elements.brightnessInput.value = String(command.brightness);
  elements.brightnessSlider.value = String(command.brightness);
}

function renderPreviewFromInputs() {
  try {
    const { command } = normalizeLightCommand(readCommandFromInputs());
    renderTwin(command, true);
  } catch {
    // 입력 중간 상태(빈 칸 등)에서는 마지막으로 유효했던 미리보기를 유지합니다.
  }
}

function renderTwin(command, previewOnly = false) {
  const color = `rgb(${command.r} ${command.g} ${command.b})`;
  const power = command.brightness / CONFIG.maxBrightness;

  elements.pixelRing.style.setProperty("--pixel-color", color);
  elements.pixelRing.style.setProperty("--pixel-glow", `${Math.round(5 + power * 18)}px`);
  elements.pixelRing.style.setProperty("--pixel-opacity", (0.16 + power * 0.84).toFixed(3));
  elements.twinStage.style.setProperty(
    "--twin-glow",
    `rgb(${command.r} ${command.g} ${command.b} / ${Math.max(0.06, power * 0.3).toFixed(2)})`,
  );
  elements.twinMode.textContent = command.mode;
  elements.twinMode.style.color = command.mode === "AUTO" ? "#fbbf24" : "#60a5fa";
  elements.twinBrightness.textContent = String(command.brightness);
  elements.rgbState.textContent = `${command.r}, ${command.g}, ${command.b}`;
  elements.brightnessState.textContent = `${command.brightness} / ${CONFIG.maxBrightness}`;
  elements.modeState.textContent = command.mode;
  elements.pixelRing.setAttribute(
    "aria-label",
    `RGB ${command.r}, ${command.g}, ${command.b}, 밝기 ${command.brightness}의 네오픽셀 8구 ${previewOnly ? "미리보기" : "명령 상태"}`,
  );
}

function handleModeChange() {
  const auto = getSelectedMode() === "AUTO";
  elements.modeBadge.textContent = auto ? "AUTO" : "MANUAL";
  elements.modeBadge.classList.toggle("mode-auto", auto);
  elements.modeBadge.classList.toggle("mode-manual", !auto);
  elements.manualControls.setAttribute("aria-disabled", String(auto));
  elements.autoNotice.hidden = !auto;

  elements.manualControls.querySelectorAll("input, button").forEach((control) => {
    control.disabled = auto;
  });

  renderPreviewFromInputs();
}

function renderConnectionState(status) {
  elements.connectionBadge.className = `status-badge status-${status}`;

  const labels = {
    offline: "연결 안 됨",
    connecting: "연결 중",
    online: `${adapter.transport.name} 연결됨`,
  };

  elements.connectionText.textContent = labels[status];
  elements.transportSelect.disabled = status !== "offline";
  elements.connectButton.disabled = status !== "offline";
  elements.disconnectButton.disabled = status !== "online";
  updateActionAvailability();
}

function updateActionAvailability() {
  elements.sendButton.disabled = !adapter.connected || state.connecting || state.sending;
  elements.sendButton.textContent = state.sending ? "전송 중…" : "조명 명령 보내기";
}

function updateTransportDescription() {
  const isSerial = elements.transportSelect.value === "serial";
  elements.transportHint.textContent = isSerial ? "실제 키트 연결" : "키트 없이 연습";
  elements.connectionHelp.textContent = isSerial
    ? "Arduino를 USB로 연결한 뒤 Chrome 또는 Edge에서 실행하세요. 시리얼 모니터는 먼저 닫아야 합니다."
    : "가상 연결은 Arduino 없이 전송 과정과 디지털 트윈을 시험합니다.";

  if (isSerial && !WebSerialTransport.isSupported()) {
    setFeedback("이 브라우저에서는 Web Serial을 사용할 수 없습니다. Chrome 또는 Edge를 사용하세요.", "warning");
  }
}

function handleUnexpectedDisconnect(error) {
  renderConnectionState("offline");
  elements.sendState.textContent = "끊김";
  setFeedback(error.message || "Arduino 연결이 예기치 않게 끊어졌습니다.", "error");
}

function syncColorPickerFromRgb() {
  try {
    const r = parseRgbChannel(elements.redInput.value, "R");
    const g = parseRgbChannel(elements.greenInput.value, "G");
    const b = parseRgbChannel(elements.blueInput.value, "B");
    elements.colorPicker.value = rgbToHex(r, g, b);
  } catch {
    // 사용자가 잘못된 값을 입력한 동안에는 색상 선택기의 마지막 유효값을 유지합니다.
  }
}

function setRgbInputs(r, g, b) {
  elements.redInput.value = String(r);
  elements.greenInput.value = String(g);
  elements.blueInput.value = String(b);
}

function getSelectedMode() {
  return elements.modeInputs.find((input) => input.checked)?.value ?? "MANUAL";
}

function setFeedback(message, type) {
  elements.feedback.className = `feedback feedback-${type}`;
  elements.feedback.textContent = message;
}

function appendLog(line) {
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());

  state.logLines.unshift(`[${time}] ${line}`);
  state.logLines = state.logLines.slice(0, 5);
  elements.commandLog.textContent = state.logLines.join("\n");
}

function clearLog() {
  state.logLines = [];
  elements.commandLog.textContent = "아직 전송한 명령이 없습니다.";
}
