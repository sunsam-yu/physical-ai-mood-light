(function runDashboard() {
  "use strict";

  const SAMPLE_INTERVAL_MS = 200;
  const MAX_SAMPLES = 60;
  const STALE_AFTER_MS = 1600;

  const sensorConfig = {
    pot: { min: 0, max: 1023, color: "#48d6ff", name: "가변저항" },
    light: { min: 0, max: 1023, color: "#ffd166", name: "조도센서" },
    touch: { min: 0, max: 1, color: "#ff78b4", name: "터치센서" },
    distance: { min: 0, max: 250, color: "#58e6a9", name: "거리센서" }
  };

  const state = {
    source: "simulation",
    current: { pot: undefined, light: undefined, touch: undefined, distance: undefined },
    history: { pot: [], light: [], touch: [], distance: [] },
    packetCount: 0,
    errorCount: 0,
    lastDataAt: Date.now(),
    serialPort: null,
    serialReader: null,
    serialReadTask: null,
    keepReading: false,
    serialBuffer: "",
    simulationTimer: null,
    simulationPhase: 0
  };

  const elements = {};

  function cacheElements() {
    [
      "source-status", "source-status-text", "serial-button", "last-update",
      "simulation-toggle", "auto-simulation", "simulation-controls",
      "sim-pot", "sim-light", "sim-touch", "sim-distance",
      "sim-pot-output", "sim-light-output", "sim-touch-output", "sim-distance-output",
      "packet-count", "error-count", "last-message", "clear-button", "serial-support-note"
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function setSourceStatus(kind, text) {
    elements["source-status"].className = `status-badge status-${kind}`;
    elements["source-status-text"].textContent = text;
  }

  function setMessage(message, isError = false) {
    elements["last-message"].textContent = message;
    elements["last-message"].style.color = isError ? "var(--danger)" : "";
  }

  function updateCounters() {
    elements["packet-count"].textContent = state.packetCount.toLocaleString("ko-KR");
    elements["error-count"].textContent = state.errorCount.toLocaleString("ko-KR");
  }

  function appendHistory(sensor, value) {
    state.history[sensor].push(value);
    if (state.history[sensor].length > MAX_SAMPLES) state.history[sensor].shift();
  }

  function receiveData(data, sourceLabel = "센서") {
    const hasAnyValue = Object.keys(sensorConfig).some((sensor) => Object.prototype.hasOwnProperty.call(data, sensor));
    if (!hasAnyValue) return;

    Object.keys(sensorConfig).forEach((sensor) => {
      if (Object.prototype.hasOwnProperty.call(data, sensor)) state.current[sensor] = data[sensor];
      const historyValue = sensor === "touch"
        ? (state.current.touch == null ? null : Number(state.current.touch))
        : state.current[sensor];
      appendHistory(sensor, historyValue);
    });

    state.packetCount += 1;
    state.lastDataAt = Date.now();
    updateCounters();
    updateCards();
    drawAllCharts();

    if (state.packetCount === 1) setMessage(`${sourceLabel} 데이터가 정상적으로 들어왔습니다.`);
  }

  function sensorMeaning(sensor, value) {
    if (value === undefined) return "값을 기다리는 중";
    if (value === null) return sensor === "distance" ? "반사 신호 없음" : "값을 기다리는 중";
    if (sensor === "pot") {
      if (value < 341) return "낮은 범위";
      if (value < 682) return "중간 범위";
      return "높은 범위";
    }
    if (sensor === "light") {
      if (value <= 100) return "매우 밝음";
      if (value <= 450) return "밝은 편";
      if (value <= 700) return "어두운 편";
      return "매우 어두움";
    }
    if (sensor === "touch") return value ? "손가락 접촉 감지" : "접촉 감지 안 됨";
    if (value < 30) return "매우 가까움";
    if (value < 100) return "가까운 범위";
    return "먼 범위";
  }

  function formatValue(sensor, value) {
    if (value === undefined) return "---";
    if (value === null) return sensor === "distance" ? "실패" : "---";
    if (sensor === "touch") return value ? "감지" : "없음";
    if (sensor === "distance") return Number(value).toFixed(1);
    return Math.round(value).toString();
  }

  function updateCards() {
    Object.keys(sensorConfig).forEach((sensor) => {
      const value = state.current[sensor];
      const valueElement = document.getElementById(`${sensor}-value`);
      const meaningElement = document.getElementById(`${sensor}-meaning`);
      const card = document.querySelector(`[data-card="${sensor}"]`);
      valueElement.textContent = formatValue(sensor, value);
      meaningElement.textContent = sensorMeaning(sensor, value);
      card.classList.toggle("is-active", sensor === "touch" && value === true);
      card.dataset.available = String(value !== null && value !== undefined);
    });
  }

  function chartRange(sensor, values) {
    const config = sensorConfig[sensor];
    if (sensor !== "distance") return { min: config.min, max: config.max };
    const valid = values.filter((value) => Number.isFinite(value));
    const largest = valid.length ? Math.max(...valid) : config.max;
    return { min: 0, max: Math.max(50, Math.ceil(largest / 50) * 50) };
  }

  function drawChart(canvas) {
    const sensor = canvas.dataset.sensor;
    const values = state.history[sensor];
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const padding = 10;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(163, 190, 226, 0.12)";
    ctx.lineWidth = 1;
    for (let line = 1; line <= 2; line += 1) {
      const y = (h / 3) * line;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (values.length < 2) return;
    const range = chartRange(sensor, values);
    const stepX = (w - padding * 2) / Math.max(MAX_SAMPLES - 1, 1);
    const startX = w - padding - stepX * (values.length - 1);

    ctx.strokeStyle = sensorConfig[sensor].color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    let drawing = false;
    values.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        drawing = false;
        return;
      }
      const fraction = (value - range.min) / Math.max(range.max - range.min, 1);
      const x = startX + stepX * index;
      const y = h - padding - Math.max(0, Math.min(1, fraction)) * (h - padding * 2);
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const latest = [...values].reverse().find((value) => Number.isFinite(value));
    if (latest === undefined) return;
    const latestFraction = (latest - range.min) / Math.max(range.max - range.min, 1);
    const latestY = h - padding - Math.max(0, Math.min(1, latestFraction)) * (h - padding * 2);
    ctx.fillStyle = sensorConfig[sensor].color;
    ctx.beginPath();
    ctx.arc(w - padding, latestY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAllCharts() {
    document.querySelectorAll("canvas[data-sensor]").forEach(drawChart);
    updateChartDescriptions();
  }

  function updateChartDescriptions() {
    Object.keys(sensorConfig).forEach((sensor) => {
      const valid = state.history[sensor].filter((value) => Number.isFinite(value));
      const label = document.getElementById(`${sensor}-chart-label`);
      if (!valid.length) {
        label.textContent = `${sensorConfig[sensor].name}의 최근 변화 그래프. 아직 데이터가 없습니다.`;
        return;
      }
      const minimum = Math.min(...valid);
      const maximum = Math.max(...valid);
      label.textContent = `${sensorConfig[sensor].name}의 최근 ${valid.length}개 데이터 그래프. 최솟값 ${minimum.toFixed(1)}, 최댓값 ${maximum.toFixed(1)}.`;
    });
  }

  function updateSimulationLabels() {
    elements["sim-pot-output"].value = elements["sim-pot"].value;
    elements["sim-light-output"].value = elements["sim-light"].value;
    elements["sim-distance-output"].value = `${elements["sim-distance"].value} cm`;
    elements["sim-touch-output"].textContent = elements["sim-touch"].checked ? "감지됨" : "감지 안 됨";
  }

  function readSimulationControls() {
    return {
      pot: Number(elements["sim-pot"].value),
      light: Number(elements["sim-light"].value),
      touch: elements["sim-touch"].checked,
      distance: Number(elements["sim-distance"].value)
    };
  }

  function animateSimulation() {
    state.simulationPhase += 0.075;
    const phase = state.simulationPhase;
    elements["sim-pot"].value = Math.round(512 + Math.sin(phase) * 460);
    elements["sim-light"].value = Math.round(530 + Math.sin(phase * 0.63 + 1.4) * 420);
    elements["sim-distance"].value = Math.round(95 + Math.sin(phase * 0.42 + 2.1) * 75);
    elements["sim-touch"].checked = Math.floor(phase / 3.2) % 2 === 1;
  }

  function simulationTick() {
    if (state.source !== "simulation") return;
    if (elements["auto-simulation"].checked) animateSimulation();
    updateSimulationLabels();
    receiveData(readSimulationControls(), "가상 센서");
  }

  function startSimulation() {
    stopSimulation();
    state.source = "simulation";
    elements["simulation-toggle"].checked = true;
    elements["simulation-controls"].setAttribute("aria-disabled", "false");
    elements["simulation-controls"].querySelectorAll("input").forEach((input) => { input.disabled = false; });
    setSourceStatus("simulation", "가상 센서 실행 중");
    setMessage("가상 센서가 데이터를 만들고 있습니다.");
    simulationTick();
    state.simulationTimer = window.setInterval(simulationTick, SAMPLE_INTERVAL_MS);
  }

  function stopSimulation() {
    if (state.simulationTimer !== null) window.clearInterval(state.simulationTimer);
    state.simulationTimer = null;
  }

  function recordParseProblem(message, rawLine) {
    state.errorCount += 1;
    updateCounters();
    const shortLine = String(rawLine).trim().slice(0, 90);
    setMessage(`${message}${shortLine ? ` · 입력: ${shortLine}` : ""}`, true);
  }

  function handleSerialLine(line) {
    const trimmedLine = String(line).trim();
    if (trimmedLine.startsWith("{")) {
      try {
        const message = JSON.parse(trimmedLine);
        if (message.type === "status") {
          setMessage(`Arduino 응답: ${message.message || "상태 확인"}`);
          return;
        }
        if (message.type === "error") {
          setMessage(`Arduino 오류: ${message.message || "알 수 없는 오류"}`, true);
          return;
        }
      } catch (_) {
        // 아래 공통 파서가 같은 줄의 자세한 JSON 오류를 안내합니다.
      }
    }

    const result = window.SensorDataParser.parseSensorLine(line);
    if (!result.ok) {
      recordParseProblem(result.error, line);
      return;
    }
    if (result.warnings.length) recordParseProblem(result.warnings.join(" "), line);
    receiveData(result.data, "Arduino");
  }

  async function readSerialLoop(port) {
    const decoder = new TextDecoder();
    state.serialReader = port.readable.getReader();
    try {
      while (state.keepReading) {
        const { value, done } = await state.serialReader.read();
        if (done) break;
        state.serialBuffer += decoder.decode(value, { stream: true });
        const lines = state.serialBuffer.split(/\r?\n/);
        state.serialBuffer = lines.pop() || "";
        lines.forEach((line) => {
          if (line.trim()) handleSerialLine(line);
        });
      }
    } catch (error) {
      if (state.keepReading) {
        setSourceStatus("error", "연결 오류");
        setMessage(`시리얼 읽기 오류: ${error.message}`, true);
      }
    } finally {
      state.serialReader.releaseLock();
      state.serialReader = null;
    }
  }

  async function connectSerial() {
    if (!("serial" in navigator)) return;
    if (state.serialPort) {
      await disconnectSerial(true);
      return;
    }

    elements["serial-button"].disabled = true;
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      stopSimulation();
      state.source = "serial";
      state.serialPort = port;
      state.keepReading = true;
      state.serialBuffer = "";
      elements["simulation-toggle"].checked = false;
      elements["simulation-controls"].setAttribute("aria-disabled", "true");
      elements["simulation-controls"].querySelectorAll("input").forEach((input) => { input.disabled = true; });
      elements["serial-button"].textContent = "연결 해제";
      setSourceStatus("connected", "Arduino 연결됨 · 데이터 대기");
      setMessage("Arduino가 보내는 첫 데이터 줄을 기다리고 있습니다.");
      state.serialReadTask = readSerialLoop(port);
    } catch (error) {
      if (error.name !== "NotFoundError") {
        setSourceStatus("error", "연결하지 못함");
        setMessage(`연결 오류: ${error.message}`, true);
      } else {
        setMessage("연결할 장치를 선택하지 않았습니다.");
      }
      if (!state.serialPort) startSimulation();
    } finally {
      elements["serial-button"].disabled = false;
    }
  }

  async function disconnectSerial(returnToSimulation) {
    state.keepReading = false;
    if (state.serialReader) {
      try { await state.serialReader.cancel(); } catch (_) { /* 이미 닫힌 포트 */ }
    }
    if (state.serialReadTask) {
      try { await state.serialReadTask; } catch (_) { /* 읽기 루프에서 안내 */ }
    }
    if (state.serialPort) {
      try { await state.serialPort.close(); } catch (_) { /* 분리된 장치는 이미 닫힘 */ }
    }
    state.serialPort = null;
    state.serialReadTask = null;
    elements["serial-button"].textContent = "Arduino 연결";
    if (returnToSimulation) startSimulation();
    else {
      state.source = "idle";
      setSourceStatus("idle", "연결 안 됨");
    }
  }

  async function toggleSimulation() {
    if (elements["simulation-toggle"].checked) {
      if (state.serialPort) await disconnectSerial(false);
      startSimulation();
    } else {
      stopSimulation();
      state.source = "idle";
      elements["simulation-controls"].setAttribute("aria-disabled", "true");
      elements["simulation-controls"].querySelectorAll("input").forEach((input) => { input.disabled = true; });
      setSourceStatus("idle", "데이터 입력 꺼짐");
      setMessage("가상 모드가 꺼졌습니다. Arduino를 연결하거나 가상 모드를 켜세요.");
    }
  }

  function clearHistory() {
    Object.keys(state.history).forEach((sensor) => { state.history[sensor] = []; });
    state.packetCount = 0;
    state.errorCount = 0;
    updateCounters();
    drawAllCharts();
    setMessage("그래프와 수신 기록을 지웠습니다.");
  }

  function updateFreshness() {
    const elapsed = Date.now() - state.lastDataAt;
    if (state.packetCount === 0) {
      elements["last-update"].textContent = "데이터 없음";
      return;
    }
    if (elapsed < 1000) elements["last-update"].textContent = "방금 전";
    else elements["last-update"].textContent = `${Math.floor(elapsed / 1000)}초 전`;

    if (state.source === "serial" && elapsed > STALE_AFTER_MS) {
      setSourceStatus("error", "Arduino 연결됨 · 데이터 지연");
    } else if (state.source === "serial") {
      setSourceStatus("connected", "Arduino 데이터 수신 중");
    }
  }

  function setupBrowserSupport() {
    if ("serial" in navigator) return;
    elements["serial-button"].disabled = true;
    elements["serial-button"].title = "이 브라우저는 Web Serial을 지원하지 않습니다.";
    elements["serial-support-note"].textContent = "이 브라우저에서는 가상 모드만 사용할 수 있습니다. Arduino 연결은 데스크톱 Chrome 또는 Edge를 사용하세요.";
  }

  function bindEvents() {
    elements["serial-button"].addEventListener("click", connectSerial);
    elements["simulation-toggle"].addEventListener("change", toggleSimulation);
    elements["clear-button"].addEventListener("click", clearHistory);

    ["sim-pot", "sim-light", "sim-touch", "sim-distance"].forEach((id) => {
      elements[id].addEventListener("input", () => {
        updateSimulationLabels();
        if (state.source === "simulation" && !elements["auto-simulation"].checked) {
          receiveData(readSimulationControls(), "가상 센서");
        }
      });
    });

    window.addEventListener("resize", drawAllCharts);
    if ("serial" in navigator) {
      navigator.serial.addEventListener("disconnect", (event) => {
        if (event.target === state.serialPort) disconnectSerial(true);
      });
    }
  }

  function initialize() {
    cacheElements();
    bindEvents();
    setupBrowserSupport();
    updateCounters();
    updateCards();
    drawAllCharts();
    startSimulation();
    window.setInterval(updateFreshness, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
