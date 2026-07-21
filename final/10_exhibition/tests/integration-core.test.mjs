import test from "node:test";
import assert from "node:assert/strict";
import {
  commandSignature,
  nextModeFromTouch,
  normalizeLightCommand,
  parseDeviceLine,
  serializeLightCommand,
  shouldSendAutomaticCommand
} from "../integration-core.mjs";

test("최종 센서 JSON을 해석한다", () => {
  const result = parseDeviceLine('{"type":"sensor","pot":512,"light":850,"touch":true,"distance":30.2}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.message, { type: "sensor", pot: 512, light: 850, touch: true, distance: 30.2 });
});

test("거리 측정 실패 null을 허용한다", () => {
  assert.equal(parseDeviceLine('{"type":"sensor","pot":0,"light":15,"touch":false,"distance":null}').ok, true);
});

test("실제 조명 상태의 범위를 검사한다", () => {
  assert.equal(parseDeviceLine('{"type":"light_state","r":255,"g":170,"b":40,"brightness":80,"mode":"AUTO"}').ok, true);
  assert.equal(parseDeviceLine('{"type":"light_state","r":300,"g":0,"b":0,"brightness":80,"mode":"AUTO"}').ok, false);
});

test("조명 명령을 Arduino CSV로 직렬화한다", () => {
  assert.equal(serializeLightCommand({ color: [255, 170, 40], brightness: 42, mode: "AUTO" }), "LIGHT,255,170,40,42,AUTO\n");
});

test("밝기는 안전 범위로 제한한다", () => {
  assert.equal(normalizeLightCommand({ r: 1, g: 2, b: 3, brightness: 100, mode: "manual" }).brightness, 80);
});

test("터치 상승 에지에서만 모드를 바꾼다", () => {
  assert.equal(nextModeFromTouch(false, true, "MANUAL"), "AUTO");
  assert.equal(nextModeFromTouch(true, true, "AUTO"), "AUTO");
  assert.equal(nextModeFromTouch(true, false, "AUTO"), "AUTO");
});

test("같은 자동 명령은 반복 전송하지 않는다", () => {
  const command = { color: [90, 150, 255], brightness: 30, mode: "AUTO" };
  const signature = commandSignature(command);
  assert.equal(shouldSendAutomaticCommand(null, command), true);
  assert.equal(shouldSendAutomaticCommand(signature, command), false);
});
