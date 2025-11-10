// 🌲 Stanford CS248B Pinball Assignment
// 📜 Startercode: Doug L. James, djames@cs.stanford.edu
// 🍂 Fall 2025

/****************************************************************************************
 🙋 Names:
  - Jameson Yee, Basant Khalil


 ✨ Features:
  Core Gameplay:
  - Interactive playfield  with targets, spinner, plunger, flippers, etc., and dynamic neon visual effects. 
  
	Obstacles include:
    • Neon flippers with glowing recoil and impact effects.
    • Slingshots that generate directional sparks and and bounce.
    • Neon bumpers with hue shift and combo scoring.
    • Multiple obstacle types including triangles, lines, boxes, and rotated boxes.
    • Neon bar obstacles with different motion types (“rock”, “float”, “tremor”).
    • Neon bar spinner obstacle that spins a full rotation when hit.
    • Plunger system with launch sound and visual feedback.
		
Gameplay Systems:
  - Multiball mode: hitting all 3 multiball targets spawns 2 extra balls into play.
  - Real-time combo system with combo multiplier + on-screen glowing combo banner that updates dynamically.  
  - Ball speed control: 
    • Press Z for slow, X for normal, and C for fast mode.
    • Speed can be changed anytime during gameplay with no cooldown (no time limit).   
    • All balls in play (active and newly spawned) inherit the chosen speed immediately.
    • All balls in play update speed immediately when speed mode changes. 
    • When resetting or spawning multiball, the selected speed by the user persists. 
    • ie: Speed preference persists through resets and multiball activation.

	Dynamic UI:
  - Speed mode indicator with glow pulse effect.
  - Combo banner with glow visual effects.  
  - Score and ball count display.  
  - Separate on screen display showing gameplay instructions with control hints. 
	
	Physics:
  -  Physics driven ball behavior with ray marching and collision detection for realistic behavior.
  -  Realistic ball bounce with COR and extra bounce for certain obstacles, for varied obstacle behavior. 
  -  Spinner uses angular velocity and decay for realistic spin. 
	
	Audio System:
  -  Responsive flipper sound effects with realistic timing on impact. 
  -  Plunger launch sound with feedback vibration. 
  -  Bumper + slingshot sound effects based on collision strength. 
  -  Combo bonus sounds that scale with multiplier level for satisfying progression.
	
	Visual System:
  -  Vivid neon glow, ripple effects, and spark particles on impact.
  -  Dynamic hue shift animations specific to gameplay energy.
  -  In sync glow effects between slingshots and flippers 
  -  Screen shake and ripple effects on major collisions.
  -  Glow trails following fast spinner rotations for added visual depth.
	
	
 🐛 Bugs / Issues ⚠️:
	* Balls could get stuck on very rare slingshot collisions when spacing was tight.  
  We redesigned their layout, shape, and size to improve spacing and prevent this.  
  This also made the overall design cleaner and less distracting for the user.
	
	* At very high speeds, the ball could occasionally clip or tunnel through thin or 
	very small obstacles. We fixed this by refining collision detection and increasing 
	obstacle thickness, making them behave realistically like in physical pinball machines.

  * When several balls were active, overlapping visuals sometimes made it difficult to track 
  them. To fix this, we adjusted the playfield layout, moved some obstacles around, reduced 
	some obstacles densities, lowered neon intensity, and decreased certain obstacle frequencies.  
  For example, we lowered the number of slingshots from 4 to 2.  
  This also helped us vary the types of our obstacles without layout redundancy.
	
  * Rapid switching between speed modes (Z/X/C spam) could have desynced the glow pulse of the 
	speed mode slightly.  
  We fixed this so that the timing remains consistent even with quick input changes.

  * Occasionally, the combo banner overlapped other HUD elements like the speed mode indicator.  
  We moved the combo banner to be below the plunger and above the spinner, which improved visibility 
	and made that combo effect feel centered on the screen to the user.  
  This also helped make gameplay feel more rewarding to the user by emphasizing the user's progress 
	feedback.

  * Sound system could have overlaped notes when many collisions happened at same time, creating minor 
	audio clutter.  
  We improved the audio system to manage overlapping notes more cleanly.

  * Launch sound sometimes cut off if the plunger was triggered very rapidly.  
  We fixed this by making the launch sound trigger only once when pressing the initial space bar to 
	start the game.

  * When spawning multiple balls, we needed to make sure every active ball, not just the original one, 
	independently decremented the ball count and disappeared upon hitting the ground.
  This was a small but key change: by improving our ball tracking logic to track and respond to each ball 
	individually, we maintained accurate game state updates and instant reliable feedback for the player.


 📚 Sources:
  - Starter pinball framework provided in class (base logic and structure)
  - No external libraries beyond p5.js 
  - Visuals, colors, and obstacle layouts were designed to match a
    “neon city / street” aesthetic and give the game that glowing arcade vibe.
*****************************************************************************************/

// 🎯 NORMALIZED SCREEN HEIGHT AND WIDTH: (y is still down)
const HEIGHT = 1.0;
const WIDTH = HEIGHT / 1.5;
const ASPECT = WIDTH / HEIGHT;

const BALL_RADIUS = 0.025; // ⚪ Size of the pinball
const FRAMERATE = 60; //      🎞️ Try a lower value, e.g., 10, to test ray-marching CCD

let obstacles; // 🧱 Array of Obstacle objects
let balls = [];

let multiTargets = [];
let activeTargets = 3;
let multiballActivated = false;

let ball; // ⚽ The pinball 
let flipperL, flipperR, FlipperR1; //

let score = 0;
let ballsLeft = 3;

let scoreNotifications = [];
let lastScore = 0;

let isPaused = true;
let gameOverActive = false;

// === Ball Speed Mode Control ===
let speedMode = "normal";  // options: "slow", "normal", "fast"
let speedFactor = 1.0;     // multiplier applied to ball velocity

//=== Styling === 
let glowParticles = [];
let trailPoints = [];

// Sound synths
let flipperSound, bumperSound, metalSound, comboSound;

// === BACKGROUND MUSIC ===
let bgAudio;
let bgAudioOriginalVol = 0.05;
let ducking = false;

let slowMotion = false;
let timeScale = 1;   // default
let slowFactor = 0.3; // how slow when active

let visualPlunger;

// === Combo system globals ===
let comboLevel = 0;
let lastHitTime = 0;
let comboTimeout = 1500; // ms window for chaining combo hits

// Combo banner state
let comboBannerAlpha = 0;
let comboBannerText = "";
let comboBannerStart = 0;
let comboBannerDuration = 1000; // ms visible duration


let shakeAmplitude = 0;
let shakeDuration = 0;
let shakeStart = 0;

let maxPenetrationDepth = 0;

function preload() {
  cyberFont = loadFont('theme/Orbitron Bold.ttf');
  flipperSound = new p5.MonoSynth();
  bumperSound = new p5.MonoSynth();
  metalSound = new p5.MonoSynth();
  comboSound = new p5.MonoSynth();

  const SFX_VOLUME = 0.01; // ← Adjust this value - lower = quieter
  
  flipperSound.volume = SFX_VOLUME;
  bumperSound.volume = SFX_VOLUME;
  metalSound.volume = SFX_VOLUME;
  comboSound.volume = SFX_VOLUME;
}

function jumpBackgroundTo(timeInSeconds) {
  if (bgAudio) {
    bgAudio.currentTime = timeInSeconds;
    // optional: make sure it plays right away
    if (bgAudio.paused) bgAudio.play();
  }
}

function setBackgroundVolume(vol) {
  if (bgAudio) bgAudio.volume = constrain(vol, 0, 1);
}

function triggerScreenShake(amp, durMs) {
  shakeAmplitude = amp;
  shakeDuration = durMs;
  shakeStart = millis();
}


function triggerComboBanner(level) {
  if (level < 2) return; // only show for combos 2+
  comboBannerText = `COMBO ×${level}!`;
	rippleEffects.push(new Ripple(WIDTH / 2, HEIGHT * 0.15, color(255, 0, 255)));
  comboBannerAlpha = 255;
  comboBannerStart = millis();
}

// === ADD SCORE NOTIFICATION AT SPECIFIC POSITION ===
function addScoreNotification(points, x = WIDTH*0.5, y = HEIGHT*0.4) {
  scoreNotifications.push({
    value: points,
    x: x + random(-0.02, 0.02), // small jitter around hit point
    y: y + random(-0.02, 0.02),
    alpha: 255,
    // neon colors with strong pop
    color: color(
      random([255, random(150, 255)]),
      random([255, random(50, 200)]),
      random([255, random(50, 200)])
    ),
    size: 0.04,
    lifetime: 60
  });
}

// === BACKGROUND MUSIC SETUP ===
function initBackgroundMusic() {
  bgAudio = new Audio('theme/neon_city_loop.mp3');
  bgAudio.loop = true;
  bgAudio.volume = .01;

  // Browser autoplay protection
  bgAudio.play().catch(() => {
    document.addEventListener('click', () => bgAudio.play(), { once: true });
  });
}

function duckBackgroundAudio() {
  if (!bgAudio || ducking) return;
  ducking = true;

  const drop = 0.10;   // how much volume drops
  const time = 200;    // duration in ms

  const newVol = Math.max(0.05, bgAudio.volume - drop);
  bgAudio.volume = newVol;

  setTimeout(() => {
    bgAudio.volume = bgAudioOriginalVol;
    ducking = false;
  }, time);
}

function pauseBackgroundAudio() {
  if (bgAudio && !bgAudio.paused) bgAudio.pause();
}

function resumeBackgroundAudio() {
  if (bgAudio && bgAudio.paused) bgAudio.play();
}

function gameOverMusicTransition() {
  if (!bgAudio) return;
  let fadeOut = setInterval(() => {
    bgAudio.volume -= 0.02;
    if (bgAudio.volume <= 0.05) {
      clearInterval(fadeOut);
      bgAudio.currentTime = 23;  // jump at low volume
      bgAudio.play();
      let fadeIn = setInterval(() => {
        bgAudio.volume += 0.02;
        if (bgAudio.volume >= 0.08) clearInterval(fadeIn);
      }, 80);
    }
  }, 80);
}

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

function setup() {
  const INSTRUCTION_WIDTH = 0.55; // Additional width for instructions
  // Create your canvas exactly as before

  const gameContainer = document.getElementById('game-container');
  const containerWidth = windowHeight * (WIDTH + INSTRUCTION_WIDTH);
  const containerHeight = windowHeight * HEIGHT;
  
  const cnv = createCanvas(containerWidth, containerHeight);
  cnv.parent('game-container'); // Attach canvas to the container
  
  // Center the canvas in the container
  centerCanvas(cnv);

  imageMode(CORNER);
  frameRate(FRAMERATE);

  userStartAudio();

  initBackgroundMusic();
  bgImage = loadImage("theme/cybercity_neon.jpg");
	
	ellipseMode(RADIUS); // --> circle(x,y,r)  (instead of diameter)
	strokeWeight(0.002); // REM: the screen is 1 high.
	obstacles = [];
	visualPlunger = new VisualPlunger();
	reverbSound = new p5.PolySynth();

	// === Outer Frame ===
  let outerFrame = new BoxObstacle(vec2(WIDTH / 2, HEIGHT / 2), WIDTH * 0.5, HEIGHT * 0.5);
  outerFrame.invert();
  outerFrame.setColor(color(255, 140, 0));
  obstacles.push(outerFrame);
  // === Bumper ===
  let bumper1 = new BumperObstacle(vec2(0.75 * WIDTH, 0.1 * HEIGHT), 0.04 * WIDTH, 150, 0.2, color(0, 255, 255));
	let bumper2 = new BumperObstacle(vec2(0.85 * WIDTH, 0.2 * HEIGHT), 0.04 * WIDTH, 150, 0.2, color(255, 0, 255));  
	let bumper3 = new BumperObstacle(vec2(0.65 * WIDTH, 0.2 * HEIGHT), 0.04 * WIDTH, 150, 0.2, color(255, 255, 0));
	
	let megaBonusBumper = new BumperObstacle(vec2(0.15 * WIDTH, 0.05 * HEIGHT), 0.04 * WIDTH, 150, 0.2, color(255, 255, 0));

	obstacles.push(bumper1, bumper2, bumper3, megaBonusBumper);
	
	// === Slingshot Neon Layout ===
	let slingStrength = 0.48;	

	// Lower Left Slingshot (facing upward toward center) ---
	// Left Slingshot (mirrored)
	let slingLowerL = new SlingshotObstacle(
			vec2(WIDTH * 0.15, HEIGHT * 0.7),    
    vec2(WIDTH * 0.02, HEIGHT * 0.60),   
    vec2(WIDTH * 0.05, HEIGHT * 0.80),
    slingStrength * 0.85,
    color(255, 120, 200) 
	);
	slingLowerL.opacity = 85;
	slingLowerL.glowPulse = true;
	obstacles.push(slingLowerL);

	// Lower Right Slingshot (alternative winding) ---  
	let slingLowerR = new SlingshotObstacle(
			vec2(WIDTH * 0.85, HEIGHT * 0.7),
			vec2(WIDTH * 0.95, HEIGHT * 0.80),  
			vec2(WIDTH * 0.98, HEIGHT * 0.60),   
			slingStrength * 0.85,
			color(120, 240, 255)
	);
	slingLowerR.opacity = 80;
	slingLowerR.glowPulse = true;
	obstacles.push(slingLowerR);

	// === Upper diamond ===
	let diamondL = new RotatedBoxObstacle(vec2(0.3 * WIDTH, 0.55 * HEIGHT), 0.05 * WIDTH, 0.05 * WIDTH, Math.PI / 4);
	diamondL.setColor(color(0, 255, 0)); // hot pink
	obstacles.push(diamondL);
	
	// === Upper diamond ===
	let diamondR = new RotatedBoxObstacle(vec2(0.7 * WIDTH, 0.55 * HEIGHT), 0.05 * WIDTH, 0.05 * WIDTH, Math.PI / 4);
	diamondL.setColor(color(0, 255, 0)); // hot pink
	obstacles.push(diamondR);
	
	/*
	// === 5. Center Vertical Bar ===
	let passiveBar = new BoxObstacle(vec2(WIDTH / 2, 0.7 * HEIGHT), 0.01 * WIDTH, 0.1 * HEIGHT);
	passiveBar.setColor(color(200 , 0, 255)); // purple neon
	obstacles.push(passiveBar);
	*/
	
	// === spinner
	let barSpinner = new NeonBarSpinnerObstacle(
			vec2(0.5 * WIDTH, 0.4 * HEIGHT),
			0.16,                             
			0.01,                               
			250,                              
			color(200, 200, 0)              // Neon yellow color
	);
	obstacles.push(barSpinner);
	
	// === Multiball targets ===
	
	// === Bouncy Ramp ===
  const rampColor = color(255, 0, 180); 
  const rampCenter = vec2(WIDTH * 0.37, HEIGHT * 0.3);
  const rampRadius = WIDTH * 0.35;
  const startAngle = radians(180);
  const endAngle = radians(300);
  const segmentCount = 20;
	
  let lastPoint = null;
  for (let i = 0; i <= segmentCount; i++) {
    const theta = lerp(startAngle, endAngle, i / segmentCount);
    const x = rampCenter.x + rampRadius * cos(theta);
    const y = rampCenter.y + rampRadius * sin(theta);
    if (lastPoint) {
      let seg = new LineObstacle(vec2(lastPoint.x, lastPoint.y), vec2(x, y));
      seg.setColor(rampColor);
      seg.setCOR(0.9); // Make it bouncy!
      obstacles.push(seg);
    }
    lastPoint = { x, y };
  }
	
	multiTargets = []; // Clear the array
	const targetWidth = 0.03 * WIDTH;
	const targetHeight = 0.04 * HEIGHT;
	
	const targetAngles = [
    lerp(startAngle, endAngle, 0.1), // First target at 15% along ramp
    lerp(startAngle, endAngle, 0.5), // Second target at 50% along ramp  
    lerp(startAngle, endAngle, 0.9)  // Third target at 85% along ramp
	];

	// Create targets positioned on the ramp curve
	const insetDistance = 0.08 * WIDTH;

	// Create targets positioned inside the ramp curve
	for (let i = 0; i < targetAngles.length; i++) {
    const theta = targetAngles[i];
    
    // Calculate position INSIDE the ramp (smaller radius)
    const x = rampCenter.x + (rampRadius - insetDistance) * cos(theta);
    const y = rampCenter.y + (rampRadius - insetDistance) * sin(theta);

    const rotationAngle = theta;
    
    // Create rotated target
    let target = new RotatedBoxObstacle(vec2(x, y), targetWidth, targetHeight, rotationAngle);
    target.setColor(color(255, 50, 50));
    target.setCOR(0.8);
    target.isActive = true;
    
    multiTargets.push(target);
    obstacles.push(target);
	}
	
	obstacles.push(
	new NeonBarObstacle(vec2
		 (WIDTH * 0.96, 
			HEIGHT * 0.27), 
			0.28, 0.014, 
			color(255, 0, 200), 
			"tremor", true
	));
	
	obstacles.push(
	new NeonBarObstacle(vec2
		 (WIDTH * 0.05, 
			HEIGHT * 0.45), 
			0.2, 0.014, 
			color(100, 255, 100), 
			"tremor", true
	));
	
	// === Flippers ===
	const KEY_F = 70;  // 'F' left
	const KEY_J = 74;  // 'J' right
	const KEY_K = 75;  // 'K' upper right

	flipperL = new Flipper(vec2(0.24 * WIDTH, 0.79 * HEIGHT),
		0.035, 0.02, 0.15, -PI * 1/4, +PI / 2, 8., KEY_F, color(255, 20, 150));
	flipperL.setCOR(0.6);

	flipperR = new Flipper(vec2(0.76 * WIDTH, 0.79 * HEIGHT),
		0.035, 0.02, 0.15, +PI * 5/4, -PI / 2, 8., KEY_J, color(255, 40, 180));
	flipperR.setCOR(0.6);

	flipperR1 = new Flipper(vec2(0.88 * WIDTH, 0.33 * HEIGHT),
		0.03, 0.01, 0.15, +PI * 9/6, -PI / 2, 8., KEY_J, color(0, 255, 255));
	flipperR1.setCOR(0.5);

	obstacles.push(flipperL, flipperR, flipperR1);
	
	// 📦 ADD YOUR DOMAIN BOUNDARY OBSTACLE (BOX FOR NOW):
	{
		let domainBox = new BoxObstacle(createVector(WIDTH / 2, HEIGHT / 2), WIDTH / 2, HEIGHT / 2);
		domainBox.invert(); // 🚫 invert to stay inside the box
		obstacles.push(domainBox);
	}

	// ⚪ Create ball:
	ball = new Ball(BALL_RADIUS);
	balls.push(ball);

	resetGame(); // 🔄 Reset game state
} 


// 🔄 Restarts Game (resets all game entities).
function resetGame() {
	balls = [ball];
	multiballActivated = false;
	
	// Reset multiball targets
	for (let target of multiTargets) {
			target.isActive = true;
			target.setColor(color(255, 50, 50)); // Back to red
	}
	activeTargets = 3;
	
	// BALL INITIAL CONDITIONS (MODIFY FOR YOUR GAME, e.g., for plunger)
	ball.p.x = WIDTH / 2;
	ball.p.y = 0.2 * HEIGHT;
	
	// Stop the ball until plunger fires
  ball.v.x = 0;
  ball.v.y = 0;

  // Launch the ball after short delay (plunger travel time)
  setTimeout(() => {
    ball.v.x = random(-0.400, -0.200);
    ball.v.y = random(-0.100, +0.100);

    rippleEffects.push(new Ripple(ball.p.x, ball.p.y, color(255, 0, 180)));
    for (let i = 0; i < 8; i++) {
      sparkParticles.push(new SparkParticle(ball.p.x, ball.p.y, color(255, 0, 180)));
    }
  }, 500); // 🔥 0.5 sec delay


	flipperL.resetFlipper();
	flipperR.resetFlipper();
	flipperR1.resetFlipper();
	
	// === Visual Flair ===
  rippleEffects.push(new Ripple(ball.p.x, ball.p.y, color(255, 0, 180)));
  for (let i = 0; i < 8; i++) {
    sparkParticles.push(new SparkParticle(ball.p.x, ball.p.y, color(255, 0, 180)));
  }
}

// 🎞️ Main animation loop
function draw() {
	if (!isPaused)
		timestep(); // ⏱️ Advance physics

	drawScene(); // 🖼️ Render game scene 
}

// 🚩 Ball lost? 
function isBallInEndzone(b) {
  // Check the individual ball passed into this function, not the global one
  return (b.p.y > HEIGHT * 0.95);
}

function timestep() {
	const dt = 1.0 / FRAMERATE; // Fixed rate. Fine assuming game runs fast enough. 
	
	flipperL.timestep(dt); // 🕹️ Left flipper physics
	flipperR.timestep(dt); // 🕹️ Right flipper physics
	flipperR1.timestep(dt);
	
	for (let o of obstacles) if (o.timestep) o.timestep(dt)
	
	for (let b of balls){
		b.timestep(dt);     // ⚪ Ball physics
	}
	
	for (let b of balls) {
    flipperL.handleBallCollision(b);
    flipperR.handleBallCollision(b);
    flipperR1.handleBallCollision(b);
  }
	
	// === 💥 Ball-to-Ball Collision Handling ===
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      let b1 = balls[i];
      let b2 = balls[j];
      let dx = b2.p.x - b1.p.x;
      let dy = b2.p.y - b1.p.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let minDist = b1.r + b2.r;

      if (dist < minDist) {
        // --- Resolve overlap ---
        let overlap = (minDist - dist) * 0.5;
        let nx = dx / dist;
        let ny = dy / dist;
        b1.p.x -= nx * overlap;
        b1.p.y -= ny * overlap;
        b2.p.x += nx * overlap;
        b2.p.y += ny * overlap;

        // --- Velocity response (elastic) ---
        let v1n = b1.v.x * nx + b1.v.y * ny;
        let v2n = b2.v.x * nx + b2.v.y * ny;
        let m1 = 1, m2 = 1; // equal mass

        let p = 2 * (v1n - v2n) / (m1 + m2);
        b1.v.x -= p * m2 * nx;
        b1.v.y -= p * m2 * ny;
        b2.v.x += p * m1 * nx;
        b2.v.y += p * m1 * ny;

        // --- 🔊 impact sound ---
				let relVel = p5.Vector.sub(b1.v, b2.v).mag();
				let intensity = constrain(map(relVel, 0, 10, 0.2, 0.7), 0.2, 0.7);

				// Pick a slightly higher, airier chord range
				let note = random(['A4', 'C5', 'E5', 'G5']);
				let pan = random(-0.5, 0.5); // subtle stereo placement

				// Main metallic ping (core hit)
				bumperSound.play(note, intensity, 0, 0.15, { pan });

				// Layer a softer shimmer tail for atmosphere
				if (typeof reverbSound !== 'undefined' && reverbSound) {
					reverbSound.play(note, intensity * 0.35, 0.02, 0.25, { pan: pan * 0.4 });
				}

				// --- Stronger visual feedback (pulse + glow + sparks + ripple) ---
				let impactColor = color(255, 60, 60);
				b1.flashColor = impactColor;
				b2.flashColor = impactColor;

				// start timers (ms)
				b1.flashTimer = b1.flashDuration;
				b2.flashTimer = b2.flashDuration;

				// size pulse
				b1.flashScale = b1.flashMaxScale;
				b2.flashScale = b2.flashMaxScale;

				// trail color hint
				b1.trailFlashColor = impactColor;
				b2.trailFlashColor = impactColor;

				// small ripple and shake
				rippleEffects.push(new Ripple((b1.p.x + b2.p.x) / 2, (b1.p.y + b2.p.y) / 2, impactColor));
				triggerScreenShake(0.012, 120);

				// spark burst (uses SparkParticle class)
				for (let s = 0; s < 10; s++) {
					sparkParticles.push(new SparkParticle((b1.p.x + b2.p.x) / 2, (b1.p.y + b2.p.y) / 2, impactColor));
				}

      }
    }
  }

	checkMultiballTargets();
	
	let ballsLostThisFrame = 0;
	
	// Handle lost balls
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
		// --- Ball loss & Game Over check (robust for multiball) --
    if (isBallInEndzone(b)) {
      balls.splice(i, 1);          // remove just that ball
      ballsLostThisFrame++;

			// Add a little effect when losing a ball
      rippleEffects.push(new Ripple(b.p.x, b.p.y, color(255, 0, 100)));
      for (let j = 0; j < 8; j++) {
        sparkParticles.push(new SparkParticle(b.p.x, b.p.y, color(255, 100, 200)));
      }
    }
  }
	
	// Update balls left (prevent going negative)
	ballsLeft = Math.max(0, ballsLeft - ballsLostThisFrame);
	
	// Game over if all balls gone
	if (balls.length === 0) {
		if (ballsLeft > 0) {
			resetGame();          // reset ball position & velocity
			visualPlunger.fireAnimation(); // 🔥 animate plunger again
			
			// 🎵 Launch sound when plunger fires after reset
			let note = random(['A4', 'B4', 'C5']);
			metalSound.play(note, 0.7, 0, 0.2);
			duckBackgroundAudio();
		} else {
			isPaused = true;
			gameOverActive = true;
			gameOverMusicTransition();  // 🟣 jump to second 23 of the Neon City track
			setBackgroundVolume(0.06);  // make it slightly louder for that end vibe
		}
	}
	
	if (ballsLeft === 0 && balls.length > 0) {
    balls = []; // Clear any remaining balls
    isPaused = true;
    gameOverActive = true;
		gameOverMusicTransition();  // 🟣 jump to second 23 of the Neon City track
		setBackgroundVolume(0.08);  // make it slightly louder for that end vibe
  }
}

// 🖼️ MAIN RENDERING CALL
function drawScene() {
	clear();
	push();
	scale(height / HEIGHT);
	
	// === Apply Screen Shake ===
  if (shakeDuration > 0) {
    let elapsed = millis() - shakeStart;
    if (elapsed < shakeDuration) {
      translate(random(-shakeAmplitude, shakeAmplitude), random(-shakeAmplitude, shakeAmplitude));
    } else {
      shakeDuration = 0;
    }
  }
	
	if (keyIsPressed === true && key === 's') { // 🔍 Debug view: rasterize SDF
			drawSDFRaster();
			isPaused = true;
			} else {
				if (bgImage) {
					image(bgImage, 0, 0, WIDTH, HEIGHT);
			} else {
				background(10, 10, 25); // fallback if no image
			}
			
			// === Perimeter light glow ===
			push();
			noStroke();
			for (let i = 0; i < 20; i++) {
				let alpha = 40 + 40 * sin(millis() * 0.002 + i);
				fill(255, 0, 255, alpha * 0.5);
				rect(WIDTH * (i / 20), 0, WIDTH / 20, 0.02); // top band flicker
				fill(0, 255, 255, alpha * 0.3);
				rect(WIDTH * (i / 20), HEIGHT - 0.02, WIDTH / 20, 0.02); // bottom glow
			}
			pop();
			
			// === NEON FRAME & ARC BORDER ONLY ===
			noFill();
			let borderColor = color(180, 0, 255);
			let accentColor = color(255, 0, 180);

			push();
			drawingContext.shadowBlur = 30;
			drawingContext.shadowColor = borderColor;
			stroke(borderColor);
			strokeWeight(0.01);
			rect(0, 0, WIDTH, HEIGHT, 0.06);
			pop();
			
			// Dynamic color balancing for slingshots
			applyNeonBalance();

			push();
			drawingContext.shadowBlur = 20;
			drawingContext.shadowColor = accentColor;
			stroke(accentColor);
			strokeWeight(0.005);
			arc(WIDTH * 0.5, 0.0, WIDTH * 0.90, HEIGHT * 0.47, Math.PI, Math.PI * 2);
			pop();
			
			// === OBSTACLES (Includes flippers) ===
			for (let i = 0; i < obstacles.length; i++) {
				let o = obstacles[i];
				push();
				drawingContext.shadowBlur = 20;
				drawingContext.shadowColor = o.getColor();
				o.draw();
				pop();
			}
				
			// --- Ripple wave effects ---
			for (let i = rippleEffects.length - 1; i >= 0; i--) {
				rippleEffects[i].updateAndDraw();
				if (rippleEffects[i].alpha <= 0) rippleEffects.splice(i, 1);
			}

			for (let b of balls) {
				b.draw();
			}
				
			visualPlunger.draw();

			// === SCOREBOARD ===
			let pulseSync = 180 + 75 * sin(millis() * 0.003);
			drawingContext.shadowBlur = 30;
			drawingContext.shadowColor = color(255, 0, 255);
			fill(255, 0, 255, pulseSync);
			textAlign(CENTER, TOP);
			textFont(cyberFont);
			textSize(0.042);
			textStyle(BOLD);
			text("Score: " + score + " | Balls: " + ballsLeft, WIDTH * 0.5, HEIGHT * 0.03);
			drawingContext.shadowBlur = 0;
				
			// === DRAW SCORE NOTIFICATIONS ===
			for (let i = scoreNotifications.length - 1; i >= 0; i--) {
				let n = scoreNotifications[i];

				// --- Motion & pulsate ---
				n.y -= 0.002 + random(0, 0.001);                 
				n.x += sin(millis() * 0.01 + i) * 0.002;         
				let pulse = 0.008 + 0.01 * sin(millis() * 0.03 * i);

				// --- Fade out ---
				n.alpha -= 3;

				// --- Color cycling for neon flicker ---
				let r = constrain(red(n.color) + sin(frameCount * 0.05 + i) * 20, 0, 255);
				let g = constrain(green(n.color) + cos(frameCount * 0.03 + i) * 20, 0, 255);
				let b = constrain(blue(n.color) + sin(frameCount * 0.04 + i) * 20, 0, 255);

				// --- Glow / shadow ---
				drawingContext.shadowBlur = 30 + random(5);
				drawingContext.shadowColor = color(r, g, b, n.alpha);

				// --- Draw text ---
				fill(r, g, b, n.alpha);
				textAlign(CENTER, CENTER);
				textFont(cyberFont);
				textSize(n.size + pulse);
				text("+" + n.value, n.x, n.y);

				// --- Remove if fully faded ---
				if (n.alpha <= 0) scoreNotifications.splice(i, 1);
			}

			drawingContext.shadowBlur = 0; // reset shadow
				
			// === ⚙️ Display Speed Mode with glow pulse ===
			push();
			textAlign(CENTER, CENTER);
			textSize(0.03);

			// Pick color based on speed mode
			let c;
			if (speedMode === "slow")      c = color(100, 200, 255);   // blueish
			else if (speedMode === "normal") c = color(255, 255, 255); // white
			else                             c = color(255, 80, 80);   // red

			// Subtle pulse effect every few frames (optional)
			if (frameCount % 5 === 0) {
				drawingContext.shadowBlur = 30;
				drawingContext.shadowColor = c;
			} else {
				drawingContext.shadowBlur = 0;
			}

			// Draw the text
			fill(c);
			noStroke();
			text(`⚙️ ${speedMode.toUpperCase()}`, WIDTH * 0.5, HEIGHT * 0.10);
			drawingContext.shadowBlur = 0; // reset
			pop();
				
			// === Combo Meter ===
			if (comboLevel > 1) {
				let comboText = "🔥 COMBO ×" + comboLevel;
				textSize(0.032);
				fill(255, 180, 0, 200);
				drawingContext.shadowBlur = 25;
				drawingContext.shadowColor = color(255, 120, 0);
				
				// Prevent overlap with speed mode text 
				text(comboText, WIDTH * 0.5, HEIGHT * 0.33);     // Change position to be between plunger (y ≈ 0.23) and spinner (y ≈ 0.40)
				
				drawingContext.shadowBlur = 0;
			}
		
				
			// === GAME OVER OVERLAY ===
			if (gameOverActive) {
				push();
				translate(WIDTH * 0.5, HEIGHT * 0.5);
				let t = millis() * 0.002;
				let slide = sin(t) * 0.05;
				let pulse = 180 + 75 * sin(t * 2);

				textAlign(CENTER, CENTER);
				textFont(cyberFont);
				textSize(0.12);

				// flicker neon fill
				let flicker = random() < 0.1 ? random(100, 255) : 255;
				fill(255, 0, 255, pulse * (flicker / 255));

				drawingContext.shadowBlur = 60;
				drawingContext.shadowColor = color(255, 0, 255);
				text("💀 GAME OVER 💀", slide, -0.05);

				textSize(0.045);
				fill(0, 255, 255);
				drawingContext.shadowBlur = 25;
				drawingContext.shadowColor = color(0, 255, 255);
				text("Press R to Restart", slide, 0.08);
				pop();
			}
			
			drawInstructions();
			pop();
		}
}

function distanceO(p) {
	let minDistO = [Infinity, this];
	for (let i = 0; i < obstacles.length; i++) {
		const doi = obstacles[i].distanceO(p);
		minDistO = SDF.opUnion(minDistO, doi); // [min(d1,d2), closestObstacle]
	}
	return minDistO; // 🎯 Closest distance + obstacle
}

function drawInstructions() {
  push();
  const panelX = WIDTH;
  const panelW = 0.55;
  const t = millis() * 0.001;

  textFont(cyberFont);
  noStroke();
  fill(0);
  rect(panelX, 0, panelW, HEIGHT);

  //drawVolumeControl(panelX, panelW);

  // --- Blue neon edge separator ---
  for (let i = 0; i < 8; i++) {
    let flicker = 180 + 60 * sin(t * 5 + i);
    fill(0, 130 + i * 15, 255, flicker);
    rect(panelX + i * 0.002, 0, 0.002, HEIGHT);
  }

  // --- Neon color palette ---
  const magenta = color(255, 60, 240);
  const cyan = color(0, 255, 255);
  const violet = color(200, 100, 255);

  // --- Header: "INSTRUCTIONS" ---
  push();
  const pulse = 200 + 55 * sin(t * 2.8);
  drawingContext.shadowBlur = 60;
  drawingContext.shadowColor = magenta;
  textSize(0.05);
  textStyle(BOLD);
  textAlign(CENTER, TOP); // Center align header
  for (let i = 0; i < 2; i++) {
    fill(i === 0 ? cyan : magenta);
    text("INSTRUCTIONS", panelX + panelW/2, 0.1 + i * 0.002);
  }
  textAlign(LEFT, TOP); // Reset to left align
  pop();

  // --- Control list ---
  let x = panelX + .04;
  let y = 0.2;
  const lh = 0.04;
  fill(cyan);
  textSize(0.026);
  
  const textWidth = panelW - .08; 
	
  text("⚡ SPACE — Pause / Resume", x, y, textWidth);
	y += lh * 1.5;

	text("🎯 F — Left flipper", x, y, textWidth);
	y += lh * 1.3;

	text("🎯 J — Right flippers", x, y, textWidth);
	y += lh * 1.3;

	text("🧪 S — SDF view", x, y, textWidth);

	// --- Speed Control Instructions ---
	y += lh * 1.3;
	fill(cyan);
	text("⚙️ Z/X/ C — Change ball speed", x, y, textWidth);

  // --- Animated divider line ---
  push();
  const dividerColor = lerpColor(cyan, magenta, (sin(t * 3) + 1) / 2);
  drawingContext.shadowBlur = 25;
  drawingContext.shadowColor = dividerColor;
  stroke(dividerColor);
  strokeWeight(0.005);
  line(panelX + 0.08, y + 0.06, panelX + panelW - 0.08, y + 0.06); // Adjusted margins
  pop();

  // --- Header: "OBJECTIVES" ---
  y += lh * 2.3;
  push();
  drawingContext.shadowBlur = 50;
  drawingContext.shadowColor = magenta;
  textAlign(CENTER, TOP); // Center align
  textSize(0.035);
  textStyle(BOLD);
  for (let i = 0; i < 2; i++) {
    fill(i === 0 ? cyan : magenta);
    text("OBJECTIVES", panelX + panelW/2, y + i * 0.001);
  }
  textAlign(LEFT, TOP); // Reset to left align
  pop();
	
  // --- Moving neon underlight strip ---
  const waveX = sin(t * 2) * 0.08;
  for (let i = 0; i < 30; i++) {
    const inter = i / 30;
    const hue = (270 + inter * 100 + t * 100) % 360;
    fill(color(`hsb(${hue}, 100%, 100%, 0.05)`));
    rect(panelX + 0.1 + waveX, y + 0.25 + i * 0.003, panelW - 0.2, 0.002);
  }
	
  // --- Objective list ---
  y += lh * 1.8;
  textSize(0.022);
  for (let i = 0; i < 3; i++) {
    const shimmer = (sin(t * 4 + i) + 1) / 2;
    const colorShift = lerpColor(violet, magenta, shimmer);
    fill(colorShift);
    const lineText = [
      "• Chain hits togeter to trigger combo",
      "• Hit all red boxes for multiball", 
      "• Keep the ball alive for combos!"
    ][i];
    text(lineText, x, y, textWidth); // Use the wider text area
    y += lh * 1.4;
  }

  // --- Floating spark particles ---
  noStroke();
  for (let i = 0; i < 12; i++) {
    const px = panelX + random(panelW);
    const py = random(HEIGHT);
    const alpha = 120 + 120 * sin(t * 5 + i);
    fill(255, 100, 255, alpha);
    circle(px, py, 0.004);
  }

  // --- Glowing vertical dots ---
  for (let i = 0; i < 18; i++) {
    const hue = (t * 80 + i * 20) % 360;
    const flicker = 180 + 75 * sin(t * 4 + i);
    fill(color(`hsb(${hue}, 100%, 100%, ${flicker / 255})`));
    const dx = panelX + panelW - 0.08 + sin(t + i) * 0.015; // Adjusted margin
    const dy = 0.1 + i * 0.05;
    circle(dx, dy, 0.006 + 0.002 * sin(t * 3 + i));
  }

  // --- Footer hint ---
  const glow = 180 + 75 * sin(t * 3);
  drawingContext.shadowBlur = 25;
  drawingContext.shadowColor = cyan;
  fill(cyan.levels[0], cyan.levels[1], cyan.levels[2], glow);
  textAlign(CENTER, BOTTOM);
  textSize(0.022);
  text("Press SPACE to start", panelX + panelW / 2, HEIGHT - 0.05);
  drawingContext.shadowBlur = 0;
  pop();
}

function checkMultiballTargets() {
	for (let i = 0; i < multiTargets.length; i++){
		let target = multiTargets[i];
		
		if(target.isActive) {
			let dist = target.distance(ball.p);
			
			if (dist < ball.r) {
				target.isActive = false;
				target.setColor(color(100, 100, 100)); // Gray out if hit
				activeTargets--;
				
				score += 250;
				addScoreNotification(250, target.x, target.y); 
				lastScore = score;
				
				if (activeTargets === 0 && !multiballActivated) {
						activateMultiball();
				}
				break;
			}
		}	
	}
}

function activateMultiball() {
    multiballActivated = true;
    
    // Bonus score for activating multiball
    score += 2000;
		addScoreNotification(2000, ball.p.x, ball.p.y); // show near main ball
		lastScore = score;
    
    // Add 2 extra balls
    for (let i = 0; i < 2; i++) {
        let newBall = new Ball(BALL_RADIUS);
        
        // Position near the original ball but with some offset
        newBall.p.x = ball.p.x + random(-0.05, 0.05);
        newBall.p.y = ball.p.y + random(-0.05, 0.05);
        
        // Give random initial velocity
        newBall.v.x = random(-0.3, 0.3);
        newBall.v.y = random(-0.2, 0.0);
        
        balls.push(newBall);
    }
    
    ballsLeft += 2; // Add to ball count
    
    console.log("MULTIBALL ACTIVATED! Total balls: " + balls.length);
}

function simulateTargetHit(index) {
  if (multiTargets[index] && multiTargets[index].isActive) {
    multiTargets[index].isActive = false;
    multiTargets[index].setColor(color(100, 100, 100));
    activeTargets--;
    score += 250;
		addScoreNotification(
			250,
			multiTargets[index].center.x, // X of the target that was hit
			multiTargets[index].center.y  // Y of the target that was hit
		);
		lastScore = score;

    console.log(`Target ${index + 1} hit! Active left: ${activeTargets}`);

    // Add some visuals for testing
    rippleEffects.push(new Ripple(multiTargets[index].center.x, multiTargets[index].center.y, color(255, 0, 180)));
    triggerScreenShake(0.01, 200);

    if (activeTargets === 0 && !multiballActivated) {
      activateMultiball();
    }
  }
}


/**
 * ⌨️ Key press handler
 */
function keyPressed() {	
  if (key === ' ') {
    isPaused = !isPaused; // ⏯️ Toggle pause with spacebar
		
		if (isPaused) {
      pauseBackgroundAudio();   // 🟣 Pause background music
    } else {
      resumeBackgroundAudio();  // 🟣 Resume background music
    }

    // 🎵 Launch sound + animation only when actually launching from plunger
    if (!isPaused) {
      const nearPlunger = dist(ball.p.x, ball.p.y, visualPlunger.x, visualPlunger.y) < 0.1;

      if (nearPlunger) {
        visualPlunger.fireAnimation();
        let note = random(['A4', 'B4', 'C5']);
        metalSound.play(note, 0.05, 0, 0.2);
				duckBackgroundAudio();
      }
    }
  }

  // 🧪 Dev keys to simulate hitting each target
  if (key === '1') simulateTargetHit(0);
  if (key === '2') simulateTargetHit(1);
  if (key === '3') simulateTargetHit(2);

	// ---- SPEED CONTROL KEYS ----
	if (key === 'z' || key === 'Z') {
		speedMode = "slow";  // ~30% slower than normal
		speedFactor = 0.5;
	} else if (key === 'x' || key === 'X') {
		speedMode = "normal"; // reset to default speed
		speedFactor = 1.0;
	} else if (key === 'c' || key === 'C') {
		speedMode = "fast"; // ~30% faster than normal
		speedFactor = 1.5;
	}
	
  // 🔁 Reset the game
  if (key === 'R' || key === 'r') {
    gameOverActive = false;
    isPaused = false;
    ballsLeft = 3;
    score = 0;
		lastScore = score;
    resetGame();
		
		resumeBackgroundAudio();  // 🟣 NEW: make sure background starts again

    // 🎵 Also trigger plunger sound + animation when resetting
    visualPlunger.fireAnimation();
    let note = random(['A4', 'B4', 'C5']);
    metalSound.play(note, 0.7, 0, 0.2);
		duckBackgroundAudio();
  }
}