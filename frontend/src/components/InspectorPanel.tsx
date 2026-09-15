import React from "react";
import { Cpu, Gamepad2, Eye, Award, Code2, Sliders } from "lucide-react";
import { TelemetryData, BlackjackSimState, BlackjackStats, TestLogEntry } from "../utils/constants";
import { ConnectomeTab } from "./tabs/ConnectomeTab";
import { GameBridgeTab } from "./tabs/GameBridgeTab";
import { VisionTab } from "./tabs/VisionTab";
import { BlackjackTab } from "./tabs/BlackjackTab";
import { PythonCodeTab } from "./tabs/PythonCodeTab";
import { TestPoseTab } from "./tabs/TestPoseTab";

interface InspectorPanelProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  telemetry: TelemetryData | null;
  blackjackSim: BlackjackSimState;
  blackjackStats: BlackjackStats;
  isBlackjackBusy: boolean;
  onPlayBlackjackRound: () => void;
  onTriggerOdor: (odor: string) => void;
  onApplyVision: (fov: number, count: number, sens: number) => void;
  isPaused: boolean;
  testLogEntries: TestLogEntry[];
  onTogglePause: () => void;
  onStepFrame: () => void;
  onResetBias: () => void;
  onSetFlyPose: (x: number, y: number, angleDeg: number) => void;
  onApplyPreset: (type: "front" | "right90" | "left90" | "back180" | "spawnFood") => void;
  onOpenLogDrawer: () => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  currentTab,
  onSelectTab,
  telemetry,
  blackjackSim,
  blackjackStats,
  isBlackjackBusy,
  onPlayBlackjackRound,
  onTriggerOdor,
  onApplyVision,
  isPaused,
  testLogEntries,
  onTogglePause,
  onStepFrame,
  onResetBias,
  onSetFlyPose,
  onApplyPreset,
  onOpenLogDrawer,
}) => {
  return (
    <aside className="panel inspector-panel">
      <nav className="inspector-tabs">
        <button
          className={`tab-btn ${currentTab === "connectome" ? "active" : ""}`}
          onClick={() => onSelectTab("connectome")}
        >
          <Cpu size={13} />
          <span>Conectoma</span>
        </button>

        <button
          className={`tab-btn ${currentTab === "gamebridge" ? "active" : ""}`}
          onClick={() => onSelectTab("gamebridge")}
        >
          <Gamepad2 size={13} />
          <span>Videojuegos</span>
        </button>

        <button
          className={`tab-btn ${currentTab === "vision" ? "active" : ""}`}
          onClick={() => onSelectTab("vision")}
        >
          <Eye size={13} />
          <span>Retina / Visión</span>
        </button>

        <button
          className={`tab-btn ${currentTab === "olfaction" ? "active" : ""}`}
          onClick={() => onSelectTab("olfaction")}
        >
          <Award size={13} />
          <span>21 / Blackjack</span>
        </button>

        <button
          className={`tab-btn ${currentTab === "code" ? "active" : ""}`}
          onClick={() => onSelectTab("code")}
        >
          <Code2 size={13} />
          <span>Código Python</span>
        </button>

        <button
          className={`tab-btn ${currentTab === "testlog" ? "active" : ""}`}
          onClick={() => onSelectTab("testlog")}
        >
          <Sliders size={13} />
          <span>Testeo & Postura</span>
        </button>
      </nav>

      {currentTab === "connectome" && <ConnectomeTab telemetry={telemetry} />}
      {currentTab === "gamebridge" && <GameBridgeTab />}
      {currentTab === "vision" && <VisionTab telemetry={telemetry} onApplyVision={onApplyVision} />}
      {currentTab === "olfaction" && (
        <BlackjackTab
          telemetry={telemetry}
          sim={blackjackSim}
          stats={blackjackStats}
          isBusy={isBlackjackBusy}
          onPlayRound={onPlayBlackjackRound}
          onTriggerOdor={onTriggerOdor}
        />
      )}
      {currentTab === "code" && <PythonCodeTab />}
      {currentTab === "testlog" && (
        <TestPoseTab
          telemetry={telemetry}
          isPaused={isPaused}
          logEntries={testLogEntries}
          onTogglePause={onTogglePause}
          onStepFrame={onStepFrame}
          onResetBias={onResetBias}
          onSetFlyPose={onSetFlyPose}
          onApplyPreset={onApplyPreset}
          onOpenLogDrawer={onOpenLogDrawer}
        />
      )}
    </aside>
  );
};
