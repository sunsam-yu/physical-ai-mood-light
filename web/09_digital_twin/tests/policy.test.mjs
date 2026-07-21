import assert from "node:assert/strict";
import test from "node:test";
import { commandLine, decideAutomaticLight } from "../policy.mjs";

const normal = { mode: "AUTO", distance: 60, expression: "smile", confidence: 0.9, pot: 1023, light: 500 };
test("감지 범위 밖이면 조명을 끈다", () => assert.equal(decideAutomaticLight({ ...normal, distance: 151 }).action, "off"));
test("낮은 신뢰도에서는 이전 상태를 유지한다", () => assert.equal(decideAutomaticLight({ ...normal, confidence: 0.69 }).action, "hold"));
test("가변저항을 최대 밝기 상한으로 사용한다", () => {
  assert.equal(decideAutomaticLight(normal).brightness, 80);
  assert.equal(decideAutomaticLight({ ...normal, pot: 0 }).brightness, 0);
});
test("조도 방향 실측 전에는 조도 보정을 적용하지 않는다", () => assert.equal(decideAutomaticLight({ ...normal, light: 0 }).brightness, decideAutomaticLight({ ...normal, light: 1023 }).brightness));
test("적용 결과를 Arduino CSV 명령으로 만든다", () => assert.equal(commandLine(decideAutomaticLight(normal)), "LIGHT,255,170,40,80,AUTO\n"));
