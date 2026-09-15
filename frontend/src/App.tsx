import React, { useState, useEffect, useRef, useCallback } from "react";
import { TopNav } from "./components/TopNav";
import { ArenaPanel } from "./components/ArenaPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import {
  TelemetryData,
  TestLogEntry,
  BlackjackSimState,
  BlackjackStats,
} from "./utils/constants";
import { globalParticles } from "./utils/canvasRenderer";

export const App: React.FC = () => {
  // Conexión y Telemetría
  const [isConnected, setIsConnected] = useState(false);
  const [fpsText, setFpsText] = useState("Midiendo FPS...");
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  // Estados de control
  const [currentTab, setCurrentTab] = useState("connectome");
  const [activeScenario, setActiveScenario] = useState("alimento_dopamina");
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);

  // Buffer del log cinemático
  const [testLogEntries, setTestLogEntries] = useState<TestLogEntry[]>([]);
  const lastLoggedStepRef = useRef<number>(-1);

  // Blackjack
  const [blackjackSim, setBlackjackSim] = useState<BlackjackSimState>({
    dealerHand: [10, 7],
    flyHand: [8, 5],
    dealerTotal: 17,
    flyTotal: 13,
    currentDecision: "PLANTARSE",
    gesture: "wave_arm",
    stepLog: "Conectoma MBONs evaluando...",
    lastOutcome: null,
  });

  const [blackjackStats, setBlackjackStats] = useState<BlackjackStats>({
    wins: 0,
    losses: 0,
    streak: 0,
    accumulatedDopamine: 0.0,
  });

  const [isBlackjackBusy, setIsBlackjackBusy] = useState(false);
  const [isBlackjackAutoPlaying, setIsBlackjackAutoPlaying] = useState(false);
  const [blackjackStatusText, setBlackjackStatusText] = useState("Conectoma listo");
  const autoPlayTimerRef = useRef<number | null>(null);

  // WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const lastArrivalRef = useRef(performance.now());
  const frameIntervalMsRef = useRef(25.0);

  const sendWsCommand = useCallback((payload: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  // Conectar WebSocket
  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host || "localhost:8000";
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setFpsText("Conectado · Sincronizando...");
      if (currentTab === "olfaction") {
        ws.send(JSON.stringify({ command: "set_mode", mode: "blackjack" }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const now = performance.now();
        frameCountRef.current++;
        const delta = now - lastFpsTimeRef.current;
        frameIntervalMsRef.current =
          frameIntervalMsRef.current * 0.85 + (now - lastArrivalRef.current) * 0.15;
        lastArrivalRef.current = now;

        if (delta >= 600) {
          const fps = ((frameCountRef.current * 1000) / delta).toFixed(1);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
          setFpsText(`En Vivo (${fps} FPS · ${frameIntervalMsRef.current.toFixed(0)}ms)`);
        }

        const data: TelemetryData = JSON.parse(event.data);
        setTelemetry(data);

        if (data.is_paused !== undefined) {
          setIsSimPaused(Boolean(data.is_paused));
        }

        // Registrar en el log cinemático si cambió el paso
        const step = data.fly?.brain?.step || 0;
        if (step !== lastLoggedStepRef.current && data.fly?.position) {
          lastLoggedStepRef.current = step;
          const pos = data.fly.position;
          const diag = data.diagnostics || {};
          const nearest = diag.nearest_food || null;
          const angleDeg = Math.round(((pos.angle * 180 / Math.PI) % 360 + 360) % 360);
          const action = data.action || { forward_thrust: 0, turn_yaw: 0, wingbeat_hz: 0 };
          const fwd = action.forward_thrust || 0;
          const yaw = action.turn_yaw || 0;
          const speed = data.fly.speed || 0;

          let badgeText = "Reposo";
          let badgeType: "idle" | "feeding" | "turning" | "surge" = "idle";

          if (diag.is_feeding || action.state?.includes("FEEDING")) {
            badgeText = "Comiendo";
            badgeType = "feeding";
          } else if (Math.abs(yaw) > 0.25) {
            badgeText = `Pivote ${yaw > 0 ? "Der." : "Izq."}`;
            badgeType = "turning";
          } else if (fwd > 0.3) {
            badgeText = "Arremetida";
            badgeType = "surge";
          } else if (fwd > 0.05) {
            badgeText = "Avance";
            badgeType = "surge";
          }

          const entry: TestLogEntry = {
            step,
            x: pos.x.toFixed(1),
            y: pos.y.toFixed(1),
            angleDeg,
            dist: nearest ? nearest.dist.toFixed(1) : "--",
            errDeg: nearest ? `${nearest.angle_err_deg > 0 ? "+" : ""}${nearest.angle_err_deg.toFixed(0)}°` : "--",
            antL: diag.antenna_left_c !== undefined ? diag.antenna_left_c.toFixed(2) : "--",
            antR: diag.antenna_right_c !== undefined ? diag.antenna_right_c.toFixed(2) : "--",
            contrast: diag.contrast_norm !== undefined ? `${diag.contrast_norm > 0 ? "+" : ""}${diag.contrast_norm.toFixed(2)}` : "--",
            p9: diag.p9_left_rate !== undefined ? `${diag.p9_left_rate.toFixed(2)}/${diag.p9_right_rate?.toFixed(2)}` : "--",
            dna: diag.dna_left_rate !== undefined ? `${diag.dna_left_rate.toFixed(2)}/${diag.dna_right_rate?.toFixed(2)}` : "--",
            fwd: fwd.toFixed(2),
            yaw: `${yaw > 0 ? "+" : ""}${yaw.toFixed(2)}`,
            speed: speed.toFixed(2),
            badgeText,
            badgeType,
          };

          setTestLogEntries((prev) => {
            const next = [...prev, entry];
            if (next.length > 300) next.shift();
            return next;
          });
        }
      } catch (e) {
        console.error("Error parsing telemetry WebSocket data:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setFpsText("Desconectado. Reintentando...");
      setTimeout(connectWebSocket, 2000);
    };
  }, [currentTab]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWebSocket]);

  // Manejo de cambio de pestaña
  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    const isBlackjack = tab === "olfaction";
    sendWsCommand({ command: "set_mode", mode: isBlackjack ? "blackjack" : "arena" });
  };

  // Pausa / Paso a paso
  const handleTogglePause = () => {
    sendWsCommand({ command: "toggle_pause" });
    setIsSimPaused((prev) => !prev);
  };

  const handleStepFrame = () => {
    sendWsCommand({ command: "step_frame" });
  };

  const handleResetBias = () => {
    sendWsCommand({ command: "reset_bias" });
    fetch("/api/reset_bias", { method: "POST" });
  };

  // Recompensas y Aversión manual
  const handleRewardManual = () => {
    sendWsCommand({ command: "reward", amount: 1.0 });
    if (telemetry?.fly?.position) {
      globalParticles.triggerBurst(telemetry.fly.position.x, telemetry.fly.position.y);
    } else {
      globalParticles.triggerBurst(400, 230);
    }
  };

  const handlePunishManual = () => {
    sendWsCommand({ command: "punish", amount: 0.5 });
  };

  // Escenarios
  const handleScenarioChange = (scenario: string) => {
    setActiveScenario(scenario);
    fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
  };

  // Estímulos
  const handleAddStimulus = (type: string, x: number, y: number) => {
    fetch("/api/stimulus/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, x, y }),
    });
  };

  const handleRemoveStimulus = (type?: string, id?: string, x?: number, y?: number) => {
    sendWsCommand({ command: "remove_stimulus", type, id, x, y });
    fetch("/api/stimulus/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, x, y }),
    });
  };

  const handleMoveStimulus = (
    type: string,
    id: string | undefined,
    x: number,
    y: number,
    oldX?: number,
    oldY?: number
  ) => {
    sendWsCommand({
      command: "move_stimulus",
      type,
      id,
      x,
      y,
      old_x: oldX,
      old_y: oldY,
    });
  };

  const handleMoveFlyPose = (x: number, y: number, angle: number, resetBias = false) => {
    sendWsCommand({
      command: "set_fly_pose",
      x,
      y,
      angle,
      reset_bias: resetBias,
    });
  };

  const handleMoveThreatAbsolute = (x: number, y: number) => {
    sendWsCommand({ command: "move_threat_absolute", x, y });
  };

  const handleClearStimuli = () => {
    sendWsCommand({ command: "clear_stimuli", target: "all" });
    fetch("/api/stimulus/clear", { method: "POST" });
  };

  // Presets de postura
  const handleApplyPreset = (type: "front" | "right90" | "left90" | "back180" | "spawnFood") => {
    if (!telemetry?.fly?.position) return;
    const fx = telemetry.fly.position.x;
    const fy = telemetry.fly.position.y;

    const foods = telemetry.foods || [];
    let foodX = 400;
    let foodY = 380;
    if (foods.length > 0) {
      let minDist = Infinity;
      foods.forEach((f) => {
        const d = Math.hypot(f.x - fx, f.y - fy);
        if (d < minDist) {
          minDist = d;
          foodX = f.x;
          foodY = f.y;
        }
      });
    }

    if (type === "spawnFood") {
      const fa = telemetry.fly.position.angle;
      const targetX = Math.max(30, Math.min(770, fx + 130 * Math.cos(fa)));
      const targetY = Math.max(30, Math.min(430, fy + 130 * Math.sin(fa)));
      handleAddStimulus("food", targetX, targetY);
      return;
    }

    const toFood = (Math.atan2(foodY - fy, foodX - fx) * 180) / Math.PI;
    let targetDeg = 0;
    if (type === "front") targetDeg = Math.round(toFood);
    if (type === "right90") targetDeg = Math.round(toFood - 90);
    if (type === "left90") targetDeg = Math.round(toFood + 90);
    if (type === "back180") targetDeg = Math.round(toFood + 180);

    const rad = (targetDeg * Math.PI) / 180;
    handleMoveFlyPose(fx, fy, rad, true);
  };

  // Visión y Olfato
  const handleApplyVision = (fov: number, ommatidia: number, sens: number) => {
    fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fov_horizontal: fov,
        ommatidia_count: ommatidia,
        sensitivity: sens,
      }),
    });
  };

  const handleTriggerOdor = (odor: string) => {
    fetch("/api/olfaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ odor_name: odor, concentration: 1.0 }),
    });
  };

  // Ronda de 21 / Blackjack
  const handlePlayBlackjackRound = async () => {
    if (isBlackjackBusy) return;
    setIsBlackjackBusy(true);
    setBlackjackStatusText("Evaluando firma química...");

    try {
      const res = await fetch("/api/blackjack/round", { method: "POST" });
      const data = await res.json();

      setBlackjackSim((prev) => ({
        ...prev,
        lastOutcome: null,
        dealerHand: [data.dealer_hand[0], "?"],
        dealerTotal: data.dealer_hand[0],
        flyHand: data.fly_hand.slice(0, 2),
        flyTotal: data.fly_hand.slice(0, 2).reduce((a: number, b: number) => a + b, 0),
        gesture: "idle",
        currentDecision: "EVALUANDO FIRMA QUÍMICA...",
      }));

      for (let i = 0; i < data.steps_log.length; i++) {
        const step = data.steps_log[i];
        await new Promise((r) => setTimeout(r, 600));

        if (step.decision === "PEDIR CARTA") {
          setBlackjackSim((prev) => ({
            ...prev,
            gesture: "raise_arm",
            currentDecision: "PEDIR CARTA (Hit)",
            stepLog: `[Mano ${step.score} pts] MBONs: Atracción=${step.mbon_app.toFixed(2)} => ¡ALZA LA PATA!`,
          }));
          setBlackjackStatusText("Alza la pata: Pedir Carta (Hit)");
          await new Promise((r) => setTimeout(r, 800));

          const dealtIndex = 2 + i;
          if (dealtIndex < data.fly_hand.length) {
            setBlackjackSim((prev) => {
              const currentHand = data.fly_hand.slice(0, dealtIndex + 1);
              return {
                ...prev,
                flyHand: currentHand,
                flyTotal: currentHand.reduce((a: number, b: number) => a + b, 0),
              };
            });
          }
        } else {
          setBlackjackSim((prev) => ({
            ...prev,
            gesture: "wave_arm",
            currentDecision: "PLANTARSE (Stand)",
            stepLog: `[Mano ${step.score} pts] MBONs: Cautela=${step.mbon_avd.toFixed(2)} => ¡MUEVE LA PATA DE LADO A LADO!`,
          }));
          setBlackjackStatusText("Mueve la pata: Plantarse (Stand)");
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      await new Promise((r) => setTimeout(r, 500));

      let decisionText = "DERROTA FRENTE AL CROUPIER";
      let statusBanner = "Croupier gana la mano";

      if (data.outcome === "VICTORIA") {
        setBlackjackStats((prev) => {
          const streak = prev.streak + 1;
          const da = 1.5 + Math.min(2.0, streak * 0.2);
          return {
            ...prev,
            wins: prev.wins + 1,
            streak,
            accumulatedDopamine: prev.accumulatedDopamine + da,
          };
        });
        decisionText = "VICTORIA DE LA MOSCA (+1.5 DA)";
        statusBanner = "Victoria de la Mosca";
        globalParticles.triggerBurst(400, 325, 45);
      } else if (data.outcome === "PASADO_21") {
        setBlackjackStats((prev) => ({ ...prev, losses: prev.losses + 1, streak: 0 }));
        decisionText = "SE PASÓ DE 21 (CASTIGO AVERSIVO)";
        statusBanner = "Se pasó de 21";
      } else if (data.outcome === "EMPATE") {
        decisionText = "EMPATE CON EL CROUPIER";
        statusBanner = "Empate con Croupier";
      } else {
        setBlackjackStats((prev) => ({ ...prev, losses: prev.losses + 1, streak: 0 }));
      }

      setBlackjackStatusText(statusBanner);
      setBlackjackSim((prev) => ({
        ...prev,
        dealerHand: data.dealer_hand,
        dealerTotal: data.dealer_total,
        flyHand: data.fly_hand,
        flyTotal: data.fly_total,
        lastOutcome: data.outcome,
        gesture: data.outcome === "VICTORIA" ? "cheer" : "idle",
        currentDecision: decisionText,
      }));
    } catch (e) {
      console.error("Error en ronda de blackjack:", e);
      setBlackjackStatusText("Error en conexión");
    } finally {
      setIsBlackjackBusy(false);
    }
  };

  const handleToggleBlackjackAutoPlay = () => {
    if (isBlackjackAutoPlaying) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
      setIsBlackjackAutoPlaying(false);
      setBlackjackStatusText("Auto-juego pausado");
    } else {
      setIsBlackjackAutoPlaying(true);
      handlePlayBlackjackRound();
      autoPlayTimerRef.current = window.setInterval(() => {
        handlePlayBlackjackRound();
      }, 4000);
    }
  };

  const handleResetBlackjackStats = () => {
    setBlackjackStats({ wins: 0, losses: 0, streak: 0, accumulatedDopamine: 0.0 });
    setBlackjackStatusText("Estadísticas reiniciadas");
    setBlackjackSim((prev) => ({
      ...prev,
      lastOutcome: null,
      dealerHand: [10, 7],
      dealerTotal: 17,
      flyHand: [8, 5],
      flyTotal: 13,
      currentDecision: "PLANTARSE",
    }));
  };

  // Atajos de teclado globales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;

      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === "." || e.key === "p" || e.key === "P") {
        e.preventDefault();
        handleStepFrame();
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (currentTab === "olfaction") return;
        e.preventDefault();
        const step = e.shiftKey ? 32 : 16;
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowUp") dy = -step;
        if (e.key === "ArrowDown") dy = step;
        if (e.key === "ArrowLeft") dx = -step;
        if (e.key === "ArrowRight") dx = step;
        sendWsCommand({ command: "move_threat", dx, dy });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentTab, handleTogglePause, handleStepFrame, sendWsCommand]);

  return (
    <>
      <TopNav
        isConnected={isConnected}
        fpsText={fpsText}
        telemetry={telemetry}
        onRewardManual={handleRewardManual}
        onPunishManual={handlePunishManual}
      />

      <main className="cockpit-container">
        <ArenaPanel
          currentTab={currentTab}
          telemetry={telemetry}
          isSimPaused={isSimPaused}
          activeScenario={activeScenario}
          onScenarioChange={handleScenarioChange}
          onTogglePause={handleTogglePause}
          onStepFrame={handleStepFrame}
          onAddStimulus={handleAddStimulus}
          onRemoveStimulus={handleRemoveStimulus}
          onMoveStimulus={handleMoveStimulus}
          onMoveFlyPose={handleMoveFlyPose}
          onMoveThreatAbsolute={handleMoveThreatAbsolute}
          onClearStimuli={handleClearStimuli}
          blackjackSim={blackjackSim}
          blackjackStats={blackjackStats}
          isBlackjackBusy={isBlackjackBusy}
          isBlackjackAutoPlaying={isBlackjackAutoPlaying}
          blackjackStatusText={blackjackStatusText}
          onPlayBlackjackRound={handlePlayBlackjackRound}
          onToggleBlackjackAutoPlay={handleToggleBlackjackAutoPlay}
          onResetBlackjackStats={handleResetBlackjackStats}
          testLogEntries={testLogEntries}
          isLogDrawerOpen={isLogDrawerOpen}
          onToggleLogDrawer={() => setIsLogDrawerOpen((prev) => !prev)}
          onCloseLogDrawer={() => setIsLogDrawerOpen(false)}
          onClearLog={() => setTestLogEntries([])}
        />

        <InspectorPanel
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          telemetry={telemetry}
          blackjackSim={blackjackSim}
          blackjackStats={blackjackStats}
          isBlackjackBusy={isBlackjackBusy}
          onPlayBlackjackRound={handlePlayBlackjackRound}
          onTriggerOdor={handleTriggerOdor}
          onApplyVision={handleApplyVision}
          isPaused={isSimPaused}
          testLogEntries={testLogEntries}
          onTogglePause={handleTogglePause}
          onStepFrame={handleStepFrame}
          onResetBias={handleResetBias}
          onSetFlyPose={(x, y, a) => handleMoveFlyPose(x, y, (a * Math.PI) / 180, true)}
          onApplyPreset={handleApplyPreset}
          onOpenLogDrawer={() => setIsLogDrawerOpen(true)}
        />
      </main>
    </>
  );
};
