export interface BrainNode {
  x: number;
  y: number;
  color: string;
  label: string;
}

export const BRAIN_LAYOUT: Record<string, BrainNode> = {
  RETINA_L: { x: 50, y: 70, color: "#38bdf8", label: "Retina L" },
  RETINA_R: { x: 50, y: 270, color: "#38bdf8", label: "Retina R" },
  LAMINA_L: { x: 100, y: 85, color: "#38bdf8", label: "Lamina L" },
  LAMINA_R: { x: 100, y: 255, color: "#38bdf8", label: "Lamina R" },
  MEDULLA_ON_L: { x: 150, y: 95, color: "#38bdf8", label: "Medulla L" },
  MEDULLA_ON_R: { x: 150, y: 245, color: "#38bdf8", label: "Medulla R" },
  LPLC2_LOOMING: { x: 170, y: 170, color: "#f43f5e", label: "LPLC2 Loom" },
  ORN: { x: 80, y: 170, color: "#a855f7", label: "Antenna AL" },
  PN: { x: 140, y: 170, color: "#a855f7", label: "PN Projection" },
  CX_EPG: { x: 230, y: 130, color: "#3b82f6", label: "CX Compass" },
  MB_KC: { x: 260, y: 210, color: "#ec4899", label: "Kenyon Cells" },
  MB_PAM_DA: { x: 280, y: 265, color: "#10b981", label: "PAM Dopamine" },
  MB_PPL1_DA: { x: 240, y: 265, color: "#f43f5e", label: "PPL1 Aversive" },
  MBON_APPROACH: { x: 330, y: 180, color: "#10b981", label: "MBON Appr" },
  MBON_AVOID: { x: 330, y: 230, color: "#f43f5e", label: "MBON Avoid" },
  DN_FORWARD: { x: 410, y: 120, color: "#f97316", label: "DN Forward" },
  DN_STEER_L: { x: 410, y: 70, color: "#f97316", label: "DN Steer L" },
  DN_STEER_R: { x: 410, y: 170, color: "#f97316", label: "DN Steer R" },
  DN_GIANT_FIBER: { x: 410, y: 220, color: "#f43f5e", label: "Giant Fiber" },
  DN_PROBOSCIS: { x: 410, y: 270, color: "#fbbf24", label: "DN Proboscis" },
};

export const BRAIN_EDGES: [string, string][] = [
  ["RETINA_L", "LAMINA_L"], ["RETINA_R", "LAMINA_R"],
  ["LAMINA_L", "MEDULLA_ON_L"], ["LAMINA_R", "MEDULLA_ON_R"],
  ["RETINA_L", "LPLC2_LOOMING"], ["RETINA_R", "LPLC2_LOOMING"],
  ["ORN", "PN"], ["PN", "MB_KC"],
  ["MEDULLA_ON_L", "CX_EPG"], ["MEDULLA_ON_R", "CX_EPG"],
  ["MB_KC", "MBON_APPROACH"], ["MB_KC", "MBON_AVOID"],
  ["MB_PAM_DA", "MBON_APPROACH"], ["MB_PPL1_DA", "MBON_AVOID"],
  ["LPLC2_LOOMING", "DN_GIANT_FIBER"],
  ["MBON_APPROACH", "DN_FORWARD"], ["MBON_APPROACH", "DN_PROBOSCIS"],
  ["MBON_AVOID", "DN_STEER_L"],
  ["CX_EPG", "DN_FORWARD"],
];

export interface FoodItem {
  id: string;
  x: number;
  y: number;
  radius?: number;
}

export interface LightItem {
  id: string;
  x: number;
  y: number;
  intensity?: number;
}

export interface ThreatItem {
  id: string;
  x: number;
  y: number;
  radius: number;
  vx?: number;
  vy?: number;
}

export interface FlyTelemetry {
  position?: { x: number; y: number; angle: number };
  speed?: number;
  is_feeding?: boolean;
  dopamine?: {
    current_level: number;
    total_rewards: number;
    total_punishments: number;
  };
  vision?: {
    fov?: number;
    ommatidia_count?: number;
    sensitivity?: number;
    ommatidia_view?: number[];
    looming_signal?: number;
  };
  brain?: {
    step?: number;
    total_spikes?: number;
    groups?: Record<string, { firing_rate: number; mean_v?: number }>;
  };
}

export interface TelemetryData {
  fly?: FlyTelemetry;
  foods?: FoodItem[];
  lights?: LightItem[];
  threats?: ThreatItem[];
  action?: {
    state?: string;
    forward_thrust: number;
    turn_yaw: number;
    wingbeat_hz: number;
    proboscis_extended?: boolean;
    escape_jump?: boolean;
  };
  compute_ms?: number;
  is_paused?: boolean;
  diagnostics?: {
    nearest_food?: { dist: number; angle_err_deg: number } | null;
    contrast_norm?: number;
    antenna_left_c?: number;
    antenna_right_c?: number;
    p9_left_rate?: number;
    p9_right_rate?: number;
    dna_left_rate?: number;
    dna_right_rate?: number;
    is_feeding?: boolean;
  };
}

export interface TestLogEntry {
  step: number;
  x: string;
  y: string;
  angleDeg: number;
  dist: string;
  errDeg: string;
  antL: string;
  antR: string;
  contrast: string;
  p9: string;
  dna: string;
  fwd: string;
  yaw: string;
  speed: string;
  badgeText: string;
  badgeType: "idle" | "feeding" | "turning" | "surge";
}

export interface BlackjackSimState {
  dealerHand: (number | string)[];
  flyHand: (number | string)[];
  dealerTotal: number;
  flyTotal: number;
  currentDecision: string;
  gesture: "raise_arm" | "wave_arm" | "cheer" | "idle";
  stepLog: string;
  lastOutcome: string | null;
}

export interface BlackjackStats {
  wins: number;
  losses: number;
  streak: number;
  accumulatedDopamine: number;
}
