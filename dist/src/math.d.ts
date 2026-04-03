/** Matrix (row-major) × vector */
export declare function matmul(A: number[][], x: number[]): number[];
/** Dot product */
export declare function dot(a: number[], b: number[]): number;
/** Outer product: a (column) × b (row) */
export declare function outer(a: number[], b: number[]): number[][];
/** Element-wise sigmoid */
export declare function sigmoid(x: number[]): number[];
/** Element-wise tanh */
export declare function tanhVec(x: number[]): number[];
/** Numerically stable softmax with temperature */
export declare function softmax(x: number[], temperature: number): number[];
/** Element-wise clamp */
export declare function clip(x: number[], min: number, max: number): number[];
/** Element-wise addition */
export declare function add(a: number[], b: number[]): number[];
/** Element-wise multiplication (Hadamard) */
export declare function mul(a: number[], b: number[]): number[];
/** Scalar multiply */
export declare function scale(a: number[], s: number): number[];
/** Zero vector */
export declare function zeros(n: number): number[];
/** Index of maximum value */
export declare function argmax(x: number[]): number;
/** Euclidean norm */
export declare function norm(x: number[]): number;
/** argsort descending — returns indices */
export declare function argsortDesc(x: number[]): number[];
