export const EXPRESSION_LIGHTS = Object.freeze({
  smile: { name: "미소", color: [255, 170, 40] },
  neutral: { name: "중립", color: [90, 150, 255] },
  surprised: { name: "놀란 표정", color: [175, 80, 255] },
  frown: { name: "찡그린 표정", color: [40, 210, 145] }
});

export function decideAutomaticLight(input, config = {}) {
  const settings = { maxDistance: 150, minConfidence: 0.7, maxBrightness: 80, lightDirection: "unknown", ...config };
  if (input.mode !== "AUTO") return { action: "hold", reason: "수동 모드" };
  if (!Number.isFinite(input.distance)) return { action: "off", reason: "거리 측정 실패" };
  if (input.distance > settings.maxDistance) return { action: "off", reason: "사람이 감지 범위 밖에 있음" };
  if (!EXPRESSION_LIGHTS[input.expression]) return { action: "hold", reason: "안정된 표정 결과를 기다리는 중" };
  if (!Number.isFinite(input.confidence) || input.confidence < settings.minConfidence) return { action: "hold", reason: "분류 신뢰도가 기준보다 낮음" };
  const userLimit = Math.round(clamp(input.pot, 0, 1023) / 1023 * settings.maxBrightness);
  let environmentFactor = 1;
  if (settings.lightDirection === "higher_is_brighter") environmentFactor = 1 - 0.65 * clamp(input.light, 0, 1023) / 1023;
  else if (settings.lightDirection === "lower_is_brighter") environmentFactor = 0.35 + 0.65 * clamp(input.light, 0, 1023) / 1023;
  const brightness = Math.round(clamp(userLimit * environmentFactor, 0, settings.maxBrightness));
  const preset = EXPRESSION_LIGHTS[input.expression];
  return { action: "apply", reason: `${preset.name} 자동 조명`, color: preset.color, brightness };
}

export function commandLine(decision) {
  if (decision.action === "off") return "LIGHT,0,0,0,0,AUTO\n";
  if (decision.action !== "apply") return null;
  return `LIGHT,${decision.color.join(",")},${decision.brightness},AUTO\n`;
}

function clamp(value, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}
