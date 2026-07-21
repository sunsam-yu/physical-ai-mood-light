export const LABELS = [
  { id: "smile", name: "미소", icon: "😊" },
  { id: "neutral", name: "중립", icon: "😐" },
  { id: "surprised", name: "놀란 표정", icon: "😮" },
  { id: "frown", name: "찡그린 표정", icon: "😣" }
];

export const FEATURES = [
  { key: "mouthSmile", label: "입꼬리 올라감" },
  { key: "jawOpen", label: "입 벌림" },
  { key: "eyeWide", label: "눈 크게 뜸" },
  { key: "browInnerUp", label: "눈썹 안쪽 올라감" },
  { key: "browDown", label: "눈썹 내림" },
  { key: "mouthFrown", label: "입꼬리 내려감" }
];

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const average = (...values) => values.reduce((sum, value) => sum + clamp01(value), 0) / values.length;

export function blendshapesToFeatures(categories = []) {
  const scores = Object.fromEntries(categories.map(({ categoryName, score }) => [categoryName, score]));
  return {
    mouthSmile: average(scores.mouthSmileLeft, scores.mouthSmileRight),
    jawOpen: clamp01(scores.jawOpen),
    eyeWide: average(scores.eyeWideLeft, scores.eyeWideRight),
    browInnerUp: clamp01(scores.browInnerUp),
    browDown: average(scores.browDownLeft, scores.browDownRight),
    mouthFrown: average(scores.mouthFrownLeft, scores.mouthFrownRight)
  };
}

export function vectorFromFeatures(features) {
  return FEATURES.map(({ key }) => clamp01(features?.[key]));
}

export class KnnClassifier {
  constructor(k = 5) {
    this.k = k;
    this.samples = [];
  }

  addSample(label, features) {
    if (!LABELS.some((item) => item.id === label)) throw new Error(`알 수 없는 범주: ${label}`);
    this.samples.push({ label, vector: vectorFromFeatures(features) });
  }

  addSamples(label, featureList) {
    featureList.forEach((features) => this.addSample(label, features));
  }

  clear() {
    this.samples = [];
  }

  count(label) {
    return this.samples.filter((sample) => sample.label === label).length;
  }

  hasEveryLabel() {
    return LABELS.every(({ id }) => this.count(id) > 0);
  }

  predict(features) {
    if (!this.samples.length) return null;
    const vector = vectorFromFeatures(features);
    const nearest = this.samples
      .map((sample) => ({ ...sample, distance: euclideanDistance(vector, sample.vector) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Math.min(this.k, this.samples.length));

    const votes = {};
    nearest.forEach(({ label, distance }) => {
      votes[label] = (votes[label] || 0) + 1 / Math.max(distance, 0.001);
    });
    const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    const total = ranked.reduce((sum, [, score]) => sum + score, 0);
    return {
      label: ranked[0][0],
      confidence: ranked[0][1] / total,
      neighbors: nearest.map(({ label, distance }) => ({ label, distance }))
    };
  }
}

export class PredictionStabilizer {
  constructor(windowSize = 7, minAgreement = 0.6, minSamples = 3) {
    this.windowSize = windowSize;
    this.minAgreement = minAgreement;
    this.minSamples = minSamples;
    this.history = [];
  }

  push(label) {
    this.history.push(label);
    if (this.history.length > this.windowSize) this.history.shift();
    if (this.history.length < this.minSamples) return null;
    const counts = this.history.reduce((all, item) => ({ ...all, [item]: (all[item] || 0) + 1 }), {});
    const [winner, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return count / this.history.length >= this.minAgreement ? winner : null;
  }

  clear() {
    this.history = [];
  }
}

function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

export const DEMO_SAMPLES = {
  smile: [
    { mouthSmile: 0.9, jawOpen: 0.15, eyeWide: 0.1, browInnerUp: 0.08, browDown: 0.05, mouthFrown: 0.02 },
    { mouthSmile: 0.75, jawOpen: 0.28, eyeWide: 0.18, browInnerUp: 0.12, browDown: 0.06, mouthFrown: 0.03 }
  ],
  neutral: [
    { mouthSmile: 0.08, jawOpen: 0.04, eyeWide: 0.08, browInnerUp: 0.08, browDown: 0.08, mouthFrown: 0.04 },
    { mouthSmile: 0.14, jawOpen: 0.07, eyeWide: 0.12, browInnerUp: 0.1, browDown: 0.09, mouthFrown: 0.06 }
  ],
  surprised: [
    { mouthSmile: 0.08, jawOpen: 0.9, eyeWide: 0.82, browInnerUp: 0.72, browDown: 0.02, mouthFrown: 0.03 },
    { mouthSmile: 0.05, jawOpen: 0.78, eyeWide: 0.7, browInnerUp: 0.65, browDown: 0.04, mouthFrown: 0.02 }
  ],
  frown: [
    { mouthSmile: 0.03, jawOpen: 0.08, eyeWide: 0.08, browInnerUp: 0.22, browDown: 0.78, mouthFrown: 0.7 },
    { mouthSmile: 0.04, jawOpen: 0.12, eyeWide: 0.1, browInnerUp: 0.18, browDown: 0.68, mouthFrown: 0.82 }
  ]
};
