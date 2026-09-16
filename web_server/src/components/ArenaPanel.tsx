import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Play,
  Pause,
  StepForward,
  FileText,
  Sun,
  AlertTriangle,
  Move,
  Eraser,
  Trash2,
  CircleDot,
} from "lucide-react";
import { TelemetryData, BlackjackSimState, BlackjackStats, TestLogEntry } from "../utils/constants";
import { renderArena, renderBlackjackTable } from "../utils/canvasRenderer";
import { TelemetryBar } from "./TelemetryBar";
import { CasinoControlsBar } from "./CasinoControlsBar";
import { TestLogDrawer } from "./TestLogDrawer";

interface ArenaPanelProps {
  currentTab: string;
  telemetry: TelemetryData | null;
  isSimPaused: boolean;
  activeScenario: string;
  onScenarioChange: (scenario: string) => void;
  onTogglePause: () => void;
  onStepFrame: () => void;
  onAddStimulus: (type: string, x: number, y: number) => void;
  onRemoveStimulus: (type?: string, id?: string, x?: number, y?: number) => void;
  onMoveStimulus: (type: string, id: string | undefined, x: number, y: number, oldX?: number, oldY?: number) => void;
  onMoveFlyPose: (x: number, y: number, angle: number, resetBias?: boolean) => void;
  onMoveThreatAbsolute: (x: number, y: number) => void;
  onClearStimuli: () => void;
  // Blackjack
  blackjackSim: BlackjackSimState;
  blackjackStats: BlackjackStats;
  isBlackjackBusy: boolean;
  isBlackjackAutoPlaying: boolean;
  blackjackStatusText: string;
  onPlayBlackjackRound: () => void;
  onToggleBlackjackAutoPlay: () => void;
  onResetBlackjackStats: () => void;
  // Test Log
  testLogEntries: TestLogEntry[];
  isLogDrawerOpen: boolean;
  onToggleLogDrawer: () => void;
  onCloseLogDrawer: () => void;
  onClearLog: () => void;
}

export const ArenaPanel: React.FC<ArenaPanelProps> = ({
  currentTab,
  telemetry,
  isSimPaused,
  activeScenario,
  onScenarioChange,
  onTogglePause,
  onStepFrame,
  onAddStimulus,
  onRemoveStimulus,
  onMoveStimulus,
  onMoveFlyPose,
  onMoveThreatAbsolute,
  onClearStimuli,
  blackjackSim,
  blackjackStats,
  isBlackjackBusy,
  isBlackjackAutoPlaying,
  blackjackStatusText,
  onPlayBlackjackRound,
  onToggleBlackjackAutoPlay,
  onResetBlackjackStats,
  testLogEntries,
  isLogDrawerOpen,
  onToggleLogDrawer,
  onCloseLogDrawer,
  onClearLog,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTool, setCurrentTool] = useState<string>("food");
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Arrastre en Canvas
  const [isDraggingFlyAngle, setIsDraggingFlyAngle] = useState(false);
  const [isDraggingThreat, setIsDraggingThreat] = useState(false);
  const [draggedElement, setDraggedElement] = useState<{
    type: string;
    id?: string;
    origX: number;
    origY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const throttleRef = useRef<number>(0);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (currentTab === "olfaction") {
      renderBlackjackTable(ctx, canvas.width, canvas.height, blackjackSim);
    } else {
      renderArena(ctx, canvas.width, canvas.height, {
        data: telemetry,
        currentTool,
        isSimPaused,
        isDraggingFlyAngle,
        draggedElement,
        mousePos,
      });
    }
  }, [
    telemetry,
    currentTab,
    currentTool,
    isSimPaused,
    isDraggingFlyAngle,
    draggedElement,
    mousePos,
    blackjackSim,
  ]);

  const getCanvasPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const findElementAtPos = useCallback(
    (x: number, y: number) => {
      if (!telemetry) return null;
      if (telemetry.fly?.position) {
        const fx = telemetry.fly.position.x;
        const fy = telemetry.fly.position.y;
        if (Math.hypot(fx - x, fy - y) <= 24) {
          return { type: "fly", id: "fly", x: fx, y: fy };
        }
      }
      if (telemetry.foods) {
        for (const f of telemetry.foods) {
          if (Math.hypot(f.x - x, f.y - y) <= (f.radius || 12) + 8) {
            return { type: "food", id: f.id, x: f.x, y: f.y };
          }
        }
      }
      if (telemetry.lights) {
        for (const l of telemetry.lights) {
          if (Math.hypot(l.x - x, l.y - y) <= 22) {
            return { type: "light", id: l.id, x: l.x, y: l.y };
          }
        }
      }
      if (telemetry.threats) {
        for (const t of telemetry.threats) {
          if (Math.hypot(t.x - x, t.y - y) <= (t.radius || 24) + 8) {
            return { type: "threat", id: t.id, x: t.x, y: t.y };
          }
        }
      }
      return null;
    },
    [telemetry]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentTab === "olfaction") return;
    const pos = getCanvasPos(e);
    const elem = findElementAtPos(pos.x, pos.y);

    if (currentTool === "eraser") {
      if (elem && elem.type !== "fly") {
        onRemoveStimulus(elem.type, elem.id, elem.x, elem.y);
      }
      return;
    }

    // Comprobar clic sobre tirador frontal de rotación de la mosca
    if (telemetry?.fly?.position) {
      const fx = telemetry.fly.position.x;
      const fy = telemetry.fly.position.y;
      const fAngle = telemetry.fly.position.angle;
      const hx = fx + 36 * Math.cos(fAngle);
      const hy = fy + 36 * Math.sin(fAngle);
      if (Math.hypot(hx - pos.x, hy - pos.y) <= 16) {
        setIsDraggingFlyAngle(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (elem) {
      setDraggedElement({
        type: elem.type,
        id: elem.id,
        origX: elem.x,
        origY: elem.y,
        currentX: pos.x,
        currentY: pos.y,
      });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (currentTool === "drag") {
      const curAngle = telemetry?.fly?.position?.angle || 0;
      onMoveFlyPose(pos.x, pos.y, curAngle, true);
      return;
    }

    if (currentTool === "threat") {
      setIsDraggingThreat(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onMoveThreatAbsolute(pos.x, pos.y);
      return;
    }

    if (currentTool === "food" || currentTool === "light") {
      onAddStimulus(currentTool, pos.x, pos.y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (currentTab === "olfaction") return;
    const pos = getCanvasPos(e);
    setMousePos(pos);

    if (isDraggingFlyAngle && telemetry?.fly?.position) {
      const fx = telemetry.fly.position.x;
      const fy = telemetry.fly.position.y;
      const newAngle = Math.atan2(pos.y - fy, pos.x - fx);
      telemetry.fly.position.angle = newAngle;

      const now = performance.now();
      if (now - throttleRef.current >= 25) {
        throttleRef.current = now;
        onMoveFlyPose(fx, fy, newAngle, false);
      }
      return;
    }

    if (draggedElement) {
      setDraggedElement((prev) => (prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null));

      const now = performance.now();
      if (now - throttleRef.current >= 25) {
        throttleRef.current = now;
        if (draggedElement.type === "fly") {
          const curAngle = telemetry?.fly?.position?.angle || 0;
          if (telemetry?.fly?.position) {
            telemetry.fly.position.x = pos.x;
            telemetry.fly.position.y = pos.y;
          }
          onMoveFlyPose(pos.x, pos.y, curAngle, false);
        } else {
          onMoveStimulus(
            draggedElement.type,
            draggedElement.id,
            pos.x,
            pos.y,
            draggedElement.origX,
            draggedElement.origY
          );
        }
      }
      return;
    }

    if (isDraggingThreat) {
      const now = performance.now();
      if (now - throttleRef.current >= 30) {
        throttleRef.current = now;
        onMoveThreatAbsolute(pos.x, pos.y);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);

    if (isDraggingFlyAngle) {
      setIsDraggingFlyAngle(false);
      if (telemetry?.fly?.position) {
        onMoveFlyPose(
          telemetry.fly.position.x,
          telemetry.fly.position.y,
          telemetry.fly.position.angle,
          true
        );
      }
      return;
    }

    if (draggedElement) {
      const canvas = canvasRef.current;
      const cw = canvas ? canvas.width : 800;
      const ch = canvas ? canvas.height : 460;
      const marginTrash = 28;
      const isOutOfBounds =
        pos.x < marginTrash || pos.x > cw - marginTrash || pos.y < marginTrash || pos.y > ch - marginTrash;
      const isTrashDropzone = pos.x >= cw - 165 && pos.y >= ch - 68;

      if ((isOutOfBounds || isTrashDropzone) && draggedElement.type !== "fly") {
        onRemoveStimulus(draggedElement.type, draggedElement.id, pos.x, pos.y);
      }
      setDraggedElement(null);
    }

    if (isDraggingThreat) {
      setIsDraggingThreat(false);
    }
  };

  const isBlackjack = currentTab === "olfaction";

  return (
    <section className="panel arena-panel">
      <div className="panel-header">
        <div className="title-group">
          <h2>{isBlackjack ? "Casino Drosophila · 21" : "Arena Virtual"}</h2>
          {!isBlackjack && (
            <div className="scenario-selector">
              <label>Escenario:</label>
              <select
                value={activeScenario}
                onChange={(e) => onScenarioChange(e.target.value)}
              >
                <option value="alimento_dopamina">Sacarosa & Dopamina</option>
                <option value="fototaxis_luz">Fototaxis hacia la Luz</option>
                <option value="escape_depredador">Escape de Depredador</option>
                <option value="olfato_quimico">Pluma Olfativa</option>
              </select>
            </div>
          )}
        </div>

        {!isBlackjack && (
          <>
            <div className="sim-playback-toolbar">
              <button
                className={`playback-btn ${isSimPaused ? "paused" : ""}`}
                onClick={onTogglePause}
                title="Pausar o Reanudar Simulación [Barra Espaciadora]"
              >
                {isSimPaused ? <Play size={12} /> : <Pause size={12} />}
                <span>{isSimPaused ? "Reanudar" : "Pausar"}</span>
              </button>

              <button
                className="playback-btn"
                onClick={onStepFrame}
                disabled={!isSimPaused}
                title="Avanzar 1 Paso cuando está pausado [Tecla .]"
              >
                <StepForward size={12} />
                <span>+1 Paso</span>
              </button>

              <button
                className={`playback-btn ${isLogDrawerOpen ? "active" : ""}`}
                onClick={onToggleLogDrawer}
                title="Abrir Consola de Log y Cinemática"
              >
                <FileText size={12} />
                <span>Log</span>
              </button>
            </div>

            <div className="tools-toolbar">
              <button
                className={`tool-btn ${currentTool === "food" ? "active" : ""}`}
                onClick={() => setCurrentTool("food")}
                title="Colocar gota de sacarosa"
              >
                <CircleDot size={12} />
                <span>Sacarosa</span>
              </button>

              <button
                className={`tool-btn ${currentTool === "light" ? "active" : ""}`}
                onClick={() => setCurrentTool("light")}
                title="Colocar fuente de luz"
              >
                <Sun size={12} />
                <span>Luz</span>
              </button>

              <button
                className={`tool-btn ${currentTool === "threat" ? "active" : ""}`}
                onClick={() => setCurrentTool("threat")}
                title="Colocar sombra depredadora"
              >
                <AlertTriangle size={12} />
                <span>Sombra</span>
              </button>

              <button
                className={`tool-btn ${currentTool === "drag" ? "active" : ""}`}
                onClick={() => setCurrentTool("drag")}
                title="Mover o arrastrar cualquier elemento"
              >
                <Move size={12} />
                <span>Mover</span>
              </button>

              <button
                className={`tool-btn ${currentTool === "eraser" ? "active" : ""}`}
                onClick={() => setCurrentTool("eraser")}
                title="Borrador: haz clic en un elemento para eliminarlo"
              >
                <Eraser size={12} />
                <span>Borrar</span>
              </button>

              <button
                className="tool-btn danger"
                onClick={onClearStimuli}
                title="Limpiar todos los elementos de la arena"
              >
                <Trash2 size={12} />
                <span>Limpiar</span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={800}
          height={460}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            cursor:
              currentTool === "eraser"
                ? "not-allowed"
                : currentTool === "drag" || draggedElement
                ? "grabbing"
                : currentTool === "threat"
                ? "crosshair"
                : "pointer",
          }}
        />

        <TestLogDrawer
          isOpen={isLogDrawerOpen}
          isPaused={isSimPaused}
          entries={testLogEntries}
          isAutoScroll={isAutoScroll}
          onToggleAutoScroll={() => setIsAutoScroll((prev) => !prev)}
          onClearLog={onClearLog}
          onClose={onCloseLogDrawer}
        />
      </div>

      {isBlackjack ? (
        <CasinoControlsBar
          isBusy={isBlackjackBusy}
          isAutoPlaying={isBlackjackAutoPlaying}
          stats={blackjackStats}
          statusText={blackjackStatusText}
          onPlayRound={onPlayBlackjackRound}
          onToggleAutoPlay={onToggleBlackjackAutoPlay}
          onResetStats={onResetBlackjackStats}
        />
      ) : (
        <TelemetryBar telemetry={telemetry} />
      )}
    </section>
  );
};
