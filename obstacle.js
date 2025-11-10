//////////////////////////////////////////////
// Base (abstract) class for your obstacles //
//////////////////////////////////////////////
class Obstacle {
	constructor() {
		this.signMultiplier = 1; //outside
		this.COR = 1; //bouncy
		this.color = color("white");
	}

	// Negates SDF to flip inside/outside.
	invert() { this.signMultiplier *= -1; }
	draw() {}
	notifyOfCollision() {}
	distance(p) { return 0 * this.signMultiplier; }
	distanceO(p) { return [this.distance(p), this]; }

	normalFD2(p) {
			const h = 0.0008;
			let px = createVector(p.x + h, p.y);
			let mx = createVector(p.x - h, p.y);
			let py = createVector(p.x, p.y + h);
			let my = createVector(p.x, p.y - h);
			let fx = this.distance(px);
			let fxm = this.distance(mx);
			let fy = this.distance(py);
			let fym = this.distance(my);
			let dx = (fx - fxm) / (2.0 * h);
			let dy = (fy - fym) / (2.0 * h);
			let n = createVector(dx, dy);
			if (n.magSq() < 1e-12) return this.normalFD1(p);
			return n.normalize();
	}

	// Normal at p
	normal(p) {
		return this.normalFD2(p);
	}

	// One-sided finite difference calculation.
	normalFD1(p) {
		const h = 0.001;
		let q = createVector(p.x, p.y);
		q.x += h;
		let d = this.distance(p);
		let dxh = this.distance(q);
		q.x -= h;
		q.y += h;
		let dyh = this.distance(q);
		let n = createVector((dxh - d) / h, (dyh - d) / h).normalize();
		return n;
	}

	// False if the obstacle is not moving, e.g., fixed. 
	isMoving() {
		return false;
	}
	// OVERRIDE. Spatial velocity at field point, p. Zero if not moving.
	velocity(p) {
		return vec2(0, 0);
	}

	getCOR() { return this.COR; }  
	setCOR(eps) { this.COR = constrain(eps, 0, 1) }
	getColor() { return this.color; }
	setColor(c) { this.color = c; }

	/** Approximate Closest Point Transform: Returns point on boundary closest to this point.
	 * @returns New p5.Vector containing the projected point.
	 */
	CPT(p) { return this.CPTOffset(p, 0); }
	/** CPT for d0-offset isosurface. Equivalent to CPT(p) for d0 zero.
	 * @param d0 Isosurface's distance value to project point onto. 
	 * @returns New p5.Vector containing the projected point.
	 */
	CPTOffset(p, d0) {
		// Approximate by pCPT = p - sdf(p)*n(p)
		let d = this.distance(p) - d0;
		let n = this.normal(p); // approximate normal, so pCPT is approximate.
		let pCPT = vaxpy(-d, n, p); // =(-d*n+p) 
		return pCPT;
	}
}

///////////////////////////////////////
// Neon Flipper 
///////////////////////////////////////
class Flipper extends Obstacle {
	
  constructor(pivot, r1, r2, h, angleRest, dAngleAction, speed, flipperKeyCode, neonColor) {
    super();
    this.pivot = pivot;
    this.r1 = r1;
    this.r2 = r2;
    this.h = h;
    this.angleRest = angleRest;
		this.lastAngleRad = this.angleRest;
    this.dAngleAction = dAngleAction;
    this.speed = sign(dAngleAction) * abs(speed);
    this.flipperKeyCode = flipperKeyCode;
    this.baseColor = neonColor;
    this.activeGlow = 0;
    this.COR = 0.55;
    this.resetFlipper();
		this.recoil = 1.0; // visual pop effect
  }

  resetFlipper() {
    this.angleRad = this.angleRest;
    this.omega = 0;
    this.lastTimestepAngleRadDelta = 0;
  }

  timestep(dt) {
    let angleStart = this.angleRad;
		this.lastAngleRad = this.angleRest;
    const pressed = keyIsDown(this.flipperKeyCode);

    if (pressed) {
      // Fast action upward
      this.omega = this.speed;
      this.activeGlow = min(1.0, this.activeGlow + dt * 5.0);
    } else {
      // Smooth return motion with damping
      this.omega = lerp(this.omega, -this.speed, 0.12);
      this.activeGlow = max(0.0, this.activeGlow - dt * 2.0);
    }

    this.angleRad += this.omega * dt;

    // Clamp motion limits
    if (this.dAngleAction > 0)
      this.angleRad = clamp(this.angleRad, this.angleRest, this.angleRest + this.dAngleAction);
    else
      this.angleRad = clamp(this.angleRad, this.angleRest + this.dAngleAction, this.angleRest);

    if (this.angleRad <= this.angleRest || this.angleRad >= this.angleRest + this.dAngleAction)
      this.omega *= 0.4; // reduce jitter at ends

    this.lastTimestepAngleRadDelta = this.angleRad - this.lastAngleRad;
  }
	
	 handleBallCollision(ball) {
    if (!this.isMoving()) return false;
    
    // Get closest point on flipper to ball
    const closestPoint = this.CPT(ball.p);
    const distanceToSurface = this.distance(ball.p);
    
    // If ball is penetrating or very close to moving flipper
    if (distanceToSurface < ball.r * 0.5) {
      // Push ball to safe distance along normal
      const normal = this.normal(ball.p);
      const pushDistance = ball.r - distanceToSurface + 0.001;
      ball.p.add(p5.Vector.mult(normal, pushDistance));
      
      // Apply flipper velocity to ball
      const flipperVel = this.velocity(ball.p);
      ball.v.add(p5.Vector.mult(flipperVel, 0.8));
      
      // Bounce effect
      const normalVel = p5.Vector.dot(ball.v, normal);
      if (normalVel < 0) {
        const bounce = p5.Vector.mult(normal, -normalVel * (1 + this.COR));
        ball.v.add(bounce);
      }
      
      this.notifyOfCollision();
      return true;
    }
    return false;
  }
	
	applyLastTimestepRotationTo(point) {
    const v = vsub(point, this.pivot);
    const rotatedV = vrotate(v, this.lastTimestepAngleRadDelta);
    return vadd(this.pivot, rotatedV);
  }

  velocity(p) {
		if (this.isMoving()) {
			let R = vsub(p, this.pivot).mult(-this.omega);
			return vec2(-R.y, R.x);
		} else
			return vec2(0, 0);
	}

  isMoving() {
		return (this.omega != 0);
	}

  // Sound + light feedback on collision
	notifyOfCollision() {
		// Play synth tone
		if (flipperSound) {
			flipperSound.play("A4", 0.03, 0, 0.08);
			duckBackgroundAudio();
		}

		// Activate full glow
		this.activeGlow = 1.0;

		// Spark burst at pivot
		for (let i = 0; i < 10; i++) {
			sparkParticles.push(new SparkParticle(this.pivot.x, this.pivot.y, this.baseColor));
		}

		// Add recoil pop
		this.recoil = 1.2;

		// Add ripple wave (energy pulse)
		rippleEffects.push(new Ripple(this.pivot.x, this.pivot.y, this.baseColor));
	}
	
	draw() {
		push();
		translate(this.pivot.x, this.pivot.y);
		rotate(-PI / 2.0 - this.angleRad);

		// Apply recoil animation (pop/stretch)
		if (this.recoil > 1.0) {
			scale(this.recoil);
			this.recoil = lerp(this.recoil, 1.0, 0.15);
		}

		// Neon glow blending based on motion
		let base = color(this.baseColor);
		let pulse = lerpColor(base, color(255, 255, 255), this.activeGlow * 0.6);
		drawingContext.shadowBlur = 40 + 80 * this.activeGlow;
		drawingContext.shadowColor = pulse;

		// Neon pulse trail based on speed
		let trailAlpha = map(abs(this.omega), 0, this.speed, 0, 200);
		if (trailAlpha > 20) {
			stroke(pulse);
			strokeWeight(0.012);
			stroke(pulse.levels[0], pulse.levels[1], pulse.levels[2], trailAlpha);
			noFill();
			arc(0, 0, this.h * 1.8, this.h * 1.8, -PI / 4, this.angleRad / 2);
		}

		// Electric micro sparks along tip when moving fast
		if (abs(this.omega) > 4.0 && random() < 0.3) {
			sparkParticles.push(
				new SparkParticle(
					this.pivot.x + random(-0.01, 0.01),
					this.pivot.y + this.h * 0.9,
					this.baseColor
				)
			);
		}

		// Flipper body with layered color
		noStroke();
		fill(pulse);
		this.drawFlipperBody(1.0);

		// Inner darker layer
		let inner = lerpColor(base, color(0, 0, 0), 0.5);
		fill(inner);
		this.drawFlipperBody(0.85);

		// Reflective highlight layer (dynamic white sheen)
		let gradientAlpha = map(abs(this.omega), 0, this.speed, 50, 160);
		fill(255, 255, 255, gradientAlpha);
		this.drawFlipperBody(0.7);

		pop();
		drawingContext.shadowBlur = 0;
	}

  drawFlipperBody(scale) {
    const R1 = scale * this.r1;
    const R2 = this.r2 - (this.r1 - R1);
    const sinBeta = abs(R1 - R2) / this.h;
    const cosBeta = sqrt(1.0 - sq(sinBeta));
    const dx1 = R1 * cosBeta, dy1 = R1 * sinBeta;
    const dx2 = R2 * cosBeta, dy2 = R2 * sinBeta;

    beginShape();
    vertex(+dx1, +dy1);
    vertex(+dx2, +this.h + dy2);
    vertex(-dx2, +this.h + dy2);
    vertex(-dx1, +dy1);
    endShape(CLOSE);

    // end circles for rounded look
    circle(0, 0, R1);
    circle(0, this.h, R2);
  }

  distance(p) {
    let v = vsub(p, this.pivot);
    let rotAngle = -((-PI / 2.0) - this.angleRad);
    let vRot = vrotate(v, rotAngle);
    return this.signMultiplier * SDF.sdUnevenCapsule(vRot, this.r1, this.r2, this.h);
  }
}

// -----------------------------
// LineObstacle (for arcs or walls)
// -----------------------------
class LineObstacle extends Obstacle {
    constructor(p1, p2) {
        super();
        this.p1 = p1;
        this.p2 = p2;
        this.setCOR(0.7);
        this.color = color(120, 120, 130);
    }
    draw() {
        stroke(this.color);
        strokeWeight(0.004 * WIDTH);
        line(this.p1.x, this.p1.y, this.p2.x, this.p2.y);
    }
    distance(p) {
        return this.signMultiplier * SDF.sdSegment(p, this.p1, this.p2);
    }
}

// ⚪ Circle
class CircleObstacle extends Obstacle {
    constructor(center, radius) {
        super();
        this.center = center;
        this.radius = radius;
    }
    draw() {
        if (this.signMultiplier > 0) {
            fill("white"); circle(this.center.x, this.center.y, this.radius);
            fill(this.color); circle(this.center.x, this.center.y, 0.95 * this.radius);
        }
    }
    distance(p) { return this.signMultiplier * SDF.sdCircle(vsub(p, this.center), this.radius); }
}

// -----------------------------
// Neon Bumper
// -----------------------------
class BumperObstacle extends CircleObstacle {
  constructor(center, radius, points = 150, extraBounce = 0.08, neonColor = color(0, 255, 255)) {
    super(center, radius);
    this.points = points;
    this.extraBounce = extraBounce;
    this.tintTime = 0.0;
    this.baseColor = neonColor;
    this.hueShift = random(360); // for shimmer
    this.setCOR(0.7);
    this.setColor(this.baseColor);
  }

	notifyOfCollision() {
		// === Combo logic ===
		let now = millis();
		if (now - lastHitTime < comboTimeout) comboLevel++;
		else comboLevel = 1;
		lastHitTime = now;

		// Apply combo multiplier
		let comboMult = 1.0 + (comboLevel - 1) * 0.2;
		let gained = floor(this.points * comboMult);
		score += gained;
		addScoreNotification(gained, this.center.x, this.center.y);
		lastScore = score;

		// === Neon ping sound ===
		if (bumperSound) {
			// Add slight random variation for natural tone
			let baseFreq = random([523.25, 659.25, 783.99]); // C5, E5, G5
			playHitSound(bumperSound, baseFreq + random(-10, 10) + comboLevel * 40, 0.4, 0.12, 120);
		}

		// === Combo BONUS sound ===
		if (comboLevel > 2 && comboSound) {
			let bonusFreq = 440 + comboLevel * 100; // Rising tone with combo
			comboSound.play(bonusFreq, 0.03, 0, 0.05);
			duckBackgroundAudio();
		}

		// === Visual feedback ===
		this.tintTime = 0.1;
		triggerScreenShake(0.01 + comboLevel * 0.002, 120 + comboLevel * 60);
		rippleEffects.push(new Ripple(this.center.x, this.center.y, this.baseColor));
		for (let i = 0; i < 6 + comboLevel; i++) {
			sparkParticles.push(new SparkParticle(this.center.x, this.center.y, this.baseColor));
		}

		print(`💥 Bumper hit! +${gained} pts | Combo ×${comboLevel}`);
		triggerComboBanner(comboLevel);
	}


  draw() {
    push();
    colorMode(HSB);
    let t = millis() * 0.002;
    this.hueShift = (this.hueShift + 0.2) % 360;

    // --- Idle pulsing hue ---
    let baseHue = (hue(this.baseColor) + this.hueShift) % 360;
    let pulse = 0.4 + 0.6 * sin(t * 2.5);
    let glowColor = color(baseHue, 100, 100 * pulse);

    // --- Flash when hit ---
    if (this.tintTime > 0) {
      this.tintTime = max(0, this.tintTime - 1.0 / FRAMERATE);
      glowColor = color(baseHue, 100, 100);
    }

    // --- Draw bumper ---
    drawingContext.shadowBlur = 30 + 50 * pulse;
    drawingContext.shadowColor = glowColor;
    noStroke();
    fill(glowColor);
    circle(this.center.x, this.center.y, this.radius);

    // --- Inner core ---
    fill(0, 0, 20 + 80 * pulse);
    circle(this.center.x, this.center.y, this.radius * 0.6);
    pop();

    drawingContext.shadowBlur = 0;
  }

  getExtraBounce() {
    return this.extraBounce;
  }
}

// -----------------------------
// TargetObstacle
// -----------------------------
class TargetObstacle extends CircleObstacle {
    constructor(center, radius, points = 500) {
        super(center, radius);
        this.points = points;
        this.active = true;
        this.setCOR(0.4);
        this.setColor(color(200, 90, 100));
    }
    notifyOfCollision() {
        if (!this.active) return;
        score += this.points;
				addScoreNotification(this.points, this.center.x, this.center.y);
				lastScore = score;
        this.active = false;
        this.signMultiplier = -1;
    }
    draw() {
        if (!this.active) return;
        super.draw();
    }
}

// -----------------------------
// TriangleObstacle
// -----------------------------
class TriangleObstacle extends Obstacle {
    constructor(p1, p2, p3, colorVal = color(150, 200, 230)) {
        super();
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
        this.color = colorVal;
        this.setCOR(0.6);
    }

    draw() {
        push();
        fill(this.color);
        noStroke();
        beginShape();
        vertex(this.p1.x, this.p1.y);
        vertex(this.p2.x, this.p2.y);
        vertex(this.p3.x, this.p3.y);
        endShape(CLOSE);
        pop();
    }

    distance(p) {
        // Using Triangle SDF - https://www.shadertoy.com/view/XsXSz4) 
				let cx = (this.p1.x + this.p2.x + this.p3.x) / 3;
        let cy = (this.p1.y + this.p2.y + this.p3.y) / 3;
        let b = vec2(0.1, 0.1); 
        return this.signMultiplier * SDF.sdTriangle(p, this.p1, this.p2, this.p3);
    }
}

// -----------------------------
// SlingshotObstacle
// -----------------------------
class SlingshotObstacle extends TriangleObstacle {
	constructor(p1, p2, p3, extraBounce = 0.5, neonColor = color(255,150,0)) {
		super(p1, p2, p3, neonColor);
		this.extraBounce = extraBounce;
		this.baseColor = safeColor(neonColor);
		this.color = safeColor(neonColor);
		this.outlineColor = safeColor(color(0, 0, 0, 120)); // sensible default outline
		this.opacity = 180;
		this.glowPulse = true;
		this.setCOR(0.95);
		this.hueShift = random(360);
		this._curvature = 0.18 + random(0, 0.06);
	}

  getExtraBounce() {
    return this.extraBounce;
  }

	distance(ballPos) {
		// Compute signed distance to the triangle (negative = inside)
		const edges = [
			[this.p1, this.p2],
			[this.p2, this.p3],
			[this.p3, this.p1],
		];
		let maxDist = -Infinity;
		for (let [a, b] of edges) {
			const edge = p5.Vector.sub(b, a);
			const n = createVector(-edge.y, edge.x).normalize();
			const d = p5.Vector.dot(p5.Vector.sub(ballPos, a), n);
			maxDist = max(maxDist, d);
		}
		return maxDist; // < 0 means inside (collision)
	}

	normal(ballPos) {
		const edges = [
			[this.p1, this.p2],
			[this.p2, this.p3],
			[this.p3, this.p1],
		];
		let bestN = createVector(0, 0);
		let minAbs = Infinity;
		for (let [a, b] of edges) {
			const edge = p5.Vector.sub(b, a);
			const n = createVector(-edge.y, edge.x).normalize();
			const d = p5.Vector.dot(p5.Vector.sub(ballPos, a), n);
			if (abs(d) < minAbs) {
				minAbs = abs(d);
				bestN = n.copy();
			}
		}
		return bestN;
	}

  notifyOfCollision() {
    // score kick and visual/sound feedback
    score += 100;
		addScoreNotification(100, this.CPTOffset(this.p1, 0).x, this.CPTOffset(this.p1, 0).y);
		lastScore = score;
    // small sound (uses bumperSound if defined)
    if (bumperSound) {
      let freq = random([440, 520, 600]);
      bumperSound.play(freq, 0.05, 0, 0.10);
			duckBackgroundAudio();
    }
    // particles + ripple
    rippleEffects.push(new Ripple(this.CPTOffset(this.p1, 0).x, this.CPTOffset(this.p1, 0).y, this.baseColor));
		
		// directional spark spray along surface normal
		let impactCenter = createVector((this.p1.x + this.p2.x + this.p3.x) / 3, (this.p1.y + this.p2.y + this.p3.y) / 3);
		let edgeVec = p5.Vector.sub(this.p2, this.p1);
		let normal = createVector(-edgeVec.y, edgeVec.x).normalize(); // perpendicular
		
		for (let i = 0; i < 8; i++) {
			let jitter = p5.Vector.random2D().mult(0.02);
			let dir = p5.Vector.add(normal.copy().mult(random(0.02, 0.05)), jitter);
			let sp = new SparkParticle(impactCenter.x, impactCenter.y, this.baseColor);
			sp.vel = dir;
			sparkParticles.push(sp);
		}

    // screen shake
    triggerScreenShake(0.008, 110);
  }

  // curved wing draw that fits the neon palette
  draw() {
		push();
		colorMode(HSB);
		noStroke();

		// ensure safe color use
		let outlineC = safeColor(this.outlineColor);
		let fillC = safeColor(this.color);

		stroke(outlineC);
		strokeWeight(0.004);
		fill(fillC);

    // base parameters
    const t = millis() * 0.002;
    this.hueShift = (this.hueShift + 0.2) % 360;
    let baseHue = (hue(this.baseColor) + this.hueShift) % 360;
		
		// combo-level hue shift bonus
		baseHue = (baseHue + comboLevel * 15) % 360;

		// Pulse intensity modulated by nearby flipper glow (sync effect)
		let flipperSync = 0.0;
		
		if (flipperL && flipperR) {
			let distL = dist((this.p1.x + this.p2.x + this.p3.x)/3, (this.p1.y + this.p2.y + this.p3.y)/3,
											 flipperL.pivot.x, flipperL.pivot.y);
			let distR = dist((this.p1.x + this.p2.x + this.p3.x)/3, (this.p1.y + this.p2.y + this.p3.y)/3,
											 flipperR.pivot.x, flipperR.pivot.y);
			let influence = max(0, 1.2 - 4.0 * min(distL, distR)); // decay with distance
			flipperSync = (flipperL.activeGlow + flipperR.activeGlow) * 0.5 * influence;
		}
		
		let pulse = this.glowPulse
			? (0.7 + 0.3 * sin(millis() * 0.006 + baseHue) + 0.5 * flipperSync)
			: 1.0;
	
    let alpha = this.opacity;

    // compute a curved-wing path (three points -> create a mid control using curvature)
    let A = this.p1;
    let B = this.p2;
    let C = this.p3;
    // mid control for inward curve: direction toward centroid
    let centroid = createVector((A.x + B.x + C.x) / 3, (A.y + B.y + C.y) / 3);
    let control = p5.Vector.lerp(centroid, B, this._curvature);

    // layered glow rings (outer -> inner)
    for (let i = 3; i >= 0; i--) {
      let layerAlpha = alpha / (i + 1);
      let scaleMul = 1.0 + i * 0.03;
      drawingContext.shadowBlur = 40 * (i + 1) * pulse;
      drawingContext.shadowColor = color(hsbToRgb(baseHue, 100, 100, 255));
      fill(hsbToRgb(baseHue, 100, 100, layerAlpha));
      beginShape();
      // A -> B (curved via control) -> C -> close back to A as soft polygon
      vertex(A.x, A.y);
      // approximate bezier with two vertices (p5 doesn't allow bezier in beginShape with vertex control easily)
      // so create many small vertices along quadratic Bezier A->B with control:
      let steps = 14;
      for (let s = 0; s <= steps; s++) {
        let u = s / steps;
        // quad bezier between A and B with control
        let bx = (1-u)*(1-u)*A.x + 2*(1-u)*u*control.x + u*u*B.x;
        let by = (1-u)*(1-u)*A.y + 2*(1-u)*u*control.y + u*u*B.y;
        vertex(bx * scaleMul - (scaleMul-1)*centroid.x + (scaleMul-1)*centroid.x, by * scaleMul - (scaleMul-1)*centroid.y + (scaleMul-1)*centroid.y);
      }
      // B->C straight-ish
      vertex(C.x, C.y);
      endShape(CLOSE);
    }

    // sharp inner core (solid darker)
    drawingContext.shadowBlur = 0;
    fill(hsbToRgb(baseHue, 60, 25, 255));
    beginShape();
    vertex(A.x, A.y);
    // smooth inner curve A->B:
    for (let s = 0; s <= 10; s++) {
      let u = s / 10;
      let bx = (1-u)*(1-u)*A.x + 2*(1-u)*u*control.x + u*u*B.x;
      let by = (1-u)*(1-u)*A.y + 2*(1-u)*u*control.y + u*u*B.y;
      vertex(bx, by);
    }
    vertex(C.x, C.y);
    endShape(CLOSE);

    // small highlight
    push();
    fill(255, 255, 255, 20);
    circle((A.x + B.x) / 2, (A.y + B.y) / 2, 0.02);
    pop();

		// --- semi-transparent inner plasma core ---
		push();
		noStroke();
		let coreC = lerpColor(this.baseColor, color(255), 0.2);
		fill(red(coreC), green(coreC), blue(coreC), 40 + 40 * sin(millis() * 0.003));
		beginShape();
		vertex(this.p1.x, this.p1.y);
		vertex(this.p2.x, this.p2.y);
		vertex(this.p3.x, this.p3.y);
		endShape(CLOSE);
		pop();

		// inside SlingshotObstacle.draw()
		push();
		noFill();
		strokeWeight(0.006);
		let baseC = safeColor(this.baseColor); // ensure it’s a real p5.Color
		let whiteC = color(255);
		let mixC = lerpColor(baseC, whiteC, pulse);

		stroke(mixC);
		drawingContext.shadowBlur = 25 + 25 * pulse;
		drawingContext.shadowColor = baseC;
		triangle(this.p1.x, this.p1.y, this.p2.x, this.p2.y, this.p3.x, this.p3.y);

		pop();

		// --- Transparent glass-like core ---
		push();
		noStroke();
		let core = lerpColor(this.baseColor, color(255), 0.3);
		fill(red(core), green(core), blue(core), 50 + 30 * sin(millis() * 0.003));
		beginShape();
		vertex(this.p1.x, this.p1.y);
		vertex(this.p2.x, this.p2.y);
		vertex(this.p3.x, this.p3.y);
		endShape(CLOSE);
		pop();

    pop();
    drawingContext.shadowBlur = 0;
  }
}

// -----------------------------
// RotatedBoxObstacle
// -----------------------------
class RotatedBoxObstacle extends Obstacle {
    constructor(center, bx, by, angleRad = 0.0) {
        super();
        this.center = center;
        this.bx = bx;
        this.by = by;
        this.angle = angleRad;
        this.color = color(230, 140, 80); 
        this.setCOR(0.4);
    }
    draw() {
        push();
        translate(this.center.x, this.center.y);
        rotate(this.angle);
        noStroke();
        fill(this.color);
        rectMode(RADIUS);
        rect(0, 0, this.bx, this.by);
        // draw star in the middle (visual for diamond obstacles)
        if (this.bx == this.by) {
            fill(30);
            this._drawStar(0, 0, min(this.bx, this.by) * 0.7, 5);
        }
        pop();
    }
    _drawStar(cx, cy, r, arms) { 
        push();
        translate(cx, cy);
        beginShape();
        for (let i = 0; i < arms * 2; i++) {
            let a = PI * i / arms;
            let rad = (i % 2 == 0) ? r : r * 0.45;
            vertex(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        endShape(CLOSE);
        pop();
    }
    distance(p) {
        let v = vsub(p, this.center);
        let vRot = vrotate(v, -this.angle);
        return this.signMultiplier * SDF.sdBox(vRot, vec2(this.bx, this.by));
    }
}

// 📦 Box
class BoxObstacle extends Obstacle {
    constructor(center, bx, by) {
        super();
        this.center = center;
        this.bx = bx;
        this.by = by;
    }
    draw() {
        push();
        rectMode(RADIUS);
        if (this.signMultiplier > 0) {
            fill(this.color);
            rect(this.center.x, this.center.y, this.bx, this.by);
        }
        pop();
    }
    distance(p) {
        let v = vsub(p, this.center);
        return this.signMultiplier * SDF.sdBox(v, vec2(this.bx, this.by));
    }
}

// -----------------------------
// 🌀 NeonBarSpinnerObstacle (Does one full spin when hit)
// -----------------------------
class NeonBarSpinnerObstacle extends Obstacle {
    constructor(center, length = 0.18, thickness = 0.012, points = 250, neonColor = color(255, 100, 255)) {
        super();
        this.center = center;
        this.length = length;
        this.thickness = thickness;
        this.points = points;
        this.baseColor = neonColor;
        
        // Rotation physics for full spin
        this.angle = 0;  // Start angle
        this.omega = 0;  // Angular velocity
        this.spinKick = 10.0;  // Higher initial spin speed for full rotation
        this.spinDecay = 0.95;  // Slower decay to complete the spin
        this.targetSpinCount = 1;
        this.currentSpin = 0;  // Track how much we've spun
        this.isSpinning = false;
        this.setCOR(0.8);
    }

    timestep(dt) {
        // If spinning, continue until we complete the target spin
        if (this.isSpinning) {
            let previousAngle = this.angle;
            this.angle += this.omega * dt;
            this.omega *= this.spinDecay;  // Gradually slow down
            
            let angleChange = this.angle - previousAngle;
            this.currentSpin += abs(angleChange);
            
            // Stop when we've completed the target spin or slowed down too much
            if (this.currentSpin >= TWO_PI * this.targetSpinCount || abs(this.omega) < 0.5) {
                this.isSpinning = false;
                this.omega = 0;
                this.currentSpin = 0;
            }
        }
    }

    distance(p) {
        let v = vsub(p, this.center);
        let vRot = vrotate(v, -this.angle);
        return this.signMultiplier * SDF.sdBox(vRot, vec2(this.length * 0.5, this.thickness * 0.5));
    }

    notifyOfCollision() {
        // Start spinning with enough speed to complete one full rotation
        this.omega = this.spinKick * (random() > 0.5 ? 1 : -1);
        this.isSpinning = true;
        this.currentSpin = 0;  // Reset spin counter
        
        // Score and effects
        score += this.points;
				addScoreNotification(this.points, this.center.x, this.center.y);
				lastScore = score;
        if (bumperSound) {
            let freq = 600 + random(-50, 50);
            bumperSound.play(freq, 0.05, 0, 0.1);
						duckBackgroundAudio();
        }
        
        rippleEffects.push(new Ripple(this.center.x, this.center.y, this.baseColor));
        
        // Directional sparks based on spin
        for (let i = 0; i < 8; i++) {
            let spark = new SparkParticle(this.center.x, this.center.y, this.baseColor);
            let angle = random(TWO_PI);
            let distance = random(this.length * 0.3, this.length * 0.45);
            let sparkX = cos(angle) * distance;
            let sparkY = sin(angle) * distance;
            
            // Tangential velocity based on spin direction
            let tangent = createVector(-sparkY, sparkX).normalize();
            spark.vel = tangent.mult(abs(this.omega) * 0.01 * sign(this.omega));
            sparkParticles.push(spark);
        }
    }

    draw() {
        push();
        translate(this.center.x, this.center.y);
        rotate(this.angle);
        
        // Enhanced glow when spinning
        let glowIntensity = this.isSpinning ? 50 : 30;
        drawingContext.shadowBlur = glowIntensity;
        drawingContext.shadowColor = this.baseColor;
        
        // Neon bar with spin intensity
        noStroke();
        let barColor = this.isSpinning ? 
            lerpColor(this.baseColor, color(255), 0.3) : 
            this.baseColor;
        fill(barColor);
        rectMode(CENTER);
        rect(0, 0, this.length, this.thickness, this.thickness * 0.5);
        
        // Motion blur effect during spin
        if (this.isSpinning && abs(this.omega) > 5) {
            let blurAlpha = map(abs(this.omega), 5, this.spinKick, 30, 80);
            noStroke();
            fill(red(this.baseColor), green(this.baseColor), blue(this.baseColor), blurAlpha);
            
            // Draw trailing copies
            let blurSteps = 2;
            let blurOffset = 0.08 * sign(this.omega);
            for (let i = 1; i <= blurSteps; i++) {
                push();
                rotate(-blurOffset * i);
                rect(0, 0, this.length * 0.9, this.thickness * 0.8, this.thickness * 0.4);
                pop();
            }
        }
        
        // Center dot with spin indicator
        let centerAlpha = this.isSpinning ? 220 : 150;
        fill(255, 255, 255, centerAlpha);
        circle(0, 0, this.thickness * 1.5);
        
        // Spin progress indicator (only when spinning)
        if (this.isSpinning) {
            let progress = this.currentSpin / (TWO_PI * this.targetSpinCount);
            stroke(255, 255, 255, 180);
            strokeWeight(0.003);
            noFill();
            arc(0, 0, this.thickness * 2.5, this.thickness * 2.5, 0, TWO_PI * progress);
        }
        
        pop();
        drawingContext.shadowBlur = 0;
    }
    
    velocity(p) {
        if (this.omega === 0) return vec2(0, 0);
        let rel = vsub(p, this.center);
        return createVector(-this.omega * rel.y, this.omega * rel.x);
    }
    
    isMoving() {
        return this.omega !== 0;
    }
}

// -----------------------------
// ⚙️ NeonBarObstacle (Dynamic Architectural Light Beam)
// -----------------------------
class NeonBarObstacle extends Obstacle {
	constructor(center, length = 0.22, thickness = 0.015, neonColor = color(255, 120, 40), motionType = "rock", vertical = false) {
		super();
		this.baseAngle = vertical ? HALF_PI : 0;  
		this.angle = this.baseAngle;  // start with correct rotation

		this.center = center;
		this.length = length;
		this.thickness = thickness;
		this.baseColor = neonColor;
		this.glowPulse = 0.0;
		this.setCOR(0.9);
		this.motionType = motionType; // "rock", "float", "tremor"
		this.phase = random(TWO_PI);
	}

  timestep(dt) {
    const t = millis() * 0.0015;
    this.glowPulse = (sin(millis() * 0.004) * 0.5 + 0.5);

		// animated motion based on type
		if (this.motionType === "rock") {
			// stronger oscillation: more violent shaking
			this.angle = this.baseAngle + 0.25 * sin(t * 3.5 + this.phase);
		}

    else if (this.motionType === "float") {
      // small vertical bob (no rotation)
      this.center.y += 0.004 * sin(t * 1.5 + this.phase);
    } 
		
		else if (this.motionType === "tremor") {
			// stronger flicker + tighter vibration
			this.center.x += 0.002 * sin(t * 12 + this.phase);
			this.angle = this.baseAngle + 0.05 * sin(t * 8 + this.phase);
		}
  }

  distance(p) {
    let v = vsub(p, this.center);
    let vRot = vrotate(v, -this.angle);
    let d = SDF.sdBox(vRot, vec2(this.length * 0.5, this.thickness * 0.5));
    return this.signMultiplier * d;
  }

  notifyOfCollision() {
    if (bumperSound) playHitSound(bumperSound, random([500, 650, 800]), 0.1, 0.1, 100);
    rippleEffects.push(new Ripple(this.center.x, this.center.y, this.baseColor));
    triggerScreenShake(0.01, 150);
    for (let i = 0; i < 5; i++) {
      sparkParticles.push(new SparkParticle(this.center.x, this.center.y, this.baseColor));
    }
  }

  draw() {
    push();
    translate(this.center.x, this.center.y);
    rotate(this.angle);
		drawingContext.shadowBlur = 55;
    drawingContext.shadowColor = this.baseColor;
		
    // neon bar body
    noStroke();
    let glow = lerpColor(this.baseColor, color(255), 0.3 + 0.3 * this.glowPulse);
    fill(red(glow), green(glow), blue(glow), 255);
    rectMode(CENTER);
    rect(0, 0, this.length, this.thickness, this.thickness * 2);

    // inner bright line
    stroke(255, 255, 255, 160);
    strokeWeight(0.004);
    line(-this.length * 0.45, 0, this.length * 0.45, 0);

    pop();
    drawingContext.shadowBlur = 0;
  }
}



/*******************************************************************************
 * 🧩 SDF Obstacle Shape Sampler. 
 * Samples points on an SDF Obstacle's boundary shape to help with drawing more complicated SDF shapes.
 * Only works for shapes approximated by a single, closed, connected curve.
 * Helper methods for drawShape.
 *******************************************************************************/
class ObstacleShapeSampler {
	/**
	 * Constructs the shape by extracting boundary points.
	 * 
	 * @param obstacle Obstacle shape to process.
	 * @param pStart Approximate starting point of the curve. If unsure, using (0,0).
	 * @param edgeLength Target edge length of the sampled curve.
	 */
	constructor(obstacle, pStart, edgeLength) {
		this.obstacle = obstacle;
		this.pStart = pStart;
		this.edgeLength = edgeLength;
		//print("ObstacleSDFBoundary():\n  OBSTACLE: " + obstacle + "\n pStart: " + pStart + "\n edgeLength: " + edgeLength);
		this.BPoints = this._extractBoundaryPoints();
	}

	/** 
	 * ✂️ Extracts array of approximate boundary points forming a closed curve.
	 * (Warning: Not guaranteed to work for all SDFs.)
	 */
	_extractBoundaryPoints() {
		let BP = []; // boundary points 		
		let O = this.obstacle;
		let h = this.edgeLength;

		let p0 = O.CPT(this.pStart); // project starting point onto surface.
		p0 = O.CPT(p0); // in case initial guess is terrible ;P
		let p = p0;
		BP.push(p); // first point
		while (BP.length < 250) { // < MAX_POINTS (increase as needed)
			let n = O.normal(p);
			let dp = vec2(+h * n.y, -h * n.x); // edge vector
			let pNext = vadd(p, dp); // estimate of next point
			pNext = O.CPT(pNext); // project onto surface
			BP.push(pNext); // save to array
			if (BP.length > 3 && p0.dist(pNext) < 1.2 * h) { // Heuristic for closing the curve (could be better)
				break;
			}
			p = pNext;
		}
		//print("ObstacleShape.extractBoundaryPoints(): |BP|=" + BP.length);
		return BP;
	}

	/** Returns the array of extracted boundary points. */
	getBoundaryPoints() {
		return this.BPoints;
	}

	/** 
	 * 🎨 Draws the closed shape with the current style (set to your liking).
	 */
	drawShape() {
		push();
		beginShape();
		for (let v of this.BPoints) vvertex(v);
		endShape(CLOSE);
		pop();
	}
	/** 
	 * 🎨 Draws the closed shape with a basic technical style (good for debugging).
	 */
	drawShapeBasic() {
		push();
		stroke(0);
		//fill(0);
		beginShape();
		for (let v of this.BPoints) vvertex(v);
		endShape(CLOSE);

		strokeWeight(0.005);
		stroke("black");
		beginShape(POINTS);
		for (let v of this.BPoints) vvertex(v);
		endShape();
		pop();
	}
}

