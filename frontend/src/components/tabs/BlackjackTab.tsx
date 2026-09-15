import React, { useRef, useEffect } from "react";
import { Play } from "lucide-react";
import { TelemetryData, BlackjackSimState, BlackjackStats } from "../../utils/constants";
import { drawBrainGraph } from "../../utils/canvasRenderer";

interface BlackjackTabProps {
  telemetry: TelemetryData | null;
  sim: BlackjackSimState;
  stats: BlackjackStats;
  isBusy: boolean;
  onPlayRound: () => void;
  onTriggerOdor: (name: string) => void;
}

export const BlackjackTab: React.FC<BlackjackTabProps> = ({
  telemetry,
  sim,
  stats,
  isBusy,
  onPlayRound,
  onTriggerOdor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBrainGraph(ctx, canvas.width, canvas.height, telemetry);
  }, [telemetry]);

  const da = telemetry?.fly?.dopamine?.current_level || 0;
  const daPct = Math.min(100, (da / 3.0) * 100);
  const streakPct = Math.min(100, (stats.accumulatedDopamine / 8.0) * 100);

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Conectoma Neural en Vivo</h3>
        <span className="tag">MBONs + Clúster PAM</span>
      </div>

      <div className="connectome-visualizer" style={{ height: "120px" }}>
        <canvas ref={canvasRef} width={480} height={120} />
      </div>

      <div className="dopamine-gauge-card" style={{ padding: "8px 10px" }}>
        <div className="gauge-header">
          <span>Nivel de Dopamina Extracelular</span>
          <span className="gauge-number">{da.toFixed(2)} / 3.00 DA</span>
        </div>
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: `${daPct}%` }} />
        </div>

        <div className="gauge-header" style={{ marginTop: "6px" }}>
          <span>Dopamina por Racha</span>
          <span className="gauge-number">+{stats.accumulatedDopamine.toFixed(1)} DA</span>
        </div>
        <div className="gauge-track" style={{ background: "rgba(251, 191, 36, 0.12)" }}>
          <div
            className="gauge-fill"
            style={{
              width: `${streakPct}%`,
              background: "linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)",
            }}
          />
        </div>

        <div className="gauge-footer" style={{ marginTop: "4px" }}>
          <span>Victorias: <strong style={{ color: "var(--accent-green)" }}>{stats.wins}</strong></span>
          <span>Derrotas: <strong style={{ color: "var(--accent-red)" }}>{stats.losses}</strong></span>
          <span>Racha: <strong style={{ color: "var(--accent-gold)" }}>{stats.streak} seguidas</strong></span>
        </div>
      </div>

      <div className="blackjack-card">
        <button
          className="btn btn-primary"
          style={{ width: "100%", justifyContent: "center", padding: "8px" }}
          onClick={onPlayRound}
          disabled={isBusy}
        >
          <Play size={13} />
          <span>{isBusy ? "EVALUANDO FIRMA QUÍMICA..." : "JUGAR RONDA CON EL CONECTOMA"}</span>
        </button>

        <div className="table-felt">
          <div className="hand-box">
            <span className="hand-title">Mano Croupier</span>
            <div className="cards-row">
              {sim.dealerHand.map((c, i) => (
                <span key={i} className="card-badge">
                  {c}
                </span>
              ))}
            </div>
            <span className="hand-score">Total: {sim.dealerTotal}</span>
          </div>

          <div className="vs-badge">VS</div>

          <div className="hand-box">
            <span className="hand-title">Mano Mosca (Cerebro)</span>
            <div className="cards-row">
              {sim.flyHand.map((c, i) => (
                <span key={i} className="card-badge" style={{ color: "#0284c7" }}>
                  {c}
                </span>
              ))}
            </div>
            <span className="hand-score">Total: {sim.flyTotal}</span>
          </div>
        </div>

        {sim.lastOutcome && (
          <div
            className="game-result-banner"
            style={{
              backgroundColor:
                sim.lastOutcome === "VICTORIA"
                  ? "rgba(16, 185, 129, 0.3)"
                  : sim.lastOutcome === "EMPATE"
                  ? "rgba(251, 191, 36, 0.3)"
                  : "rgba(244, 63, 94, 0.3)",
              color: "#fff",
            }}
          >
            {sim.currentDecision}
          </div>
        )}

        <div className="decision-log">
          <div>{sim.stepLog}</div>
        </div>
      </div>

      <div className="sub-header" style={{ marginTop: "4px" }}>
        <h3>Dispensador de Aromas Químicos</h3>
      </div>
      <div className="odor-buttons">
        <button className="btn-odor" onClick={() => onTriggerOdor("vinagre_manzana")}>
          Vinagre de Manzana
        </button>
        <button className="btn-odor" onClick={() => onTriggerOdor("sacarosa_azucar")}>
          Sacarosa Líquida
        </button>
        <button className="btn-odor" onClick={() => onTriggerOdor("platano_fruta")}>
          Éster de Plátano
        </button>
        <button className="btn-odor" onClick={() => onTriggerOdor("humo_repelente")}>
          Humo Aversivo
        </button>
        <button className="btn-odor" style={{ gridColumn: "span 2" }} onClick={() => onTriggerOdor("aire_limpio")}>
          Aire Limpio (Restablecer)
        </button>
      </div>
    </div>
  );
};
