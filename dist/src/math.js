/** Matrix (row-major) × vector */
export function matmul(A, x) {
    return A.map(row => dot(row, x));
}
/** Dot product */
export function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++)
        s += a[i] * b[i];
    return s;
}
/** Outer product: a (column) × b (row) */
export function outer(a, b) {
    return a.map(ai => b.map(bj => ai * bj));
}
/** Element-wise sigmoid */
export function sigmoid(x) {
    return x.map(v => 1 / (1 + Math.exp(-v)));
}
/** Element-wise tanh */
export function tanhVec(x) {
    return x.map(v => Math.tanh(v));
}
/** Numerically stable softmax with temperature */
export function softmax(x, temperature) {
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
export function clip(x, min, max) {
    return x.map(v => Math.max(min, Math.min(max, v)));
}
/** Element-wise addition */
export function add(a, b) {
    return a.map((v, i) => v + b[i]);
}
/** Element-wise multiplication (Hadamard) */
export function mul(a, b) {
    return a.map((v, i) => v * b[i]);
}
/** Scalar multiply */
export function scale(a, s) {
    return a.map(v => v * s);
}
/** Zero vector */
export function zeros(n) {
    return new Array(n).fill(0);
}
/** Index of maximum value */
export function argmax(x) {
    let maxIdx = 0;
    for (let i = 1; i < x.length; i++) {
        if (x[i] > x[maxIdx])
            maxIdx = i;
    }
    return maxIdx;
}
/** Euclidean norm */
export function norm(x) {
    return Math.sqrt(x.reduce((s, v) => s + v * v, 0));
}
/** argsort descending — returns indices */
export function argsortDesc(x) {
    return x.map((v, i) => i).sort((a, b) => x[b] - x[a]);
}
//# sourceMappingURL=math.js.map