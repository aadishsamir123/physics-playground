const canvas = document.getElementById("simulation-canvas");
const ctx = canvas.getContext("2d");

const stageTitle = document.getElementById("stage-title");
const simHint = document.getElementById("sim-hint");
const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");
const simulationSpeedInput = document.getElementById("simulation-speed");
const simulationSpeedValue = document.getElementById("simulation-speed-value");
const projectileLineList = document.getElementById("projectile-line-list");
const projectileGridEnabledInput = document.getElementById("projectile-grid-enabled");
const projectileGridSpacingInput = document.getElementById("projectile-grid-spacing");
const projectileGridOpacityInput = document.getElementById("projectile-grid-opacity");
const activeSimId = document.body.dataset.sim || "orbit";
const rangeInputs = Array.from(document.querySelectorAll('input[type="range"]'));

const dpr = Math.min(window.devicePixelRatio || 1, 2);

function getProjectileColor(index) {
  const hue = (index * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 78% 52%)`;
}

const state = {
  active: activeSimId,
  paused: false,
  lastTime: performance.now(),
  speed: 1,
  width: 0,
  height: 0,
  pointerDown: false,
  draggingPendulum: false,
  pointerId: null,
  lastPointerAngle: null,
  lastPointerAngleTime: null,
};

// ─── ORBIT ────────────────────────────────────────────────────────────────────
const orbit = {
  title: "Orbit Lab",
  hint: "Spin up a miniature solar system and fling satellites into orbit.",
  bodies: [],
  gravity: 520,
  spawnEnergy: 150,
  countSetting: 7,
  trailLength: 26,
  coreMass: 1050,
  reset() {
    const centerX = state.width * 0.5;
    const centerY = state.height * 0.5;
    this.bodies = [];
    const bodyCount = Math.max(3, Math.round(this.countSetting));
    for (let i = 0; i < bodyCount; i += 1) {
      const angle = (Math.PI * 2 * i) / bodyCount;
      const distance = 110 + i * 28;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      const tangent = angle + Math.PI / 2;
      const speed = 92 + i * 8;
      this.bodies.push({ x, y, vx: Math.cos(tangent) * speed, vy: Math.sin(tangent) * speed, r: 4 + (i % 3), hue: 170 + i * 14, trail: [] });
    }
  },
  spawn() {
    const centerX = state.width * 0.5;
    const centerY = state.height * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const distance = 90 + Math.random() * 20;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const tangent = angle + Math.PI / 2;
    const energyScale = this.spawnEnergy / 150;
    this.bodies.push({ x, y, vx: Math.cos(tangent) * this.spawnEnergy * 0.7 * energyScale, vy: Math.sin(tangent) * this.spawnEnergy * 0.7 * energyScale, r: 4 + Math.random() * 2, hue: 155 + Math.random() * 120, trail: [] });
  },
  update(dt) {
    const centerX = state.width * 0.5;
    const centerY = state.height * 0.5;
    const dtSeconds = dt / 1000;
    this.bodies.forEach((body) => {
      const dx = centerX - body.x;
      const dy = centerY - body.y;
      const distanceSq = Math.max(dx * dx + dy * dy, 900);
      const distance = Math.sqrt(distanceSq);
      const accel = this.gravity / distanceSq;
      body.vx += (dx / distance) * accel * dt * 220;
      body.vy += (dy / distance) * accel * dt * 220;
      body.x += body.vx * dtSeconds;
      body.y += body.vy * dtSeconds;
      body.trail.push([body.x, body.y]);
      if (body.trail.length > this.trailLength) body.trail.shift();
    });
    this.bodies = this.bodies.filter((body) => {
      const dx = body.x - centerX;
      const dy = body.y - centerY;
      return Math.hypot(dx, dy) < Math.max(state.width, state.height) * 1.4;
    });
  },
  draw(ctx2d) {
    const centerX = state.width * 0.5;
    const centerY = state.height * 0.5;

    ctx2d.save();
    ctx2d.fillStyle = "#030712";
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Star field
    ctx2d.fillStyle = "rgba(255,255,255,0.55)";
    for (let s = 0; s < 80; s++) {
      const sx = ((s * 137.508 * 19) % state.width);
      const sy = ((s * 97.3 * 23) % state.height);
      const sr = (s % 3 === 0) ? 1.2 : 0.7;
      ctx2d.beginPath();
      ctx2d.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // Orbit rings
    ctx2d.strokeStyle = "rgba(255,255,255,0.07)";
    ctx2d.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring += 1) {
      ctx2d.beginPath();
      ctx2d.arc(centerX, centerY, 92 + ring * 58, 0, Math.PI * 2);
      ctx2d.stroke();
    }

    // Sun glow
    const sunGlow = ctx2d.createRadialGradient(centerX, centerY, 10, centerX, centerY, 110);
    sunGlow.addColorStop(0, "rgba(253,230,138,0.35)");
    sunGlow.addColorStop(1, "rgba(245,158,11,0)");
    ctx2d.fillStyle = sunGlow;
    ctx2d.beginPath();
    ctx2d.arc(centerX, centerY, 110, 0, Math.PI * 2);
    ctx2d.fill();

    // Sun body
    const sunGrad = ctx2d.createRadialGradient(centerX - 20, centerY - 20, 4, centerX, centerY, 28);
    sunGrad.addColorStop(0, "#fef9c3");
    sunGrad.addColorStop(1, "#f59e0b");
    ctx2d.fillStyle = sunGrad;
    ctx2d.beginPath();
    ctx2d.arc(centerX, centerY, 28, 0, Math.PI * 2);
    ctx2d.fill();

    this.bodies.forEach((body) => {
      if (body.trail.length > 1) {
        ctx2d.beginPath();
        body.trail.forEach(([tx, ty], index) => { if (index === 0) ctx2d.moveTo(tx, ty); else ctx2d.lineTo(tx, ty); });
        ctx2d.strokeStyle = `hsla(${body.hue},80%,65%,0.4)`;
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();
      }
      const bGrad = ctx2d.createRadialGradient(body.x - body.r*0.3, body.y - body.r*0.3, 0.5, body.x, body.y, body.r);
      bGrad.addColorStop(0, `hsl(${body.hue} 80% 80%)`);
      bGrad.addColorStop(1, `hsl(${body.hue} 70% 45%)`);
      ctx2d.fillStyle = bGrad;
      ctx2d.beginPath();
      ctx2d.arc(body.x, body.y, body.r, 0, Math.PI * 2);
      ctx2d.fill();
    });

    ctx2d.restore();
  },
  count() { return this.bodies.length + 1; },
};

// ─── PENDULUM ─────────────────────────────────────────────────────────────────
const pendulum = {
  title: "Pendulum Lab",
  hint: "A damped pendulum swings through a long, satisfying arc.",
  length: 210,
  airResistance: 4,
  mass: 10,
  bobSize: 18,
  angle: -0.62,
  velocity: 0,
  dragging: false,
  anchorX: 0,
  anchorY: 0,
  push() { this.velocity = 0; this.angle = -0.62; },
  reset() { this.angle = -0.62; this.velocity = 0; },
  update(dt) {
    const dtSeconds = dt / 1000;
    const gravity = 9.81;
    const pixelsPerMeter = 100;
    const lengthInMeters = this.length / pixelsPerMeter;
    const airForce = this.airResistance * 0.02; // Damping
    if (this.dragging) return;
    
    // Standard pendulum equation: alpha = -(g/L) * sin(theta) - damping * omega
    const acceleration = (-gravity / lengthInMeters) * Math.sin(this.angle) - (airForce / this.mass) * this.velocity;
    this.velocity += acceleration * dtSeconds;
    this.velocity = Math.max(-10, Math.min(10, this.velocity));
    this.angle += this.velocity * dtSeconds;
  },
  draw(ctx2d) {
    const anchorX = state.width * 0.5;
    const anchorY = Math.max(90, state.height * 0.14);
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    const bobX = anchorX + Math.sin(this.angle) * this.length;
    const bobY = anchorY + Math.cos(this.angle) * this.length;
    ctx2d.save();

    // Dark background with subtle gradient
    const bgGrad = ctx2d.createLinearGradient(0, 0, 0, state.height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx2d.fillStyle = bgGrad;
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Ceiling mount
    ctx2d.fillStyle = "#475569";
    ctx2d.fillRect(anchorX - 36, 0, 72, anchorY);
    ctx2d.fillStyle = "#64748b";
    ctx2d.fillRect(anchorX - 40, anchorY - 12, 80, 12);

    // Shadow arc on floor
    const floorY = state.height - 20;
    const shadowX = anchorX + Math.sin(this.angle) * this.length * 1.05;
    const shadowW = this.bobSize * 1.4;
    ctx2d.fillStyle = "rgba(0,0,0,0.25)";
    ctx2d.beginPath();
    ctx2d.ellipse(shadowX, floorY, shadowW, 5, 0, 0, Math.PI * 2);
    ctx2d.fill();

    // String
    ctx2d.strokeStyle = "#94a3b8";
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(anchorX, anchorY);
    ctx2d.lineTo(bobX, bobY);
    ctx2d.stroke();

    // Anchor pin
    ctx2d.fillStyle = "#cbd5e1";
    ctx2d.beginPath();
    ctx2d.arc(anchorX, anchorY, 7, 0, Math.PI * 2);
    ctx2d.fill();

    // Bob glow
    const glow = ctx2d.createRadialGradient(bobX, bobY, this.bobSize * 0.4, bobX, bobY, this.bobSize * 2.2);
    glow.addColorStop(0, "rgba(99,102,241,0.3)");
    glow.addColorStop(1, "rgba(99,102,241,0)");
    ctx2d.fillStyle = glow;
    ctx2d.beginPath();
    ctx2d.arc(bobX, bobY, this.bobSize * 2.2, 0, Math.PI * 2);
    ctx2d.fill();

    // Bob
    const bobGrad = ctx2d.createRadialGradient(bobX - this.bobSize*0.3, bobY - this.bobSize*0.3, 1, bobX, bobY, this.bobSize);
    bobGrad.addColorStop(0, "#a5b4fc");
    bobGrad.addColorStop(1, "#4f46e5");
    ctx2d.fillStyle = bobGrad;
    ctx2d.beginPath();
    ctx2d.arc(bobX, bobY, this.bobSize, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.restore();
  },
  count() { return 1; },
};

// ─── PROJECTILE ───────────────────────────────────────────────────────────────
const projectile = {
  title: "Projectile Lab",
  hint: "Fire a shell, compare paths, and keep the grid where it helps.",
  angle: 48,
  power: 126,
  drag: 0,
  gravity: 540,
  gridEnabled: true,
  gridSpacing: 48,
  gridOpacity: 0.16,
  launched: false,
  elapsed: 0,
  origin: { x: 0, y: 0 },
  pos: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  lines: [],
  activeLine: null,
  nextLineId: 1,
  prepareIdleState() {
    const groundY = state.height - 84;
    this.origin = { x: 90, y: groundY };
    this.pos = { x: this.origin.x, y: this.origin.y };
    this.velocity = { x: 0, y: 0 };
    this.elapsed = 0;
    this.launched = false;
    this.activeLine = null;
  },
  reset() {
    this.lines = [];
    this.nextLineId = 1;
    this.activeLine = null;
    this.launched = false;
    this.elapsed = 0;
    this.prepareIdleState();
    renderProjectileLegend();
  },
  launch() {
    const groundY = state.height - 84;
    this.origin = { x: 90, y: groundY };
    this.pos = { x: this.origin.x, y: this.origin.y };
    const speed = this.power * 3.1;
    const radians = (this.angle * Math.PI) / 180;
    this.velocity = { x: Math.cos(radians) * speed, y: -Math.sin(radians) * speed };
    const line = { id: this.nextLineId, label: `Shot ${this.nextLineId}`, color: getProjectileColor(this.nextLineId - 1), visible: true, points: [{ x: this.pos.x, y: this.pos.y }] };
    this.nextLineId += 1;
    this.lines.push(line);
    this.activeLine = line;
    this.launched = true;
    this.elapsed = 0;
    renderProjectileLegend();
  },
  update(dt) {
    if (!this.launched) return;
    const dtSeconds = dt / 1000;
    this.elapsed += dtSeconds;
    this.velocity.y += this.gravity * dtSeconds;
    const dragFactor = Math.max(0, 1 - this.drag * 0.01 * dtSeconds * 8);
    this.velocity.x *= dragFactor;
    this.velocity.y *= dragFactor;
    this.pos.x += this.velocity.x * dtSeconds;
    this.pos.y += this.velocity.y * dtSeconds;
    if (this.activeLine) this.activeLine.points.push({ x: this.pos.x, y: this.pos.y });
    if (this.activeLine && this.activeLine.points.length > 220) this.activeLine.points.shift();
    const groundY = state.height - 84;
    if (this.pos.y >= groundY) { this.pos.y = groundY; this.launched = false; this.activeLine = null; }
  },
  draw(ctx2d) {
    const groundY = state.height - 84;
    ctx2d.save();

    // Dark sky gradient
    const skyGrad = ctx2d.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, "#0c1220");
    skyGrad.addColorStop(1, "#1a2744");
    ctx2d.fillStyle = skyGrad;
    ctx2d.fillRect(0, 0, state.width, groundY);

    if (this.gridEnabled) {
      const spacing = Math.max(16, this.gridSpacing);
      ctx2d.strokeStyle = `rgba(148, 163, 200, ${this.gridOpacity})`;
      ctx2d.lineWidth = 1;
      for (let x = 0; x <= state.width; x += spacing) { ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, groundY); ctx2d.stroke(); }
      for (let y = 0; y <= groundY; y += spacing) { ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(state.width, y); ctx2d.stroke(); }
    }

    // Ground
    const groundGrad = ctx2d.createLinearGradient(0, groundY, 0, state.height);
    groundGrad.addColorStop(0, "#1e3a1e");
    groundGrad.addColorStop(1, "#0f2010");
    ctx2d.fillStyle = groundGrad;
    ctx2d.fillRect(0, groundY, state.width, state.height - groundY);

    // Ground surface line
    ctx2d.strokeStyle = "#4ade80";
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();
    ctx2d.moveTo(0, groundY); ctx2d.lineTo(state.width, groundY);
    ctx2d.stroke();

    this.lines.forEach((line) => {
      if (!line.visible || line.points.length <= 1) return;
      ctx2d.beginPath();
      line.points.forEach(({ x, y }, index) => { if (index === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y); });
      ctx2d.strokeStyle = line.color;
      ctx2d.lineWidth = 2.5;
      ctx2d.stroke();
    });

    // Shell glow
    const shellX = this.launched ? this.pos.x : this.origin.x;
    const shellY = this.launched ? this.pos.y : this.origin.y;
    if (this.launched) {
      const shellGlow = ctx2d.createRadialGradient(shellX, shellY, 2, shellX, shellY, 24);
      shellGlow.addColorStop(0, "rgba(251,146,60,0.4)");
      shellGlow.addColorStop(1, "rgba(251,146,60,0)");
      ctx2d.fillStyle = shellGlow;
      ctx2d.beginPath();
      ctx2d.arc(shellX, shellY, 24, 0, Math.PI * 2);
      ctx2d.fill();
    }
    ctx2d.fillStyle = "#fb923c";
    ctx2d.beginPath();
    ctx2d.arc(shellX, shellY, 10, 0, Math.PI * 2);
    ctx2d.fill();

    // Cannon
    ctx2d.fillStyle = "#334155";
    ctx2d.fillRect(56, groundY - 10, 64, 10);
    ctx2d.fillStyle = "#94a3b8";
    ctx2d.fillRect(62, groundY - 48, 14, 38);
    ctx2d.fillRect(74, groundY - 58, 32, 48);
    ctx2d.restore();
  },
  count() { return this.lines.length || 1; },
};

// ─── CIRCULAR MOTION ──────────────────────────────────────────────────────────
const circular = {
  title: "Circular Motion",
  hint: "Adjust speed and radius. Toggle velocity and centripetal force vectors.",
  angle: 0,
  speed: 1.8,
  radius: 120,
  showVelocity: true,
  showCentripetal: true,
  trail: [],
  maxTrail: 80,
  reset() { this.angle = 0; this.trail = []; },
  update(dt) {
    const dtSeconds = dt / 1000;
    this.angle += this.speed * dtSeconds;
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    const x = cx + Math.cos(this.angle) * this.radius;
    const y = cy + Math.sin(this.angle) * this.radius;
    this.trail.push([x, y]);
    if (this.trail.length > this.maxTrail) this.trail.shift();
  },
  draw(ctx2d) {
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    const x = cx + Math.cos(this.angle) * this.radius;
    const y = cy + Math.sin(this.angle) * this.radius;

    ctx2d.save();
    ctx2d.fillStyle = "#fff";
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Orbit circle
    ctx2d.strokeStyle = "#d1d5db";
    ctx2d.lineWidth = 1.5;
    ctx2d.setLineDash([6, 4]);
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, this.radius, 0, Math.PI * 2);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    // Radial line
    ctx2d.strokeStyle = "#e5e7eb";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath();
    ctx2d.moveTo(cx, cy);
    ctx2d.lineTo(x, y);
    ctx2d.stroke();

    // Trail
    if (this.trail.length > 1) {
      ctx2d.beginPath();
      this.trail.forEach(([tx, ty], i) => {
        if (i === 0) ctx2d.moveTo(tx, ty); else ctx2d.lineTo(tx, ty);
      });
      ctx2d.strokeStyle = "rgba(99,102,241,0.25)";
      ctx2d.lineWidth = 2;
      ctx2d.stroke();
    }

    // Center
    ctx2d.fillStyle = "#374151";
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx2d.fill();

    // Velocity vector (tangent, 90° ahead)
    if (this.showVelocity) {
      const vx = -Math.sin(this.angle);
      const vy = Math.cos(this.angle);
      const vLen = this.speed * this.radius * 0.25;
      ctx2d.strokeStyle = "#16a34a";
      ctx2d.lineWidth = 2.5;
      ctx2d.beginPath();
      ctx2d.moveTo(x, y);
      ctx2d.lineTo(x + vx * vLen, y + vy * vLen);
      ctx2d.stroke();
      drawArrowhead(ctx2d, x + vx * vLen, y + vy * vLen, vx, vy, "#16a34a");
      ctx2d.fillStyle = "#16a34a";
      ctx2d.font = "bold 12px system-ui";
      ctx2d.fillText("v", x + vx * vLen + vx * 10, y + vy * vLen + vy * 10);
    }

    // Centripetal vector (toward center)
    if (this.showCentripetal) {
      const ax = cx - x;
      const ay = cy - y;
      const aLen = Math.hypot(ax, ay);
      const anx = ax / aLen;
      const any = ay / aLen;
      const cLen = this.speed * this.speed * this.radius * 0.1;
      ctx2d.strokeStyle = "#dc2626";
      ctx2d.lineWidth = 2.5;
      ctx2d.beginPath();
      ctx2d.moveTo(x, y);
      ctx2d.lineTo(x + anx * cLen, y + any * cLen);
      ctx2d.stroke();
      drawArrowhead(ctx2d, x + anx * cLen, y + any * cLen, anx, any, "#dc2626");
      ctx2d.fillStyle = "#dc2626";
      ctx2d.font = "bold 12px system-ui";
      ctx2d.fillText("a", x + anx * cLen + anx * 12, y + any * cLen + any * 12);
    }

    // Particle
    ctx2d.fillStyle = "#6366f1";
    ctx2d.beginPath();
    ctx2d.arc(x, y, 10, 0, Math.PI * 2);
    ctx2d.fill();

    // Labels
    ctx2d.fillStyle = "#6b7280";
    ctx2d.font = "12px system-ui";
    ctx2d.fillText(`ω = ${this.speed.toFixed(2)} rad/s`, cx - this.radius, cy - this.radius - 14);
    ctx2d.fillText(`r = ${Math.round(this.radius)} px`, cx + 8, cy - 6);

    ctx2d.restore();
  },
  count() { return 1; },
};

// ─── SPRING MASS ──────────────────────────────────────────────────────────────
const spring = {
  title: "Spring Mass",
  hint: "A mass oscillates on a vertical spring. Drag the mass to pull it, then release.",
  k: 5,
  mass: 1,
  damping: 0.8,
  amp: 120,
  pos: 0,
  vel: 0,
  dragging: false,
  lastDragY: null,
  lastDragTime: null,
  equilY: 0,   // set each draw so pointer events can use it
  history: [],
  maxHistory: 200,
  reset() { this.pos = this.amp; this.vel = 0; this.history = []; },
  update(dt) {
    if (this.dragging) return;
    // Sub-stepped Euler (proper units: pos px, vel px/s, acc px/s²)
    // ω = sqrt(k/m), so k=5,m=1 → T≈2.8s — a comfortable oscillation.
    const dtSeconds = dt / 1000;
    const steps = 8;
    const sub = dtSeconds / steps;
    for (let i = 0; i < steps; i++) {
      const acc = (-this.k * this.pos) / Math.max(0.1, this.mass) - this.damping * this.vel;
      this.vel += acc * sub;
      this.pos += this.vel * sub;
    }
    const maxDisplace = state.height * 0.32;
    if (Math.abs(this.pos) > maxDisplace) {
      this.pos = Math.sign(this.pos) * maxDisplace;
      this.vel *= -0.3;
    }
    this.history.push(this.pos);
    if (this.history.length > this.maxHistory) this.history.shift();
  },
  draw(ctx2d) {
    const cx = state.width * 0.5;
    const ceilingY = 50;
    const equilY = ceilingY + state.height * 0.38;
    this.equilY = equilY;  // expose for pointer hit-testing
    const massY = equilY + this.pos;
    const massR = 22;
    // Show grab cursor hint
    canvas.style.cursor = this.dragging ? "grabbing" : "";

    ctx2d.save();

    // Dark background
    const bgGrad = ctx2d.createLinearGradient(0, 0, 0, state.height);
    bgGrad.addColorStop(0, "#0f172a");
    bgGrad.addColorStop(1, "#1e293b");
    ctx2d.fillStyle = bgGrad;
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Ceiling block with hatching
    ctx2d.fillStyle = "#334155";
    ctx2d.fillRect(cx - 44, 0, 88, ceilingY);
    ctx2d.strokeStyle = "#475569";
    ctx2d.lineWidth = 1;
    for (let hx = cx - 44; hx < cx + 44; hx += 10) {
      ctx2d.beginPath();
      ctx2d.moveTo(hx, 0);
      ctx2d.lineTo(hx - 10, ceilingY);
      ctx2d.stroke();
    }
    ctx2d.fillStyle = "#64748b";
    ctx2d.fillRect(cx - 44, ceilingY - 6, 88, 6);

    // Equilibrium dashed line
    ctx2d.strokeStyle = "rgba(148,163,184,0.35)";
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([6, 5]);
    ctx2d.beginPath();
    ctx2d.moveTo(cx - 80, equilY);
    ctx2d.lineTo(cx + 80, equilY);
    ctx2d.stroke();
    ctx2d.setLineDash([]);
    ctx2d.fillStyle = "rgba(148,163,184,0.6)";
    ctx2d.font = "11px system-ui";
    ctx2d.fillText("x = 0", cx + 54, equilY + 4);

    // Spring coil — clean zigzag between ceiling and mass top
    const springTop = ceilingY;
    const springBot = Math.max(springTop + 20, massY - massR);
    const springLen = springBot - springTop;
    const coilW = 14;
    const segments = 20;
    const leadIn = springLen * 0.08;

    ctx2d.strokeStyle = "#94a3b8";
    ctx2d.lineWidth = 2;
    ctx2d.lineJoin = "round";
    ctx2d.beginPath();
    ctx2d.moveTo(cx, springTop);
    ctx2d.lineTo(cx, springTop + leadIn);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const sy = (springTop + leadIn) + t * (springLen - leadIn * 2);
      const sx = cx + (i % 2 === 0 ? coilW : -coilW);
      ctx2d.lineTo(sx, sy);
    }
    ctx2d.lineTo(cx, springBot);
    ctx2d.stroke();

    // Displacement arrow on left
    if (Math.abs(this.pos) > 6) {
      const arrowX = cx - 54;
      const dir = Math.sign(this.pos);
      ctx2d.strokeStyle = "#f59e0b";
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(arrowX, equilY);
      ctx2d.lineTo(arrowX, massY);
      ctx2d.stroke();
      ctx2d.fillStyle = "#f59e0b";
      ctx2d.beginPath();
      ctx2d.moveTo(arrowX, massY);
      ctx2d.lineTo(arrowX - 5, massY - dir * 10);
      ctx2d.lineTo(arrowX + 5, massY - dir * 10);
      ctx2d.closePath();
      ctx2d.fill();
      ctx2d.fillStyle = "#fbbf24";
      ctx2d.font = "11px system-ui";
      ctx2d.textAlign = "center";
      ctx2d.fillText("x=" + this.pos.toFixed(0), arrowX, (equilY + massY) / 2 - 6 * dir);
      ctx2d.textAlign = "left";
    }

    // Mass glow
    const glow = ctx2d.createRadialGradient(cx, massY, massR * 0.5, cx, massY, massR * 2.5);
    glow.addColorStop(0, "rgba(99,102,241,0.25)");
    glow.addColorStop(1, "rgba(99,102,241,0)");
    ctx2d.fillStyle = glow;
    ctx2d.beginPath();
    ctx2d.arc(cx, massY, massR * 2.5, 0, Math.PI * 2);
    ctx2d.fill();

    // Mass body
    const massGrad = ctx2d.createRadialGradient(cx - massR * 0.3, massY - massR * 0.3, 1, cx, massY, massR);
    massGrad.addColorStop(0, "#a5b4fc");
    massGrad.addColorStop(1, "#4338ca");
    ctx2d.fillStyle = massGrad;
    ctx2d.beginPath();
    ctx2d.arc(cx, massY, massR, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.fillStyle = "rgba(255,255,255,0.25)";
    ctx2d.beginPath();
    ctx2d.arc(cx - massR * 0.28, massY - massR * 0.28, massR * 0.3, 0, Math.PI * 2);
    ctx2d.fill();

    // History graph on right
    const graphX = cx + 80;
    const graphW = Math.max(0, state.width - graphX - 20);
    const graphH = 140;
    const graphY = state.height * 0.5 - graphH / 2;
    if (graphW > 50 && this.history.length > 1) {
      ctx2d.fillStyle = "rgba(0,0,0,0.3)";
      ctx2d.fillRect(graphX, graphY, graphW, graphH);
      ctx2d.strokeStyle = "rgba(100,116,139,0.5)";
      ctx2d.lineWidth = 1;
      ctx2d.strokeRect(graphX, graphY, graphW, graphH);
      ctx2d.strokeStyle = "rgba(100,116,139,0.4)";
      ctx2d.setLineDash([4, 4]);
      ctx2d.beginPath();
      ctx2d.moveTo(graphX, graphY + graphH / 2);
      ctx2d.lineTo(graphX + graphW, graphY + graphH / 2);
      ctx2d.stroke();
      ctx2d.setLineDash([]);
      ctx2d.strokeStyle = "#818cf8";
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      const maxAmp = Math.max(this.amp, 1);
      this.history.forEach((p, i) => {
        const hx = graphX + (i / this.maxHistory) * graphW;
        const hy = graphY + graphH / 2 - (p / (this.amp * 1.2)) * (graphH / 2);
        if (i === 0) ctx2d.moveTo(hx, hy); else ctx2d.lineTo(hx, hy);
      });
      ctx2d.stroke();
      ctx2d.fillStyle = "#6b7280";
      ctx2d.font = "10px system-ui";
      ctx2d.fillText("x(t)", graphX + 4, graphY - 4);
    }

    ctx2d.restore();
  },
  count() { return 1; },
};

// ─── WAVE TANK ────────────────────────────────────────────────────────────────
const wave = {
  title: "Wave Tank",
  hint: "Adjust amplitude, frequency and speed. Toggle standing wave mode.",
  phase: 0,
  speed: 2.4,
  amp: 60,
  freq: 0.012,
  standing: false,
  reset() { this.phase = 0; },
  update(dt) { this.phase += this.speed * (dt / 1000); },
  draw(ctx2d) {
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    ctx2d.save();

    // Background gradient
    const bgGrad = ctx2d.createLinearGradient(0, 0, 0, state.height);
    bgGrad.addColorStop(0, "#f0f9ff");
    bgGrad.addColorStop(1, "#e0f2fe");
    ctx2d.fillStyle = bgGrad;
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Build wave points
    const points = [];
    for (let x = 0; x <= state.width; x += 2) {
      let y = cy;
      if (this.standing) {
        y = cy + Math.sin(x * this.freq * 2) * Math.cos(this.phase) * this.amp;
      } else {
        y = cy + Math.sin(x * this.freq + this.phase) * this.amp;
      }
      points.push([x, y]);
    }

    // Fill below wave
    ctx2d.beginPath();
    ctx2d.moveTo(0, state.height);
    points.forEach(([x, y]) => ctx2d.lineTo(x, y));
    ctx2d.lineTo(state.width, state.height);
    ctx2d.closePath();
    const fillGrad = ctx2d.createLinearGradient(0, cy, 0, state.height);
    fillGrad.addColorStop(0, "rgba(59,130,246,0.28)");
    fillGrad.addColorStop(1, "rgba(59,130,246,0.08)");
    ctx2d.fillStyle = fillGrad;
    ctx2d.fill();

    // Wave line
    ctx2d.beginPath();
    points.forEach(([x, y], i) => { if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y); });
    ctx2d.strokeStyle = "#2563eb";
    ctx2d.lineWidth = 2.5;
    ctx2d.stroke();

    // If standing, also draw the two component waves faintly
    if (this.standing) {
      const drawComponent = (phaseSign, color) => {
        ctx2d.beginPath();
        for (let x = 0; x <= state.width; x += 3) {
          const y = cy + Math.sin(x * this.freq * 2 + phaseSign * this.phase) * this.amp * 0.5;
          if (x === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        }
        ctx2d.strokeStyle = color;
        ctx2d.lineWidth = 1;
        ctx2d.setLineDash([4, 4]);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
      };
      drawComponent(1, "rgba(239,68,68,0.4)");
      drawComponent(-1, "rgba(16,185,129,0.4)");
    }

    // Center line
    ctx2d.strokeStyle = "rgba(148,163,184,0.4)";
    ctx2d.lineWidth = 1;
    ctx2d.setLineDash([6, 4]);
    ctx2d.beginPath();
    ctx2d.moveTo(0, cy);
    ctx2d.lineTo(state.width, cy);
    ctx2d.stroke();
    ctx2d.setLineDash([]);

    ctx2d.fillStyle = "#64748b";
    ctx2d.font = "12px system-ui";
    ctx2d.fillText(this.standing ? "Standing Wave" : "Traveling Wave", 12, 22);

    ctx2d.restore();
  },
  count() { return 1; },
};

// ─── BOUNCING BALLS ───────────────────────────────────────────────────────────
const bounce = {
  title: "Bouncing Balls",
  hint: "Balls bounce off walls and each other. Adjust gravity, restitution and count.",
  balls: [],
  gravity: 900,
  restitution: 0.78,
  ballCount: 12,
  minRadius: 10,
  reset() {
    this.balls = [];
    for (let i = 0; i < this.ballCount; i += 1) {
      const r = this.minRadius + Math.random() * 8;
      this.balls.push({
        x: r + Math.random() * (state.width - r * 2),
        y: r + Math.random() * state.height * 0.5,
        vx: (Math.random() - 0.5) * 300,
        vy: Math.random() * 60,
        r,
        hue: Math.random() * 360,
      });
    }
  },
  update(dt) {
    const dtSeconds = dt / 1000;
    const e = this.restitution;

    // Gravity + wall collisions
    this.balls.forEach((b) => {
      b.vy += this.gravity * dtSeconds;
      b.x += b.vx * dtSeconds;
      b.y += b.vy * dtSeconds;

      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * e; }
      if (b.x + b.r > state.width) { b.x = state.width - b.r; b.vx = -Math.abs(b.vx) * e; }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * e; }
      if (b.y + b.r > state.height) { b.y = state.height - b.r; b.vy = -Math.abs(b.vy) * e; if (Math.abs(b.vy) < 20) b.vy = 0; }
    });

    // Ball-ball elastic collisions
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i];
        const b = this.balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if (dist < minDist && dist > 0) {
          // Separate
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Elastic collision (equal mass approximation)
          const dvx = b.vx - a.vx;
          const dvy = b.vy - a.vy;
          const dot = dvx * nx + dvy * ny;
          if (dot < 0) {
            const impulse = dot * e;
            a.vx += impulse * nx;
            a.vy += impulse * ny;
            b.vx -= impulse * nx;
            b.vy -= impulse * ny;
          }
        }
      }
    }
  },
  draw(ctx2d) {
    ctx2d.save();
    ctx2d.fillStyle = "#0f172a";
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Subtle grid
    ctx2d.strokeStyle = "rgba(255,255,255,0.04)";
    ctx2d.lineWidth = 1;
    for (let x = 0; x < state.width; x += 60) { ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, state.height); ctx2d.stroke(); }
    for (let y = 0; y < state.height; y += 60) { ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(state.width, y); ctx2d.stroke(); }

    this.balls.forEach((b) => {
      const grad = ctx2d.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      grad.addColorStop(0, `hsl(${b.hue} 85% 75%)`);
      grad.addColorStop(1, `hsl(${b.hue} 70% 40%)`);
      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx2d.fill();

      // Specular
      ctx2d.fillStyle = "rgba(255,255,255,0.3)";
      ctx2d.beginPath();
      ctx2d.arc(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.28, 0, Math.PI * 2);
      ctx2d.fill();
    });
    ctx2d.restore();
  },
  count() { return this.balls.length || 1; },
};

// ─── COLLISION LAB ────────────────────────────────────────────────────────────
const collision = {
  title: "Collision Lab",
  hint: "Elastic collision. Adjust masses, velocities and elasticity. Balls bounce off walls.",
  massA: 2,
  massB: 3,
  velA: 180,
  velB: -60,
  elasticity: 1.0,
  hasRightWall: true,
  collisionCount: 0,
  a: null,
  b: null,
  labels: [],
  reset() {
    this.collisionCount = 0;
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    const maxRadius = 80;
    const rA = Math.min(maxRadius, 12 + this.massA * 3);
    const rB = Math.min(maxRadius, 12 + this.massB * 3);
    this.a = { x: cx - 150, y: cy, vx: this.velA, vy: 0, r: rA, m: this.massA, hue: 210 };
    this.b = { x: cx + 150, y: cy, vx: this.velB, vy: 0, r: rB, m: this.massB, hue: 10 };
    this.labels = [
      { text: `m=${this.massA}kg`, ball: "a" },
      { text: `m=${this.massB}kg`, ball: "b" },
    ];
  },
  update(dt) {
    const dtSeconds = dt / 1000;
    const wallMargin = 20;
    const leftWall = wallMargin;
    const rightWall = state.width - wallMargin;

    const subSteps = 100;
    const subDt = dtSeconds / subSteps;

    for (let i = 0; i < subSteps; i++) {
      [this.a, this.b].forEach((p) => {
        p.x += p.vx * subDt;
        p.y += p.vy * subDt;

        // Wall bounce
        if (p.x - p.r < leftWall) { p.x = leftWall + p.r; p.vx = Math.abs(p.vx) * this.elasticity; this.collisionCount++; }
        if (this.hasRightWall && p.x + p.r > rightWall) { p.x = rightWall - p.r; p.vx = -Math.abs(p.vx) * this.elasticity; this.collisionCount++; }
        if (p.y - p.r < 0) { p.y = p.r; p.vy = Math.abs(p.vy); }
        if (p.y + p.r > state.height) { p.y = state.height - p.r; p.vy = -Math.abs(p.vy); }
      });

      const dx = this.b.x - this.a.x;
      const dy = this.b.y - this.a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < this.a.r + this.b.r && dist > 0) {
        const nx = dx / dist;
        const ny = dy / dist;
        // Separate
        const overlap = (this.a.r + this.b.r - dist) / 2;
        this.a.x -= nx * overlap;
        this.b.x += nx * overlap;
        this.a.y -= ny * overlap;
        this.b.y += ny * overlap;

        const va = this.a.vx * nx + this.a.vy * ny;
        const vb = this.b.vx * nx + this.b.vy * ny;
        if (va - vb > 0) { // approaching
          this.collisionCount++;
          const ma = this.a.m, mb = this.b.m;
          const e = this.elasticity;
          const pa = ((ma - e * mb) * va + (1 + e) * mb * vb) / (ma + mb);
          const pb = ((mb - e * ma) * vb + (1 + e) * ma * va) / (ma + mb);
          const da = pa - va, db = pb - vb;
          this.a.vx += da * nx; this.a.vy += da * ny;
          this.b.vx += db * nx; this.b.vy += db * ny;
        }
      }
    }
  },
  draw(ctx2d) {
    ctx2d.save();
    ctx2d.fillStyle = "#fff";
    ctx2d.fillRect(0, 0, state.width, state.height);

    const wallMargin = 20;
    const leftWall = wallMargin;
    const rightWall = state.width - wallMargin;

    // Draw Left Wall
    ctx2d.strokeStyle = "#475569";
    ctx2d.lineWidth = 4;
    ctx2d.beginPath();
    ctx2d.moveTo(leftWall, 0);
    ctx2d.lineTo(leftWall, state.height);
    ctx2d.stroke();
    
    ctx2d.lineWidth = 1;
    for (let y = -20; y < state.height + 20; y += 15) {
      ctx2d.beginPath();
      ctx2d.moveTo(leftWall, y);
      ctx2d.lineTo(leftWall - 15, y - 15);
      ctx2d.stroke();
    }

    // Draw Right Wall (if enabled)
    if (this.hasRightWall) {
      ctx2d.lineWidth = 4;
      ctx2d.beginPath();
      ctx2d.moveTo(rightWall, 0);
      ctx2d.lineTo(rightWall, state.height);
      ctx2d.stroke();
      
      ctx2d.lineWidth = 1;
      for (let y = -20; y < state.height + 20; y += 15) {
        ctx2d.beginPath();
        ctx2d.moveTo(rightWall, y);
        ctx2d.lineTo(rightWall + 15, y - 15);
        ctx2d.stroke();
      }
    }

    // Collision Count
    ctx2d.fillStyle = "#1f2937";
    ctx2d.font = "bold 16px system-ui";
    ctx2d.textAlign = "right";
    ctx2d.fillText(`Collisions: ${this.collisionCount}`, state.width - 150, 30);
    ctx2d.textAlign = "left";

    // Momentum bar
    const pA = this.a ? Math.abs(this.a.m * this.a.vx) : 0;
    const pB = this.b ? Math.abs(this.b.m * this.b.vx) : 0;
    const maxP = Math.max(pA + pB, 1);
    const barY = state.height - 30;
    const barW = state.width - 40;

    ctx2d.fillStyle = "#f1f5f9";
    ctx2d.fillRect(20, barY, barW, 12);
    ctx2d.fillStyle = `hsl(210 70% 50%)`;
    ctx2d.fillRect(20, barY, (pA / maxP) * barW, 12);
    ctx2d.fillStyle = `hsl(10 70% 50%)`;
    ctx2d.fillRect(20 + (pA / maxP) * barW, barY, (pB / maxP) * barW, 12);

    ctx2d.fillStyle = "#64748b";
    ctx2d.font = "11px system-ui";
    ctx2d.fillText("Momentum", 20, barY - 5);

    [this.a, this.b].forEach((p) => {
      if (!p) return;
      // Shadow
      ctx2d.fillStyle = "rgba(0,0,0,0.08)";
      ctx2d.beginPath();
      ctx2d.ellipse(p.x, p.y + p.r + 4, p.r * 0.8, 4, 0, 0, Math.PI * 2);
      ctx2d.fill();

      const grad = ctx2d.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
      grad.addColorStop(0, `hsl(${p.hue} 75% 70%)`);
      grad.addColorStop(1, `hsl(${p.hue} 65% 45%)`);
      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx2d.fill();

      // Velocity arrow
      const arrowLen = Math.min(Math.abs(p.vx) * 0.15, 60);
      const dir = p.vx >= 0 ? 1 : -1;
      ctx2d.strokeStyle = `hsl(${p.hue} 70% 40%)`;
      ctx2d.lineWidth = 2;
      ctx2d.beginPath();
      ctx2d.moveTo(p.x, p.y);
      ctx2d.lineTo(p.x + dir * arrowLen, p.y);
      ctx2d.stroke();

      // Label
      ctx2d.fillStyle = "#1f2937";
      ctx2d.font = "bold 13px system-ui";
      ctx2d.textAlign = "center";
      ctx2d.fillText(`m=${p.m}`, p.x, p.y - p.r - 8);
      ctx2d.fillText(`v=${p.vx.toFixed(0)}`, p.x, p.y - p.r - 22);
      ctx2d.textAlign = "left";
    });

    ctx2d.restore();
  },
  count() { return 2; },
};

// ─── DIFFUSION ────────────────────────────────────────────────────────────────
const diffusion = {
  title: "Diffusion",
  hint: "Particles perform random walks from the center. Adjust count and step size.",
  walkers: [],
  particleCount: 200,
  stepSize: 8,
  dotSize: 3,
  colorMode: "hue", // "hue" | "gradient"
  reset() {
    this.walkers = [];
    for (let i = 0; i < this.particleCount; i += 1) {
      this.walkers.push({
        x: state.width / 2,
        y: state.height / 2,
        hue: Math.random() * 360,
        age: 0,
      });
    }
  },
  update(dt) {
    const step = this.stepSize;
    this.walkers.forEach((w) => {
      w.x += (Math.random() - 0.5) * step * 2;
      w.y += (Math.random() - 0.5) * step * 2;
      w.x = Math.max(0, Math.min(state.width, w.x));
      w.y = Math.max(0, Math.min(state.height, w.y));
      w.age += 1;
    });
  },
  draw(ctx2d) {
    ctx2d.save();
    ctx2d.fillStyle = "#0f172a";
    ctx2d.fillRect(0, 0, state.width, state.height);

    const cx = state.width / 2;
    const cy = state.height / 2;
    const maxDist = Math.hypot(cx, cy);

    this.walkers.forEach((w) => {
      let color;
      if (this.colorMode === "gradient") {
        const dist = Math.hypot(w.x - cx, w.y - cy) / maxDist;
        color = `hsl(${240 - dist * 200} 80% 60% / 0.85)`;
      } else {
        color = `hsl(${w.hue} 80% 65% / 0.85)`;
      }
      ctx2d.fillStyle = color;
      ctx2d.beginPath();
      ctx2d.arc(Math.round(w.x), Math.round(w.y), this.dotSize, 0, Math.PI * 2);
      ctx2d.fill();
    });

    // Source indicator
    ctx2d.fillStyle = "rgba(255,255,255,0.6)";
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.fillStyle = "rgba(255,255,255,0.4)";
    ctx2d.font = "11px system-ui";
    ctx2d.fillText(`${this.walkers.length} particles`, 10, 20);

    ctx2d.restore();
  },
  count() { return this.walkers.length || 1; },
};

// ─── BROWNIAN MOTION ──────────────────────────────────────────────────────────
const brownian = {
  title: "Brownian Motion",
  hint: "A large particle receives random kicks from unseen fluid molecules. Adjust kick strength.",
  particles: [],
  numParticles: 1,
  infiniteTrail: false,
  kickStrength: 200,
  drag: 0.92,
  trailLength: 60,
  showFluid: true,
  fluid: [],
  reset() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: state.width / 2 + (Math.random() - 0.5) * 40,
        y: state.height / 2 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        trail: []
      });
    }
    this.fluid = [];
    for (let i = 0; i < 60; i++) {
      this.fluid.push({ x: Math.random() * state.width, y: Math.random() * state.height, vx: (Math.random()-0.5)*30, vy: (Math.random()-0.5)*30, hue: 180 + Math.random() * 60, r: 2 + Math.random() * 2 });
    }
  },
  update(dt) {
    const dtSeconds = dt / 1000;
    
    this.particles.forEach(p => {
      p.vx += (Math.random() - 0.5) * this.kickStrength * dtSeconds * 60;
      p.vy += (Math.random() - 0.5) * this.kickStrength * dtSeconds * 60;
      p.vx *= this.drag;
      p.vy *= this.drag;
      p.x += p.vx * dtSeconds;
      p.y += p.vy * dtSeconds;

      // Wall bounce
      if (p.x < 14) { p.x = 14; p.vx = Math.abs(p.vx); }
      if (p.x > state.width - 14) { p.x = state.width - 14; p.vx = -Math.abs(p.vx); }
      if (p.y < 14) { p.y = 14; p.vy = Math.abs(p.vy); }
      if (p.y > state.height - 14) { p.y = state.height - 14; p.vy = -Math.abs(p.vy); }

      p.trail.push([p.x, p.y]);
      while (!this.infiniteTrail && p.trail.length > this.trailLength) {
        p.trail.shift();
      }
    });

    // Fluid particles drift
    this.fluid.forEach((f) => {
      f.x += f.vx * dtSeconds;
      f.y += f.vy * dtSeconds;
      if (f.x < 0 || f.x > state.width) f.vx *= -1;
      if (f.y < 0 || f.y > state.height) f.vy *= -1;
    });
  },
  draw(ctx2d) {
    ctx2d.save();
    ctx2d.fillStyle = "#0f172a";
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Fluid particles
    if (this.showFluid) {
      this.fluid.forEach((f) => {
        ctx2d.fillStyle = `hsl(${f.hue} 60% 55% / 0.5)`;
        ctx2d.beginPath();
        ctx2d.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx2d.fill();
      });
    }

    // Trails
    ctx2d.strokeStyle = "rgba(251,191,36,0.5)";
    ctx2d.lineWidth = 2;
    this.particles.forEach(p => {
      if (p.trail.length > 1) {
        ctx2d.beginPath();
        p.trail.forEach(([x, y], i) => {
          if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
        });
        ctx2d.stroke();
      }
    });

    // Main particles
    this.particles.forEach(p => {
      const grad = ctx2d.createRadialGradient(p.x - 5, p.y - 5, 1, p.x, p.y, 14);
      grad.addColorStop(0, "#fbbf24");
      grad.addColorStop(1, "#d97706");
      ctx2d.fillStyle = grad;
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, 14, 0, Math.PI * 2);
      ctx2d.fill();
    });

    ctx2d.restore();
  },
  count() { return this.particles.length; },
};

// ─── LISSAJOUS ────────────────────────────────────────────────────────────────
const lissajous = {
  title: "Lissajous Figures",
  hint: "Adjust frequency ratios and phase to create beautiful parametric curves.",
  t: 0,
  A: 130,
  a: 3,
  b: 2,
  delta: Math.PI / 2,
  strokeColor: "#7c3aed",
  tracePoints: 1200,
  reset() { this.t = 0; },
  update(dt) { this.t += dt / 1000; },
  draw(ctx2d) {
    const cx = state.width * 0.5;
    const cy = state.height * 0.5;
    ctx2d.save();

    // Dark background
    ctx2d.fillStyle = "#0a0a1a";
    ctx2d.fillRect(0, 0, state.width, state.height);

    // Axes
    ctx2d.strokeStyle = "rgba(255,255,255,0.07)";
    ctx2d.lineWidth = 1;
    ctx2d.beginPath(); ctx2d.moveTo(cx, 0); ctx2d.lineTo(cx, state.height); ctx2d.stroke();
    ctx2d.beginPath(); ctx2d.moveTo(0, cy); ctx2d.lineTo(state.width, cy); ctx2d.stroke();

    // Lissajous curve with color gradient
    const N = this.tracePoints;
    for (let seg = 0; seg < N - 1; seg++) {
      const t1 = (seg / N) * Math.PI * 2 + this.t;
      const t2 = ((seg + 1) / N) * Math.PI * 2 + this.t;
      const x1 = cx + Math.sin(this.a * t1 + this.delta) * this.A;
      const y1 = cy + Math.sin(this.b * t1) * this.A;
      const x2 = cx + Math.sin(this.a * t2 + this.delta) * this.A;
      const y2 = cy + Math.sin(this.b * t2) * this.A;
      const alpha = (seg / N) * 0.9 + 0.1;
      const hue = (seg / N) * 300;
      ctx2d.strokeStyle = `hsla(${hue + 240},85%,65%,${alpha})`;
      ctx2d.lineWidth = 1.5;
      ctx2d.beginPath();
      ctx2d.moveTo(x1, y1);
      ctx2d.lineTo(x2, y2);
      ctx2d.stroke();
    }

    // Moving dot at current phase
    const dotX = cx + Math.sin(this.a * this.t + this.delta) * this.A;
    const dotY = cy + Math.sin(this.b * this.t) * this.A;
    ctx2d.fillStyle = "#fff";
    ctx2d.beginPath();
    ctx2d.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx2d.fill();

    // Labels
    ctx2d.fillStyle = "rgba(255,255,255,0.5)";
    ctx2d.font = "12px system-ui";
    ctx2d.fillText(`a:b = ${this.a}:${this.b}   δ = ${(this.delta / Math.PI).toFixed(2)}π`, 12, 22);

    ctx2d.restore();
  },
  count() { return 1; },
};


// ─── ELECTRIC FIELD ───────────────────────────────────────────────────────────
const electric = {
  title: "Electric Field",
  hint: "Drag charges to reposition. Adjust charge magnitudes. Toggle field lines.",
  charges: [
    { xFactor: 0.38, yFactor: 0.5, q: 1, dragging: false },
    { xFactor: 0.62, yFactor: 0.5, q: -1, dragging: false },
  ],
  resolution: 40, // grid step
  showLines: true,
  t: 0,
  reset() {
    this.charges[0].xFactor = 0.38; this.charges[0].yFactor = 0.5;
    this.charges[1].xFactor = 0.62; this.charges[1].yFactor = 0.5;
  },
  update(dt) { this.t += dt / 1000; },
  getField(px, py) {
    let ex = 0, ey = 0;
    this.charges.forEach((ch) => {
      const cx = state.width * ch.xFactor;
      const cy = state.height * ch.yFactor;
      const dx = px - cx, dy = py - cy;
      const r2 = Math.max(400, dx * dx + dy * dy);
      const inv = ch.q / r2;
      ex += dx * inv; ey += dy * inv;
    });
    return { ex, ey };
  },
  draw(ctx2d) {
    ctx2d.save();
    ctx2d.fillStyle = "#f8fafc";
    ctx2d.fillRect(0, 0, state.width, state.height);

    const step = this.resolution;

    if (this.showLines) {
      // Field lines traced from each positive charge
      const numLines = 16;
      this.charges.forEach((ch) => {
        if (ch.q <= 0) return;
        const cx0 = state.width * ch.xFactor;
        const cy0 = state.height * ch.yFactor;
        for (let li = 0; li < numLines; li++) {
          const angle0 = (li / numLines) * Math.PI * 2;
          let px = cx0 + Math.cos(angle0) * 25;
          let py = cy0 + Math.sin(angle0) * 25;
          ctx2d.beginPath();
          ctx2d.moveTo(px, py);
          for (let step2 = 0; step2 < 200; step2++) {
            const { ex, ey } = this.getField(px, py);
            const mag = Math.hypot(ex, ey);
            if (mag === 0) break;
            px += (ex / mag) * 4;
            py += (ey / mag) * 4;
            if (px < 0 || px > state.width || py < 0 || py > state.height) break;
            ctx2d.lineTo(px, py);
            // Stop near negative charge
            let near = false;
            this.charges.forEach((c2) => {
              if (c2.q < 0 && Math.hypot(px - state.width * c2.xFactor, py - state.height * c2.yFactor) < 22) near = true;
            });
            if (near) break;
          }
          ctx2d.strokeStyle = "rgba(99,102,241,0.4)";
          ctx2d.lineWidth = 1;
          ctx2d.stroke();
        }
      });
    } else {
      // Arrow grid
      for (let gx = step / 2; gx < state.width; gx += step) {
        for (let gy = step / 2; gy < state.height; gy += step) {
          const { ex, ey } = this.getField(gx, gy);
          const mag = Math.hypot(ex, ey);
          if (mag === 0) continue;
          const nx = (ex / mag) * 14;
          const ny = (ey / mag) * 14;
          const intensity = Math.min(1, Math.log(1 + mag * 5000) / 8);
          ctx2d.strokeStyle = `rgba(99,102,241,${intensity * 0.7})`;
          ctx2d.lineWidth = 1;
          ctx2d.beginPath();
          ctx2d.moveTo(gx - nx * 0.5, gy - ny * 0.5);
          ctx2d.lineTo(gx + nx * 0.5, gy + ny * 0.5);
          ctx2d.stroke();
          drawArrowhead(ctx2d, gx + nx * 0.5, gy + ny * 0.5, nx / 14, ny / 14, `rgba(99,102,241,${intensity * 0.7})`, 4);
        }
      }
    }

    // Draw charges with pulsing glow
    this.charges.forEach((ch) => {
      const cx = state.width * ch.xFactor;
      const cy = state.height * ch.yFactor;
      const pulse = 1 + Math.sin(this.t * 2) * 0.1;
      const r = (14 + Math.abs(ch.q) * 4) * pulse;

      // Glow
      const glow = ctx2d.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 2.5);
      const baseColor = ch.q > 0 ? "239,68,68" : "37,99,235";
      glow.addColorStop(0, `rgba(${baseColor},0.25)`);
      glow.addColorStop(1, `rgba(${baseColor},0)`);
      ctx2d.fillStyle = glow;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
      ctx2d.fill();

      ctx2d.fillStyle = ch.q > 0 ? "#ef4444" : "#2563eb";
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, r, 0, Math.PI * 2);
      ctx2d.fill();

      // +/- label
      ctx2d.fillStyle = "#fff";
      ctx2d.font = `bold ${14 + Math.abs(ch.q) * 2}px system-ui`;
      ctx2d.textAlign = "center";
      ctx2d.textBaseline = "middle";
      ctx2d.fillText(ch.q > 0 ? "+" : "−", cx, cy);
      ctx2d.textAlign = "left";
      ctx2d.textBaseline = "alphabetic";

      // Charge value label
      ctx2d.fillStyle = ch.q > 0 ? "#dc2626" : "#1d4ed8";
      ctx2d.font = "11px system-ui";
      ctx2d.fillText(`q=${ch.q > 0 ? "+" : ""}${ch.q}`, cx + r + 4, cy - r - 4);
    });

    ctx2d.restore();
  },
  count() { return this.charges.length; },
};

// ─── HELPER ───────────────────────────────────────────────────────────────────
function drawArrowhead(ctx2d, x, y, nx, ny, color, size = 7) {
  const angle = Math.atan2(ny, nx);
  ctx2d.fillStyle = color;
  ctx2d.beginPath();
  ctx2d.moveTo(x, y);
  ctx2d.lineTo(x - size * Math.cos(angle - 0.4), y - size * Math.sin(angle - 0.4));
  ctx2d.lineTo(x - size * Math.cos(angle + 0.4), y - size * Math.sin(angle + 0.4));
  ctx2d.closePath();
  ctx2d.fill();
}

// ─── REGISTRY ─────────────────────────────────────────────────────────────────
const simulations = { orbit, pendulum, projectile, circular, spring, wave, bounce, collision, diffusion, brownian, lissajous, electric };

// ─── CANVAS RESIZE ────────────────────────────────────────────────────────────
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.width = Math.max(1, Math.floor(rect.width));
  state.height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state.active === "orbit" && orbit.bodies.length === 0) orbit.reset();
  if (state.active === "projectile" && projectile.lines.length === 0) projectile.prepareIdleState();
}

function resetCurrentSim() {
  const sim = simulations[state.active];
  sim.reset();
  if (state.active === "projectile") { sim.launch(); sim.launched = false; }
}

function initializeCurrentSim() {
  const sim = simulations[state.active];
  stageTitle.textContent = sim.title;
  simHint.textContent = sim.hint;
  resetButton.textContent = state.active === "projectile" ? "Clear paths" : "Reset";
}

function syncSimulationSpeed() {
  const valueNode = document.getElementById("simulation-speed-value");
  if (valueNode && valueNode.tagName === 'INPUT') {
    if (document.activeElement !== valueNode) {
      valueNode.value = Number(state.speed).toFixed(2);
    }
  } else if (valueNode) {
    valueNode.textContent = `${Number(state.speed).toFixed(2)}x`;
  }
}

function syncRangeLabels() {
  rangeInputs.forEach((input) => {
    let valueNode = document.querySelector(`[data-value-for="${input.id}"]`);
    if (!valueNode && input.id === "simulation-speed") {
      valueNode = document.getElementById("simulation-speed-value");
    }
    if (!valueNode) return;

    if (valueNode.tagName !== 'INPUT') {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '4px';

      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.className = 'range-value-input';
      numInput.style.width = '64px';
      numInput.style.padding = '2px 4px';
      numInput.style.border = '1px solid #cbd5e1';
      numInput.style.borderRadius = '4px';
      numInput.style.fontSize = '0.88rem';
      numInput.style.textAlign = 'right';
      numInput.style.color = '#334155';
      numInput.style.backgroundColor = '#fff';
      numInput.step = input.step || 'any';
      numInput.min = input.min;
      numInput.max = input.max;

      if (valueNode.hasAttribute('data-value-for')) {
        numInput.setAttribute('data-value-for', input.id);
      } else {
        numInput.id = valueNode.id;
      }

      const unitSpan = document.createElement('span');
      unitSpan.style.fontSize = '0.88rem';
      unitSpan.style.color = '#334155';
      if (input.dataset.unit) unitSpan.textContent = input.dataset.unit;
      else if (input.id === 'projectile-angle') unitSpan.textContent = '°';
      else if (input.id === 'projectile-grid-spacing') unitSpan.textContent = ' px';
      else if (input.id === 'projectile-grid-opacity') unitSpan.textContent = '%';
      else if (input.id === 'simulation-speed') unitSpan.textContent = 'x';

      wrapper.appendChild(numInput);
      wrapper.appendChild(unitSpan);

      valueNode.replaceWith(wrapper);
      valueNode = numInput;

      valueNode.addEventListener('input', (e) => {
        let val = Number(e.target.value);
        if (input.id === 'projectile-grid-opacity') val = val / 100;
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    if (document.activeElement !== valueNode) {
      if (input.id === "projectile-grid-opacity") valueNode.value = Math.round(Number(input.value) * 100);
      else if (input.id === "simulation-speed") valueNode.value = Number(input.value).toFixed(2);
      else valueNode.value = input.value;
    }
  });
}

function renderProjectileLegend() {
  if (!projectileLineList) return;
  projectileLineList.replaceChildren();
  if (projectile.lines.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "trajectory-empty";
    emptyState.textContent = "Fire a shot to create a path here.";
    projectileLineList.appendChild(emptyState);
    return;
  }
  projectile.lines.forEach((line) => {
    const item = document.createElement("label");
    item.className = "trajectory-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.checked = line.visible;
    checkbox.addEventListener("change", () => { line.visible = checkbox.checked; });
    const swatch = document.createElement("span");
    swatch.className = "trajectory-swatch"; swatch.style.background = line.color;
    const text = document.createElement("span");
    text.className = "trajectory-label"; text.textContent = line.label;
    item.append(checkbox, swatch, text);
    projectileLineList.appendChild(item);
  });
}

function drawBackground() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save(); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, state.width, state.height); ctx.restore();
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function bindInput(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", handler);
}

function bindChange(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handler);
}

// ─── ANIMATION LOOP ───────────────────────────────────────────────────────────
function animate(now) {
  const dt = Math.min(now - state.lastTime, 40);
  state.lastTime = now;
  const scaledDt = dt * state.speed;
  if (!state.paused) simulations[state.active].update(scaledDt);
  drawBackground();
  simulations[state.active].draw(ctx);
  requestAnimationFrame(animate);
}

// ─── GLOBAL BUTTONS ───────────────────────────────────────────────────────────
pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
});
resetButton.addEventListener("click", resetCurrentSim);

// ─── ORBIT BINDINGS ───────────────────────────────────────────────────────────
bindClick("spawn-body", () => orbit.spawn());
bindInput("orbit-gravity", (e) => { orbit.gravity = Number(e.target.value); syncRangeLabels(); });
bindInput("orbit-speed", (e) => { orbit.spawnEnergy = Number(e.target.value); syncRangeLabels(); });
bindInput("orbit-count", (e) => { orbit.countSetting = Number(e.target.value); syncRangeLabels(); if (state.active === "orbit") orbit.reset(); });
bindInput("orbit-trail", (e) => { orbit.trailLength = Number(e.target.value); syncRangeLabels(); });

// ─── PENDULUM BINDINGS ────────────────────────────────────────────────────────
bindClick("kick-pendulum", () => pendulum.reset());
bindInput("pendulum-length", (e) => { pendulum.length = Number(e.target.value); syncRangeLabels(); });
bindInput("pendulum-air", (e) => { pendulum.airResistance = Number(e.target.value); syncRangeLabels(); });
bindInput("pendulum-mass", (e) => { pendulum.mass = Number(e.target.value); syncRangeLabels(); });
bindInput("pendulum-bob-size", (e) => { pendulum.bobSize = Number(e.target.value); syncRangeLabels(); });

// ─── PROJECTILE BINDINGS ──────────────────────────────────────────────────────
bindClick("fire-projectile", () => projectile.launch());
bindInput("projectile-angle", (e) => { projectile.angle = Number(e.target.value); syncRangeLabels(); });
bindInput("projectile-power", (e) => { projectile.power = Number(e.target.value); syncRangeLabels(); });
bindInput("projectile-drag", (e) => { projectile.drag = Number(e.target.value); syncRangeLabels(); });
if (projectileGridSpacingInput) projectileGridSpacingInput.addEventListener("input", (e) => { projectile.gridSpacing = Number(e.target.value); syncRangeLabels(); });
if (projectileGridOpacityInput) projectileGridOpacityInput.addEventListener("input", (e) => { projectile.gridOpacity = Number(e.target.value); syncRangeLabels(); });
if (projectileGridEnabledInput) projectileGridEnabledInput.addEventListener("change", (e) => { projectile.gridEnabled = e.target.checked; });

// ─── CIRCULAR MOTION BINDINGS ─────────────────────────────────────────────────
bindInput("circular-speed", (e) => { circular.speed = Number(e.target.value); syncRangeLabels(); });
bindInput("circular-radius", (e) => { circular.radius = Number(e.target.value); syncRangeLabels(); circular.trail = []; });
bindChange("circular-show-velocity", (e) => { circular.showVelocity = e.target.checked; });
bindChange("circular-show-centripetal", (e) => { circular.showCentripetal = e.target.checked; });

// ─── SPRING MASS BINDINGS ─────────────────────────────────────────────────────
bindInput("spring-k", (e) => { spring.k = Number(e.target.value); syncRangeLabels(); });
bindInput("spring-mass", (e) => { spring.mass = Number(e.target.value); syncRangeLabels(); });
bindInput("spring-damping", (e) => { spring.damping = Number(e.target.value); syncRangeLabels(); });
bindInput("spring-amp", (e) => { spring.amp = Number(e.target.value); spring.pos = spring.amp; spring.vel = 0; syncRangeLabels(); });

// ─── WAVE TANK BINDINGS ───────────────────────────────────────────────────────
bindInput("wave-amp", (e) => { wave.amp = Number(e.target.value); syncRangeLabels(); });
bindInput("wave-freq", (e) => { wave.freq = Number(e.target.value); syncRangeLabels(); });
bindInput("wave-speed", (e) => { wave.speed = Number(e.target.value); syncRangeLabels(); });
bindChange("wave-standing", (e) => { wave.standing = e.target.checked; });

// ─── BOUNCE BINDINGS ──────────────────────────────────────────────────────────
bindInput("bounce-count", (e) => { bounce.ballCount = Number(e.target.value); syncRangeLabels(); bounce.reset(); });
bindInput("bounce-gravity", (e) => { bounce.gravity = Number(e.target.value); syncRangeLabels(); });
bindInput("bounce-restitution", (e) => { bounce.restitution = Number(e.target.value); syncRangeLabels(); });
bindInput("bounce-size", (e) => { bounce.minRadius = Number(e.target.value); syncRangeLabels(); bounce.reset(); });

// ─── COLLISION BINDINGS ───────────────────────────────────────────────────────
bindInput("collision-mass-a", (e) => { collision.massA = Number(e.target.value); syncRangeLabels(); collision.reset(); });
bindInput("collision-mass-b", (e) => { collision.massB = Number(e.target.value); syncRangeLabels(); collision.reset(); });
bindInput("collision-vel-a", (e) => { collision.velA = Number(e.target.value); syncRangeLabels(); collision.reset(); });
bindInput("collision-vel-b", (e) => { collision.velB = Number(e.target.value); syncRangeLabels(); collision.reset(); });
bindInput("collision-elasticity", (e) => { collision.elasticity = Number(e.target.value); syncRangeLabels(); });
bindChange("collision-right-wall", (e) => { collision.hasRightWall = e.target.checked; });

const piPresetBtn = document.getElementById("pi-preset-button");
if (piPresetBtn) {
  piPresetBtn.addEventListener("click", () => {
    const wrap = document.querySelector(".canvas-wrap");
    if (!wrap) return;

    if (document.getElementById("pi-preset-dialog")) return;

    const overlay = document.createElement("div");
    overlay.id = "pi-preset-dialog";
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "100";
    overlay.style.backdropFilter = "blur(2px)";

    const modal = document.createElement("div");
    modal.style.background = "#fff";
    modal.style.padding = "24px";
    modal.style.borderRadius = "8px";
    modal.style.boxShadow = "0 10px 25px rgba(0,0,0,0.1)";
    modal.style.width = "300px";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "16px";
    modal.style.fontFamily = "inherit";

    const title = document.createElement("h3");
    title.textContent = "Pi Preset Configuration";
    title.style.margin = "0";
    title.style.color = "#1e293b";

    const desc = document.createElement("p");
    desc.textContent = "Enter the mass for the right ball. (e.g. 100 = 31 collisions, 10000 = 314 collisions)";
    desc.style.margin = "0";
    desc.style.fontSize = "0.9rem";
    desc.style.color = "#475569";

    const inputWrap = document.createElement("div");
    inputWrap.style.display = "flex";
    inputWrap.style.flexDirection = "column";
    inputWrap.style.gap = "8px";

    const label = document.createElement("label");
    label.textContent = "Mass B (kg):";
    label.style.fontSize = "0.9rem";
    label.style.fontWeight = "bold";
    label.style.color = "#334155";

    const input = document.createElement("input");
    input.type = "number";
    input.value = "100";
    input.min = "1";
    input.max = "1000000";
    input.style.padding = "8px";
    input.style.border = "1px solid #cbd5e1";
    input.style.borderRadius = "4px";
    input.style.fontSize = "1rem";

    inputWrap.appendChild(label);
    inputWrap.appendChild(input);

    const btnWrap = document.createElement("div");
    btnWrap.style.display = "flex";
    btnWrap.style.justifyContent = "flex-end";
    btnWrap.style.gap = "8px";
    btnWrap.style.marginTop = "8px";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "ghost-button";
    cancelBtn.style.padding = "8px 16px";
    
    const startBtn = document.createElement("button");
    startBtn.textContent = "Start";
    startBtn.className = "primary-button";
    startBtn.style.padding = "8px 16px";

    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(startBtn);

    modal.appendChild(title);
    modal.appendChild(desc);
    modal.appendChild(inputWrap);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    wrap.appendChild(overlay);

    const closeDialog = () => {
      overlay.remove();
    };

    cancelBtn.addEventListener("click", closeDialog);

    startBtn.addEventListener("click", () => {
      const selectedMass = Number(input.value) || 100;
      
      const aMass = document.getElementById("collision-mass-a");
      const bMass = document.getElementById("collision-mass-b");
      const aVel = document.getElementById("collision-vel-a");
      const bVel = document.getElementById("collision-vel-b");
      const elas = document.getElementById("collision-elasticity");
      const rightWall = document.getElementById("collision-right-wall");
      
      if (aMass) aMass.value = 1;
      if (bMass) bMass.value = selectedMass;
      if (aVel) aVel.value = 0;
      if (bVel) bVel.value = -60;
      if (elas) elas.value = 1;
      if (rightWall) rightWall.checked = false;
      
      collision.massA = 1;
      collision.massB = selectedMass;
      collision.velA = 0;
      collision.velB = -60;
      collision.elasticity = 1.0;
      collision.hasRightWall = false;
      
      syncRangeLabels();
      collision.reset();
      
      collision.b.x = state.width - 150;
      
      closeDialog();
    });
  });
}

// ─── DIFFUSION BINDINGS ───────────────────────────────────────────────────────
bindInput("diffusion-count", (e) => { diffusion.particleCount = Number(e.target.value); syncRangeLabels(); diffusion.reset(); });
bindInput("diffusion-step", (e) => { diffusion.stepSize = Number(e.target.value); syncRangeLabels(); });
bindInput("diffusion-dot", (e) => { diffusion.dotSize = Number(e.target.value); syncRangeLabels(); });
bindChange("diffusion-color", (e) => { diffusion.colorMode = e.target.value; });

// ─── BROWNIAN BINDINGS ────────────────────────────────────────────────────────
bindInput("brownian-particles", (e) => { 
  brownian.numParticles = Number(e.target.value); 
  syncRangeLabels(); 
  if (brownian.particles.length < brownian.numParticles) {
    while (brownian.particles.length < brownian.numParticles) {
      brownian.particles.push({
        x: state.width / 2 + (Math.random() - 0.5) * 40,
        y: state.height / 2 + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        trail: []
      });
    }
  } else if (brownian.particles.length > brownian.numParticles) {
    brownian.particles.length = brownian.numParticles;
  }
});
bindChange("brownian-infinite-trail", (e) => { brownian.infiniteTrail = e.target.checked; });
bindInput("brownian-kick", (e) => { brownian.kickStrength = Number(e.target.value); syncRangeLabels(); });
bindInput("brownian-drag", (e) => { brownian.drag = Number(e.target.value); syncRangeLabels(); });
bindInput("brownian-trail", (e) => { brownian.trailLength = Number(e.target.value); syncRangeLabels(); });
bindChange("brownian-fluid", (e) => { brownian.showFluid = e.target.checked; });

// ─── LISSAJOUS BINDINGS ───────────────────────────────────────────────────────
bindInput("lissajous-a", (e) => { lissajous.a = Number(e.target.value); syncRangeLabels(); });
bindInput("lissajous-b", (e) => { lissajous.b = Number(e.target.value); syncRangeLabels(); });
bindInput("lissajous-delta", (e) => { lissajous.delta = Number(e.target.value) * Math.PI; syncRangeLabels(); });
bindInput("lissajous-amp", (e) => { lissajous.A = Number(e.target.value); syncRangeLabels(); });


// ─── ELECTRIC BINDINGS ────────────────────────────────────────────────────────
bindInput("electric-charge1", (e) => { electric.charges[0].q = Number(e.target.value); syncRangeLabels(); });
bindInput("electric-charge2", (e) => { electric.charges[1].q = Number(e.target.value); syncRangeLabels(); });
bindInput("electric-resolution", (e) => { electric.resolution = Number(e.target.value); syncRangeLabels(); });
bindChange("electric-show-lines", (e) => { electric.showLines = e.target.checked; });

// ─── POINTER DRAG (pendulum, spring, electric) ────────────────────────────────
canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;

  if (state.active === "pendulum") {
    state.pointerDown = true;
    state.draggingPendulum = true;
    state.pointerId = event.pointerId;
    pendulum.dragging = true;
    const dx = mx - pendulum.anchorX;
    const dy = my - pendulum.anchorY;
    pendulum.angle = Math.max(-1.35, Math.min(1.35, Math.atan2(dx, dy)));
    pendulum.velocity = 0;
    state.lastPointerAngle = pendulum.angle;
    state.lastPointerAngleTime = performance.now();
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    return;
  }

  if (state.active === "spring") {
    const massCx = state.width * 0.5;
    const massY = spring.equilY + spring.pos;
    const massR = 22;
    if (Math.hypot(mx - massCx, my - massY) < massR + 12) {
      spring.dragging = true;
      spring.vel = 0;
      spring.lastDragY = my;
      spring.lastDragTime = performance.now();
      try { canvas.setPointerCapture(event.pointerId); } catch {}
    }
    return;
  }

  if (state.active === "electric") {
    electric.charges.forEach((ch) => {
      const cx = state.width * ch.xFactor;
      const cy = state.height * ch.yFactor;
      if (Math.hypot(mx - cx, my - cy) < 30) {
        ch.dragging = true;
        try { canvas.setPointerCapture(event.pointerId); } catch {}
      }
    });
  }
});

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const mx = event.clientX - rect.left;
  const my = event.clientY - rect.top;

  if (state.draggingPendulum && state.active === "pendulum") {
    const dx = mx - pendulum.anchorX;
    const dy = my - pendulum.anchorY;
    const angle = Math.atan2(dx, dy);
    pendulum.angle = Math.max(-1.35, Math.min(1.35, angle));
    pendulum.velocity = 0;
    const now = performance.now();
    if (state.lastPointerAngle !== null && state.lastPointerAngleTime !== null) {
      const deltaTime = Math.max(now - state.lastPointerAngleTime, 1);
      const deltaAngle = pendulum.angle - state.lastPointerAngle;
      pendulum.velocity = Math.max(-10.0, Math.min(10.0, (deltaAngle / deltaTime) * 1000));
    }
    state.lastPointerAngle = pendulum.angle;
    state.lastPointerAngleTime = now;
  }

  if (state.active === "spring") {
    if (spring.dragging) {
      const maxDisplace = state.height * 0.32;
      spring.pos = Math.max(-maxDisplace, Math.min(maxDisplace, my - spring.equilY));
      const now = performance.now();
      if (spring.lastDragY !== null && spring.lastDragTime !== null) {
        const dt = Math.max(now - spring.lastDragTime, 1);
        const dy = my - spring.lastDragY;
        spring.vel = (dy / dt) * 1000;  // px/ms → px/s
      }
      spring.lastDragY = my;
      spring.lastDragTime = performance.now();
    } else {
      // Hover cursor
      const massCx = state.width * 0.5;
      const massY = spring.equilY + spring.pos;
      canvas.style.cursor = Math.hypot(mx - massCx, my - massY) < 34 ? "grab" : "";
    }
  }

  if (state.active === "electric") {
    electric.charges.forEach((ch) => {
      if (ch.dragging) {
        ch.xFactor = Math.max(0.05, Math.min(0.95, mx / state.width));
        ch.yFactor = Math.max(0.05, Math.min(0.95, my / state.height));
      }
    });
  }
});

function releasePendulumDrag(event) {
  if (!state.draggingPendulum || state.pointerId !== event.pointerId) return;
  state.pointerDown = false; state.draggingPendulum = false; state.pointerId = null;
  pendulum.dragging = false; state.lastPointerAngle = null; state.lastPointerAngleTime = null;
  try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch {}
}

canvas.addEventListener("pointerup", (event) => {
  releasePendulumDrag(event);
  if (spring.dragging) {
    spring.dragging = false;
    spring.lastDragY = null;
    spring.lastDragTime = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  }
  if (state.active === "electric") {
    electric.charges.forEach((ch) => { ch.dragging = false; });
    try { canvas.releasePointerCapture(event.pointerId); } catch {}
  }
});
canvas.addEventListener("pointercancel", (event) => {
  releasePendulumDrag(event);
  if (spring.dragging) {
    spring.dragging = false;
    spring.lastDragY = null;
    spring.lastDragTime = null;
  }
  if (state.active === "electric") electric.charges.forEach((ch) => { ch.dragging = false; });
});

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener("resize", resizeCanvas);
simulationSpeedInput.addEventListener("input", (e) => { state.speed = Number(e.target.value); syncSimulationSpeed(); });

syncRangeLabels();
syncSimulationSpeed();
initializeCurrentSim();
renderProjectileLegend();
resizeCanvas();

// Force reset all sims on load so they have proper state
simulations[state.active].reset();

requestAnimationFrame(animate);
