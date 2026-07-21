(function attachSensorDataParser(globalScope) {
  "use strict";

  const KEY_ALIASES = {
    pot: new Set(["pot", "potentiometer", "potvalue", "a0", "가변저항"]),
    light: new Set(["light", "lightvalue", "brightnesssensor", "a5", "조도", "조도센서"]),
    touch: new Set(["touch", "touched", "touchdetected", "d13", "터치", "터치센서"]),
    distance: new Set(["distance", "distancecm", "range", "rangecm", "거리", "거리cm", "초음파", "초음파센서"])
  };

  function normalizeKey(key) {
    return String(key)
      .trim()
      .toLowerCase()
      .replace(/[\s_()\[\].-]/g, "");
  }

  function canonicalKey(key) {
    const normalized = normalizeKey(key);
    return Object.keys(KEY_ALIASES).find((name) => KEY_ALIASES[name].has(normalized)) || null;
  }

  function parseFiniteNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value !== "string") return null;
    const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function parseTouch(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }

    const normalized = String(value).trim().toLowerCase().replace(/\s/g, "");
    const truthy = ["1", "true", "high", "on", "yes", "감지", "눌림", "터치됨"];
    const falsy = ["0", "false", "low", "off", "no", "없음", "안눌림", "감지안됨"];
    if (truthy.includes(normalized)) return true;
    if (falsy.includes(normalized)) return false;
    return null;
  }

  function validateField(key, rawValue) {
    if (key === "touch") {
      const touch = parseTouch(rawValue);
      return touch === null
        ? { valid: false, message: `터치값 '${rawValue}'을(를) 해석할 수 없습니다.` }
        : { valid: true, value: touch };
    }

    if (key === "distance") {
      if (rawValue === null || String(rawValue).includes("측정 실패")) {
        return { valid: true, value: null };
      }
      const distance = parseFiniteNumber(rawValue);
      if (distance === -1) return { valid: true, value: null };
      if (distance === null || distance < 0 || distance > 500) {
        return { valid: false, message: `거리값 '${rawValue}'이(가) 0~500cm 범위를 벗어났습니다.` };
      }
      return { valid: true, value: distance };
    }

    const number = parseFiniteNumber(rawValue);
    if (number === null || number < 0 || number > 1023) {
      const label = key === "pot" ? "가변저항" : "조도";
      return { valid: false, message: `${label}값 '${rawValue}'이(가) 0~1023 범위를 벗어났습니다.` };
    }
    return { valid: true, value: Math.round(number) };
  }

  function normalizeObject(source) {
    const data = {};
    const warnings = [];
    let recognized = 0;

    Object.entries(source).forEach(([rawKey, rawValue]) => {
      const key = canonicalKey(rawKey);
      if (!key) return;
      recognized += 1;
      const checked = validateField(key, rawValue);
      if (checked.valid) data[key] = checked.value;
      else warnings.push(checked.message);
    });

    if (recognized === 0) {
      return { ok: false, error: "알려진 센서 키가 없습니다." };
    }
    if (Object.keys(data).length === 0) {
      return { ok: false, error: warnings.join(" ") || "사용할 수 있는 센서값이 없습니다." };
    }
    return { ok: true, data, warnings };
  }

  function parseKeyValueLine(line) {
    const pairs = {};
    line.split(/[|,;]/).forEach((part) => {
      const separatorIndex = part.search(/[:=]/);
      if (separatorIndex < 0) return;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) pairs[key] = value;
    });
    return normalizeObject(pairs);
  }

  function parseCsvLine(line) {
    const fields = line.split(",").map((field) => field.trim());
    if (fields.length !== 4) {
      return { ok: false, error: "CSV 데이터는 pot,light,touch,distance 순서의 4개 값이어야 합니다." };
    }
    const normalized = normalizeObject({
      pot: fields[0],
      light: fields[1],
      touch: fields[2],
      distance: fields[3]
    });
    if (normalized.ok) normalized.format = "csv";
    return normalized;
  }

  function parseSensorLine(rawLine) {
    const line = String(rawLine ?? "").trim();
    if (!line) return { ok: false, error: "빈 데이터입니다." };

    if (line.startsWith("{")) {
      try {
        const parsed = JSON.parse(line);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          return { ok: false, error: "JSON은 센서 키가 들어 있는 객체여야 합니다." };
        }
        const normalized = normalizeObject(parsed);
        if (normalized.ok) normalized.format = "json";
        return normalized;
      } catch (error) {
        return { ok: false, error: `JSON 문법 오류: ${error.message}` };
      }
    }

    if (/[:=]/.test(line)) {
      const normalized = parseKeyValueLine(line);
      if (normalized.ok) normalized.format = "key-value";
      return normalized;
    }

    return parseCsvLine(line);
  }

  const api = { parseSensorLine, normalizeKey };
  globalScope.SensorDataParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
