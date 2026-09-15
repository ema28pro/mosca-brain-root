import React from "react";
import { TelemetryData } from "../utils/constants";

interface TelemetryBarProps {
  telemetry: TelemetryData | null;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({ telemetry }) => {
  const action = telemetry?.action || {
    forward_thrust: 0,
    turn_yaw: 0,
    wingbeat_hz: 0,
    proboscis_extended: false,
    escape_jump: false,
  };

  const thrust = action.forward_thrust || 0;
  const yaw = action.turn_yaw || 0;
  const wbf = action.wingbeat_hz || 0;
  const isFeeding = Boolean(action.proboscis_extended);
  const isEscape = Boolean(action.escape_jump);

  const yawWidth = Math.min(50, Math.abs(yaw) * 50);
  const yawLeft = yaw >= 0 ? 50 : 50 - yawWidth;

  return (
    <div className="telemetry-bar">
      <div className="telem-item">
        <span className="telem-label">Avance (Empuje)</span>
        <div className="meter-bar">
          <div className="meter-fill" style={{ width: `${Math.min(100, thrust * 100)}%` }} />
        </div>
        <span className="telem-val">{thrust.toFixed(2)}</span>
      </div>

      <div className="telem-item">
        <span className="telem-label">Giro Angular (Yaw)</span>
        <div className="meter-bar">
          <div
            className="meter-fill steer"
            style={{
              position: "absolute",
              left: `${yawLeft}%`,
              width: `${yawWidth}%`,
            }}
          />
        </div>
        <span className="telem-val">
          {yaw >= 0 ? "+" : ""}
          {yaw.toFixed(2)}
        </span>
      </div>

      <div className="telem-item">
        <span className="telem-label">Batido Alas (WBF)</span>
        <span
          className="telem-badge"
          style={{ color: wbf > 0 ? "var(--accent-gold)" : "var(--text-muted)" }}
        >
          {wbf.toFixed(1)} Hz
        </span>
      </div>

      <div className="telem-item">
        <span className="telem-label">Probóscide</span>
        <span
          className="telem-badge"
          style={{ color: isFeeding ? "var(--accent-green)" : "var(--text-muted)" }}
        >
          {isFeeding ? "EXTENDIDA (ALIMENTO)" : "RETRAÍDA"}
        </span>
      </div>

      <div className="telem-item">
        <span className="telem-label">Salto de Escape (GF)</span>
        <span
          className="telem-badge"
          style={{ color: isEscape ? "var(--accent-red)" : "var(--text-muted)" }}
        >
          {isEscape ? "SALTO ACTIVADO" : "INACTIVO"}
        </span>
      </div>
    </div>
  );
};
