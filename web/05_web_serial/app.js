const BAUD_RATE = 115200;
const MOCK_INTERVAL_MS = 200;
const MAX_LOG_LINES = 10;

const elements = {
  connectButton: document.querySelector("#connectButton"),
  disconnectButton: document.querySelector("#disconnectButton"),
  pingButton: document.querySelector("#pingButton"),
  mockButton: document.querySelector("#mockButton"),
  clearLogButton: document.querySelector("#clearLogButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
  statusDot: document.querySelector("#statusDot"),
  lastUpdated: document.querySelector("#lastUpdated"),
  browserNotice: document.querySelector("#browserNotice"),
  serialLog: document.querySelector("#serialLog"),
  message: document.querySelector("#message"),
  potValue: document.querySelector("#potValue"),
  lightValue: document.querySelector("#lightValue"),
  touchValue: document.querySelector("#touchValue"),
  distanceValue: document.querySelector("#distanceValue"),
  brightnessValue: document.querySelector("#brightnessValue"),
  colorValue: document.querySelector("#colorValue")
};

let port = null;
let reader = null;
let readLoopPromise = null;
let keepReading = false;
let receiveBuffer = "";
let mockTimer = null;
let mockTick = 0;
let logLines = [];

function setMessage(text, isError = false) {
  elements.message.textContent = text;
  elements.message.classList.toggle("error", isError);
}

function setConnectionState(state) {
  const isSerial = state === "serial";
  const isMock = state === "mock";

  elements.connectButton.disabled = isSerial || isMock || !("serial" in navigator);
  elements.disconnectButton.disabled = !isSerial;
  elements.pingButton.disabled = !isSerial;
  elements.mockButton.disabled = isSerial;
  elements.mockButton.textContent = isMock ? "가상 센서 중지" : "가상 센서 시작";
  elements.connectionStatus.textContent = isSerial
    ? "Arduino 연결됨"
    : isMock
      ? "가상 센서 실행 중"
      : "연결 안 됨";
  elements.statusDot.className = `status-dot${isSerial ? " connected" : isMock ? " mock" : ""}`;
}

async function connectSerial() {
  if (!("serial" in navigator)) return;

  try {
    stopMock();
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: BAUD_RATE });
    keepReading = true;
    receiveBuffer = "";
    setConnectionState("serial");
    setMessage("연결했습니다. Arduino가 재시작되면 데이터가 올 때까지 잠시 기다리세요.");
    readLoopPromise = readSerialLoop();
  } catch (error) {
    port = null;
    setConnectionState("idle");
    if (error.name !== "NotFoundError") {
      setMessage(`연결 실패: ${error.message}`, true);
    }
  }
}

async function readSerialLoop() {
  const decoder = new TextDecoder();

  try {
    reader = port.readable.getReader();

    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;

      receiveBuffer += decoder.decode(value, { stream: true });
      processReceiveBuffer();
    }

    receiveBuffer += decoder.decode();
    processReceiveBuffer();
  } catch (error) {
    if (keepReading) setMessage(`수신 오류: ${error.message}`, true);
  } finally {
    reader?.releaseLock();
    reader = null;
  }
}

function processReceiveBuffer() {
  const lines = receiveBuffer.split("\n");
  receiveBuffer = lines.pop() ?? "";

  for (const line of lines) {
    handleLine(line);
  }
}

function handleLine(rawLine, source = "serial") {
  const line = rawLine.trim();
  if (!line) return;

  appendLog(`${source === "mock" ? "[가상] " : ""}${line}`);

  try {
    const data = JSON.parse(line);

    if (data.type === "sensor") {
      updateSensorCards(data);
      setMessage("센서 JSON 한 줄을 정상적으로 읽었습니다.");
    } else if (data.type === "status") {
      setMessage(`Arduino 응답: ${data.message ?? "상태 확인"}`);
    } else if (data.type === "error") {
      setMessage(`Arduino 오류: ${data.message ?? "알 수 없는 오류"}`, true);
    }
  } catch (error) {
    setMessage(`JSON 형식 오류: ${line}`, true);
  }
}

function updateSensorCards(data) {
  setNumber(elements.potValue, data.pot, 0);
  setNumber(elements.lightValue, data.light, 0);
  elements.touchValue.textContent = typeof data.touch === "boolean"
    ? data.touch ? "감지" : "없음"
    : "---";
  elements.distanceValue.textContent = data.distance === null
    ? "측정 실패"
    : formatNumber(data.distance, 1);
  setNumber(elements.brightnessValue, data.brightness, 0);
  setNumber(elements.colorValue, data.color, 0);
  elements.lastUpdated.textContent = `${new Date().toLocaleTimeString("ko-KR")} 마지막 수신`;
}

function setNumber(element, value, digits) {
  element.textContent = formatNumber(value, digits);
}

function formatNumber(value, digits) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "---";
}

async function sendCommand(command) {
  if (!port?.writable) return;

  const writer = port.writable.getWriter();
  try {
    await writer.write(new TextEncoder().encode(`${command}\n`));
    setMessage(`${command} 명령을 보냈습니다.`);
  } catch (error) {
    setMessage(`전송 오류: ${error.message}`, true);
  } finally {
    writer.releaseLock();
  }
}

async function disconnectSerial(showMessage = true) {
  keepReading = false;

  try {
    await reader?.cancel();
    await readLoopPromise;
    if (port) await port.close();
  } catch (error) {
    if (showMessage) setMessage(`연결 해제 오류: ${error.message}`, true);
  } finally {
    port = null;
    readLoopPromise = null;
    setConnectionState("idle");
    if (showMessage) setMessage("Arduino 연결을 해제했습니다.");
  }
}

function toggleMock() {
  if (mockTimer) {
    stopMock();
    setConnectionState("idle");
    setMessage("가상 센서를 중지했습니다.");
    return;
  }

  startMock();
}

function startMock() {
  mockTick = 0;
  setConnectionState("mock");
  setMessage("가상 센서값을 만들고 있습니다. 실제 하드웨어 검증은 아닙니다.");
  emitMockData();
  mockTimer = window.setInterval(emitMockData, MOCK_INTERVAL_MS);
}

function stopMock() {
  if (!mockTimer) return;
  window.clearInterval(mockTimer);
  mockTimer = null;
}

function emitMockData() {
  mockTick += 1;
  const wave = (Math.sin(mockTick / 9) + 1) / 2;
  const pot = Math.round(wave * 1023);
  const mockData = {
    type: "sensor",
    pot,
    light: Math.round(260 + ((Math.sin(mockTick / 15) + 1) / 2) * 520),
    touch: mockTick % 40 >= 35,
    distance: mockTick % 55 === 0 ? null : Number((18 + wave * 82).toFixed(1)),
    brightness: Math.round((pot / 1023) * 80),
    color: Math.floor(mockTick / 40) % 4
  };

  handleLine(JSON.stringify(mockData), "mock");
}

function appendLog(line) {
  logLines.push(line);
  logLines = logLines.slice(-MAX_LOG_LINES);
  elements.serialLog.textContent = logLines.join("\n");
  elements.serialLog.scrollTop = elements.serialLog.scrollHeight;
}

function clearLog() {
  logLines = [];
  elements.serialLog.textContent = "데이터를 기다리는 중...";
}

function checkBrowserSupport() {
  if ("serial" in navigator) return;
  elements.browserNotice.hidden = false;
  elements.browserNotice.textContent = "이 브라우저는 Web Serial을 지원하지 않습니다. Chrome 또는 Edge에서 열거나 가상 센서를 사용하세요.";
  elements.connectButton.disabled = true;
}

elements.connectButton.addEventListener("click", connectSerial);
elements.disconnectButton.addEventListener("click", () => disconnectSerial());
elements.pingButton.addEventListener("click", () => sendCommand("PING"));
elements.mockButton.addEventListener("click", toggleMock);
elements.clearLogButton.addEventListener("click", clearLog);

if ("serial" in navigator) {
  navigator.serial.addEventListener("disconnect", (event) => {
    if (event.target === port) disconnectSerial(false);
  });
}

window.addEventListener("beforeunload", () => {
  keepReading = false;
  stopMock();
});

setConnectionState("idle");
checkBrowserSupport();
