import { BRAIN_LAYOUT, BRAIN_EDGES, TelemetryData, BlackjackSimState } from "./constants";

// Partículas de dopamina
interface DopamineParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

export class ParticleManager {
  private particles: DopamineParticle[] = [];

  triggerBurst(x: number, y: number, count = 28) {
    const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#fbbf24"];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        size: 2.5 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= 0.024;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export const globalParticles = new ParticleManager();

// ============================================================================
// Renderizado de la Arena 2D
// ============================================================================
export interface ArenaRenderOptions {
  data: TelemetryData | null;
  currentTool: string;
  isSimPaused: boolean;
  isDraggingFlyAngle: boolean;
  draggedElement: { type: string; id?: string; currentX: number; currentY: number } | null;
  mousePos: { x: number; y: number } | null;
}

export function renderArena(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: ArenaRenderOptions
) {
  const { data, currentTool, isSimPaused, isDraggingFlyAngle, draggedElement, mousePos } = options;

  ctx.clearRect(0, 0, w, h);

  // Cuadrícula sutil cibernética
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (!data) return;

  // 1. Fuentes de luz
  if (data.lights) {
    data.lights.forEach((light) => {
      const grad = ctx.createRadialGradient(light.x, light.y, 5, light.x, light.y, 140);
      grad.addColorStop(0, "rgba(251, 191, 36, 0.35)");
      grad.addColorStop(1, "rgba(251, 191, 36, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(light.x, light.y, 140, 0, Math.PI * 2);
      ctx.fill();

      // Foco central
      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(light.x, light.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  // 2. Gotas de sacarosa (Comida)
  if (data.foods) {
    data.foods.forEach((food) => {
      const radius = food.radius || 12;
      // Brillo exterior
      ctx.fillStyle = "rgba(16, 185, 129, 0.22)";
      ctx.beginPath();
      ctx.arc(food.x, food.y, radius + 6, 0, Math.PI * 2);
      ctx.fill();

      // Gota dulce
      const grad = ctx.createRadialGradient(food.x - 3, food.y - 3, 2, food.x, food.y, radius);
      grad.addColorStop(0, "#a7f3d0");
      grad.addColorStop(1, "#059669");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(food.x, food.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  // 3. Sombras de depredador (Threats)
  if (data.threats) {
    data.threats.forEach((threat, i) => {
      const isLatest = i === data.threats.length - 1;

      // Anillos concéntricos de alerta
      ctx.strokeStyle = isLatest ? "rgba(244, 63, 94, 0.75)" : "rgba(244, 63, 94, 0.35)";
      ctx.lineWidth = isLatest ? 2 : 1;
      ctx.beginPath();
      ctx.arc(threat.x, threat.y, threat.radius + 12, 0, Math.PI * 2);
      ctx.stroke();

      // Núcleo de sombra
      const grad = ctx.createRadialGradient(threat.x, threat.y, 4, threat.x, threat.y, threat.radius);
      grad.addColorStop(0, "rgba(244, 63, 94, 0.85)");
      grad.addColorStop(1, "rgba(20, 24, 33, 0.95)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(threat.x, threat.y, threat.radius, 0, Math.PI * 2);
      ctx.fill();

      // Mira en la sombra controlable
      if (isLatest) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(threat.x, threat.y, threat.radius + 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cruceta
        ctx.beginPath();
        ctx.moveTo(threat.x - 6, threat.y);
        ctx.lineTo(threat.x + 6, threat.y);
        ctx.moveTo(threat.x, threat.y - 6);
        ctx.lineTo(threat.x, threat.y + 6);
        ctx.stroke();
        ctx.restore();
      }
    });
  }

  // 4. Agente Mosca
  if (data.fly && data.fly.position) {
    const fx = data.fly.position.x;
    const fy = data.fly.position.y;
    const angle = data.fly.position.angle;
    const action = data.action || { forward_thrust: 0, turn_yaw: 0, wingbeat_hz: 0 };

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);

    // Cono de campo visual (FOV)
    const fovDeg = (data.fly.vision && data.fly.vision.fov) || 270;
    const halfFov = (fovDeg * Math.PI) / 360;
    ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 90, -halfFov, halfFov);
    ctx.closePath();
    ctx.fill();

    // Alas (vibran si batido > 0 o salto)
    const wingAngle = action.wingbeat_hz > 0 ? Math.sin(Date.now() * 0.08) * 0.4 : 0.15;
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;

    // Ala izquierda
    ctx.save();
    ctx.translate(-4, -6);
    ctx.rotate(-0.4 - wingAngle);
    ctx.beginPath();
    ctx.ellipse(-8, -12, 5, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Ala derecha
    ctx.save();
    ctx.translate(-4, 6);
    ctx.rotate(0.4 + wingAngle);
    ctx.beginPath();
    ctx.ellipse(-8, 12, 5, 14, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Abdomen segmentado
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(-12, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tórax
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(-2, 0, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ojos compuestos (rojos característicos)
    ctx.fillStyle = "#dc2626";
    // Ojo izquierdo
    ctx.beginPath();
    ctx.arc(6, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Ojo derecho
    ctx.beginPath();
    ctx.arc(6, 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Probóscide extendida si come
    if (action.proboscis_extended) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();
    }

    ctx.restore();

    // Gizmo interactivo para rotación y postura
    const isInteractingFly =
      isSimPaused ||
      currentTool === "drag" ||
      isDraggingFlyAngle ||
      (draggedElement && draggedElement.type === "fly");

    if (isInteractingFly) {
      ctx.save();
      ctx.translate(fx, fy);

      // Círculo guía
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vector de dirección
      const hx = 36 * Math.cos(angle);
      const hy = 36 * Math.sin(angle);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(hx, hy);
      ctx.stroke();

      // Tirador de rotación frontal
      ctx.fillStyle = isDraggingFlyAngle ? "#10b981" : "#38bdf8";
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }
  }

  // Zona de papelera para soltar elementos arrastrados
  if (draggedElement && mousePos) {
    drawTrashDropzone(ctx, w, h, mousePos.x, mousePos.y);
  }

  // Partículas de dopamina
  globalParticles.render(ctx);
}

function drawTrashDropzone(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mx: number,
  my: number
) {
  const zoneW = 150;
  const zoneH = 46;
  const zoneX = w - zoneW - 14;
  const zoneY = h - zoneH - 14;

  const isHover = mx >= zoneX && mx <= zoneX + zoneW && my >= zoneY && my <= zoneY + zoneH;

  ctx.save();
  ctx.fillStyle = isHover ? "rgba(244, 63, 94, 0.35)" : "rgba(244, 63, 94, 0.15)";
  ctx.strokeStyle = isHover ? "#f43f5e" : "rgba(244, 63, 94, 0.5)";
  ctx.lineWidth = isHover ? 2 : 1;
  ctx.fillRect(zoneX, zoneY, zoneW, zoneH);
  ctx.strokeRect(zoneX, zoneY, zoneW, zoneH);

  ctx.fillStyle = isHover ? "#fff" : "#fca5a5";
  ctx.font = "600 11px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SOLTAR PARA BORRAR", zoneX + zoneW / 2, zoneY + zoneH / 2);
  ctx.restore();
}

// ============================================================================
// Renderizado de Mesa de Casino Blackjack 21
// ============================================================================
export function renderBlackjackTable(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sim: BlackjackSimState
) {
  ctx.clearRect(0, 0, w, h);

  // 1. Paño de mesa verde esmeralda
  const feltGrad = ctx.createRadialGradient(w / 2, h * 0.45, 60, w / 2, h * 0.45, w * 0.7);
  feltGrad.addColorStop(0, "#065f46");
  feltGrad.addColorStop(0.7, "#044332");
  feltGrad.addColorStop(1, "#022c22");
  ctx.fillStyle = feltGrad;
  ctx.fillRect(0, 0, w, h);

  // Borde caoba recto
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Línea semicircular de paño
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.35, w * 0.4, 0, Math.PI);
  ctx.stroke();

  // Tipografía en el paño (sin emojis)
  ctx.fillStyle = "rgba(251, 191, 36, 0.4)";
  ctx.font = "700 12px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText("CASINO DROSOPHILA · 21 (BLACKJACK BIOFÍSICO)", w / 2, 28);
  ctx.font = "10px Outfit, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fillText("FIRMAS QUÍMICAS DE CARTAS DETECTADAS POR EL LÓBULO ANTENAL", w / 2, 43);

  // 2. Cartas del Croupier
  const dealerCards = sim.dealerHand || [10, 7];
  const dealerTotal = sim.dealerTotal || 17;
  const startDx = w / 2 - (dealerCards.length * 52) / 2;

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.font = "600 11px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`MANO CROUPIER: ${dealerTotal} PTS`, w / 2, 63);

  dealerCards.forEach((cardVal, i) => {
    const cx = startDx + i * 52;
    const cy = 72;
    drawCard(ctx, cx, cy, cardVal, i % 2 === 0 ? "S" : "C", "#0f172a");
  });

  // 3. Estelas de aromas químicos flotando
  renderCardAromaPlumes(ctx, w / 2, 138, w / 2, 285);

  // 4. Cartas de la Mosca
  const flyCards = sim.flyHand || [8, 5];
  const flyTotal = sim.flyTotal || 13;
  const startFx = w / 2 - (flyCards.length * 52) / 2;

  ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
  ctx.font = "600 12px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`MANO MOSCA: ${flyTotal} PTS`, w / 2, 158);

  flyCards.forEach((cardVal, i) => {
    const cx = startFx + i * 52;
    const cy = 168;
    drawCard(ctx, cx, cy, cardVal, i % 2 === 0 ? "H" : "D", "#b91c1c");
  });

  // 5. La Mosca de la Fruta Sentada
  const flyX = w / 2;
  const flyY = 325;
  drawBlackjackFly(ctx, flyX, flyY, sim.gesture);

  // 6. Bocadillo de decisión
  drawDecisionCallout(ctx, flyX + 175, flyY - 20, sim.gesture, sim.currentDecision);

  // 7. Banner de desenlace
  if (sim.lastOutcome) {
    drawOutcomeHeroBanner(ctx, w / 2, 120, sim.lastOutcome);
  }

  // 8. Partículas de dopamina
  globalParticles.render(ctx);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  val: string | number,
  suit: string,
  color: string
) {
  const cw = 44;
  const ch = 62;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Cara blanca de la carta con borde recto
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, cw, ch);
  ctx.shadowColor = "transparent";

  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, cw, ch);

  ctx.fillStyle = color;
  ctx.font = "700 16px Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(val), x + cw / 2, y + ch / 2 - 6);

  ctx.font = "600 11px JetBrains Mono, monospace";
  ctx.fillText(suit, x + cw / 2, y + ch / 2 + 15);
  ctx.restore();
}

function drawBlackjackFly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gesture: string
) {
  ctx.save();
  ctx.translate(x, y);
  const s = 2.0;
  ctx.scale(s, s);

  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  // Patas traseras y medias
  ctx.beginPath();
  ctx.moveTo(-6, 8);
  ctx.lineTo(-24, 18);
  ctx.lineTo(-30, 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(6, 8);
  ctx.lineTo(24, 18);
  ctx.lineTo(30, 30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.lineTo(-26, 4);
  ctx.lineTo(-32, 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8, 2);
  ctx.lineTo(26, 4);
  ctx.lineTo(32, 12);
  ctx.stroke();

  // Pata delantera izquierda
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-22, -22);
  ctx.stroke();

  // Pata delantera derecha que hace el gesto
  ctx.lineWidth = 2.4;
  if (gesture === "raise_arm") {
    // Alzar pata (Hit)
    ctx.strokeStyle = "#38bdf8";
    const wave = Math.sin(Date.now() * 0.018) * 5;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(16, -26 + wave);
    ctx.lineTo(24, -46 + wave);
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(24, -46 + wave, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(24, -46 + wave, 9, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
  } else if (gesture === "wave_arm") {
    // Mover pata horizontalmente (Stand)
    ctx.strokeStyle = "#fbbf24";
    const sweepX = Math.sin(Date.now() * 0.014) * 20;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(14 + sweepX * 0.5, -16);
    ctx.lineTo(18 + sweepX, -24);
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(18 + sweepX, -24, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-2, -24);
    ctx.lineTo(38, -24);
    ctx.stroke();
  } else {
    // Reposo
    ctx.strokeStyle = "#64748b";
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(18, -16);
    ctx.lineTo(22, -22);
    ctx.stroke();
  }

  // Cuerpo: abdomen
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.ellipse(0, 14, 10, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tórax
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(0, -2, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ojos compuestos
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(-7, -12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(7, -12, 4, 0, Math.PI * 2);
  ctx.fill();

  // Cabeza
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, -13, 5, 0, Math.PI * 2);
  ctx.fill();

  // Alas
  const wingLift = gesture === "cheer" ? 0.5 : 0.05;
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1;

  ctx.save();
  ctx.translate(-4, 2);
  ctx.rotate(-0.35 - wingLift);
  ctx.beginPath();
  ctx.ellipse(-10, 16, 6, 20, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(4, 2);
  ctx.rotate(0.35 + wingLift);
  ctx.beginPath();
  ctx.ellipse(10, 16, 6, 20, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawDecisionCallout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  gesture: string,
  decision: string
) {
  const boxW = 160;
  const boxH = 50;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  const isHit = gesture === "raise_arm";
  const isStand = gesture === "wave_arm";
  const borderColor = isHit ? "#38bdf8" : isStand ? "#fbbf24" : "rgba(255, 255, 255, 0.2)";

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
  ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 10px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.fillText("DECISIÓN CONECTOMA", x, y - 8);

  ctx.fillStyle = isHit ? "#38bdf8" : isStand ? "#fbbf24" : "#f1f5f9";
  ctx.font = "700 12px Outfit, sans-serif";
  ctx.fillText(decision || "EN ESPERA", x, y + 12);

  ctx.restore();
}

function drawOutcomeHeroBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  outcome: string
) {
  const bw = 380;
  const bh = 54;

  ctx.save();
  let bg = "rgba(16, 185, 129, 0.9)";
  let text = "VICTORIA DE LA MOSCA (+1.5 DA)";
  if (outcome === "PASADO_21") {
    bg = "rgba(244, 63, 94, 0.9)";
    text = "SE PASÓ DE 21 (CASTIGO AVERSIVO)";
  } else if (outcome === "DERROTA") {
    bg = "rgba(244, 63, 94, 0.9)";
    text = "DERROTA FRENTE AL CROUPIER";
  } else if (outcome === "EMPATE") {
    bg = "rgba(251, 191, 36, 0.9)";
    text = "EMPATE CON EL CROUPIER";
  }

  ctx.fillStyle = bg;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
  ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);

  ctx.fillStyle = "#090d13";
  ctx.font = "700 14px JetBrains Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);

  ctx.restore();
}

function renderCardAromaPlumes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fx: number,
  fy: number
) {
  const time = Date.now() * 0.002;
  ctx.save();
  ctx.strokeStyle = "rgba(168, 85, 247, 0.25)";
  ctx.lineWidth = 1.5;

  for (let i = -2; i <= 2; i++) {
    const offset = i * 18;
    ctx.beginPath();
    ctx.moveTo(cx + offset, cy);
    const wave = Math.sin(time + i) * 16;
    ctx.quadraticCurveTo(cx + offset + wave, (cy + fy) / 2, fx + offset * 0.4, fy);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================================
// Renderizado del Conectoma Neural (Grafo 2D)
// ============================================================================
export function drawBrainGraph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: TelemetryData | null
) {
  ctx.clearRect(0, 0, w, h);
  if (!data) return;

  const groups = data.fly?.brain?.groups || {};
  const dopamineLevel = data.fly?.dopamine?.current_level || 0.0;

  const scaleX = w / 480;
  const scaleY = h / 320;

  // 1. Sinapsis
  BRAIN_EDGES.forEach(([src, dst]) => {
    const p1 = BRAIN_LAYOUT[src];
    const p2 = BRAIN_LAYOUT[dst];
    if (!p1 || !p2) return;

    const act1 = groups[src] ? groups[src].firing_rate : 0;
    const isLit = act1 > 0.05 || (src === "MB_PAM_DA" && dopamineLevel > 0.2);

    ctx.beginPath();
    ctx.moveTo(p1.x * scaleX, p1.y * scaleY);
    ctx.lineTo(p2.x * scaleX, p2.y * scaleY);
    ctx.strokeStyle = isLit ? "rgba(56, 189, 248, 0.65)" : "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = isLit ? 2 : 1;
    ctx.stroke();
  });

  // 2. Nodos
  Object.entries(BRAIN_LAYOUT).forEach(([name, node]) => {
    const gData = groups[name] || { firing_rate: 0 };
    const act = gData.firing_rate;
    const isDA = name === "MB_PAM_DA" && dopamineLevel > 0.1;
    const nx = node.x * scaleX;
    const ny = node.y * scaleY;

    if (act > 0.05 || isDA) {
      ctx.fillStyle = isDA ? "rgba(16, 185, 129, 0.4)" : "rgba(56, 189, 248, 0.35)";
      ctx.beginPath();
      ctx.arc(nx, ny, isDA ? 14 * scaleY : 10 * scaleY, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = isDA ? "#10b981" : act > 0.05 ? "#fff" : node.color;
    ctx.beginPath();
    ctx.arc(nx, ny, 5.5 * Math.min(scaleX, scaleY), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    const fontSize = Math.max(8, Math.round(9 * Math.min(scaleX, scaleY)));
    ctx.font = `600 ${fontSize}px JetBrains Mono, monospace`;
    ctx.fillText(node.label, nx - 16 * scaleX, ny + 13 * scaleY);
  });
}
