const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

export function parseDeviceLine(rawLine) {
  const line = String(rawLine ?? "").trim();
  if (!line) return { ok: false, error: "빈 데이터" };

  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    return { ok: false, error: `JSON 오류: ${error.message}` };
  }

  if (!message || Array.isArray(message) || typeof message !== "object") {
    return { ok: false, error: "JSON 객체가 아님" };
  }

  if (message.type === "sensor") {
    const pot = Number(message.pot);
    const light = Number(message.light);
    const distance = message.distance === null ? null : Number(message.distance);
    if (!Number.isFinite(pot) || pot < 0 || pot > 1023) return { ok: false, error: "가변저항 범위 오류" };
    if (!Number.isFinite(light) || light < 0 || light > 1023) return { ok: false, error: "조도센서 범위 오류" };
    if (typeof message.touch !== "boolean") return { ok: false, error: "터치센서 형식 오류" };
    if (distance !== null && (!Number.isFinite(distance) || distance < 0 || distance > 500)) {
      return { ok: false, error: "거리센서 범위 오류" };
    }
    return { ok: true, message: { ...message, pot, light, distance } };
  }

  if (message.type === "light_state") {
    const channels = ["r", "g", "b"].map((key) => Number(message[key]));
    const brightness = Number(message.brightness);
    if (channels.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
      return { ok: false, error: "RGB 범위 오류" };
    }
    if (!Number.isInteger(brightness) || brightness < 0 || brightness > 80) {
      return { ok: false, error: "조명 밝기 범위 오류" };
    }
    if (!["AUTO", "MANUAL"].includes(message.mode)) return { ok: false, error: "조명 모드 오류" };
    return {
      ok: true,
      message: { ...message, r: channels[0], g: channels[1], b: channels[2], brightness }
    };
  }

  if (["status", "error"].includes(message.type)) return { ok: true, message };
  return { ok: false, error: `알 수 없는 메시지 종류: ${message.type ?? "없음"}` };
}

export function normalizeLightCommand(raw) {
  const color = Array.isArray(raw?.color) ? raw.color : [raw?.r, raw?.g, raw?.b];
  const [r, g, b] = color.map(Number);
  if ([r, g, b].some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    throw new Error("RGB는 0~255 정수여야 합니다.");
  }
  const brightness = Math.round(clamp(raw?.brightness, 0, 80));
  if (!Number.isFinite(brightness)) throw new Error("밝기가 숫자가 아닙니다.");
  const mode = String(raw?.mode ?? "").toUpperCase();
  if (!["AUTO", "MANUAL"].includes(mode)) throw new Error("모드는 AUTO 또는 MANUAL이어야 합니다.");
  return { r, g, b, brightness, mode };
}

export function serializeLightCommand(raw) {
  const command = normalizeLightCommand(raw);
  return `LIGHT,${command.r},${command.g},${command.b},${command.brightness},${command.mode}\n`;
}

export function commandSignature(raw) {
  const command = normalizeLightCommand(raw);
  return `${command.r},${command.g},${command.b},${command.brightness},${command.mode}`;
}

export function nextModeFromTouch(previousTouch, currentTouch, currentMode) {
  if (previousTouch !== false || currentTouch !== true) return currentMode;
  return currentMode === "AUTO" ? "MANUAL" : "AUTO";
}

export function shouldSendAutomaticCommand(lastSignature, command) {
  if (!command) return false;
  return commandSignature(command) !== lastSignature;
}
