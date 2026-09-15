/**
 * MoscaBrain: Cliente interactivo Web en tiempo real (40-60 FPS).
 * Conecta por WebSocket con el motor biofísico de FlyWire en Python,
 * renderiza la arena 2D, el conectoma neural, los omatidios y el juego de 21.
 */

// Estado del cliente
let ws = null;
let currentTool = "food";
let activeScenario = "alimento_dopamina";
let lastTelemetry = null;

// Estado de Simulación, Pausa y Herramienta de Testeo
let isSimPaused = false;
let isAutoScrollEnabled = true;
let testLogBuffer = [];
const MAX_TEST_LOG_ENTRIES = 400;
let isDraggingFlyAngle = false;
let lastLoggedStep = -1;
let isUserInteractingWithPose = false;

// Estado de arrastre de sombra y elementos con puntero
let isDraggingThreat = false;
let threatDragThrottle = 0;  // timestamp del último envío
let isDraggingElement = false;
let draggedElement = null;   // { type, id, origX, origY, currentX, currentY }
let elementDragThrottle = 0;

// Canvases
const arenaCanvas = document.getElementById("arenaCanvas");
const arenaCtx = arenaCanvas.getContext("2d");
const brainCanvas = document.getElementById("brainCanvas");
const brainCtx = brainCanvas.getContext("2d");
const bjBrainCanvas = document.getElementById("bjBrainCanvas");
const bjBrainCtx = bjBrainCanvas ? bjBrainCanvas.getContext("2d") : null;

// Elementos UI
const connStatus = document.getElementById("connStatus");
const connText = document.getElementById("connText");
const topComputeVal = document.getElementById("topComputeVal");
const topSpikesVal = document.getElementById("topSpikesVal");
const topDopamineVal = document.getElementById("topDopamineVal");
const topActionState = document.getElementById("topActionState");
const meterThrust = document.getElementById("meterThrust");
const valThrust = document.getElementById("valThrust");
const meterYaw = document.getElementById("meterYaw");
const valYaw = document.getElementById("valYaw");
const valWingbeat = document.getElementById("valWingbeat");
const valProboscis = document.getElementById("valProboscis");
const valEscape = document.getElementById("valEscape");
const gaugeDopamineFill = document.getElementById("gaugeDopamineFill");
const gaugeDopamineText = document.getElementById("gaugeDopamineText");
const valRewardsCount = document.getElementById("valRewardsCount");
const valPunishCount = document.getElementById("valPunishCount");
const ommatidiaGrid = document.getElementById("ommatidiaGrid");
const loomingAlert = document.getElementById("loomingAlert");

// Elementos UI Blackjack Lateral
const bjGaugeDopamineFill = document.getElementById("bjGaugeDopamineFill");
const bjGaugeDopamineText = document.getElementById("bjGaugeDopamineText");
const bjDopamineStreakFill = document.getElementById("bjDopamineStreakFill");
const bjStreakRewardText = document.getElementById("bjStreakRewardText");
const bjWinsCount = document.getElementById("bjWinsCount");
const bjLossesCount = document.getElementById("bjLossesCount");
const bjStreakCount = document.getElementById("bjStreakCount");

let blackjackStats = {
  wins: 0,
  losses: 0,
  streak: 0,
  accumulatedDopamine: 0.0,
};

// Partículas de dopamina en canvas
let dopamineBursts = [];

// Métricas de rendimiento en tiempo real (FPS y latencia reales)
let frameCount = 0;
let lastFpsUpdateTime = performance.now();
let lastFrameArrival = performance.now();
let frameIntervalMs = 25.0;

// ============================================================================
// Conexión WebSocket
// ============================================================================
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    connStatus.style.color = "var(--accent-green)";
    connStatus.style.borderColor = "rgba(16, 185, 129, 0.4)";
    connText.innerText = "Conectado · Sincronizando...";
    if (currentTab === "olfaction") {
      ws.send(JSON.stringify({ command: "set_mode", mode: "blackjack" }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const now = performance.now();
      frameCount++;
      const delta = now - lastFpsUpdateTime;
      frameIntervalMs = frameIntervalMs * 0.85 + (now - lastFrameArrival) * 0.15;
      lastFrameArrival = now;

      // Cálculo real de FPS cada 600 ms
      if (delta >= 600) {
        const measuredFps = ((frameCount * 1000) / delta).toFixed(1);
        frameCount = 0;
        lastFpsUpdateTime = now;
        connText.innerText = `En Vivo (${measuredFps} FPS · ${frameIntervalMs.toFixed(0)}ms)`;
      }

      const data = JSON.parse(event.data);
      lastTelemetry = data;

      if (data.compute_ms !== undefined && topComputeVal) {
        topComputeVal.innerText = `${data.compute_ms.toFixed(1)} ms`;
      }
      if (data.fly && data.fly.brain && topSpikesVal) {
        topSpikesVal.innerText = (data.fly.brain.total_spikes || 0).toLocaleString();
      }

      if (data.is_paused !== undefined) {
        setSimulationPauseUI(Boolean(data.is_paused));
      }

      renderArena(data);
      renderBrain(data);
      updateUI(data);
      recordTestLogEntry(data);
    } catch (e) {
      console.error("Error parsing telemetry:", e);
    }
  };


  ws.onclose = () => {
    connStatus.style.color = "var(--accent-red)";
    connStatus.style.borderColor = "rgba(244, 63, 94, 0.4)";
    connText.innerText = "Desconectado. Reintentando...";
    setTimeout(connectWebSocket, 2000);
  };
}

// ============================================================================
// Renderizado de la Arena 2D y Modo Casino Blackjack
// ============================================================================
let currentTab = "connectome";

let blackjackSim = {
  dealerHand: [10, 7],
  flyHand: [8, 5],
  flyTotal: 13,
  dealerTotal: 17,
  currentDecision: "PLANTARSE",
  gesture: "wave_arm", // "raise_arm" (Hit) | "wave_arm" (Stand) | "cheer" | "idle"
  stepLog: "[Mano 13 pts] -> Conectoma MBONs evaluando...",
  lastOutcome: null, // "VICTORIA" | "DERROTA" | "PASADO_21" | "EMPATE"
};

function renderArena(data) {
  const w = arenaCanvas.width;
  const h = arenaCanvas.height;

  if (currentTab === "olfaction" || currentTab === "blackjack") {
    renderBlackjackTable(data);
    return;
  }

  arenaCtx.clearRect(0, 0, w, h);

  // Cuadrícula sutil
  arenaCtx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  arenaCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    arenaCtx.beginPath();
    arenaCtx.moveTo(x, 0);
    arenaCtx.lineTo(x, h);
    arenaCtx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    arenaCtx.beginPath();
    arenaCtx.moveTo(0, y);
    arenaCtx.lineTo(w, y);
    arenaCtx.stroke();
  }

  // 1. Fuentes de luz
  if (data.lights) {
    data.lights.forEach((light) => {
      const grad = arenaCtx.createRadialGradient(light.x, light.y, 5, light.x, light.y, 140);
      grad.addColorStop(0, "rgba(251, 191, 36, 0.4)");
      grad.addColorStop(1, "rgba(251, 191, 36, 0.0)");
      arenaCtx.fillStyle = grad;
      arenaCtx.beginPath();
      arenaCtx.arc(light.x, light.y, 140, 0, Math.PI * 2);
      arenaCtx.fill();

      // Bombilla / fuente central
      arenaCtx.fillStyle = "#fef08a";
      arenaCtx.beginPath();
      arenaCtx.arc(light.x, light.y, 8, 0, Math.PI * 2);
      arenaCtx.fill();
    });
  }

  // 2. Gotas de sacarosa (Comida / Recompensa)
  if (data.foods) {
    data.foods.forEach((food) => {
      // Brillo exterior
      arenaCtx.fillStyle = "rgba(16, 185, 129, 0.25)";
      arenaCtx.beginPath();
      arenaCtx.arc(food.x, food.y, food.radius + 6, 0, Math.PI * 2);
      arenaCtx.fill();

      // Gota dulce
      const grad = arenaCtx.createRadialGradient(food.x - 3, food.y - 3, 2, food.x, food.y, food.radius);
      grad.addColorStop(0, "#a7f3d0");
      grad.addColorStop(1, "#059669");
      arenaCtx.fillStyle = grad;
      arenaCtx.beginPath();
      arenaCtx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
      arenaCtx.fill();
      arenaCtx.strokeStyle = "#10b981";
      arenaCtx.stroke();
    });
  }

  // 3. Sombras de depredador (Looming Stimulus - Estáticas / Controlables)
  if (data.threats) {
    data.threats.forEach((threat, i) => {
      const isLatest = i === data.threats.length - 1;

      // Anillos concéntricos de advertencia
      arenaCtx.strokeStyle = isLatest ? "rgba(244, 63, 94, 0.75)" : "rgba(244, 63, 94, 0.35)";
      arenaCtx.lineWidth = isLatest ? 2.5 : 1.5;
      arenaCtx.beginPath();
      arenaCtx.arc(threat.x, threat.y, threat.radius + 12, 0, Math.PI * 2);
      arenaCtx.stroke();

      // Núcleo de sombra
      const grad = arenaCtx.createRadialGradient(threat.x, threat.y, 4, threat.x, threat.y, threat.radius);
      grad.addColorStop(0, "rgba(244, 63, 94, 0.85)");
      grad.addColorStop(1, "rgba(20, 24, 33, 0.95)");
      arenaCtx.fillStyle = grad;
      arenaCtx.beginPath();
      arenaCtx.arc(threat.x, threat.y, threat.radius, 0, Math.PI * 2);
      arenaCtx.fill();

      // Indicador interactivo en la sombra más reciente (controlable con teclado)
      if (isLatest) {
        arenaCtx.save();
        arenaCtx.strokeStyle = "#38bdf8";
        arenaCtx.lineWidth = 1.8;
        arenaCtx.setLineDash([5, 4]);
        arenaCtx.beginPath();
        arenaCtx.arc(threat.x, threat.y, threat.radius + 18, 0, Math.PI * 2);
        arenaCtx.stroke();
        arenaCtx.setLineDash([]);

        // Mira / cruceta sutil
        arenaCtx.beginPath();
        arenaCtx.moveTo(threat.x - 6, threat.y);
        arenaCtx.lineTo(threat.x + 6, threat.y);
        arenaCtx.moveTo(threat.x, threat.y - 6);
        arenaCtx.lineTo(threat.x, threat.y + 6);
        arenaCtx.stroke();

        // Etiqueta flotante
        arenaCtx.fillStyle = "#38bdf8";
        arenaCtx.font = "bold 10px Outfit, sans-serif";
        arenaCtx.textAlign = "center";
        arenaCtx.fillText("🎯 Flechas ⬆️⬇️⬅️➡️", threat.x, threat.y - threat.radius - 8);
        arenaCtx.restore();
      }
    });
  }

  // 4. Agente Mosca
  if (data.fly && data.fly.position) {
    const fx = data.fly.position.x;
    const fy = data.fly.position.y;
    const angle = data.fly.position.angle;
    const action = data.action || {};

    arenaCtx.save();
    arenaCtx.translate(fx, fy);
    arenaCtx.rotate(angle);

    // Cono de campo de visión (FOV)
    const fovDeg = (data.fly.vision && data.fly.vision.fov) || 270;
    const halfFov = (fovDeg * Math.PI) / 360;
    arenaCtx.fillStyle = "rgba(56, 189, 248, 0.08)";
    arenaCtx.beginPath();
    arenaCtx.moveTo(0, 0);
    arenaCtx.arc(0, 0, 90, -halfFov, halfFov);
    arenaCtx.closePath();
    arenaCtx.fill();

    // Alas (vibran si hay batido de alas o salto de escape)
    const wingAngle = action.wingbeat_hz > 0 ? (Math.sin(Date.now() * 0.08) * 0.4) : 0.15;
    arenaCtx.fillStyle = "rgba(255, 255, 255, 0.4)";
    arenaCtx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    arenaCtx.lineWidth = 1;

    // Ala izquierda
    arenaCtx.save();
    arenaCtx.translate(-4, -6);
    arenaCtx.rotate(-0.4 - wingAngle);
    arenaCtx.beginPath();
    arenaCtx.ellipse(-8, -12, 5, 14, 0.2, 0, Math.PI * 2);
    arenaCtx.fill();
    arenaCtx.stroke();
    arenaCtx.restore();

    // Ala derecha
    arenaCtx.save();
    arenaCtx.translate(-4, 6);
    arenaCtx.rotate(0.4 + wingAngle);
    arenaCtx.beginPath();
    arenaCtx.ellipse(-8, 12, 5, 14, -0.2, 0, Math.PI * 2);
    arenaCtx.fill();
    arenaCtx.stroke();
    arenaCtx.restore();

    // Abdomen segmentado (gris perla / café oscuro)
    arenaCtx.fillStyle = "#334155";
    arenaCtx.beginPath();
    arenaCtx.ellipse(-12, 0, 10, 6, 0, 0, Math.PI * 2);
    arenaCtx.fill();

    // Tórax
    arenaCtx.fillStyle = "#1e293b";
    arenaCtx.beginPath();
    arenaCtx.ellipse(-2, 0, 7, 5, 0, 0, Math.PI * 2);
    arenaCtx.fill();

    // Ojos compuestos (rojos característicos de Drosophila)
    arenaCtx.fillStyle = "#dc2626";
    // Ojo izquierdo
    arenaCtx.beginPath();
    arenaCtx.arc(6, -4, 3.5, 0, Math.PI * 2);
    arenaCtx.fill();
    // Ojo derecho
    arenaCtx.beginPath();
    arenaCtx.arc(6, 4, 3.5, 0, Math.PI * 2);
    arenaCtx.fill();

    // Probóscide extendida si come
    if (action.proboscis_extended) {
      arenaCtx.strokeStyle = "#f59e0b";
      arenaCtx.lineWidth = 2.5;
      arenaCtx.beginPath();
      arenaCtx.moveTo(8, 0);
      arenaCtx.lineTo(16, 0);
      arenaCtx.stroke();
    }

    arenaCtx.restore();

    // Gizmo interactivo para "Acomodar a la Mosca" cuando está pausado o en modo arrastre
    if (isSimPaused || currentTool === "drag" || isDraggingFlyAngle || (draggedElement && draggedElement.type === "fly")) {
      arenaCtx.save();
      arenaCtx.translate(fx, fy);

      // Círculo brújula discontinuo alrededor de la mosca
      arenaCtx.strokeStyle = isDraggingFlyAngle ? "rgba(56, 189, 248, 0.9)" : "rgba(56, 189, 248, 0.35)";
      arenaCtx.lineWidth = 1.5;
      arenaCtx.setLineDash([4, 4]);
      arenaCtx.beginPath();
      arenaCtx.arc(0, 0, 36, 0, Math.PI * 2);
      arenaCtx.stroke();
      arenaCtx.setLineDash([]);

      // Puntero y flecha de rotación hacia el ángulo actual
      arenaCtx.rotate(angle);
      arenaCtx.fillStyle = isDraggingFlyAngle ? "#38bdf8" : "rgba(56, 189, 248, 0.85)";
      arenaCtx.strokeStyle = "#0284c7";
      arenaCtx.lineWidth = 2;
      arenaCtx.beginPath();
      arenaCtx.arc(36, 0, 6, 0, Math.PI * 2);
      arenaCtx.fill();
      arenaCtx.stroke();

      // Flecha indicadora frontal
      arenaCtx.fillStyle = "#38bdf8";
      arenaCtx.beginPath();
      arenaCtx.moveTo(48, 0);
      arenaCtx.lineTo(38, -5);
      arenaCtx.lineTo(38, 5);
      arenaCtx.closePath();
      arenaCtx.fill();

      // Etiqueta flotante con el ángulo en grados
      arenaCtx.rotate(-angle); // volver a horizontal
      arenaCtx.fillStyle = "#f8fafc";
      arenaCtx.font = "bold 11px monospace";
      arenaCtx.textAlign = "center";
      const degText = `${Math.round(((angle * 180 / Math.PI) % 360 + 360) % 360)}°`;
      arenaCtx.fillText(degText, 0, -42);
      arenaCtx.restore();
    }
  }

  // 5b. Papelera flotante y advertencia de bordes si se arrastra un elemento para borrarlo
  if (isDraggingElement && draggedElement && draggedElement.type !== "fly") {
    drawTrashDropzone(arenaCtx, w, h, draggedElement.currentX, draggedElement.currentY);
  }

  // 6. Cartel overlay sutil si la simulación está pausada
  if (isSimPaused && currentTab !== "olfaction" && currentTab !== "blackjack") {
    arenaCtx.save();
    arenaCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
    arenaCtx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    arenaCtx.lineWidth = 1;
    arenaCtx.beginPath();
    arenaCtx.roundRect(14, 14, 380, 26, 6);
    arenaCtx.fill();
    arenaCtx.stroke();

    arenaCtx.fillStyle = "#38bdf8";
    arenaCtx.font = "bold 11px Outfit, sans-serif";
    arenaCtx.textAlign = "left";
    arenaCtx.textBaseline = "middle";
    arenaCtx.fillText("⏸️ SIMULACIÓN PAUSADA · Arrastra la mosca o la flecha para rotarla", 24, 27);
    arenaCtx.restore();
  }

  // 7. Partículas de destellos de Dopamina
  renderDopamineBursts();
}

function triggerDopamineParticleBurst(x, y) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1.5;
    dopamineBursts.push({
      x: x || 400,
      y: y || 260,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color: Math.random() > 0.4 ? "#10b981" : "#fbbf24",
    });
  }
}

function renderDopamineBursts() {
  for (let i = dopamineBursts.length - 1; i >= 0; i--) {
    const p = dopamineBursts[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) {
      dopamineBursts.splice(i, 1);
      continue;
    }
    arenaCtx.fillStyle = p.color;
    arenaCtx.globalAlpha = p.life;
    arenaCtx.beginPath();
    arenaCtx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
    arenaCtx.fill();
    arenaCtx.globalAlpha = 1.0;
  }
}

function drawTrashDropzone(ctx, w, h, mx, my) {
  ctx.save();

  // 1. Resaltado de advertencia en los bordes de la arena ("Arrastrar al borde para borrar")
  ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.setLineDash([]);

  // 2. Zona de papelera en la esquina inferior derecha
  const zx = w - 165;
  const zy = h - 68;
  const zw = 155;
  const zh = 58;

  const isHovered = (
    (mx >= zx && my >= zy) ||
    (mx < 28 || mx > w - 28 || my < 28 || my > h - 28)
  );

  ctx.shadowColor = isHovered ? "rgba(239, 68, 68, 0.9)" : "rgba(239, 68, 68, 0.35)";
  ctx.shadowBlur = isHovered ? 20 : 8;

  ctx.fillStyle = isHovered ? "rgba(220, 38, 38, 0.96)" : "rgba(153, 27, 27, 0.85)";
  ctx.beginPath();
  ctx.roundRect(zx, zy, zw, zh, 10);
  ctx.fill();

  ctx.strokeStyle = isHovered ? "#ffffff" : "rgba(252, 165, 165, 0.75)";
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = isHovered ? "bold 13px Outfit, sans-serif" : "bold 12px Outfit, sans-serif";
  ctx.fillText(isHovered ? "🗑️ ¡SOLTAR PARA BORRAR!" : "🗑️ Papelera (Soltar aquí)", zx + zw / 2, zy + zh / 2 - 7);

  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.font = "10px Outfit, sans-serif";
  ctx.fillText("o arrastrar fuera del borde", zx + zw / 2, zy + zh / 2 + 12);

  ctx.restore();
}

// ============================================================================
// Renderizado del Casino Blackjack (Simulación de Gestos de la Mosca)
// ============================================================================
let aromaParticles = [];

function renderBlackjackTable(data) {
  const w = arenaCanvas.width;
  const h = arenaCanvas.height;
  arenaCtx.clearRect(0, 0, w, h);

  // 1. Paño de mesa de casino verde esmeralda con degradado circular
  const feltGrad = arenaCtx.createRadialGradient(w / 2, h * 0.45, 60, w / 2, h * 0.45, w * 0.7);
  feltGrad.addColorStop(0, "#065f46"); // Verde mesa
  feltGrad.addColorStop(0.7, "#044332");
  feltGrad.addColorStop(1, "#022c22"); // Borde oscuro
  arenaCtx.fillStyle = feltGrad;
  arenaCtx.fillRect(0, 0, w, h);

  // Borde de madera de caoba
  arenaCtx.strokeStyle = "#78350f";
  arenaCtx.lineWidth = 12;
  arenaCtx.strokeRect(6, 6, w - 12, h - 12);
  arenaCtx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  arenaCtx.lineWidth = 1.5;
  arenaCtx.strokeRect(12, 12, w - 24, h - 24);

  // Línea semicircular de paño de apuestas
  arenaCtx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  arenaCtx.lineWidth = 2;
  arenaCtx.beginPath();
  arenaCtx.arc(w / 2, h * 0.35, w * 0.4, 0, Math.PI);
  arenaCtx.stroke();

  // Tipografía dorada en el paño
  arenaCtx.fillStyle = "rgba(251, 191, 36, 0.35)";
  arenaCtx.font = "bold 13px Outfit, sans-serif";
  arenaCtx.textAlign = "center";
  arenaCtx.fillText("♠ CASINO DROSOPHILA · 21 (BLACKJACK BIOFÍSICO) ♠", w / 2, 28);
  arenaCtx.font = "10px Outfit, sans-serif";
  arenaCtx.fillStyle = "rgba(255, 255, 255, 0.25)";
  arenaCtx.fillText("LAS CARTAS EMITEN FIRMAS QUÍMICAS DETECTADAS POR EL LÓBULO ANTENAL", w / 2, 43);

  // 2. Cartas del Croupier (Arriba)
  const dealerCards = blackjackSim.dealerHand || [10, 7];
  const dealerTotal = blackjackSim.dealerTotal || 17;
  const startDx = w / 2 - (dealerCards.length * 52) / 2;

  arenaCtx.fillStyle = "rgba(255, 255, 255, 0.85)";
  arenaCtx.font = "bold 11px Outfit, sans-serif";
  arenaCtx.textAlign = "center";
  arenaCtx.fillText(`Mano del Croupier (${dealerTotal} pts)`, w / 2, 63);

  dealerCards.forEach((cardVal, i) => {
    const cx = startDx + i * 52;
    const cy = 72;
    drawCard(arenaCtx, cx, cy, cardVal, i % 2 === 0 ? "♠" : "♣", "#0f172a");
  });

  // 3. Estelas de aromas químicos flotando hacia las antenas de la mosca
  renderCardAromaPlumes(arenaCtx, w / 2, 138, w / 2, 285);

  // 4. Cartas de la Mosca (Frente a la mosca)
  const flyCards = blackjackSim.flyHand || [8, 5];
  const flyTotal = blackjackSim.flyTotal || 13;
  const startFx = w / 2 - (flyCards.length * 52) / 2;

  arenaCtx.fillStyle = "rgba(56, 189, 248, 0.95)";
  arenaCtx.font = "bold 12px Outfit, sans-serif";
  arenaCtx.textAlign = "center";
  arenaCtx.fillText(`Mano de la Mosca: ${flyTotal} pts`, w / 2, 158);

  flyCards.forEach((cardVal, i) => {
    const cx = startFx + i * 52;
    const cy = 168;
    drawCard(arenaCtx, cx, cy, cardVal, i % 2 === 0 ? "♥" : "♦", "#b91c1c");
  });

  // 5. La Mosca de la Fruta Sentada a la Mesa (Primer plano ampliado)
  const flyX = w / 2;
  const flyY = 325;
  drawBlackjackFly(arenaCtx, flyX, flyY, blackjackSim.gesture);

  // 6. Bocadillo / Cartel de Decisión del Conectoma
  drawDecisionCallout(arenaCtx, flyX + 175, flyY - 20, blackjackSim.gesture, blackjackSim.currentDecision);

  // 6b. Gran Banner de Desenlace (¡LA MOSCA GANA! / ¡LA MOSCA PIERDE!) en la pantalla principal
  if (blackjackSim.lastOutcome) {
    drawOutcomeHeroBanner(arenaCtx, w / 2, 120, blackjackSim.lastOutcome);
  }

  // 7. Partículas de dopamina si hay celebración
  renderDopamineBursts();
}

function drawCard(ctx, x, y, val, suit, color) {
  const cw = 44;
  const ch = 62;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  // Cara blanca de la carta
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x, y, cw, ch, 6);
  ctx.fill();
  ctx.shadowColor = "transparent";

  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Texto del valor y palo
  ctx.fillStyle = color;
  ctx.font = "bold 17px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(val, x + cw / 2, y + ch / 2 - 6);

  ctx.font = "12px sans-serif";
  ctx.fillText(suit, x + cw / 2, y + ch / 2 + 15);
  ctx.restore();
}

function drawBlackjackFly(ctx, x, y, gesture) {
  ctx.save();
  ctx.translate(x, y);

  // Escala agrandada para visualizar claramente patas, alas y ojos
  const s = 2.0;
  ctx.scale(s, s);

  // 1. Patas traseras y medias apoyadas en el paño
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  // Pata trasera izquierda
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.lineTo(-24, 18);
  ctx.lineTo(-30, 30);
  ctx.stroke();

  // Pata trasera derecha
  ctx.beginPath();
  ctx.moveTo(6, 8);
  ctx.lineTo(24, 18);
  ctx.lineTo(30, 30);
  ctx.stroke();

  // Pata media izquierda
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(-26, 4);
  ctx.lineTo(-32, 12);
  ctx.stroke();

  // Pata media derecha
  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(26, 4);
  ctx.lineTo(32, 12);
  ctx.stroke();

  // Pata delantera izquierda (descansando en el paño verde)
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-22, -22);
  ctx.stroke();

  // 2. Pata delantera derecha (¡LA PATA QUE HACE EL GESTO DE BLACKJACK!)
  ctx.lineWidth = 2.4;

  if (gesture === "raise_arm") {
    // ¡ALZA LA PATA EN ALTO HACIA EL CROUPIER PARA PEDIR CARTA! (Hit)
    ctx.strokeStyle = "#38bdf8";
    const wave = Math.sin(Date.now() * 0.018) * 5;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(16, -26 + wave);
    ctx.lineTo(24, -46 + wave); // ¡Pata apuntando bien alto hacia el croupier!
    ctx.stroke();

    // Pezuña alzada brillante
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(24, -46 + wave, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Ondas de énfasis de movimiento hacia arriba
    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(24, -46 + wave, 9, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

  } else if (gesture === "wave_arm") {
    // ¡MUEVE LA PATA DE LADO A LADO SOBRE LA MESA PARA DECIR QUE SE PLANTA! (Stand)
    ctx.strokeStyle = "#fbbf24";
    const sweepX = Math.sin(Date.now() * 0.014) * 20;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(14 + sweepX * 0.5, -16);
    ctx.lineTo(18 + sweepX, -24); // Pata barriendo horizontalmente
    ctx.stroke();

    // Pezuña sobre el paño
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(18 + sweepX, -24, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Estela de movimiento horizontal de lado a lado
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -24);
    ctx.lineTo(38, -24);
    ctx.stroke();

  } else if (gesture === "cheer") {
    // Celebración de Victoria
    ctx.strokeStyle = "#10b981";
    const cheer = Math.sin(Date.now() * 0.02) * 5;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(20, -28 + cheer);
    ctx.lineTo(28, -44 + cheer);
    ctx.stroke();

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(28, -44 + cheer, 3.5, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // En reposo sobre el paño verde
    ctx.strokeStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(16, -14);
    ctx.lineTo(20, -20);
    ctx.stroke();
  }

  // 3. Abdomen segmentado
  const abdGrad = ctx.createLinearGradient(0, 4, 0, 30);
  abdGrad.addColorStop(0, "#334155");
  abdGrad.addColorStop(1, "#1e293b");
  ctx.fillStyle = abdGrad;
  ctx.beginPath();
  ctx.ellipse(0, 16, 9, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Rayas de Drosophila
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.5;
  for (let sy = 8; sy <= 24; sy += 4) {
    ctx.beginPath();
    ctx.moveTo(-6, sy);
    ctx.lineTo(6, sy);
    ctx.stroke();
  }

  // 4. Tórax
  const thorGrad = ctx.createLinearGradient(0, -10, 0, 8);
  thorGrad.addColorStop(0, "#1e293b");
  thorGrad.addColorStop(1, "#0f172a");
  ctx.fillStyle = thorGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.stroke();

  // 5. Alas (vibran si hay batido de alas o celebración)
  const wingTilt = gesture === "cheer" ? Math.sin(Date.now() * 0.08) * 0.3 : 0.08;

  // Ala izquierda
  ctx.save();
  ctx.translate(-3, -2);
  ctx.rotate(-0.25 - wingTilt);
  ctx.fillStyle = "rgba(226, 232, 240, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(-7, 16, 6, 20, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Ala derecha
  ctx.save();
  ctx.translate(3, -2);
  ctx.rotate(0.25 + wingTilt);
  ctx.fillStyle = "rgba(226, 232, 240, 0.45)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(7, 16, 6, 20, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 6. Cabeza y Ojos Compuestos Rubí
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(0, -10, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ojo compuesto izquierdo (Rojo carmín)
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(-6, -11, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-7, -12, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Ojo compuesto derecho
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(6, -11, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(5, -12, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 7. Antenas con detección olfativa (resplandor púrpura)
  const antPulse = (Math.sin(Date.now() * 0.01) + 1.0) * 0.5;
  ctx.strokeStyle = `rgba(168, 85, 247, ${0.7 + antPulse * 0.3})`;
  ctx.lineWidth = 1.2;

  // Antena izq
  ctx.beginPath();
  ctx.moveTo(-2, -14);
  ctx.lineTo(-5, -20);
  ctx.stroke();

  // Antena der
  ctx.beginPath();
  ctx.moveTo(2, -14);
  ctx.lineTo(5, -20);
  ctx.stroke();

  // Aristas sensoriales
  ctx.fillStyle = "#c084fc";
  ctx.beginPath();
  ctx.arc(-5, -20, 1.8, 0, Math.PI * 2);
  ctx.arc(5, -20, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDecisionCallout(ctx, x, y, gesture, decision) {
  let title = "";
  let desc = "";
  let bgColor = "rgba(15, 23, 42, 0.95)";
  let borderColor = "rgba(255, 255, 255, 0.2)";
  let textColor = "#ffffff";

  if (gesture === "raise_arm") {
    title = "✋ ¡ALZA LA PATA! PEDIR CARTA (Hit)";
    desc = "Gesto: Pata delantera arriba hacia el croupier";
    bgColor = "rgba(2, 132, 199, 0.95)";
    borderColor = "#38bdf8";
  } else if (gesture === "wave_arm") {
    title = "🛑 ¡MUEVE LA PATA! PLANTARSE (Stand)";
    desc = "Gesto: Pata de lado a lado sobre el paño verde";
    bgColor = "rgba(217, 119, 6, 0.95)";
    borderColor = "#fbbf24";
  } else if (gesture === "cheer") {
    title = "🏆 ¡VICTORIA! (+1.5 DOPAMINA)";
    desc = "Celebración de victoria con aleteo y clúster PAM";
    bgColor = "rgba(5, 150, 105, 0.95)";
    borderColor = "#10b981";
  } else {
    title = "🧠 CONECTOMA OLIENDO CARTAS...";
    desc = "Codificación de mano en glomérulos antenales";
    bgColor = "rgba(30, 41, 59, 0.95)";
    borderColor = "rgba(168, 85, 247, 0.6)";
    textColor = "#c084fc";
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const boxW = 280;
  const boxH = 50;
  const bx = x - boxW / 2;
  const by = y - boxH / 2;

  // Bocadillo rectangular
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 8);
  ctx.fill();
  ctx.stroke();

  // Flecha hacia la izquierda (apuntando a la mosca)
  ctx.beginPath();
  ctx.moveTo(bx, y - 6);
  ctx.lineTo(bx - 10, y);
  ctx.lineTo(bx, y + 6);
  ctx.closePath();
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Textos del bocadillo
  ctx.fillStyle = textColor;
  ctx.font = "bold 12px Outfit, sans-serif";
  ctx.fillText(title, x, y - 8);

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "10px Outfit, sans-serif";
  ctx.fillText(desc, x, y + 10);

  ctx.restore();
}

function drawOutcomeHeroBanner(ctx, x, y, outcome) {
  ctx.save();
  const bw = 540;
  const bh = 56;
  const bx = x - bw / 2;
  const by = y - bh / 2;

  let title = "";
  let sub = "";
  let grad1 = "";
  let grad2 = "";
  let borderColor = "";
  let glowColor = "";

  if (outcome === "VICTORIA") {
    title = "👑 ¡LA MOSCA GANA! 👑";
    sub = "Recompensa Dopaminérgica (+1.5 DA) · Clúster PAM Estimulado · Racha de Victorias";
    grad1 = "rgba(6, 78, 59, 0.96)";
    grad2 = "rgba(5, 150, 105, 0.96)";
    borderColor = "#10b981";
    glowColor = "rgba(16, 185, 129, 0.65)";
  } else if (outcome === "PASADO_21") {
    title = "💥 ¡LA MOSCA PIERDE! (SE PASÓ DE 21) 💥";
    sub = "Señal Aversiva PPL1 Disparada · Cautela MBON Reforzada · Racha Reiniciada";
    grad1 = "rgba(136, 19, 55, 0.96)";
    grad2 = "rgba(225, 29, 72, 0.96)";
    borderColor = "#f43f5e";
    glowColor = "rgba(244, 63, 94, 0.65)";
  } else if (outcome === "EMPATE") {
    title = "⚖️ ¡EMPATE CON EL CROUPIER! ⚖️";
    sub = "Misma Puntuación · Equilibrio Sináptico de Decisión";
    grad1 = "rgba(146, 64, 14, 0.96)";
    grad2 = "rgba(217, 119, 6, 0.96)";
    borderColor = "#fbbf24";
    glowColor = "rgba(251, 191, 36, 0.65)";
  } else {
    // DERROTA
    title = "❌ ¡LA MOSCA PIERDE! ❌";
    sub = "Croupier Superó la Mano · Señal Aversiva PPL1 · Racha Reiniciada";
    grad1 = "rgba(136, 19, 55, 0.96)";
    grad2 = "rgba(190, 18, 60, 0.96)";
    borderColor = "#f43f5e";
    glowColor = "rgba(244, 63, 94, 0.65)";
  }

  // Resplandor exterior
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 2;

  // Fondo con degradado
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  grad.addColorStop(0, grad1);
  grad.addColorStop(1, grad2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, 10);
  ctx.fill();

  // Borde brillante
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.shadowColor = "transparent";

  // Textos del Hero Banner
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Outfit, sans-serif";
  ctx.fillText(title, x, y - 9);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = "11px Outfit, sans-serif";
  ctx.fillText(sub, x, y + 14);

  ctx.restore();
}

function renderCardAromaPlumes(ctx, cx, cy, fx, fy) {
  if (Math.random() < 0.4) {
    aromaParticles.push({
      x: cx + (Math.random() - 0.5) * 110,
      y: cy,
      vx: (Math.random() - 0.5) * 0.9,
      vy: Math.random() * 2.0 + 1.2,
      life: 1.0,
      size: Math.random() * 6 + 4,
      color: Math.random() > 0.4 ? "rgba(168, 85, 247, " : "rgba(56, 189, 248, ",
    });
  }

  for (let i = aromaParticles.length - 1; i >= 0; i--) {
    const p = aromaParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.018;

    if (p.life <= 0) {
      aromaParticles.splice(i, 1);
      continue;
    }

    ctx.fillStyle = p.color + (p.life * 0.35) + ")";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1.2 - p.life * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
}


// ============================================================================
// Renderizado del Conectoma Neural (Grafo 2D)
// ============================================================================
const BRAIN_LAYOUT = {
  RETINA_L: { x: 50, y: 70, color: "#38bdf8", label: "Retina L" },
  RETINA_R: { x: 50, y: 270, color: "#38bdf8", label: "Retina R" },
  LAMINA_L: { x: 100, y: 85, color: "#38bdf8", label: "Lamina L" },
  LAMINA_R: { x: 100, y: 255, color: "#38bdf8", label: "Lamina R" },
  MEDULLA_ON_L: { x: 150, y: 95, color: "#38bdf8", label: "Medulla L" },
  MEDULLA_ON_R: { x: 150, y: 245, color: "#38bdf8", label: "Medulla R" },
  LPLC2_LOOMING: { x: 170, y: 170, color: "#f43f5e", label: "LPLC2 Loom" },
  ORN: { x: 80, y: 170, color: "#a855f7", label: "Antenna AL" },
  PN: { x: 140, y: 170, color: "#a855f7", label: "PN Projection" },
  CX_EPG: { x: 230, y: 130, color: "#3b82f6", label: "CX Compass" },
  MB_KC: { x: 260, y: 210, color: "#ec4899", label: "Kenyon Cells" },
  MB_PAM_DA: { x: 280, y: 265, color: "#10b981", label: "PAM Dopamine" },
  MB_PPL1_DA: { x: 240, y: 265, color: "#f43f5e", label: "PPL1 Aversive" },
  MBON_APPROACH: { x: 330, y: 180, color: "#10b981", label: "MBON Appr" },
  MBON_AVOID: { x: 330, y: 230, color: "#f43f5e", label: "MBON Avoid" },
  DN_FORWARD: { x: 410, y: 120, color: "#f97316", label: "DN Forward" },
  DN_STEER_L: { x: 410, y: 70, color: "#f97316", label: "DN Steer L" },
  DN_STEER_R: { x: 410, y: 170, color: "#f97316", label: "DN Steer R" },
  DN_GIANT_FIBER: { x: 410, y: 220, color: "#f43f5e", label: "Giant Fiber" },
  DN_PROBOSCIS: { x: 410, y: 270, color: "#fbbf24", label: "DN Proboscis" },
};

const BRAIN_EDGES = [
  ["RETINA_L", "LAMINA_L"], ["RETINA_R", "LAMINA_R"],
  ["LAMINA_L", "MEDULLA_ON_L"], ["LAMINA_R", "MEDULLA_ON_R"],
  ["RETINA_L", "LPLC2_LOOMING"], ["RETINA_R", "LPLC2_LOOMING"],
  ["ORN", "PN"], ["PN", "MB_KC"],
  ["MEDULLA_ON_L", "CX_EPG"], ["MEDULLA_ON_R", "CX_EPG"],
  ["MB_KC", "MBON_APPROACH"], ["MB_KC", "MBON_AVOID"],
  ["MB_PAM_DA", "MBON_APPROACH"], ["MB_PPL1_DA", "MBON_AVOID"],
  ["LPLC2_LOOMING", "DN_GIANT_FIBER"],
  ["MBON_APPROACH", "DN_FORWARD"], ["MBON_APPROACH", "DN_PROBOSCIS"],
  ["MBON_AVOID", "DN_STEER_L"],
  ["CX_EPG", "DN_FORWARD"],
];

function drawBrainGraph(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);

  const groups = data.fly && data.fly.brain && data.fly.brain.groups ? data.fly.brain.groups : {};
  const dopamineLevel = (data.fly && data.fly.dopamine && data.fly.dopamine.current_level) || 0.0;

  const scaleX = w / 480;
  const scaleY = h / 320;

  // 1. Dibujar conexiones (sinapsis)
  BRAIN_EDGES.forEach(([src, dst]) => {
    const p1 = BRAIN_LAYOUT[src];
    const p2 = BRAIN_LAYOUT[dst];
    if (!p1 || !p2) return;

    const act1 = groups[src] ? groups[src].firing_rate : 0;
    const isLit = act1 > 0.05 || (src === "MB_PAM_DA" && dopamineLevel > 0.2);

    ctx.beginPath();
    ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
    ctx.lineTo(p2.x * scaleX, p2.y * scaleY);
    ctx.strokeStyle = isLit ? "rgba(56, 189, 248, 0.6)" : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = isLit ? 2 : 1;
    ctx.stroke();
  });

  // 2. Dibujar nodos neuronales
  Object.entries(BRAIN_LAYOUT).forEach(([name, node]) => {
    const gData = groups[name] || { firing_rate: 0, mean_v: -65 };
    const act = gData.firing_rate;
    const isDA = name === "MB_PAM_DA" && dopamineLevel > 0.1;
    const nx = node.x * scaleX;
    const ny = node.y * scaleY;

    // Resplandor si está activo
    if (act > 0.05 || isDA) {
      ctx.fillStyle = isDA ? "rgba(16, 185, 129, 0.4)" : "rgba(56, 189, 248, 0.35)";
      ctx.beginPath();
      ctx.arc(nx, ny, isDA ? 16 * scaleY : 12 * scaleY, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nodo principal
    ctx.fillStyle = isDA ? "#10b981" : (act > 0.05 ? "#fff" : node.color);
    ctx.beginPath();
    ctx.arc(nx, ny, 6 * Math.min(scaleX, scaleY), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Etiqueta
    ctx.fillStyle = "#94a3b8";
    const fontSize = Math.max(8, Math.round(9 * Math.min(scaleX, scaleY)));
    ctx.font = `${fontSize}px Outfit, sans-serif`;
    ctx.fillText(node.label, nx - 16 * scaleX, ny + 14 * scaleY);
  });
}

function renderBrain(data) {
  if (brainCtx) {
    drawBrainGraph(brainCtx, brainCanvas.width, brainCanvas.height, data);
  }
  if (bjBrainCtx) {
    drawBrainGraph(bjBrainCtx, bjBrainCanvas.width, bjBrainCanvas.height, data);
  }
}

// ============================================================================
// Actualización de la Interfaz y Telemetría
// ============================================================================
function updateUI(data) {
  if (!data.fly) return;

  const da = data.fly.dopamine || { current_level: 0, total_rewards: 0, total_punishments: 0 };
  const action = data.action || { state: "IDLE", forward_thrust: 0, turn_yaw: 0, wingbeat_hz: 0 };
  const vision = data.fly.vision || {};

  topDopamineVal.innerText = da.current_level.toFixed(2);

  const rawState = action.state || "";
  if (currentTab === "olfaction" || rawState.includes("BLACKJACK")) {
    topActionState.innerText = "🎰 CASINO 21 (ARENA PAUSADA)";
    topActionState.style.color = "#38bdf8";
  } else if (rawState.includes("FEEDING")) {
    topActionState.innerText = "🍬 COMIENDO SACAROSA";
    topActionState.style.color = "#10b981";
    if (Math.random() < 0.25 && data.fly.position) {
      triggerDopamineParticleBurst(data.fly.position.x, data.fly.position.y);
    }
  } else if (rawState.includes("ESCAPE")) {
    topActionState.innerText = "⚡ SALTO DE ESCAPE";
    topActionState.style.color = "#f43f5e";
  } else if (rawState.includes("TURNING_LEFT")) {
    const hasLights = data.lights && data.lights.length > 0;
    topActionState.innerText = hasLights ? "🔄 GIRANDO IZQ (HACIA LUZ)" : "🔄 GIRANDO IZQ";
    topActionState.style.color = "#f59e0b";
  } else if (rawState.includes("TURNING_RIGHT")) {
    const hasLights = data.lights && data.lights.length > 0;
    topActionState.innerText = hasLights ? "🔄 GIRANDO DER (HACIA LUZ)" : "🔄 GIRANDO DER";
    topActionState.style.color = "#f59e0b";
  } else if (rawState.includes("WALKING")) {
    topActionState.innerText = "🚶 CAMINANDO (P9 DNs)";
    topActionState.style.color = "#38bdf8";
  } else {
    topActionState.innerText = rawState.split(" ")[0] || "EN REPOSO";
    topActionState.style.color = "#94a3b8";
  }

  // Barra de telemetría inferior
  valThrust.innerText = action.forward_thrust.toFixed(2);
  meterThrust.style.width = `${Math.min(100, action.forward_thrust * 100)}%`;

  const yawVal = action.turn_yaw || 0;
  valYaw.innerText = (yawVal >= 0 ? "+" : "") + yawVal.toFixed(2);
  if (yawVal >= 0) {
    meterYaw.style.left = "50%";
    meterYaw.style.width = `${Math.min(50, yawVal * 50)}%`;
  } else {
    const w = Math.min(50, Math.abs(yawVal) * 50);
    meterYaw.style.left = `${50 - w}%`;
    meterYaw.style.width = `${w}%`;
  }

  valWingbeat.innerText = `${action.wingbeat_hz.toFixed(1)} Hz`;
  valWingbeat.style.color = action.wingbeat_hz > 0 ? "var(--accent-gold)" : "var(--text-muted)";

  valProboscis.innerText = action.proboscis_extended ? "¡Extendida!" : "Retraída";
  valProboscis.style.color = action.proboscis_extended ? "var(--accent-gold)" : "var(--text-muted)";

  valEscape.innerText = action.escape_jump ? "¡SALTO BALÍSTICO!" : "Inactivo";
  valEscape.style.color = action.escape_jump ? "var(--accent-red)" : "var(--text-muted)";

  // Medidor de dopamina
  const pct = Math.min(100, (da.current_level / 2.5) * 100);
  gaugeDopamineFill.style.width = `${pct}%`;
  gaugeDopamineText.innerText = `${da.current_level.toFixed(2)} / 2.50`;
  valRewardsCount.innerText = da.total_rewards.toFixed(1);
  valPunishCount.innerText = da.total_punishments.toFixed(1);

  // Medidores de dopamina y racha en el panel lateral de Blackjack
  if (bjGaugeDopamineFill) {
    const bjPct = Math.min(100, (da.current_level / 3.0) * 100);
    bjGaugeDopamineFill.style.width = `${bjPct}%`;
  }
  if (bjGaugeDopamineText) {
    bjGaugeDopamineText.innerText = `${da.current_level.toFixed(2)} / 3.00`;
  }
  if (bjDopamineStreakFill) {
    const streakPct = Math.min(100, (blackjackStats.accumulatedDopamine / 8.0) * 100);
    bjDopamineStreakFill.style.width = `${streakPct}%`;
  }
  if (bjStreakRewardText) {
    bjStreakRewardText.innerText = `+${blackjackStats.accumulatedDopamine.toFixed(1)} DA (Racha: ${blackjackStats.streak})`;
  }
  if (bjWinsCount) bjWinsCount.innerText = blackjackStats.wins;
  if (bjLossesCount) bjLossesCount.innerText = blackjackStats.losses;
  if (bjStreakCount) bjStreakCount.innerText = `${blackjackStats.streak} 🔥`;

  // Alerta de sombra Looming
  if (vision.looming_signal > 0.4) {
    loomingAlert.style.display = "block";
  } else {
    loomingAlert.style.display = "none";
  }

  // Monitor de Omatidios
  if (vision.ommatidia_view && vision.ommatidia_view.length > 0) {
    renderOmmatidia(vision.ommatidia_view);
  }
}

function renderOmmatidia(viewArray) {
  if (ommatidiaGrid.children.length !== viewArray.length) {
    ommatidiaGrid.innerHTML = "";
    ommatidiaGrid.style.gridTemplateColumns = `repeat(${Math.min(viewArray.length, 16)}, 1fr)`;
    for (let i = 0; i < viewArray.length; i++) {
      const cell = document.createElement("div");
      cell.className = "ommatidium-cell";
      ommatidiaGrid.appendChild(cell);
    }
  }

  const cells = ommatidiaGrid.children;
  for (let i = 0; i < viewArray.length; i++) {
    const val = Math.min(1.0, viewArray[i]);
    // Color según intensidad percibida (azul cian fotorreceptor)
    const brightness = Math.floor(val * 255);
    cells[i].style.backgroundColor = `rgb(${Math.floor(brightness * 0.2)}, ${Math.floor(brightness * 0.7)}, ${brightness})`;
  }
}

// ============================================================================
// Funciones de la Herramienta de Testeo, Pausa y Log Cinemático
// ============================================================================
function getCardinalText(deg) {
  const norm = ((deg % 360) + 360) % 360;
  if (norm >= 337.5 || norm < 22.5) return `${norm}° (Este)`;
  if (norm >= 22.5 && norm < 67.5) return `${norm}° (Sureste)`;
  if (norm >= 67.5 && norm < 112.5) return `${norm}° (Sur)`;
  if (norm >= 112.5 && norm < 157.5) return `${norm}° (Suroeste)`;
  if (norm >= 157.5 && norm < 202.5) return `${norm}° (Oeste)`;
  if (norm >= 202.5 && norm < 247.5) return `${norm}° (Noroeste)`;
  if (norm >= 247.5 && norm < 292.5) return `${norm}° (Norte)`;
  return `${norm}° (Noreste)`;
}

function setSimulationPauseUI(isPaused) {
  isSimPaused = isPaused;
  const pauseLabel = document.getElementById("pauseLabel");
  const pauseIcon = document.getElementById("pauseIcon");
  const btnToggle = document.getElementById("btnTogglePause");

  const sidePauseLabel = document.getElementById("sidePauseLabel");
  const sidePauseIcon = document.getElementById("sidePauseIcon");
  const sideBtnToggle = document.getElementById("sideBtnTogglePause");

  const btnStep = document.getElementById("btnStepFrame");
  const sideBtnStep = document.getElementById("sideBtnStepFrame");

  const logPill = document.getElementById("logPauseIndicator");
  const testTag = document.getElementById("testStatusTag");

  if (isPaused) {
    if (pauseLabel) pauseLabel.innerText = "Reanudar";
    if (pauseIcon) pauseIcon.innerText = "▶️";
    if (btnToggle) btnToggle.classList.add("paused");

    if (sidePauseLabel) sidePauseLabel.innerText = "Reanudar Simulación";
    if (sidePauseIcon) sidePauseIcon.innerText = "▶️";
    if (sideBtnToggle) sideBtnToggle.classList.add("paused");

    if (btnStep) btnStep.disabled = false;
    if (sideBtnStep) sideBtnStep.disabled = false;

    if (logPill) {
      logPill.innerText = "⏸️ Pausado";
      logPill.classList.add("paused");
    }
    if (testTag) {
      testTag.innerText = "⏸️ Simulación Pausada";
      testTag.style.background = "rgba(244, 63, 94, 0.15)";
      testTag.style.color = "#fb7185";
    }
  } else {
    if (pauseLabel) pauseLabel.innerText = "Pausar";
    if (pauseIcon) pauseIcon.innerText = "⏸️";
    if (btnToggle) btnToggle.classList.remove("paused");

    if (sidePauseLabel) sidePauseLabel.innerText = "Pausar";
    if (sidePauseIcon) sidePauseIcon.innerText = "⏸️";
    if (sideBtnToggle) sideBtnToggle.classList.remove("paused");

    if (btnStep) btnStep.disabled = true;
    if (sideBtnStep) sideBtnStep.disabled = true;

    if (logPill) {
      logPill.innerText = "🟢 En Vivo";
      logPill.classList.remove("paused");
    }
    if (testTag) {
      testTag.innerText = "🟢 En Simulación";
      testTag.style.background = "rgba(16, 185, 129, 0.15)";
      testTag.style.color = "#34d399";
    }
  }
}

function toggleSimulationPause() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: "toggle_pause" }));
  }
}

function stepSimulationSingleFrame() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command: "step_frame" }));
  }
}

function syncFlyPoseInputs(x, y, angle) {
  const sliderX = document.getElementById("sliderFlyX");
  const numX = document.getElementById("numFlyX");
  const sliderY = document.getElementById("sliderFlyY");
  const numY = document.getElementById("numFlyY");
  const sliderAngle = document.getElementById("sliderFlyAngle");
  const numAngle = document.getElementById("numFlyAngle");
  const badgeCoords = document.getElementById("flyPoseCoordsBadge");
  const cardinal = document.getElementById("cardinalBadge");

  const angleDeg = Math.round(((angle * 180 / Math.PI) % 360 + 360) % 360);
  const signedAngleDeg = Math.round((angle * 180 / Math.PI));

  if (sliderX) sliderX.value = Math.round(x);
  if (numX) numX.value = Math.round(x);
  if (sliderY) sliderY.value = Math.round(y);
  if (numY) numY.value = Math.round(y);
  if (sliderAngle) sliderAngle.value = signedAngleDeg;
  if (numAngle) numAngle.value = signedAngleDeg;

  if (badgeCoords) badgeCoords.innerText = `(${Math.round(x)}, ${Math.round(y)}) · ${angleDeg}°`;
  if (cardinal) cardinal.innerText = getCardinalText(angleDeg);
}

function recordTestLogEntry(data) {
  if (!data || !data.fly || !data.fly.position) return;
  const brain = data.fly.brain || {};
  const step = brain.step || 0;

  // Actualizar telemetría instantánea en la pestaña de testeo
  const diag = data.diagnostics || {};
  const nearest = diag.nearest_food || null;
  const pos = data.fly.position;
  const angleDeg = Math.round(((pos.angle * 180 / Math.PI) % 360 + 360) % 360);

  const instDistFood = document.getElementById("instDistFood");
  const instAngleErr = document.getElementById("instAngleErr");
  const instContrast = document.getElementById("instContrast");
  const instAntennaLR = document.getElementById("instAntennaLR");
  const instP9 = document.getElementById("instP9");
  const instDNa = document.getElementById("instDNa");

  if (nearest) {
    if (instDistFood) instDistFood.innerText = `${nearest.dist.toFixed(1)} px`;
    if (instAngleErr) {
      instAngleErr.innerText = `${nearest.angle_err_deg > 0 ? "+" : ""}${nearest.angle_err_deg.toFixed(0)}°`;
      instAngleErr.style.color = Math.abs(nearest.angle_err_deg) <= 10 ? "#10b981" : "#fbbf24";
    }
  } else {
    if (instDistFood) instDistFood.innerText = "--";
    if (instAngleErr) instAngleErr.innerText = "--";
  }

  if (diag.contrast_norm !== undefined && instContrast) {
    instContrast.innerText = `${diag.contrast_norm > 0 ? "+" : ""}${diag.contrast_norm.toFixed(2)}`;
    instContrast.style.color = Math.abs(diag.contrast_norm) <= 0.15 ? "#10b981" : "#38bdf8";
  }
  if (diag.antenna_left_c !== undefined && instAntennaLR) {
    instAntennaLR.innerText = `${diag.antenna_left_c.toFixed(2)} / ${diag.antenna_right_c.toFixed(2)}`;
  }
  if (diag.p9_left_rate !== undefined && instP9) {
    instP9.innerText = `${diag.p9_left_rate.toFixed(2)} / ${diag.p9_right_rate.toFixed(2)}`;
  }
  if (diag.dna_left_rate !== undefined && instDNa) {
    instDNa.innerText = `${diag.dna_left_rate.toFixed(2)} / ${diag.dna_right_rate.toFixed(2)}`;
  }

  // Sincronizar sliders de postura si el usuario no los está moviendo manualmente
  if (!isUserInteractingWithPose && !isDraggingFlyAngle) {
    syncFlyPoseInputs(pos.x, pos.y, pos.angle);
  }

  // Si el paso no avanzó (simulación pausada sin step), solo actualizar display
  if (step === lastLoggedStep) return;
  lastLoggedStep = step;

  // Determinar comportamiento para badge
  const action = data.action || {};
  const fwd = action.forward_thrust || 0;
  const yaw = action.turn_yaw || 0;
  const speed = data.fly.speed || 0;
  let badgeHtml = '<span class="badge-behavior badge-idle">⏸️ Reposo</span>';
  let badgeText = "Reposo";

  if (diag.is_feeding || (action.state && action.state.includes("FEEDING"))) {
    badgeHtml = '<span class="badge-behavior badge-feeding">🍬 Comiendo</span>';
    badgeText = "Comiendo";
  } else if (Math.abs(yaw) > 0.25) {
    const dir = yaw > 0 ? "Der." : "Izq.";
    badgeHtml = `<span class="badge-behavior badge-turning">🔄 Pivote ${dir}</span>`;
    badgeText = `Pivote ${dir}`;
  } else if (fwd > 0.3) {
    badgeHtml = '<span class="badge-behavior badge-surge">⚡ Arremetida</span>';
    badgeText = "Arremetida";
  } else if (fwd > 0.05) {
    badgeHtml = '<span class="badge-behavior badge-surge">🚶 Avance</span>';
    badgeText = "Avance";
  }

  const entry = {
    step,
    x: pos.x.toFixed(1),
    y: pos.y.toFixed(1),
    angleDeg,
    dist: nearest ? nearest.dist.toFixed(1) : "--",
    errDeg: nearest ? `${nearest.angle_err_deg > 0 ? "+" : ""}${nearest.angle_err_deg.toFixed(0)}°` : "--",
    antL: diag.antenna_left_c !== undefined ? diag.antenna_left_c.toFixed(2) : "--",
    antR: diag.antenna_right_c !== undefined ? diag.antenna_right_c.toFixed(2) : "--",
    contrast: diag.contrast_norm !== undefined ? `${diag.contrast_norm > 0 ? "+" : ""}${diag.contrast_norm.toFixed(2)}` : "--",
    p9: diag.p9_left_rate !== undefined ? `${diag.p9_left_rate.toFixed(2)}/${diag.p9_right_rate.toFixed(2)}` : "--",
    dna: diag.dna_left_rate !== undefined ? `${diag.dna_left_rate.toFixed(2)}/${diag.dna_right_rate.toFixed(2)}` : "--",
    fwd: fwd.toFixed(2),
    yaw: `${yaw > 0 ? "+" : ""}${yaw.toFixed(2)}`,
    speed: speed.toFixed(2),
    badgeHtml,
    badgeText,
  };

  testLogBuffer.push(entry);
  if (testLogBuffer.length > MAX_TEST_LOG_ENTRIES) {
    testLogBuffer.shift();
  }

  // Actualizar tabla en drawer inferior
  const tbody = document.getElementById("testLogBody");
  if (tbody) {
    const emptyRow = tbody.querySelector(".empty-row");
    if (emptyRow) tbody.innerHTML = "";

    const tr = document.createElement("tr");
    if (isSimPaused) tr.classList.add("row-step-highlight");
    tr.innerHTML = `
      <td>#${entry.step}</td>
      <td>(${entry.x}, ${entry.y})</td>
      <td>${entry.angleDeg}°</td>
      <td>${entry.dist}</td>
      <td>${entry.errDeg}</td>
      <td>${entry.antL} / ${entry.antR}</td>
      <td>${entry.contrast}</td>
      <td>P9:${entry.p9} | DNa:${entry.dna}</td>
      <td>Fwd:${entry.fwd} | Yaw:${entry.yaw}</td>
      <td>${entry.speed} px/f</td>
      <td>${entry.badgeHtml}</td>
    `;
    tbody.appendChild(tr);

    while (tbody.children.length > 250) {
      tbody.removeChild(tbody.firstChild);
    }

    if (isAutoScrollEnabled) {
      const wrapper = document.getElementById("testLogTableWrapper");
      if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
    }
  }

  // Contador de pasos
  const countEl = document.getElementById("testLogCount");
  if (countEl) countEl.innerText = `${testLogBuffer.length} pasos`;

  // Mini-log lateral en pestaña
  const miniList = document.getElementById("miniLogList");
  if (miniList) {
    const emptyHint = miniList.querySelector(".empty-hint");
    if (emptyHint) miniList.innerHTML = "";

    const miniRow = document.createElement("div");
    miniRow.className = `mini-log-row ${isSimPaused ? "highlight" : ""}`;
    miniRow.innerHTML = `
      <span>#${entry.step} (${entry.x}, ${entry.y}) ${entry.angleDeg}°</span>
      <span>${entry.errDeg !== "--" ? "Err:" + entry.errDeg : ""}</span>
      <span>${entry.badgeText}</span>
    `;
    miniList.appendChild(miniRow);
    while (miniList.children.length > 40) {
      miniList.removeChild(miniList.firstChild);
    }
    miniList.scrollTop = miniList.scrollHeight;
  }
}

function copyTestLogTsv() {
  if (!testLogBuffer.length) return;
  const header = "Paso\tX\tY\tAnguloDeg\tDistGota\tErrAng\tAntenaIzq\tAntenaDer\tContraste\tP9\tDNa\tFwd\tYaw\tVelocidad\tEstado\n";
  const rows = testLogBuffer.map(e => `${e.step}\t${e.x}\t${e.y}\t${e.angleDeg}\t${e.dist}\t${e.errDeg}\t${e.antL}\t${e.antR}\t${e.contrast}\t${e.p9}\t${e.dna}\t${e.fwd}\t${e.yaw}\t${e.speed}\t${e.badgeText}`).join("\n");
  navigator.clipboard.writeText(header + rows).then(() => {
    const btn = document.getElementById("btnCopyTestLog");
    if (btn) {
      const orig = btn.innerText;
      btn.innerText = "✅ ¡Copiado!";
      setTimeout(() => btn.innerText = orig, 1800);
    }
  });
}

function exportTestLogCsv() {
  if (!testLogBuffer.length) return;
  const header = "Paso,X,Y,AnguloDeg,DistGota,ErrAng,AntenaIzq,AntenaDer,Contraste,P9,DNa,Fwd,Yaw,Velocidad,Estado\n";
  const rows = testLogBuffer.map(e => `${e.step},${e.x},${e.y},${e.angleDeg},${e.dist},"${e.errDeg}",${e.antL},${e.antR},${e.contrast},"${e.p9}","${e.dna}",${e.fwd},${e.yaw},${e.speed},"${e.badgeText}"`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moscabrain_test_log_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function findNearestFoodOrCoords() {
  if (lastTelemetry && lastTelemetry.foods && lastTelemetry.foods.length > 0) {
    const fx = lastTelemetry.fly ? lastTelemetry.fly.position.x : 400;
    const fy = lastTelemetry.fly ? lastTelemetry.fly.position.y : 300;
    return lastTelemetry.foods.reduce((prev, curr) => {
      const d1 = Math.hypot(prev.x - fx, prev.y - fy);
      const d2 = Math.hypot(curr.x - fx, curr.y - fy);
      return d2 < d1 ? curr : prev;
    });
  }
  return { x: 400.0, y: 380.0 };
}

// ============================================================================
// Event Listeners y Controles
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();

  // Cambio de herramienta de arena
  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.id === "btnClearStimuli") {
        fetch("/api/stimulus/clear", { method: "POST" });
        return;
      }
      document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTool = btn.dataset.tool;
    });
  });

  // Funciones auxiliares para manipulación y borrado de elementos
  function findElementAtPos(x, y, data) {
    if (!data) return null;
    // 1. Mosca
    if (data.fly && data.fly.position) {
      const fx = data.fly.position.x;
      const fy = data.fly.position.y;
      if (Math.hypot(fx - x, fy - y) <= 24) {
        return { type: "fly", id: "fly", x: fx, y: fy };
      }
    }
    // 2. Gotas de sacarosa (alimento)
    if (data.foods) {
      for (let f of data.foods) {
        if (Math.hypot(f.x - x, f.y - y) <= (f.radius || 12) + 8) {
          return { type: "food", id: f.id, x: f.x, y: f.y, radius: f.radius };
        }
      }
    }
    // 3. Luces
    if (data.lights) {
      for (let l of data.lights) {
        if (Math.hypot(l.x - x, l.y - y) <= 22) {
          return { type: "light", id: l.id, x: l.x, y: l.y };
        }
      }
    }
    // 4. Sombras o depredadores
    if (data.threats) {
      for (let t of data.threats) {
        if (Math.hypot(t.x - x, t.y - y) <= (t.radius || 24) + 8) {
          return { type: "threat", id: t.id, x: t.x, y: t.y, radius: t.radius };
        }
      }
    }
    return null;
  }

  function removeStimulusItem(elem) {
    if (!elem || elem.type === "fly") return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        command: "remove_stimulus",
        type: elem.type,
        id: elem.id,
        x: elem.x,
        y: elem.y,
      }));
    }
    fetch("/api/stimulus/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: elem.type,
        id: elem.id,
        x: elem.x,
        y: elem.y,
      }),
    });
  }

  function getCanvasPos(e) {
    const rect = arenaCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * arenaCanvas.width,
      y: ((clientY - rect.top) / rect.height) * arenaCanvas.height,
    };
  }

  // Interacción táctil y con ratón en el Canvas (Arrastrar, Borrar y Colocar)
  arenaCanvas.addEventListener("pointerdown", (e) => {
    if (currentTab === "olfaction" || currentTab === "blackjack") return;
    const pos = getCanvasPos(e);
    const elem = findElementAtPos(pos.x, pos.y, lastTelemetry);

    // 1. Herramienta Borrador (Eraser): clic en un elemento para eliminarlo
    if (currentTool === "eraser") {
      if (elem && elem.type !== "fly") {
        removeStimulusItem(elem);
      }
      return;
    }

    // 1b. Acomodar Mosca: comprobar clic sobre el tirador frontal de rotación de la mosca
    if (lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position) {
      const fx = lastTelemetry.fly.position.x;
      const fy = lastTelemetry.fly.position.y;
      const fAngle = lastTelemetry.fly.position.angle;
      const hx = fx + 36 * Math.cos(fAngle);
      const hy = fy + 36 * Math.sin(fAngle);
      if (Math.hypot(hx - pos.x, hy - pos.y) <= 16) {
        isDraggingFlyAngle = true;
        arenaCanvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Si se hace clic sobre un elemento existente (o la mosca): iniciar arrastre
    if (elem) {
      isDraggingElement = true;
      draggedElement = {
        type: elem.type,
        id: elem.id,
        origX: elem.x,
        origY: elem.y,
        currentX: pos.x,
        currentY: pos.y,
      };
      arenaCanvas.setPointerCapture(e.pointerId);
      return;
    }

    // 3. Herramienta Mover / Arrastrar sin elemento debajo: mover mosca a esa posición
    if (currentTool === "drag") {
      if (ws && ws.readyState === WebSocket.OPEN) {
        const curAngle = lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position ? lastTelemetry.fly.position.angle : 0;
        ws.send(JSON.stringify({ command: "set_fly_pose", x: pos.x, y: pos.y, angle: curAngle, reset_bias: true }));
        syncFlyPoseInputs(pos.x, pos.y, curAngle);
      }
      return;
    }

    // 4. Herramienta Sombra: colocar o mover sombra con arrastre
    if (currentTool === "threat") {
      isDraggingThreat = true;
      arenaCanvas.setPointerCapture(e.pointerId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: "move_threat_absolute", x: pos.x, y: pos.y }));
      }
      return;
    }

    // 5. Herramientas de adición (food, light)
    if (currentTool === "food" || currentTool === "light") {
      fetch("/api/stimulus/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: currentTool, x: pos.x, y: pos.y }),
      });
    }
  });

  arenaCanvas.addEventListener("pointermove", (e) => {
    if (currentTab === "olfaction" || currentTab === "blackjack") return;
    const pos = getCanvasPos(e);

    // Arrastre interactivo de orientación angular de la mosca
    if (isDraggingFlyAngle && lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position) {
      const fx = lastTelemetry.fly.position.x;
      const fy = lastTelemetry.fly.position.y;
      const newAngle = Math.atan2(pos.y - fy, pos.x - fx);
      lastTelemetry.fly.position.angle = newAngle;
      renderArena(lastTelemetry);
      syncFlyPoseInputs(fx, fy, newAngle);
      const now = performance.now();
      if (now - elementDragThrottle >= 25) {
        elementDragThrottle = now;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ command: "set_fly_pose", x: fx, y: fy, angle: newAngle, reset_bias: false }));
        }
      }
      return;
    }

    // Si se está arrastrando un elemento (mosca, comida, luz, etc.)
    if (isDraggingElement && draggedElement) {
      draggedElement.currentX = pos.x;
      draggedElement.currentY = pos.y;
      const now = performance.now();
      if (now - elementDragThrottle >= 25) {
        elementDragThrottle = now;
        if (draggedElement.type === "fly") {
          const curAngle = lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position ? lastTelemetry.fly.position.angle : 0;
          if (lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position) {
            lastTelemetry.fly.position.x = pos.x;
            lastTelemetry.fly.position.y = pos.y;
            renderArena(lastTelemetry);
          }
          syncFlyPoseInputs(pos.x, pos.y, curAngle);
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ command: "set_fly_pose", x: pos.x, y: pos.y, angle: curAngle, reset_bias: false }));
          }
        } else {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              command: "move_stimulus",
              type: draggedElement.type,
              id: draggedElement.id,
              x: pos.x,
              y: pos.y,
              old_x: draggedElement.origX,
              old_y: draggedElement.origY,
            }));
          }
        }
      }
      return;
    }

    // Arrastre específico de sombra
    if (isDraggingThreat) {
      const now = performance.now();
      if (now - threatDragThrottle < 30) return;
      threatDragThrottle = now;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: "move_threat_absolute", x: pos.x, y: pos.y }));
      }
    }
  });

  arenaCanvas.addEventListener("pointerup", (e) => {
    if (isDraggingFlyAngle) {
      isDraggingFlyAngle = false;
      if (lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position && ws && ws.readyState === WebSocket.OPEN) {
        const fx = lastTelemetry.fly.position.x;
        const fy = lastTelemetry.fly.position.y;
        const angle = lastTelemetry.fly.position.angle;
        ws.send(JSON.stringify({ command: "set_fly_pose", x: fx, y: fy, angle: angle, reset_bias: true }));
      }
      return;
    }

    if (isDraggingElement && draggedElement) {
      const pos = getCanvasPos(e);
      // Comprobar si se soltó fuera o cerca de los bordes o sobre la zona de papelera para BORRARLO
      const marginTrash = 28;
      const isOutOfBounds = (
        pos.x < marginTrash ||
        pos.x > arenaCanvas.width - marginTrash ||
        pos.y < marginTrash ||
        pos.y > arenaCanvas.height - marginTrash
      );
      const isTrashDropzone = (
        pos.x >= arenaCanvas.width - 165 &&
        pos.y >= arenaCanvas.height - 68
      );

      if ((isOutOfBounds || isTrashDropzone) && draggedElement.type !== "fly") {
        removeStimulusItem(draggedElement);
      } else if (draggedElement.type === "fly") {
        const curAngle = lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position ? lastTelemetry.fly.position.angle : 0;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ command: "set_fly_pose", x: pos.x, y: pos.y, angle: curAngle, reset_bias: true }));
        }
      } else {
        // Fijar posición final
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            command: "move_stimulus",
            type: draggedElement.type,
            id: draggedElement.id,
            x: pos.x,
            y: pos.y,
            old_x: draggedElement.origX,
            old_y: draggedElement.origY,
          }));
        }
      }
      isDraggingElement = false;
      draggedElement = null;
    }
    isDraggingThreat = false;
  });

  arenaCanvas.addEventListener("pointercancel", () => {
    isDraggingElement = false;
    draggedElement = null;
    isDraggingThreat = false;
  });

  // Clic derecho para borrar rápidamente cualquier elemento
  arenaCanvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (currentTab === "olfaction" || currentTab === "blackjack") return;
    const pos = getCanvasPos(e);
    const elem = findElementAtPos(pos.x, pos.y, lastTelemetry);
    if (elem && elem.type !== "fly") {
      removeStimulusItem(elem);
    }
  });

  // Estilo de cursor dinámico según herramienta y elemento bajo el puntero
  arenaCanvas.addEventListener("mousemove", (e) => {
    if (currentTab === "olfaction" || currentTab === "blackjack") {
      arenaCanvas.style.cursor = "default";
      return;
    }
    const pos = getCanvasPos(e);
    const elem = findElementAtPos(pos.x, pos.y, lastTelemetry);

    if (currentTool === "eraser") {
      arenaCanvas.style.cursor = elem && elem.type !== "fly" ? "not-allowed" : "crosshair";
    } else if (currentTool === "threat") {
      arenaCanvas.style.cursor = "crosshair";
    } else if (currentTool === "drag" || elem) {
      arenaCanvas.style.cursor = isDraggingElement ? "grabbing" : "grab";
    } else {
      arenaCanvas.style.cursor = "pointer";
    }
  });


  // Selector de escenario
  document.getElementById("scenarioSelect").addEventListener("change", (e) => {
    activeScenario = e.target.value;
    fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: activeScenario }),
    });
  });

  // Inyección manual de Dopamina
  document.getElementById("btnRewardManual").addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "reward", amount: 1.0 }));
    }
    if (lastTelemetry && lastTelemetry.fly && lastTelemetry.fly.position) {
      triggerDopamineParticleBurst(lastTelemetry.fly.position.x, lastTelemetry.fly.position.y);
    } else {
      triggerDopamineParticleBurst(400, 260);
    }
  });

  // Señal Aversiva manual
  document.getElementById("btnPunishManual").addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ command: "punish", amount: 0.5 }));
    }
  });

  // Control con teclas de flechas para mover la sombra de depredador más reciente
  window.addEventListener("keydown", (e) => {
    // Deshabilitado en modo Blackjack
    if (currentTab === "olfaction" || currentTab === "blackjack") return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
      if (activeTag === "input" || activeTag === "select" || activeTag === "textarea") return;

      e.preventDefault();
      const step = e.shiftKey ? 32 : 16;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: "move_threat", dx, dy }));
      }
    }
  });

  // Pestañas del Inspector
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetId = `tab${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}`;
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add("active");

      // Sincronizar pestaña activa con la vista de la arena
      currentTab = btn.dataset.tab;
      const arenaPanel = document.querySelector(".arena-panel");
      const arenaTitle = document.querySelector(".panel-header h2");
      const toolsToolbar = document.querySelector(".tools-toolbar");
      const scenarioSelector = document.querySelector(".scenario-selector");
      const casinoControlsBar = document.getElementById("casinoControlsBar");

      const isBlackjack = currentTab === "olfaction";

      // Notificar al backend para pausar completamente la arena física en modo Blackjack
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: "set_mode", mode: isBlackjack ? "blackjack" : "arena" }));
      }

      if (isBlackjack) {
        if (arenaPanel) arenaPanel.classList.add("casino-view");
        if (arenaTitle) arenaTitle.innerHTML = '🎰 Casino Drosophila · 21 (Blackjack Biofísico)';
        if (toolsToolbar) toolsToolbar.style.display = "none";
        if (scenarioSelector) scenarioSelector.style.display = "none";
        if (casinoControlsBar) casinoControlsBar.style.display = "flex";
      } else {
        if (arenaPanel) arenaPanel.classList.remove("casino-view");
        if (arenaTitle) arenaTitle.innerHTML = 'Arena Virtual';
        if (toolsToolbar) toolsToolbar.style.display = "flex";
        if (scenarioSelector) scenarioSelector.style.display = "flex";
        if (casinoControlsBar) casinoControlsBar.style.display = "none";
      }

      if (lastTelemetry) {
        renderArena(lastTelemetry);
      }
    });
  });

  // Sliders de Visión
  const sliderFov = document.getElementById("sliderFov");
  const sliderOmmatidia = document.getElementById("sliderOmmatidia");
  const sliderSens = document.getElementById("sliderSens");

  function applyVisionConfig() {
    document.getElementById("labelFov").innerText = `${sliderFov.value}°`;
    document.getElementById("labelOmmatidia").innerText = sliderOmmatidia.value;
    document.getElementById("labelSens").innerText = `${sliderSens.value}x`;

    fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fov_horizontal: parseFloat(sliderFov.value),
        ommatidia_count: parseInt(sliderOmmatidia.value),
        sensitivity: parseFloat(sliderSens.value),
      }),
    });
    updateCodeSnippet();
  }

  sliderFov.addEventListener("input", applyVisionConfig);
  sliderOmmatidia.addEventListener("input", applyVisionConfig);
  sliderSens.addEventListener("input", applyVisionConfig);

  // Dispensador de Aromas
  document.querySelectorAll(".btn-odor").forEach((btn) => {
    btn.addEventListener("click", () => {
      const odor = btn.dataset.odor;
      fetch("/api/olfaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odor_name: odor === "aire_limpio" ? null : odor, concentration: 1.0 }),
      });
    });
  });

  // Juego de 21 / Blackjack con Simulación de Gestos
  const btnSidebarRound = document.getElementById("btnPlayBlackjackRound");
  const btnCasinoRound = document.getElementById("btnCasinoPlayRound");
  const btnCasinoAuto = document.getElementById("btnCasinoAutoPlay");
  const btnCasinoReset = document.getElementById("btnCasinoResetStats");
  const casinoStatusEl = document.getElementById("casinoBarStatus");
  const casinoStreakEl = document.getElementById("casinoBarStreak");
  const casinoDopamineEl = document.getElementById("casinoBarDopamine");

  function setBlackjackButtonsBusy(isBusy) {
    if (btnSidebarRound) {
      btnSidebarRound.disabled = isBusy;
      btnSidebarRound.innerText = isBusy ? "⏳ Conectoma evaluando mano..." : "♠️ Jugar Ronda con el Conectoma";
    }
    if (btnCasinoRound) {
      btnCasinoRound.disabled = isBusy;
      btnCasinoRound.innerText = isBusy ? "⏳ CONECTOMA EVALUANDO..." : "♠️ JUGAR RONDA (CONECTOMA)";
    }
  }

  function syncCasinoBarStats() {
    if (casinoStreakEl) casinoStreakEl.innerText = `${blackjackStats.streak} 🔥`;
    if (casinoDopamineEl) casinoDopamineEl.innerText = `+${blackjackStats.accumulatedDopamine.toFixed(1)} DA`;
  }

  async function playBlackjackRound() {
    setBlackjackButtonsBusy(true);
    if (casinoStatusEl) casinoStatusEl.innerText = "Evaluando firma química...";

    try {
      const res = await fetch("/api/blackjack/round", { method: "POST" });
      const data = await res.json();

      // Asegurar vista de mesa de casino en la arena
      currentTab = "olfaction";
      blackjackSim.lastOutcome = null;

      // 1. Estado inicial con primeras cartas
      blackjackSim.dealerHand = [data.dealer_hand[0], "?"];
      blackjackSim.dealerTotal = data.dealer_hand[0];
      const initialCards = data.fly_hand.slice(0, 2);
      blackjackSim.flyHand = initialCards;
      blackjackSim.flyTotal = initialCards.reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);
      blackjackSim.gesture = "idle";
      blackjackSim.currentDecision = "EVALUANDO FIRMA QUÍMICA...";
      if (lastTelemetry) renderArena(lastTelemetry);

      // Render parcial inicial en el inspector
      const dealerCardsEl = document.getElementById("dealerCards");
      const dealerScoreEl = document.getElementById("dealerScore");
      const flyCardsEl = document.getElementById("flyCards");
      const flyScoreEl = document.getElementById("flyScore");

      if (dealerCardsEl) dealerCardsEl.innerHTML = `<span class="card">${data.dealer_hand[0]}</span><span class="card">🂠</span>`;
      if (dealerScoreEl) dealerScoreEl.innerText = `Total: ${data.dealer_hand[0]}+?`;
      if (flyCardsEl) flyCardsEl.innerHTML = initialCards.map((c) => `<span class="card">${c}</span>`).join("");
      if (flyScoreEl) flyScoreEl.innerText = `Total: ${blackjackSim.flyTotal}`;

      // 2. Ejecutar secuencialmente cada paso de decisión con su gesto físico correspondiente
      for (let i = 0; i < data.steps_log.length; i++) {
        const step = data.steps_log[i];
        await new Promise((r) => setTimeout(r, 600));

        if (step.decision === "PEDIR CARTA") {
          // GESTO: ¡Alza la pata delantera en alto hacia el croupier!
          blackjackSim.gesture = "raise_arm";
          blackjackSim.currentDecision = "PEDIR CARTA (Hit)";
          blackjackSim.stepLog = `[Mano ${step.score} pts] MBONs: Atracción=${step.mbon_app.toFixed(2)} => ¡ALZA LA PATA!`;
          if (casinoStatusEl) casinoStatusEl.innerText = "¡Alza la pata! Pedir Carta (Hit)";
          if (lastTelemetry) renderArena(lastTelemetry);

          // Pausa para que el usuario aprecie el gesto de alzar la pata
          await new Promise((r) => setTimeout(r, 900));

          // Llega la nueva carta repartida
          const dealtIndex = 2 + i;
          if (dealtIndex < data.fly_hand.length) {
            blackjackSim.flyHand = data.fly_hand.slice(0, dealtIndex + 1);
            blackjackSim.flyTotal = blackjackSim.flyHand.reduce((a, b) => a + b, 0);
            if (flyCardsEl) {
              flyCardsEl.innerHTML = blackjackSim.flyHand.map((c) => `<span class="card">${c}</span>`).join("");
            }
            if (flyScoreEl) flyScoreEl.innerText = `Total: ${blackjackSim.flyTotal}`;
          }
        } else {
          // GESTO: ¡Mueve la pata de lado a lado sobre el paño verde para decir que se planta!
          blackjackSim.gesture = "wave_arm";
          blackjackSim.currentDecision = "PLANTARSE (Stand)";
          blackjackSim.stepLog = `[Mano ${step.score} pts] MBONs: Cautela=${step.mbon_avd.toFixed(2)} => ¡MUEVE LA PATA DE LADO A LADO!`;
          if (casinoStatusEl) casinoStatusEl.innerText = "¡Mueve la pata! Plantarse (Stand)";
          if (lastTelemetry) renderArena(lastTelemetry);

          // Pausa para apreciar el movimiento horizontal de la pata
          await new Promise((r) => setTimeout(r, 1100));
        }
      }

      // 3. El Croupier revela su mano completa y desenlace final
      await new Promise((r) => setTimeout(r, 500));
      blackjackSim.dealerHand = data.dealer_hand;
      blackjackSim.dealerTotal = data.dealer_total;
      blackjackSim.flyHand = data.fly_hand;
      blackjackSim.flyTotal = data.fly_total;

      blackjackSim.lastOutcome = data.outcome;

      if (data.outcome === "VICTORIA") {
        blackjackStats.wins++;
        blackjackStats.streak++;
        const daEarned = 1.5 + Math.min(2.0, blackjackStats.streak * 0.2);
        blackjackStats.accumulatedDopamine += daEarned;
        blackjackSim.gesture = "cheer";
        blackjackSim.currentDecision = `🏆 ¡LA MOSCA GANA! (+${daEarned.toFixed(1)} DA)`;
        if (casinoStatusEl) casinoStatusEl.innerText = `🏆 ¡Victoria! +${daEarned.toFixed(1)} DA`;
        triggerDopamineParticleBurst(arenaCanvas.width / 2, 325);
      } else if (data.outcome === "PASADO_21") {
        blackjackStats.losses++;
        blackjackStats.streak = 0;
        blackjackSim.gesture = "idle";
        blackjackSim.currentDecision = "💥 ¡LA MOSCA SE PASÓ DE 21!";
        if (casinoStatusEl) casinoStatusEl.innerText = "💥 Se pasó de 21";
      } else if (data.outcome === "EMPATE") {
        blackjackSim.gesture = "idle";
        blackjackSim.currentDecision = "⚖️ ¡EMPATE CON EL CROUPIER!";
        if (casinoStatusEl) casinoStatusEl.innerText = "⚖️ Empate con Croupier";
      } else {
        blackjackStats.losses++;
        blackjackStats.streak = 0;
        blackjackSim.gesture = "idle";
        blackjackSim.currentDecision = "❌ ¡LA MOSCA PIERDE!";
        if (casinoStatusEl) casinoStatusEl.innerText = "❌ Croupier gana la mano";
      }

      // Actualizar contadores de victorias, derrotas y racha en el panel lateral y barra de casino
      if (bjWinsCount) bjWinsCount.innerText = blackjackStats.wins;
      if (bjLossesCount) bjLossesCount.innerText = blackjackStats.losses;
      if (bjStreakCount) bjStreakCount.innerText = `${blackjackStats.streak} 🔥`;
      if (bjDopamineStreakFill) {
        const streakPct = Math.min(100, (blackjackStats.accumulatedDopamine / 8.0) * 100);
        bjDopamineStreakFill.style.width = `${streakPct}%`;
      }
      if (bjStreakRewardText) {
        bjStreakRewardText.innerText = `+${blackjackStats.accumulatedDopamine.toFixed(1)} DA (Racha: ${blackjackStats.streak})`;
      }
      syncCasinoBarStats();

      if (lastTelemetry) renderArena(lastTelemetry);

      // Renderizar cartas completas en el inspector
      if (dealerCardsEl) {
        dealerCardsEl.innerHTML = data.dealer_hand.map((c) => `<span class="card">${c}</span>`).join("");
      }
      if (dealerScoreEl) dealerScoreEl.innerText = `Total: ${data.dealer_total}`;

      if (flyCardsEl) {
        flyCardsEl.innerHTML = data.fly_hand.map((c) => `<span class="card">${c}</span>`).join("");
      }
      if (flyScoreEl) flyScoreEl.innerText = `Total: ${data.fly_total}`;

      // Banner de resultado
      const banner = document.getElementById("gameResultBanner");
      if (banner) {
        if (data.outcome === "VICTORIA") {
          banner.innerText = `🏆 ¡VICTORIA DE LA MOSCA! +1.5 Dopamina liberada`;
          banner.style.backgroundColor = "rgba(16, 185, 129, 0.4)";
        } else if (data.outcome === "PASADO_21") {
          banner.innerText = `💥 ¡SE PASÓ DE 21! Señal aversiva PPL1`;
          banner.style.backgroundColor = "rgba(244, 63, 94, 0.4)";
        } else if (data.outcome === "EMPATE") {
          banner.innerText = `⚖️ EMPATE. Mano equilibrada`;
          banner.style.backgroundColor = "rgba(251, 191, 36, 0.3)";
        } else {
          banner.innerText = `❌ DERROTA. Croupier tuvo mejor puntaje`;
          banner.style.backgroundColor = "rgba(244, 63, 94, 0.3)";
        }
      }

      // Log de decisiones
      const logBox = document.getElementById("decisionLog");
      if (logBox) {
        const stepsText = data.steps_log
          .map((s) => `[Mano ${s.score} pts] -> Atracción MBON=${s.mbon_app}, Cautela=${s.mbon_avd} => ${s.decision}`)
          .join("<br>");
        logBox.innerHTML = stepsText;
      }
    } catch (e) {
      console.error("Error jugando ronda de Blackjack:", e);
      if (casinoStatusEl) casinoStatusEl.innerText = "Error en conexión";
    } finally {
      setBlackjackButtonsBusy(false);
    }
  }

  // Eventos de botones
  if (btnSidebarRound) btnSidebarRound.addEventListener("click", playBlackjackRound);
  if (btnCasinoRound) btnCasinoRound.addEventListener("click", playBlackjackRound);

  // Auto-Juego Continuo de Racha
  let autoPlayTimer = null;
  if (btnCasinoAuto) {
    btnCasinoAuto.addEventListener("click", () => {
      if (autoPlayTimer) {
        clearInterval(autoPlayTimer);
        autoPlayTimer = null;
        btnCasinoAuto.classList.remove("active");
        btnCasinoAuto.innerText = "⚡ Auto-Juego";
        if (casinoStatusEl) casinoStatusEl.innerText = "Auto-juego pausado";
      } else {
        btnCasinoAuto.classList.add("active");
        btnCasinoAuto.innerText = "⏸️ Detener Auto";
        playBlackjackRound();
        autoPlayTimer = setInterval(() => {
          if (btnCasinoRound && !btnCasinoRound.disabled) {
            playBlackjackRound();
          }
        }, 3800);
      }
    });
  }

  // Reiniciar Estadísticas
  if (btnCasinoReset) {
    btnCasinoReset.addEventListener("click", () => {
      blackjackStats = { wins: 0, losses: 0, streak: 0, accumulatedDopamine: 0.0 };
      if (bjWinsCount) bjWinsCount.innerText = "0";
      if (bjLossesCount) bjLossesCount.innerText = "0";
      if (bjStreakCount) bjStreakCount.innerText = "0 🔥";
      if (bjDopamineStreakFill) bjDopamineStreakFill.style.width = "0%";
      if (bjStreakRewardText) bjStreakRewardText.innerText = "+0.0 DA";
      syncCasinoBarStats();
      if (casinoStatusEl) casinoStatusEl.innerText = "Estadísticas reiniciadas";
      blackjackSim.lastOutcome = null;
      blackjackSim.dealerHand = [10, 7];
      blackjackSim.dealerTotal = 17;
      blackjackSim.flyHand = [8, 5];
      blackjackSim.flyTotal = 13;
      blackjackSim.currentDecision = "PLANTARSE";
      if (lastTelemetry) renderArena(lastTelemetry);
    });
  }

  // Copiar Código Python
  document.getElementById("btnCopyCode").addEventListener("click", () => {
    const code = document.getElementById("codeSnippet").innerText;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.getElementById("btnCopyCode");
      btn.innerText = "✅ ¡Copiado!";
      setTimeout(() => (btn.innerText = "📋 Copiar Código"), 2000);
    });
  });

  function updateCodeSnippet() {
    const fov = sliderFov.value;
    const ommatidia = sliderOmmatidia.value;
    const sens = sliderSens.value;
    document.getElementById("codeSnippet").innerText = `from moscabrain import FlyAgent

# 1. Instanciar agente con conectoma de FlyWire
fly = FlyAgent()

# 2. Configurar visión
fly.vision.configure(fov_horizontal=${fov}, ommatidia_count=${ommatidia}, sensitivity=${sens})

# 3. Inyectar dopamina o trigger
fly.reward(amount=1.0, reason="azucar")

# 4. Ciclo sensorial-motor
action = fly.step()
print(f"Estado: {action.state.name}, Empuje: {action.forward_thrust}")
`;
  }

  // ============================================================================
  // Herramienta de Testeo, Pausa, Acomodar Mosca y Log Cinemático
  // ============================================================================
  const btnTogglePause = document.getElementById("btnTogglePause");
  const sideBtnTogglePause = document.getElementById("sideBtnTogglePause");
  const btnStepFrame = document.getElementById("btnStepFrame");
  const sideBtnStepFrame = document.getElementById("sideBtnStepFrame");
  const sideBtnResetBias = document.getElementById("sideBtnResetBias");

  if (btnTogglePause) btnTogglePause.addEventListener("click", toggleSimulationPause);
  if (sideBtnTogglePause) sideBtnTogglePause.addEventListener("click", toggleSimulationPause);

  if (btnStepFrame) btnStepFrame.addEventListener("click", stepSimulationSingleFrame);
  if (sideBtnStepFrame) sideBtnStepFrame.addEventListener("click", stepSimulationSingleFrame);

  if (sideBtnResetBias) {
    sideBtnResetBias.addEventListener("click", () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ command: "reset_bias" }));
        sideBtnResetBias.innerText = "✅ Bias En Cero";
        setTimeout(() => sideBtnResetBias.innerText = "🔄 Reset Bias a Cero", 1600);
      }
    });
  }

  // Drawer de Log de Testeo
  const testLogDrawer = document.getElementById("testLogDrawer");
  const btnToggleTestDrawer = document.getElementById("btnToggleTestDrawer");
  const btnCloseTestLogDrawer = document.getElementById("btnCloseTestLogDrawer");
  const btnSideOpenLogDrawer = document.getElementById("btnSideOpenLogDrawer");

  function toggleTestLogDrawer() {
    if (!testLogDrawer) return;
    testLogDrawer.classList.toggle("collapsed");
    if (btnToggleTestDrawer) {
      btnToggleTestDrawer.classList.toggle("active", !testLogDrawer.classList.contains("collapsed"));
    }
  }

  if (btnToggleTestDrawer) btnToggleTestDrawer.addEventListener("click", toggleTestLogDrawer);
  if (btnCloseTestLogDrawer) btnCloseTestLogDrawer.addEventListener("click", toggleTestLogDrawer);
  if (btnSideOpenLogDrawer) {
    btnSideOpenLogDrawer.addEventListener("click", () => {
      if (testLogDrawer && testLogDrawer.classList.contains("collapsed")) {
        toggleTestLogDrawer();
      }
      const drawer = document.getElementById("testLogTableWrapper");
      if (drawer) drawer.scrollTop = drawer.scrollHeight;
    });
  }

  // Botón Auto-Scroll
  const btnToggleAutoScroll = document.getElementById("btnToggleAutoScroll");
  if (btnToggleAutoScroll) {
    btnToggleAutoScroll.addEventListener("click", () => {
      isAutoScrollEnabled = !isAutoScrollEnabled;
      btnToggleAutoScroll.innerText = isAutoScrollEnabled ? "📜 Auto-Scroll: ON" : "📜 Auto-Scroll: OFF";
      btnToggleAutoScroll.classList.toggle("active", isAutoScrollEnabled);
    });
  }

  // Limpiar Log
  const btnClearTestLog = document.getElementById("btnClearTestLog");
  if (btnClearTestLog) {
    btnClearTestLog.addEventListener("click", () => {
      testLogBuffer = [];
      const tbody = document.getElementById("testLogBody");
      if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="11">Log reiniciado. Esperando telemetría...</td></tr>';
      const miniList = document.getElementById("miniLogList");
      if (miniList) miniList.innerHTML = '<div class="empty-hint">Log reiniciado.</div>';
      const countEl = document.getElementById("testLogCount");
      if (countEl) countEl.innerText = "0 pasos";
    });
  }

  // Copiar y Exportar Log
  const btnCopyTestLog = document.getElementById("btnCopyTestLog");
  if (btnCopyTestLog) btnCopyTestLog.addEventListener("click", copyTestLogTsv);
  const btnExportTestLogCsv = document.getElementById("btnExportTestLogCsv");
  if (btnExportTestLogCsv) btnExportTestLogCsv.addEventListener("click", exportTestLogCsv);

  // Sliders y números para acomodar la posición y orientación de la mosca
  const sliderFlyX = document.getElementById("sliderFlyX");
  const numFlyX = document.getElementById("numFlyX");
  const sliderFlyY = document.getElementById("sliderFlyY");
  const numFlyY = document.getElementById("numFlyY");
  const sliderFlyAngle = document.getElementById("sliderFlyAngle");
  const numFlyAngle = document.getElementById("numFlyAngle");

  function sendPoseUpdateFromUI() {
    const x = parseFloat(sliderFlyX.value);
    const y = parseFloat(sliderFlyY.value);
    const angleDeg = parseFloat(sliderFlyAngle.value);
    const angleRad = (angleDeg * Math.PI) / 180.0;

    syncFlyPoseInputs(x, y, angleRad);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        command: "set_fly_pose",
        x: x,
        y: y,
        angle: angleRad,
        reset_bias: true,
      }));
    }
  }

  function bindPoseControl(slider, num, isAngle = false) {
    if (!slider || !num) return;
    const onStart = () => { isUserInteractingWithPose = true; };
    const onEnd = () => {
      setTimeout(() => { isUserInteractingWithPose = false; }, 300);
    };

    slider.addEventListener("mousedown", onStart);
    slider.addEventListener("touchstart", onStart);
    slider.addEventListener("mouseup", onEnd);
    slider.addEventListener("touchend", onEnd);

    slider.addEventListener("input", () => {
      num.value = slider.value;
      sendPoseUpdateFromUI();
    });

    num.addEventListener("focus", onStart);
    num.addEventListener("blur", onEnd);
    num.addEventListener("input", () => {
      slider.value = num.value;
      sendPoseUpdateFromUI();
    });
  }

  bindPoseControl(sliderFlyX, numFlyX, false);
  bindPoseControl(sliderFlyY, numFlyY, false);
  bindPoseControl(sliderFlyAngle, numFlyAngle, true);

  // Presets Rápidos de Orientación y Escenario
  function applyPosePreset(targetAngleDeg) {
    if (!lastTelemetry || !lastTelemetry.fly || !lastTelemetry.fly.position) return;
    const fx = lastTelemetry.fly.position.x;
    const fy = lastTelemetry.fly.position.y;
    const angleRad = (targetAngleDeg * Math.PI) / 180.0;

    syncFlyPoseInputs(fx, fy, angleRad);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        command: "set_fly_pose",
        x: fx,
        y: fy,
        angle: angleRad,
        reset_bias: true,
      }));
    }
  }

  const btnPreset0Front = document.getElementById("btnPreset0Front");
  if (btnPreset0Front) {
    btnPreset0Front.addEventListener("click", () => {
      const food = findNearestFoodOrCoords();
      const fx = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.x : 400;
      const fy = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.y : 300;
      const angleDeg = Math.round(Math.atan2(food.y - fy, food.x - fx) * 180 / Math.PI);
      applyPosePreset(angleDeg);
    });
  }

  const btnPreset90Right = document.getElementById("btnPreset90Right");
  if (btnPreset90Right) {
    btnPreset90Right.addEventListener("click", () => {
      const food = findNearestFoodOrCoords();
      const fx = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.x : 400;
      const fy = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.y : 300;
      const toFood = Math.atan2(food.y - fy, food.x - fx) * 180 / Math.PI;
      // Mosca orientada de tal manera que la gota queda 90° a su DERECHA (head = toFood - 90)
      const targetDeg = Math.round(toFood - 90);
      applyPosePreset(targetDeg);
    });
  }

  const btnPreset90Left = document.getElementById("btnPreset90Left");
  if (btnPreset90Left) {
    btnPreset90Left.addEventListener("click", () => {
      const food = findNearestFoodOrCoords();
      const fx = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.x : 400;
      const fy = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.y : 300;
      const toFood = Math.atan2(food.y - fy, food.x - fx) * 180 / Math.PI;
      // Mosca orientada de tal manera que la gota queda 90° a su IZQUIERDA (head = toFood + 90)
      const targetDeg = Math.round(toFood + 90);
      applyPosePreset(targetDeg);
    });
  }

  const btnPreset180Back = document.getElementById("btnPreset180Back");
  if (btnPreset180Back) {
    btnPreset180Back.addEventListener("click", () => {
      const food = findNearestFoodOrCoords();
      const fx = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.x : 400;
      const fy = lastTelemetry && lastTelemetry.fly ? lastTelemetry.fly.position.y : 300;
      const toFood = Math.atan2(food.y - fy, food.x - fx) * 180 / Math.PI;
      const targetDeg = Math.round(toFood + 180);
      applyPosePreset(targetDeg);
    });
  }

  const btnPresetSpawnFoodFront = document.getElementById("btnPresetSpawnFoodFront");
  if (btnPresetSpawnFoodFront) {
    btnPresetSpawnFoodFront.addEventListener("click", () => {
      if (!lastTelemetry || !lastTelemetry.fly || !lastTelemetry.fly.position) return;
      const fx = lastTelemetry.fly.position.x;
      const fy = lastTelemetry.fly.position.y;
      const fa = lastTelemetry.fly.position.angle;
      const dist = 130;
      const foodX = Math.max(30, Math.min(arenaCanvas.width - 30, fx + dist * Math.cos(fa)));
      const foodY = Math.max(30, Math.min(arenaCanvas.height - 30, fy + dist * Math.sin(fa)));

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          command: "add_food",
          x: foodX,
          y: foodY,
          radius: 14,
        }));
      }
    });
  }

  // Teclas rápidas globales: Espacio = Pausar/Reanudar, . = Avanzar 1 Paso
  window.addEventListener("keydown", (e) => {
    if (currentTab === "olfaction" || currentTab === "blackjack") return;
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    if (activeTag === "input" || activeTag === "select" || activeTag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      toggleSimulationPause();
    } else if (e.key === "." || e.key === "p" || e.key === "P") {
      e.preventDefault();
      stepSimulationSingleFrame();
    }
  });
});
