// ▦ Draws raster of scene SDF 
function drawSDFRaster() {
	push();
	// Warning: slow for small h due to draw call overhead
	const h = 0.01;
	noStroke(); { // BLACK BACKGROUND
		rectMode(CORNERS);
		fill(0);
		rect(0, 0, WIDTH, HEIGHT);
	}
	rectMode(CENTER); // --> square(x,y,h) of width h centered at (x,y)
	for (let x = h / 2; x < WIDTH; x += h) {
		for (let y = h / 2; y < HEIGHT; y += h) {
			let distO = distanceO(vec2(x, y));
			let d = distO[0];
			let o = distO[1];
			if (d <= 0) { // BLUE obstacles
				fill(0, 0, abs(d) * 255 / WIDTH * 10);
			} else { // ORANGE distances
				let r = 255 * d / WIDTH * 4.5;
				let g = 165 * d / WIDTH * 4.5;
				fill(r, g, 0);
			}
			square(x, y, h);
		}
	}
	// DRAW GRID LINES:
	strokeWeight(0.001);
	stroke(255);
	for (z = 0; z <= 1; z += 0.1) {
		line(z, 0, z, 1);
		line(0, z, 1, z);
	}

	// DRAW XY AXES (reassure everyone that the world really is upside down 🙃)
	{
		let arrowH = 0.1; // arrow size 
		let headH = 0.01; // arrowhead size
		strokeWeight(0.01);
		// X Arrow:
		stroke("red");
		line(0, 0, arrowH, 0);
		line(arrowH, 0, arrowH - headH, headH)
		// Y Arrow:
		stroke("lime");
		line(0, 0.005, 0, arrowH);
		line(0, arrowH, headH, arrowH - headH)
	}
	pop();
}

////////////////////////////////////////////////////////////
// Some 2D Signed Distance Fields. Feel free to add more! //
// See https://iquilezles.org/articles/distfunctions2d    // 
// Uses GLSL-like javascript macros below                 //
////////////////////////////////////////////////////////////
class SDF {

	/**
	 * Computes SDF union distance value, min(d1,d2), and its corresponding object reference.
	 * @param distO1 {[number,object]} Obstacle #1's SDF value, d, and object ref, o, as an array [d1,o1].
	 * @param distO2 {[number,object]} Obstacle #2's SDF value, d, and object ref, o, as an array [d2,o2].
	 * @return {[number,object]} Returns [d1,o1] if d1<d2, and [d2,o2] otherwise.
	 */
	static opUnion(distO1, distO2) {
		return (distO1[0] < distO2[0]) ? distO1 : distO2;
	}
	/**
	 * Computes SDF intersection distance value, max(d1,d2), and its corresponding object reference.
	 * @param distO1 {[number,object]} Obstacle #1's SDF value, d, and object ref, o, as an array [d1,o1].
	 * @param distO2 {[number,object]} Obstacle #2's SDF value, d, and object ref, o, as an array [d2,o2].
	 * @return {[number,object]} Returns [d1,o1] if d1>d2, and [d2,o2] otherwise.
	 */
	static opIntersection(distO1, distO2) {
		return (distO1[0] > distO2[0]) ? distO1 : distO2;
	}

	// ANOTHER BOOLEAN YOU MAY WANT TO USE:
	//float opSubtraction ( float d1, float d2 ) { return max(-d1,d2);}

	/**
	 * 🟢 SDF of a circle at origin.
	 * @param {p5.Vector} p Evaluation point
	 * @param {number}    r Radius
	 * @return {number}   SDF value
	 */
	static sdCircle(p, r) {
		return length(p) - r;
	}
	/**
	 * 🔲 SDF of a box at origin
	 * @param {p5.Vector} p Evaluation point
	 * @param {p5.Vector} b Half widths in X & Y
	 * @return {number}   SDF value
	 */
	static sdBox(p, b) {
		let d = vsub(vabs(p), b);
		return length(vmax(d, 0.0)) + min(max(d.x, d.y), 0.0);
	}

	/** 
	 * 🌀 Uneven Capsule - exact   (https://www.shadertoy.com/view/4lcBWn)
	 * @param {p5.Vector} q  Evaluation point
	 * @param {number}    r1 
	 * @param {number}    r2
	 * @param {number}    h  
	 */
	static sdUnevenCapsule(q, r1, r2, h) {
		// p.x = abs(p.x);
		let p = vec2(abs(q.x), q.y); // local copy to avoid changing pass-by-ref input
		const b = (r1 - r2) / h;
		const a = Math.sqrt(1.0 - b * b);
		const k = dot(p, vec2(-b, a));
		if (k < 0.0) return length(p) - r1;
		if (k > a * h) return length(vsub(p, vec2(0.0, h))) - r2;
		return dot(p, vec2(a, b)) - r1;
	}
	
	static sdTriangle(p, p0, p1, p2) {
		let e0 = vsub(p1, p0);      
    let e1 = vsub(p2, p1);      
    let e2 = vsub(p0, p2);      
    
    let v0 = vsub(p, p0);
    let v1 = vsub(p, p1);
    let v2 = vsub(p, p2);
    
    let pq0 = vsub(v0, vmult(e0, clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0)));
    let pq1 = vsub(v1, vmult(e1, clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0)));
    let pq2 = vsub(v2, vmult(e2, clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0)));
    
    let s = sign(e0.x * e2.y - e0.y * e2.x);
    
    let d0 = vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x));
    let d1 = vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x));
    let d2 = vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x));
    
    let d = d0;
    if (d1.x < d.x) d = d1;
    if (d2.x < d.x) d = d2;
    
    return -Math.sqrt(d.x) * sign(d.y);
	}
	
	static sdSegment(p, a, b ) {
		let pa = vsub(p,a); 
		let ba = vsub(b,a);
		let h =  vec2(clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 ));
		return length( vsub(pa, vmult(ba,h)));
	}
}

