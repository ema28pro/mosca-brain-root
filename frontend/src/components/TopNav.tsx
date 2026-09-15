import React from "react";
import { Sparkles, Zap, Cpu } from "lucide-react";
import { TelemetryData } from "../utils/constants";

interface TopNavProps {
  isConnected: boolean;
  fpsText: string;
  telemetry: TelemetryData | null;
  onRewardManual: () => void;
  onPunishManual: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  isConnected,
  fpsText,
  telemetry,
  onRewardManual,
  onPunishManual,
}) => {
  const computeMs = telemetry?.compute_ms !== undefined ? telemetry.compute_ms.toFixed(1) : "0.0";
  const spikes = telemetry?.fly?.brain?.total_spikes !== undefined
    ? telemetry.fly.brain.total_spikes.toLocaleString()
    : "0";
  const dopamine = telemetry?.fly?.dopamine?.current_level !== undefined
    ? telemetry.fly.dopamine.current_level.toFixed(2)
    : "0.00";

  // Formateo de estado sin emojis
  const rawState = telemetry?.action?.state || "INICIANDO";
  let displayState = "EN REPOSO";
  let stateClass = "state";

  if (rawState.includes("BLACKJACK")) {
    displayState = "CASINO 21 (PAUSA)";
    stateClass = "cyan";
  } else if (rawState.includes("FEEDING")) {
    displayState = "COMIENDO SACAROSA";
    stateClass = "green";
  } else if (rawState.includes("ESCAPE")) {
    displayState = "SALTO DE ESCAPE";
    stateClass = "red";
  } else if (rawState.includes("TURNING_LEFT")) {
    displayState = "GIRANDO IZQ";
  } else if (rawState.includes("TURNING_RIGHT")) {
    displayState = "GIRANDO DER";
  } else if (rawState.includes("WALKING")) {
    displayState = "CAMINANDO (P9)";
    stateClass = "cyan";
  } else if (rawState.length > 0 && rawState !== "INICIANDO") {
    displayState = rawState.split(" ")[0];
  }

  return (
    <header className="top-nav">
      <div className="brand">
        <div className="brand-icon-box" title="FlyWire Connectome Engine">
          <Cpu size={20} />
        </div>
        <div className="brand-text">
          <h1>
            MOSCA<span className="accent">BRAIN</span>
          </h1>
          <span className="subtitle">Emulador Funcional de Conectoma (FlyWire Adult Drosophila)</span>
        </div>
      </div>

      <div className="header-status">
        <div className={`connection-badge ${!isConnected ? "disconnected" : ""}`}>
          <span className="status-dot"></span>
          <span>{isConnected ? fpsText : "Desconectado"}</span>
        </div>

        {/* Medida DEBAJO de cada etiqueta */}
        <div className="stat-box">
          <span className="stat-label">Cómputo</span>
          <span className="stat-value cyan">{computeMs} ms</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Conectoma</span>
          <span className="stat-value purple">138.639 N · 15.09M S</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Espigas</span>
          <span className="stat-value">{spikes}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Dopamina</span>
          <span className="stat-value green">{dopamine}</span>
        </div>

        <div className="stat-box">
          <span className="stat-label">Estado</span>
          <span className={`stat-value ${stateClass}`} title={displayState}>
            {displayState}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <button
          className="btn btn-dopamine"
          onClick={onRewardManual}
          title="Activa el clúster PAM de dopamina (+1.0)"
        >
          <Sparkles size={13} />
          <span>+ Dopamina (+1.0)</span>
        </button>

        <button
          className="btn btn-punish"
          onClick={onPunishManual}
          title="Activa el clúster PPL1 aversivo (-0.5)"
        >
          <Zap size={13} />
          <span>- Aversión (-0.5)</span>
        </button>
      </div>
    </header>
  );
};
