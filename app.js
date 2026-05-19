const canvas = document.getElementById("simulation-canvas");
const ctx = canvas.getContext("2d");

const stageTitle = document.getElementById("stage-title");
const simHint = document.getElementById("sim-hint");
const pauseButton = document.getElementById("pause-button");
const resetButton = document.getElementById("reset-button");
const simulationSpeedInput = document.getElementById("simulation-speed");
const simulationSpeedValue = document.getElementById("simulation-speed-value");
const activeSimId = document.body.dataset.sim || "orbit";
const rangeInputs = Array.from(
  document.querySelectorAll('input[type="range"]'),
);

const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      this.bodies.push({
        x,
        y,
        vx: Math.cos(tangent) * speed,
        vy: Math.sin(tangent) * speed,
        r: 4 + (i % 3),
        hue: 170 + i * 14,
        trail: [],
      });
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
    this.bodies.push({
      x,
      y,
      vx: Math.cos(tangent) * this.spawnEnergy * 0.7 * energyScale,
      vy: Math.sin(tangent) * this.spawnEnergy * 0.7 * energyScale,
      r: 4 + Math.random() * 2,
      hue: 155 + Math.random() * 120,
      trail: [],
    });
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
      if (body.trail.length > this.trailLength) {
        body.trail.shift();
      }
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
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, state.width, state.height);

    ctx2d.fillStyle = "#fde68a";
    ctx2d.beginPath();
    ctx2d.arc(centerX, centerY, 80, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.fillStyle = "#f59e0b";
    ctx2d.beginPath();
    ctx2d.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.strokeStyle = "#d1d5db";
    ctx2d.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring += 1) {
      ctx2d.beginPath();
      ctx2d.arc(centerX, centerY, 92 + ring * 58, 0, Math.PI * 2);
      ctx2d.stroke();
    }

    this.bodies.forEach((body) => {
      if (body.trail.length > 1) {
        ctx2d.beginPath();
        body.trail.forEach(([tx, ty], index) => {
          if (index === 0) {
            ctx2d.moveTo(tx, ty);
          } else {
            ctx2d.lineTo(tx, ty);
          }
        });
        ctx2d.strokeStyle = "#93c5fd";
        ctx2d.lineWidth = 2;
        ctx2d.stroke();
      }

      ctx2d.fillStyle = "#cbd5e1";
      ctx2d.beginPath();
      ctx2d.arc(body.x, body.y, body.r, 0, Math.PI * 2);
      ctx2d.fill();
    });

    ctx2d.restore();
  },
  count() {
    return this.bodies.length + 1;
  },
};

const pendulum = {
  title: "Pendulum Lab",
  hint: "A damped pendulum swings through a long, satisfying arc.",
  length: 210,
  airResistance: 4,
  bobSize: 18,
  angle: -0.62,
  velocity: 0,
  dragging: false,
  dragOffsetAngle: 0,
  anchorX: 0,
  anchorY: 0,
  push() {
    this.velocity = 0;
    this.angle = -0.62;
  },
  reset() {
    this.angle = -0.62;
    this.velocity = 0;
  },
  update(dt) {
    const dtSeconds = dt / 1000;
    const gravity = 9.6;
    const airForce = this.airResistance * 0.01;
    if (this.dragging) {
      return;
    }
    const acceleration =
      (-gravity / this.length) * Math.sin(this.angle) -
      airForce * this.velocity;
    this.velocity += acceleration * dtSeconds * 60;
    this.velocity = Math.max(-2.1, Math.min(2.1, this.velocity));
    this.angle += this.velocity * dtSeconds * 60;
  },
  draw(ctx2d) {
    const anchorX = state.width * 0.5;
    const anchorY = Math.max(90, state.height * 0.14);
    this.anchorX = anchorX;
    this.anchorY = anchorY;
    const bobX = anchorX + Math.sin(this.angle) * this.length;
    const bobY = anchorY + Math.cos(this.angle) * this.length;

    ctx2d.save();
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, state.width, state.height);

    ctx2d.strokeStyle = "#9ca3af";
    ctx2d.lineWidth = 2;
    ctx2d.beginPath();
    ctx2d.moveTo(anchorX, anchorY);
    ctx2d.lineTo(bobX, bobY);
    ctx2d.stroke();

    ctx2d.fillStyle = "#374151";
    ctx2d.beginPath();
    ctx2d.arc(anchorX, anchorY, 8, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.fillStyle = "#2563eb";
    ctx2d.beginPath();
    ctx2d.arc(bobX, bobY, this.bobSize, 0, Math.PI * 2);
    ctx2d.fill();
    ctx2d.restore();
  },
  count() {
    return 1;
  },
};

const projectile = {
  title: "Projectile Lab",
  hint: "Fire a shell, watch the arc, then line up the next launch.",
  angle: 48,
  power: 126,
  drag: 0,
  gravity: 540,
  launched: false,
  elapsed: 0,
  origin: { x: 0, y: 0 },
  pos: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  trail: [],
  reset() {
    this.launched = false;
    this.elapsed = 0;
    this.trail = [];
  },
  launch() {
    const groundY = state.height - 84;
    this.origin = { x: 90, y: groundY };
    this.pos = { x: this.origin.x, y: this.origin.y };
    const speed = this.power * 3.1;
    const radians = (this.angle * Math.PI) / 180;
    this.velocity = {
      x: Math.cos(radians) * speed,
      y: -Math.sin(radians) * speed,
    };
    this.launched = true;
    this.elapsed = 0;
    this.trail = [[this.pos.x, this.pos.y]];
  },
  update(dt) {
    if (!this.launched) {
      if (this.trail.length === 0) {
        this.launch();
        this.launched = false;
      }
      return;
    }

    const dtSeconds = dt / 1000;
    this.elapsed += dtSeconds;
    this.velocity.y += this.gravity * dtSeconds;
    const dragFactor = Math.max(0, 1 - this.drag * 0.01 * dtSeconds * 8);
    this.velocity.x *= dragFactor;
    this.velocity.y *= dragFactor;
    this.pos.x += this.velocity.x * dtSeconds;
    this.pos.y += this.velocity.y * dtSeconds;
    this.trail.push([this.pos.x, this.pos.y]);

    if (this.trail.length > 220) {
      this.trail.shift();
    }

    const groundY = state.height - 84;
    if (this.pos.y >= groundY) {
      this.pos.y = groundY;
      this.launched = false;
    }
  },
  draw(ctx2d) {
    const groundY = state.height - 84;
    ctx2d.save();
    ctx2d.fillStyle = "#ffffff";
    ctx2d.fillRect(0, 0, state.width, state.height);

    ctx2d.strokeStyle = "#d1d5db";
    ctx2d.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      const y = groundY - i * 90;
      ctx2d.beginPath();
      ctx2d.moveTo(48, y);
      ctx2d.lineTo(state.width - 48, y);
      ctx2d.stroke();
    }

    ctx2d.fillStyle = "#f3f4f6";
    ctx2d.fillRect(0, groundY, state.width, state.height - groundY);

    if (this.trail.length > 1) {
      ctx2d.beginPath();
      this.trail.forEach(([tx, ty], index) => {
        if (index === 0) {
          ctx2d.moveTo(tx, ty);
        } else {
          ctx2d.lineTo(tx, ty);
        }
      });
      ctx2d.strokeStyle = "#f59e0b";
      ctx2d.lineWidth = 2.5;
      ctx2d.stroke();
    }

    const shellX = this.launched ? this.pos.x : this.origin.x;
    const shellY = this.launched ? this.pos.y : this.origin.y;
    ctx2d.fillStyle = "#f97316";
    ctx2d.beginPath();
    ctx2d.arc(shellX, shellY, 10, 0, Math.PI * 2);
    ctx2d.fill();

    ctx2d.fillStyle = "#cbd5e1";
    ctx2d.fillRect(56, groundY - 10, 64, 10);
    ctx2d.fillStyle = "#94a3b8";
    ctx2d.fillRect(62, groundY - 48, 14, 38);
    ctx2d.fillRect(74, groundY - 58, 32, 48);
    ctx2d.restore();
  },
  count() {
    return 1;
  },
};

const simulations = {
  orbit,
  pendulum,
  projectile,
};

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  state.width = Math.max(1, Math.floor(rect.width));
  state.height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.active === "orbit" && orbit.bodies.length === 0) {
    orbit.reset();
  }

  if (state.active === "projectile" && projectile.trail.length === 0) {
    projectile.launch();
    projectile.launched = false;
  }
}

function resetCurrentSim() {
  const sim = simulations[state.active];
  sim.reset();
  if (state.active === "projectile") {
    sim.launch();
    sim.launched = false;
    sim.trail = [];
  }
}

function initializeCurrentSim() {
  const sim = simulations[state.active];
  stageTitle.textContent = sim.title;
  simHint.textContent = sim.hint;
  resetButton.textContent =
    state.active === "projectile" ? "Clear path" : "Reset";
}

function syncSimulationSpeed() {
  simulationSpeedValue.textContent = `${Number(state.speed).toFixed(2)}x`;
}

function syncRangeLabels() {
  rangeInputs.forEach((input) => {
    const valueNode = document.querySelector(`[data-value-for="${input.id}"]`);
    if (!valueNode) {
      return;
    }

    if (input.id === "projectile-angle") {
      valueNode.textContent = `${input.value}°`;
    } else if (input.id === "simulation-speed") {
      valueNode.textContent = `${Number(input.value).toFixed(2)}x`;
    } else {
      valueNode.textContent = input.value;
    }
  });
}

function drawBackground() {
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, state.width, state.height);
  ctx.restore();
}

function bindClick(id, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener("click", handler);
  }
}

function bindInput(id, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener("input", handler);
  }
}

function animate(now) {
  const dt = Math.min(now - state.lastTime, 40);
  state.lastTime = now;
  const scaledDt = dt * state.speed;

  if (!state.paused) {
    const sim = simulations[state.active];
    sim.update(scaledDt);
  }

  drawBackground();
  simulations[state.active].draw(ctx);
  requestAnimationFrame(animate);
}

pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "Resume" : "Pause";
});

resetButton.addEventListener("click", () => {
  resetCurrentSim();
});

bindClick("spawn-body", () => orbit.spawn());
bindClick("kick-pendulum", () => pendulum.reset());
bindClick("fire-projectile", () => projectile.launch());

bindInput("orbit-gravity", (event) => {
  orbit.gravity = Number(event.target.value);
  syncRangeLabels();
});

bindInput("orbit-speed", (event) => {
  orbit.spawnEnergy = Number(event.target.value);
  syncRangeLabels();
});

bindInput("orbit-count", (event) => {
  orbit.countSetting = Number(event.target.value);
  syncRangeLabels();
  if (state.active === "orbit") {
    orbit.reset();
  }
});

bindInput("orbit-trail", (event) => {
  orbit.trailLength = Number(event.target.value);
  syncRangeLabels();
});

bindInput("pendulum-length", (event) => {
  pendulum.length = Number(event.target.value);
  syncRangeLabels();
});

bindInput("pendulum-air", (event) => {
  pendulum.airResistance = Number(event.target.value);
  syncRangeLabels();
});

bindInput("pendulum-bob-size", (event) => {
  pendulum.bobSize = Number(event.target.value);
  syncRangeLabels();
});

bindInput("projectile-angle", (event) => {
  projectile.angle = Number(event.target.value);
  syncRangeLabels();
});

bindInput("projectile-power", (event) => {
  projectile.power = Number(event.target.value);
  syncRangeLabels();
});

bindInput("projectile-drag", (event) => {
  projectile.drag = Number(event.target.value);
  syncRangeLabels();
});

simulationSpeedInput.addEventListener("input", (event) => {
  state.speed = Number(event.target.value);
  syncSimulationSpeed();
});

canvas.addEventListener("pointerdown", (event) => {
  if (state.active !== "pendulum") {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  state.pointerDown = true;
  state.draggingPendulum = true;
  state.pointerId = event.pointerId;
  pendulum.dragging = true;
  const dx = x - pendulum.anchorX;
  const dy = y - pendulum.anchorY;
  pendulum.angle = Math.max(-1.35, Math.min(1.35, Math.atan2(dx, dy)));
  pendulum.velocity = 0;
  state.lastPointerAngle = pendulum.angle;
  state.lastPointerAngleTime = performance.now();
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    // Some synthetic or older pointer events do not support capture.
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.draggingPendulum || state.active !== "pendulum") {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const dx = x - pendulum.anchorX;
  const dy = y - pendulum.anchorY;
  const angle = Math.atan2(dx, dy);
  pendulum.angle = Math.max(-1.35, Math.min(1.35, angle));
  pendulum.velocity = 0;

  const now = performance.now();
  if (state.lastPointerAngle !== null && state.lastPointerAngleTime !== null) {
    const deltaTime = Math.max(now - state.lastPointerAngleTime, 1);
    const deltaAngle = pendulum.angle - state.lastPointerAngle;
    pendulum.velocity = Math.max(
      -2.0,
      Math.min(2.0, (deltaAngle / deltaTime) * 16),
    );
  }

  state.lastPointerAngle = pendulum.angle;
  state.lastPointerAngleTime = now;
});

function releasePendulumDrag(event) {
  if (!state.draggingPendulum || state.pointerId !== event.pointerId) {
    return;
  }

  state.pointerDown = false;
  state.draggingPendulum = false;
  state.pointerId = null;
  pendulum.dragging = false;
  state.lastPointerAngle = null;
  state.lastPointerAngleTime = null;

  try {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Ignore capture teardown failures.
  }
}

canvas.addEventListener("pointerup", releasePendulumDrag);
canvas.addEventListener("pointercancel", releasePendulumDrag);

window.addEventListener("resize", resizeCanvas);

syncRangeLabels();
syncSimulationSpeed();
initializeCurrentSim();
resizeCanvas();
requestAnimationFrame(animate);
