import React, { useRef, useEffect } from "react";
import { TelemetryData } from "../../utils/constants";
import { drawBrainGraph } from "../../utils/canvasRenderer";

interface ConnectomeTabProps {
  telemetry: TelemetryData | null;
}

export const ConnectomeTab: React.FC<ConnectomeTabProps> = ({ telemetry }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBrainGraph(ctx, canvas.width, canvas.height, telemetry);
  }, [telemetry]);

  const da = telemetry?.fly?.dopamine || { current_level: 0, total_rewards: 0, total_punishments: 0 };
  const daLevel = da.current_level || 0;
  const pct = Math.min(100, (daLevel / 2.5) * 100);

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Circuitos Funcionales de FlyWire</h3>
        <span className="tag">LIF Dynamics + Plasticidad DA</span>
      </div>

      <div className="connectome-visualizer">
        <canvas ref={canvasRef} width={480} height={320} />
      </div>

      <div className="circuit-legend">
        <span className="legend-item">
          <span className="dot optic" /> Lóbulo Óptico
        </span>
        <span className="legend-item">
          <span className="dot antennal" /> Lóbulo Antenal
        </span>
        <span className="legend-item">
          <span className="dot compass" /> Complejo Central
        </span>
        <span className="legend-item">
          <span className="dot mb" /> Mushroom Body
        </span>
        <span className="legend-item">
          <span className="dot pam" /> Dopamina (PAM/PPL1)
        </span>
        <span className="legend-item">
          <span className="dot motor" /> Descendentes (DNs)
        </span>
      </div>

      <div className="dopamine-gauge-card">
        <div className="gauge-header">
          <span>Nivel de Dopamina Extracelular</span>
          <span className="gauge-number">{daLevel.toFixed(2)} / 2.50 DA</span>
        </div>
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="gauge-footer">
          <span>Recompensas: <strong>{da.total_rewards.toFixed(1)}</strong></span>
          <span>Castigos: <strong>{da.total_punishments.toFixed(1)}</strong></span>
        </div>
      </div>
    </div>
  );
};
