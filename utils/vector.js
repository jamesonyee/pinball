/////////////////////////////////////////////////////////////////
// Some convenient GLSL-like macros for p5.Vector calculations //
/////////////////////////////////////////////////////////////////
function length(v) {
	return v.mag();
}

function dot(x, y) {
	return x.dot(y);
}

function dot2(x) {
	return x.dot(x);
}

function vec2(a, b) {
	return createVector(a, b);
}

function vec3(a, b, c) {
	return createVector(a, b, c);
}

function sign(n) {
	return Math.sign(n);
}

// Constrains number, n, to [lo,hi].
function clamp(n, lo, hi) {
	return constrain(n, lo, hi);
}
// Constrains components of Vector, v, to [lo,hi].
// @returns A new Vector.
function vclamp(v, lo, hi) {
	return createVector(constrain(v.x,lo,hi), constrain(v.y,lo,hi), constrain(v.z,lo,hi));
}
// v+w: Vector addition (to avoid confusion with p5.j2 "add" function)
// @returns A new Vector.
function vadd(v, w) {
	return p5.Vector.add(v, w);
}
// v-w: Vector subtraction
// @returns A new Vector.
function vsub(v, w) {
	return p5.Vector.sub(v, w);
}
// v += scale*w:  In-place accumulation of a scaled vector, w, into v.
function vacc(v, scale, w) {
	v.x += scale * w.x;
	v.y += scale * w.y;
}
// Returns a*X for scalar a and Vector X.
// @returns A new Vector.
function vax(a, X) {
	return vec2(a*X.x + Y.x, a*X.y+Y.y); // :P
}
// Returns a*X + Y for scalar a and Vectors X & Y.
// @returns A new Vector.
function vaxpy(a, X, Y) {
	return vec2(a*X.x + Y.x, a*X.y+Y.y); // :P
}
// Returns a*X + b*Y for scalars a & b and Vectors X & Y.
// @returns A new Vector.
function vaxpby(a, X, b, Y) {
	return vec2(a*X.x + b*Y.x, a*X.y + b*Y.y); // :S
}
// Returns a new scaled vector, (v.x*scale, v.y*scale).
// @returns A new Vector.
function vmult(v, scale) {
	return vec2(v.x*scale, v.y*scale);	
}
// Absolute value of vector components: (|v.x|, |v.y|).
// @returns A new Vector.
function vabs(v) {
	return vec2(Math.abs(v.x), Math.abs(v.y));
}
// Component-wise max with a scalar, n
// @returns A new Vector.
function vmax(v, n) {
	return vec2(Math.max(v.x, n), Math.max(v.y, n));
}
// Component-wise min with a scalar, n
// @returns A new Vector.
function vmin(v, n) {
	return vec2(Math.min(v.x, n), Math.min(v.y, n));
}
// Shape vertex call with vec2 argument.
function vvertex(p) {
	vertex(p.x, p.y);
}
// 2D rotation of a vec2 by θ (radians).
// @returns A new Vector.
function vrotate(v, θ) {
	const c = cos(θ);
	const s = sin(θ);
	return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}