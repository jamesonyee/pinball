function rayMarchToImpact(p0, v, dt, ballRadius) {
  // Move along the velocity vector in small steps until an obstacle is close
  const vNorm = v.copy().normalize();
  const maxDist = v.mag() * dt;
  let distTravelled = 0;

  const PRECISION = 0.0001; // smaller = more accurate
  const MAX_STEPS = 60;     // safety cap to prevent infinite loops

  for (let i = 0; i < MAX_STEPS && distTravelled < maxDist; i++) {
    const probe = p5.Vector.add(p0, p5.Vector.mult(vNorm, distTravelled));
    const [d, _] = distanceO(probe);
    if (d < ballRadius + PRECISION) break;          // near obstacle, stop marching
    distTravelled += max(d, 0.0002);   // march forward along ray
  }
  return distTravelled;
}

// ------------------------------------------------------------
// Ball Class
// Represents a single pinball in the game.
// Handles movement, collisions, and basic visual drawing.
// ------------------------------------------------------------
class Ball {
	constructor(r) {
		this.p = createVector(0, 0);  // position
		this.v = createVector(0, 0);  // velocity
		this.r = r;										// radius
		this.highlight = false;				// for debugging (shows red when colliding)

		// --- Visual state for ball-to-ball hits ---
		this.baseColor = color(200);        // default normal color
		this.flashColor = null;             // current flash color
		this.flashTimer = 0;                // ms remaining for flash
		this.flashDuration = 180;           // total flash time in ms (tweakable)
		this.flashScale = 1.0;              // visual size multiplier for pulse
		this.flashMaxScale = 1.25;         // how big the pulse gets
		this.flashFadeSpeed = 0.02;        // lerp amount per frame for color fade
		this.trailFlashColor = null;        // trail color override
	}

	draw() {
		push();
		translate(this.p.x, this.p.y);
		noStroke();

		const drawR = this.r * this.flashScale;
		const t = millis() * 0.0035;
		const speed = this.v.mag();

		// --- Hue cycle (yellow→green→aqua→blue→magenta→violet)
		colorMode(HSB);

		// Map sin cycle to hue range (60-300), avoids red (0-30)
		let hueShift = map(sin(t * 0.5), -1, 1, 60, 300); 
		let innerHue = hueShift;
		let midHue = (innerHue + 20) % 360;
		let outerHue = (innerHue + 50) % 360;

		// --- Outer gradient: soft, muted, almost silver in darkest parts
		let outerInner = color(innerHue, 50, 90);    // soft inner tone
		let outerMid   = color(midHue, 40, 70, 0.5); // gentle mid glow
		let outerOuter = color(outerHue, 25, 40, 0.0); // diffuse outer mist

		colorMode(RGB);

		// --- Glassy orb gradient
		for (let i = drawR; i > 0; i -= 0.6) {
			let p = i / drawR;
			let c = lerpColor(outerInner, outerMid, p * 0.7);
			if (p > 0.7) c = lerpColor(outerMid, outerOuter, (p - 0.7) / 0.3);
			fill(red(c), green(c), blue(c), 140 * (1 - p * 0.8));
			circle(0, 0, i * 2);
		}

		// --- Floating inner particle (dynamic, glowing)
		let floatRadius = drawR * 0.35;
		let floatX = sin(t * 2.5 + noise(t * 0.5) * 4) * floatRadius * 0.9 +
								 noise(t * 0.7, 99) * floatRadius * 0.4;
		let floatY = cos(t * 2.4 + noise(t * 0.6) * 4) * floatRadius * 0.9 +
								 noise(t * 0.8, 7) * floatRadius * 0.4;

		let particleR = drawR * 0.22 * (1 + 0.05 * sin(t * 5));

		drawingContext.shadowBlur = 16 + speed * 0.6;
		drawingContext.shadowColor = color(innerHue, 90, 100); // high-contrast inner
		fill(color(innerHue, 90, 100));
		circle(floatX, floatY, particleR);

		// --- Pulse shimmer of main orb (soft breathing)
		let pulse = 1 + sin(t * 4 + speed * 0.3) * 0.03;
		drawingContext.shadowBlur = 6 + speed * 0.4;
		drawingContext.shadowColor = color(innerHue, 90, 100);
		fill(color(innerHue, 90, 100));
		circle(0, 0, drawR * pulse);

		// --- Glass reflection (subtle highlight)
		fill(255, 255, 255, 70);
		let hlX = -drawR * 0.25 + this.v.x * 0.015;
		let hlY = -drawR * 0.25 + this.v.y * 0.015;
		ellipse(hlX, hlY, drawR * 0.25, drawR * 0.25);

		// --- Collision flash overlay (no red, safe neutral)
		if (this.flashColor) {
			let safeFlash = lerpColor(color(innerHue, 90, 100), color(220,220,220), 0.4); 
			drawingContext.shadowBlur = 8;
			drawingContext.shadowColor = safeFlash;
			fill(safeFlash);
			circle(0, 0, drawR * 1.04);
		}

		drawingContext.shadowBlur = 0;
		pop();
	}


  // Updates ball physics for one time step using
  // Symplectic Euler integration with continuous collision detection (CCD)
  timestep(dt) {
		const g = 9.81 * 0.113203 * HEIGHT / 2; // simple gravity term
    this.v.y += dt * g;

    // Continuous collision detection:
    // Estimate how far we can move safely before a collision occurs
		
		// 🧭 Apply speedFactor to ray-march velocity to keep CCD accurate at all speeds
		const marchDist = rayMarchToImpact(this.p, p5.Vector.mult(this.v, speedFactor), dt, this.r); 
		
    const moveFrac = constrain(marchDist / (this.v.mag() * dt + 1e-6), 0, 1);
    const effectiveDt = dt * moveFrac;
		
		// Move the ball up to the first collision point (scaled by speed factor)
		vacc(this.p, effectiveDt * speedFactor, this.v);

		
    // Check if we collided with any obstacle
    let [d, obstacle] = distanceO(this.p);
    let n = obstacle.normal(this.p);
    let vn = this.v.dot(n) - obstacle.velocity(this.p).dot(n);
    this.highlight = (d < this.r); // mark red when inside obstacle (debug)
		
		// Collision response
    if (d < this.r && vn < 0) {
			if (obstacle instanceof Flipper) {
				console.log(`Flipper: omega=${obstacle.omega}, velocity=${obstacle.velocity(this.p)}`);
			}
      // Compute bounce using restitution
      let eps = obstacle.getCOR();
      vn *= -(1 + eps);
      let impulse = p5.Vector.mult(n, vn);
      this.v.add(impulse);
			
			// Extra boost if hit by a moving flipper
      if (obstacle instanceof Flipper && obstacle.isMoving()) {
        const kickPower = 0.1 * obstacle.omega;
        this.v.add(p5.Vector.mult(n, kickPower));
      }

      // Notify obstacle for sound or particle effects
      obstacle.notifyOfCollision();

			// Positional correction to prevent sinking
      this.p.add(p5.Vector.mult(n, this.r - d));
		}
		
		// --- Flash / pulse decay (visual only) ---
		if (this.flashTimer > 0) {
			// decrement timer based on real time: convert dt (seconds) -> ms
			this.flashTimer = Math.max(0, this.flashTimer - dt * 1000);

			// fade flashColor towards baseColor
			if (this.flashColor) {
				// lerpColor needs two p5 color objects; lerp a bit each frame
				this.flashColor = lerpColor(this.flashColor, this.baseColor, this.flashFadeSpeed);
			}

			// gently bring pulse back to normal
			this.flashScale += (1.0 - this.flashScale) * 0.25; // smooth damping
		} else {
			// ensure it finishes fully reset
			this.flashColor = null;
			this.trailFlashColor = null;
			this.flashScale += (1.0 - this.flashScale) * 0.4;
			if (abs(this.flashScale - 1.0) < 0.002) this.flashScale = 1.0;
		}


		// Move remaining time after the collision (if any)
		if (moveFrac < 1.0) {
			const remainingDt = dt * (1.0 - moveFrac);
			vacc(this.p, remainingDt, this.v);
		}
	}
}