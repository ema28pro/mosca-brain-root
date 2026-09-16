import React, { useState, useEffect } from "react";
import { Play, Pause, StepForward, RotateCcw, Table } from "lucide-react";
import { TelemetryData, TestLogEntry } from "../../utils/constants";

interface TestPoseTabProps {
  telemetry: TelemetryData | null;
  isPaused: boolean;
  logEntries: TestLogEntry[];
  onTogglePause: () => void;
  onStepFrame: () => void;
  onResetBias: () => void;
  onSetFlyPose: (x: number, y: number, angleDeg: number) => void;
  onApplyPreset: (type: "front" | "right90" | "left90" | "back180" | "spawnFood") => void;
  onOpenLogDrawer: () => void;
}

export const TestPoseTab: React.FC<TestPoseTabProps> = ({
  telemetry,
  isPaused,
  logEntries,
  onTogglePause,
  onStepFrame,
  onResetBias,
  onSetFlyPose,
  onApplyPreset,
  onOpenLogDrawer,
}) => {
  const pos = telemetry?.fly?.position || { x: 400, y: 300, angle: 0 };
  const angleDeg = Math.round(((pos.angle * 180 / Math.PI) % 360 + 360) % 360);

  const [posX, setPosX] = useState(pos.x);
  const [posY, setPosY] = useState(pos.y);
  const [angle, setAngle] = useState(angleDeg);

  useEffect(() => {
    setPosX(Math.round(pos.x));
    setPosY(Math.round(pos.y));
    setAngle(angleDeg);
  }, [pos.x, pos.y, angleDeg]);

  const handleX = (val: number) => {
    setPosX(val);
    onSetFlyPose(val, posY, angle);
  };

  const handleY = (val: number) => {
    setPosY(val);
    onSetFlyPose(posX, val, angle);
  };

  const handleAngle = (val: number) => {
    setAngle(val);
    onSetFlyPose(posX, posY, val);
  };

  const getCardinal = (deg: number) => {
    const norm = ((deg % 360) + 360) % 360;
    if (norm >= 337.5 || norm < 22.5) return `${norm}° (Este)`;
    if (norm >= 22.5 && norm < 67.5) return `${norm}° (Sureste)`;
    if (norm >= 67.5 && norm < 112.5) return `${norm}° (Sur)`;
    if (norm >= 112.5 && norm < 157.5) return `${norm}° (Suroeste)`;
    if (norm >= 157.5 && norm < 202.5) return `${norm}° (Oeste)`;
    if (norm >= 202.5 && norm < 247.5) return `${norm}° (Noroeste)`;
    if (norm >= 247.5 && norm < 292.5) return `${norm}° (Norte)`;
    return `${norm}° (Noreste)`;
  };

  const diag = telemetry?.diagnostics || {};
  const nearest = diag.nearest_food || null;

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Herramienta de Testeo y Postura</h3>
        <span className="tag">{isPaused ? "PAUSADO" : "EN SIMULACIÓN"}</span>
      </div>

      {/* Control de Ejecución */}
      <div className="test-card">
        <div className="test-card-header">
          <h4>Control de Ejecución</h4>
        </div>
        <div className="test-playback-row">
          <button
            className={`btn ${isPaused ? "btn-primary" : "btn-secondary"}`}
            onClick={onTogglePause}
          >
            {isPaused ? <Play size={12} /> : <Pause size={12} />}
            <span>{isPaused ? "REANUDAR" : "PAUSAR"}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onStepFrame}
            disabled={!isPaused}
            title="Avanzar 1 Paso cuando está pausado [Tecla .]"
          >
            <StepForward size={12} />
            <span>+1 PASO</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={onResetBias}
            title="Restablecer potenciales de membrana a reposo"
          >
            <RotateCcw size={12} />
            <span>RESET BIAS</span>
          </button>
        </div>
      </div>

      {/* Acomodar Mosca */}
      <div className="test-card">
        <div className="test-card-header">
          <h4>Acomodar Postura de la Mosca</h4>
          <span className="cardinal-badge">
            ({Math.round(posX)}, {Math.round(posY)}) · {angle}°
          </span>
        </div>
        <div className="config-group" style={{ gap: "6px" }}>
          <div className="control-row">
            <label>Posición X (px):</label>
            <input
              type="range"
              min="20"
              max="780"
              value={posX}
              onChange={(e) => handleX(parseFloat(e.target.value))}
            />
            <input
              type="number"
              className="mini-num-input"
              value={posX}
              onChange={(e) => handleX(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="control-row">
            <label>Posición Y (px):</label>
            <input
              type="range"
              min="20"
              max="440"
              value={posY}
              onChange={(e) => handleY(parseFloat(e.target.value))}
            />
            <input
              type="number"
              className="mini-num-input"
              value={posY}
              onChange={(e) => handleY(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="control-row">
            <label>Orientación θ:</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={angle > 180 ? angle - 360 : angle}
              onChange={(e) => handleAngle(parseFloat(e.target.value))}
            />
            <div className="angle-display">
              <input
                type="number"
                className="mini-num-input"
                value={angle}
                onChange={(e) => handleAngle(parseFloat(e.target.value) || 0)}
              />
              <span className="cardinal-badge">{getCardinal(angle)}</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
          Presets de Orientación Respecto a la Gota:
        </div>
        <div className="pose-presets-grid">
          <button className="btn-preset" onClick={() => onApplyPreset("right90")}>
            90° Lateral Der.
          </button>
          <button className="btn-preset" onClick={() => onApplyPreset("left90")}>
            90° Lateral Izq.
          </button>
          <button className="btn-preset" onClick={() => onApplyPreset("front")}>
            0° Frontal (De Frente)
          </button>
          <button className="btn-preset" onClick={() => onApplyPreset("back180")}>
            180° Opuesta (De Espaldas)
          </button>
          <button className="btn-preset highlight" onClick={() => onApplyPreset("spawnFood")}>
            + Gota Frente a Mosca
          </button>
        </div>
      </div>

      {/* Telemetría Instantánea */}
      <div className="test-card">
        <div className="test-card-header">
          <h4>Lectura Instantánea</h4>
        </div>
        <div className="instant-telemetry-grid">
          <div className="metric-box">
            <span className="metric-label">Dist. Gota</span>
            <span className="metric-val">{nearest ? `${nearest.dist.toFixed(1)} px` : "--"}</span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Error Angular</span>
            <span className="metric-val">
              {nearest ? `${nearest.angle_err_deg > 0 ? "+" : ""}${nearest.angle_err_deg.toFixed(0)}°` : "--"}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Contraste</span>
            <span className="metric-val">
              {diag.contrast_norm !== undefined
                ? `${diag.contrast_norm > 0 ? "+" : ""}${diag.contrast_norm.toFixed(2)}`
                : "--"}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Antenas (L / R)</span>
            <span className="metric-val">
              {diag.antenna_left_c !== undefined
                ? `${diag.antenna_left_c.toFixed(2)} / ${diag.antenna_right_c?.toFixed(2)}`
                : "--"}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Motores P9</span>
            <span className="metric-val">
              {diag.p9_left_rate !== undefined
                ? `${diag.p9_left_rate.toFixed(2)} / ${diag.p9_right_rate?.toFixed(2)}`
                : "--"}
            </span>
          </div>
          <div className="metric-box">
            <span className="metric-label">Giro DNa</span>
            <span className="metric-val">
              {diag.dna_left_rate !== undefined
                ? `${diag.dna_left_rate.toFixed(2)} / ${diag.dna_right_rate?.toFixed(2)}`
                : "--"}
            </span>
          </div>
        </div>
      </div>

      {/* Historial Reciente */}
      <div className="test-card">
        <div className="test-card-header">
          <h4>Historial del Log ({logEntries.length})</h4>
          <button className="mini-btn" onClick={onOpenLogDrawer}>
            <Table size={10} />
            <span>VER TABLA</span>
          </button>
        </div>
        <div style={{ maxHeight: "80px", overflowY: "auto", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
          {logEntries.slice(-4).reverse().map((e) => (
            <div key={e.step} style={{ padding: "2px 0", borderBottom: "1px solid var(--panel-border-subtle)" }}>
              #{e.step} ({e.x}, {e.y}) {e.angleDeg}° · {e.badgeText}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
