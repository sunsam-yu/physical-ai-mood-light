"use strict";

const assert = require("node:assert/strict");
const { parseSensorLine, normalizeKey } = require("../data-parser.js");

function expectData(input, expected, expectedFormat) {
  const result = parseSensorLine(input);
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(result.data, expected);
  assert.equal(result.format, expectedFormat);
}

assert.equal(normalizeKey("distance_cm"), "distancecm");
assert.equal(normalizeKey("거리(cm)"), "거리cm");

expectData(
  '{"pot":512,"light":730,"touch":false,"distance":38.4}',
  { pot: 512, light: 730, touch: false, distance: 38.4 },
  "json"
);

expectData(
  '{"type":"sensor","pot":512,"light":730,"touch":false,"distance":38.4,"brightness":40,"color":1}',
  { pot: 512, light: 730, touch: false, distance: 38.4 },
  "json"
);

expectData(
  '{"potentiometer":"100","light_value":200,"touched":"HIGH","distance_cm":null}',
  { pot: 100, light: 200, touch: true, distance: null },
  "json"
);

expectData(
  "512,730,0,38.4",
  { pot: 512, light: 730, touch: false, distance: 38.4 },
  "csv"
);

expectData(
  "pot=512, light=730, touch=1, distance=-1",
  { pot: 512, light: 730, touch: true, distance: null },
  "key-value"
);

expectData(
  "가변저항: 512 | 조도: 730 | 터치: 감지 | 거리(cm): 38.4 | 밝기: 40",
  { pot: 512, light: 730, touch: true, distance: 38.4 },
  "key-value"
);

expectData(
  "가변저항: 512 | 조도: 730 | 터치: 없음 | 거리(cm): 측정 실패",
  { pot: 512, light: 730, touch: false, distance: null },
  "key-value"
);

const partialWarning = parseSensorLine('{"pot":2048,"light":700,"touch":true,"distance":20}');
assert.equal(partialWarning.ok, true);
assert.deepEqual(partialWarning.data, { light: 700, touch: true, distance: 20 });
assert.equal(partialWarning.warnings.length, 1);

const malformed = parseSensorLine("{not json}");
assert.equal(malformed.ok, false);
assert.match(malformed.error, /JSON 문법 오류/);

const unknown = parseSensorLine('{"temperature":23}');
assert.equal(unknown.ok, false);
assert.match(unknown.error, /센서 키/);

const badCsv = parseSensorLine("1,2,3");
assert.equal(badCsv.ok, false);
assert.match(badCsv.error, /4개 값/);

console.log("모든 파서 테스트 통과 (11개 시나리오)");
