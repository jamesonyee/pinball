function centerCanvas(cnv) {
  // Calculate centered position
  let x = 0;
  let y = Math.floor((windowHeight - height));

  // Prevent negative or fractional positions that cause scrollbars
  x = Math.max(0, x);
  y = Math.max(0, y);

  cnv.position(x, y);

  // Also make sure body doesn't scroll
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

// ------------------------------------------------------------
// Utility and Rendering Helpers
// ------------------------------------------------------------
function safeColor(c, fallback = color(255, 0, 255)) {
	// If already a p5.Color, return it. Otherwise attempt to coerce; on failure return fallback.s
  try {
    if (c instanceof p5.Color) return c;
    if (Array.isArray(c)) return color(...c);     // If it's an array [r,g,b,a]
    return color(c);     // If it's undefined/null, color() will throw, so catch below
  } catch (e) {
    return fallback;
  }
}

// ------------------------------------------------------------
// Converts HSB color to RGB, used for dynamic neon colors
// ------------------------------------------------------------
function hsbToRgb(h, s, b, a = 255) {
  colorMode(HSB);
  let c = color(h % 360, s, b, a);
  colorMode(RGB);
  return c;
}

// ------------------------------------------------------------
// Adjusts neon colors dynamically to create pulsing effects
// ------------------------------------------------------------
function applyNeonBalance() {
  const t = millis() * 0.002;

  for (let o of obstacles) {
    // Only apply to Slingshot obstacles
    if (!(o instanceof SlingshotObstacle)) continue;

    // Neon color oscillation based on object position and time
    const cx = (o.center && o.center.x) ? o.center.x : random(1);
    const pulse = 0.5 + 0.5 * sin(t + cx * 10);

    // Smoothly vary RGB values to simulate glow changes
    let base = o.getColor ? o.getColor() : color(255);
    let r = red(base) * (0.8 + 0.4 * pulse);
    let g = green(base) * (0.8 + 0.4 * pulse);
    let b = blue(base) * (0.8 + 0.4 * pulse);
    o.setColor(color(r, g, b));

    // Slightly brighten when flippers glow
    if (typeof flipperL !== "undefined" && flipperL.activeGlow !== undefined) {
      let flipperGlow = flipperL.activeGlow + flipperR.activeGlow + flipperR1.activeGlow;
      if (flipperGlow > 0.2) {
        o.setColor(color(
          red(o.getColor()) * 1.1,
          green(o.getColor()) * 1.1,
          blue(o.getColor()) * 1.3
        ));
      }
    }
  }
}

let rippleEffects = [];
let sparkParticles = [];

class SparkParticle {
  constructor(x, y, col) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.002, 0.008));
    this.life = 1.0;
    this.color = col;
  }
  update(dt) {
    this.pos.add(p5.Vector.mult(this.vel, dt * 60));
    this.life -= dt * 3.0;
		this.vel.mult(0.98);
		this.vel.y += 0.0005; // subtle drift downward
  }
  draw() {
    if (this.life <= 0) return;
    push();
    noStroke();
		let fadeColor = lerpColor(this.color, color(255, 255, 255), 1 - this.life);
		fill(red(fadeColor), green(fadeColor), blue(fadeColor), 255 * this.life);
    circle(this.pos.x, this.pos.y, 0.008 * this.life);
    pop();
  }
}

class Ripple {
  constructor(x, y, c) {
    this.x = x;
    this.y = y;
    this.color = c;
    this.radius = 0.02;
    this.alpha = 180;
  }

  updateAndDraw() {
    push();
    noFill();
    stroke(
      red(this.color),
      green(this.color),
      blue(this.color),
      this.alpha
    );
    strokeWeight(0.004);
    circle(this.x, this.y, this.radius);
    pop();
    this.radius += 0.01;
    this.alpha -= 4;
  }
}

let lastSoundTime = 0;
function playHitSound(synth, note, velocity = 0.4, duration = 0.1, cooldown = 150) {
  const now = millis();
  if (now - lastSoundTime < cooldown) return; // avoid rapid overlap
  lastSoundTime = now;
  synth.play(note, velocity, 0, duration);
}

// === Visual Plunger (v2 – clear, punchy, vibrant look) ===
class VisualPlunger {
  constructor() {
    this.x = WIDTH * 0.56;
    this.y = HEIGHT * 0.2 + 0.03;
    this.width = WIDTH * 0.03;
    this.height = HEIGHT * 0.14;
    this.offset = 0;
    this.flashAlpha = 0;
    this.charge = 0;
    this.isCharging = false;
    this.kickTime = 0;

    // Visual state
    this.hue = 300;
    this.pulse = 0;
    this.trail = [];
    this.burst = 0; // brief burst intensity after firing
  }

  startCharge() { this.isCharging = true; }

  release() {
    if (this.isCharging) {
      this.fireAnimation(this.charge);
      this.isCharging = false;
      this.charge = 0;
    }
  }

  fireAnimation(power = 1.0) {
    this.flashAlpha = 255;
    this.kickTime = millis();
    this.burst = 1; // quick flash burst

    let start = millis();
    let duration = 450;
    let forwardSnap = 0.3;
    let overshoot = 0.25 * power;

    const animate = () => {
      let t = (millis() - start) / duration;
      if (t < forwardSnap) {
        this.offset = map(t, 0, forwardSnap, 0, -this.width * 0.8 * power);
      } else if (t < 1.0) {
        let tt = (t - forwardSnap) / (1 - forwardSnap);
        this.offset = map(tt, 0, 1, -this.width * 0.8 * power, this.width * overshoot);
      } else {
        this.offset = 0;
        return;
      }
      this.trail.push({ x: this.x + this.offset, y: this.y, alpha: 200 });
      requestAnimationFrame(animate);
    };
    animate();
  }

  update() {
    if (this.isCharging) {
      this.charge = min(1, this.charge + 0.02);
      this.flashAlpha = min(255, this.flashAlpha + 12);
      this.hue = lerp(this.hue, 190, 0.05); // magenta → cyan
    } else {
      this.hue = lerp(this.hue, 300, 0.02);
      this.flashAlpha = max(0, this.flashAlpha - 25);
    }

    this.pulse = sin(millis() * 0.004) * 0.3 + 0.7;
    this.trail.forEach(p => p.alpha -= 12);
    this.trail = this.trail.filter(p => p.alpha > 0);

    if (this.burst > 0) this.burst = max(0, this.burst - 0.15);
  }

  draw() {
    this.update();

    push();
    rectMode(CENTER);
    noStroke();
    translate(this.x + this.offset, this.y);
    colorMode(HSB);

    let base = color(this.hue, 100, 100);
    let tip = color((this.hue + 40) % 360, 100, 95);
    let c = lerpColor(base, tip, this.charge);

    // Trail (stronger)
    for (let p of this.trail) {
      fill(this.hue, 100, 100, map(p.alpha, 0, 200, 0, 0.6));
      ellipse(p.x - this.x, p.y - this.y, this.width * 0.9, this.height * 0.4);
    }

    // Main neon glow
    drawingContext.shadowBlur = 50 + this.charge * 40;
    drawingContext.shadowColor = color(this.hue, 100, 100, 255);

    // Outer rim glow ring (sharpness)
    fill(this.hue, 100, 90, 1);
    rect(0, 0, this.width * 1.1, this.height * 1.05, this.width / 1.5);

    // Core body
    for (let i = 0; i < 8; i++) {
      let inter = i / 8;
      let col = lerpColor(c, color(this.hue, 90, 70), inter);
      fill(hue(col), saturation(col), brightness(col) * (this.pulse * 0.8 + 0.3), 0.95);
      rect(0, this.height * (inter - 0.5), this.width * 0.95, this.height / 8, this.width / 2);
    }

    // Highlight top tip
    fill(0, 0, 100, 0.95);
    ellipse(0, -this.height * 0.45, this.width * 0.8, this.width * 0.35);

    // Burst reflection flash (impact moment)
    if (this.burst > 0) {
      fill(0, 0, 100, this.burst);
      ellipse(0, -this.height * 0.5, this.width * 1.2, this.width * 0.5);
    }

    pop();
    colorMode(RGB);
  }
}