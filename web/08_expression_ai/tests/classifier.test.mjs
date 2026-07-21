import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SAMPLES,
  KnnClassifier,
  PredictionStabilizer,
  blendshapesToFeatures
} from "../classifier.mjs";

test("좌우 blendshape 평균을 교육용 특징값으로 바꾼다", () => {
  const features = blendshapesToFeatures([
    { categoryName: "mouthSmileLeft", score: 0.8 },
    { categoryName: "mouthSmileRight", score: 0.6 },
    { categoryName: "jawOpen", score: 0.3 }
  ]);
  assert.equal(features.mouthSmile, 0.7);
  assert.equal(features.jawOpen, 0.3);
});

test("KNN은 미소 예시와 가까운 특징을 미소로 분류한다", () => {
  const classifier = trainedDemoClassifier();
  const result = classifier.predict({ mouthSmile: 0.84, jawOpen: 0.2, eyeWide: 0.12, browInnerUp: 0.1, browDown: 0.04, mouthFrown: 0.01 });
  assert.equal(result.label, "smile");
  assert.ok(result.confidence > 0.5);
});

test("모든 범주가 하나 이상 있어야 분류 시작 조건을 만족한다", () => {
  const classifier = new KnnClassifier();
  classifier.addSample("neutral", DEMO_SAMPLES.neutral[0]);
  assert.equal(classifier.hasEveryLabel(), false);
  Object.entries(DEMO_SAMPLES).forEach(([label, samples]) => classifier.addSample(label, samples[0]));
  assert.equal(classifier.hasEveryLabel(), true);
});

test("최근 결과가 기준 비율 이상 같을 때만 안정 결과를 낸다", () => {
  const stabilizer = new PredictionStabilizer(5, 0.6);
  assert.equal(stabilizer.push("smile"), null);
  assert.equal(stabilizer.push("neutral"), null);
  assert.equal(stabilizer.push("smile"), "smile");
});

function trainedDemoClassifier() {
  const classifier = new KnnClassifier(3);
  Object.entries(DEMO_SAMPLES).forEach(([label, samples]) => classifier.addSamples(label, samples));
  return classifier;
}
