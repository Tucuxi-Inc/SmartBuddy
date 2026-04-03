/** Matrix (row-major) × vector */
export function matmul(A: number[][], x: number[]): number[] {
  return A.map(row => dot(row, x));
}

/** Dot product */
export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Outer product: a (column) × b (row) */
export function outer(a: number[], b: number[]): number[][] {
  return a.map(ai => b.map(bj => ai * bj));
}

/** Element-wise sigmoid */
export function sigmoid(x: number[]): number[] {
  return x.map(v => 1 / (1 + Math.exp(-v)));
}

/** Element-wise tanh */
export function tanhVec(x: number[]): number[] {
  return x.map(v => Math.tanh(v));
}

/** Numerically stable softmax with temperature */
export function softmax(x: number[], temperature: number): number[] {
  if (temperature <= 0) {
    const idx = argmax(x);
    return x.map((_, i) => i === idx ? 1 : 0);
  }
  const max = Math.max(...x);
  const exps = x.map(v => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(v => v / sum);
}

/** Element-wise clamp */
export function clip(x: number[], min: number, max: number): number[] {
  return x.map(v => Math.max(min, Math.min(max, v)));
}

/** Element-wise addition */
export function add(a: number[], b: number[]): number[] {
  return a.map((v, i) => v + b[i]);
}

/** Element-wise multiplication (Hadamard) */
export function mul(a: number[], b: number[]): number[] {
  return a.map((v, i) => v * b[i]);
}

/** Scalar multiply */
export function scale(a: number[], s: number): number[] {
  return a.map(v => v * s);
}

/** Zero vector */
export function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

/** Index of maximum value */
export function argmax(x: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < x.length; i++) {
    if (x[i] > x[maxIdx]) maxIdx = i;
  }
  return maxIdx;
}

/** Euclidean norm */
export function norm(x: number[]): number {
  return Math.sqrt(x.reduce((s, v) => s + v * v, 0));
}

/** argsort descending — returns indices */
export function argsortDesc(x: number[]): number[] {
  return x.map((v, i) => i).sort((a, b) => x[b] - x[a]);
}
