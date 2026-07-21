const connectButton = document.querySelector("#connectButton");
const disconnectButton = document.querySelector("#disconnectButton");
const serialLog = document.querySelector("#serialLog");
const message = document.querySelector("#message");

let port = null;
let reader = null;
let keepReading = false;
let readLoopPromise = null;
let hasReceivedData = false;

async function connectSerial() {
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    keepReading = true;
    connectButton.disabled = true;
    disconnectButton.disabled = false;
    message.textContent = "연결했습니다. 들어오는 원문을 확인하세요.";
    readLoopPromise = readSerial();
  } catch (error) {
    if (error.name !== "NotFoundError") message.textContent = `연결 실패: ${error.message}`;
  }
}

async function readSerial() {
  const decoder = new TextDecoder();
  reader = port.readable.getReader();

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!hasReceivedData) {
        serialLog.textContent = "";
        hasReceivedData = true;
      }
      serialLog.textContent += decoder.decode(value, { stream: true });
      serialLog.scrollTop = serialLog.scrollHeight;
    }
  } catch (error) {
    if (keepReading) message.textContent = `수신 오류: ${error.message}`;
  } finally {
    reader.releaseLock();
    reader = null;
  }
}

async function disconnectSerial() {
  keepReading = false;
  await reader?.cancel();
  await readLoopPromise;
  await port?.close();
  port = null;
  connectButton.disabled = false;
  disconnectButton.disabled = true;
  message.textContent = "연결을 해제했습니다.";
}

if (!("serial" in navigator)) {
  connectButton.disabled = true;
  message.textContent = "Web Serial을 지원하는 Chrome 또는 Edge에서 여세요.";
}

connectButton.addEventListener("click", connectSerial);
disconnectButton.addEventListener("click", disconnectSerial);
