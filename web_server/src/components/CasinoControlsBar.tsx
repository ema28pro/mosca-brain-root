import React from "react";
import { Play, RotateCcw, Zap, Pause } from "lucide-react";
import { BlackjackStats } from "../utils/constants";

interface CasinoControlsBarProps {
  isBusy: boolean;
  isAutoPlaying: boolean;
  stats: BlackjackStats;
  statusText: string;
  onPlayRound: () => void;
  onToggleAutoPlay: () => void;
  onResetStats: () => void;
}

export const CasinoControlsBar: React.FC<CasinoControlsBarProps> = ({
  isBusy,
  isAutoPlaying,
  stats,
  statusText,
  onPlayRound,
  onToggleAutoPlay,
  onResetStats,
}) => {
  return (
    <div className="casino-controls-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          className="btn btn-primary"
          onClick={onPlayRound}
          disabled={isBusy}
          title="El conectoma evalúa la mano con sus neuronas MBON"
        >
          <Play size={13} />
          <span>{isBusy ? "EVALUANDO FIRMA..." : "JUGAR RONDA (CONECTOMA)"}</span>
        </button>

        <button
          className={`btn ${isAutoPlaying ? "btn-punish" : "btn-secondary"}`}
          onClick={onToggleAutoPlay}
          title="Juego automático continuo de rondas"
        >
          {isAutoPlaying ? <Pause size={13} /> : <Zap size={13} />}
          <span>{isAutoPlaying ? "DETENER AUTO" : "AUTO-JUEGO"}</span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="stat-box" style={{ padding: "4px 8px" }}>
          <span className="stat-label">Estado Mesa</span>
          <span className="stat-value cyan" style={{ fontSize: "11px" }}>
            {statusText}
          </span>
        </div>

        <div className="stat-box" style={{ padding: "4px 8px" }}>
          <span className="stat-label">Racha Activa</span>
          <span className="stat-value" style={{ fontSize: "11px" }}>
            {stats.streak} seguidas
          </span>
        </div>

        <div className="stat-box" style={{ padding: "4px 8px" }}>
          <span className="stat-label">DA Acumulada</span>
          <span className="stat-value green" style={{ fontSize: "11px" }}>
            +{stats.accumulatedDopamine.toFixed(1)} DA
          </span>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={onResetStats}
          title="Reiniciar racha y estadísticas"
        >
          <RotateCcw size={12} />
          <span>REINICIAR</span>
        </button>
      </div>
    </div>
  );
};
