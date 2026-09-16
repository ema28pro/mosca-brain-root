import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { TelemetryData } from "../../utils/constants";

interface VisionTabProps {
  telemetry: TelemetryData | null;
  onApplyVision: (fov: number, ommatidia: number, sens: number) => void;
}

export const VisionTab: React.FC<VisionTabProps> = ({ telemetry, onApplyVision }) => {
  const [fov, setFov] = useState(270);
  const [ommatidia, setOmmatidia] = useState(32);
  const [sens, setSens] = useState(1.0);

  const vision = telemetry?.fly?.vision || {};
  const ommatidiaView = vision.ommatidia_view || [];
  const isLooming = (vision.looming_signal || 0) > 0.4;

  const handleFovChange = (val: number) => {
    setFov(val);
    onApplyVision(val, ommatidia, sens);
  };

  const handleOmmatidiaChange = (val: number) => {
    setOmmatidia(val);
    onApplyVision(fov, val, sens);
  };

  const handleSensChange = (val: number) => {
    setSens(val);
    onApplyVision(fov, ommatidia, val);
  };

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Retina de Ojo Compuesto (Omatidios)</h3>
        <span className="tag">Muestreo Hexagonal Retinotópico</span>
      </div>

      <div className="ommatidia-monitor">
        <div className="eye-label-row">
          <span>Ojo Izquierdo</span>
          <span>Ojo Derecho</span>
        </div>

        <div
          className="ommatidia-grid"
          style={{ gridTemplateColumns: `repeat(${Math.max(16, ommatidiaView.length)}, 1fr)` }}
        >
          {ommatidiaView.length === 0
            ? Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className="ommatidium-cell" />
              ))
            : ommatidiaView.map((val, i) => {
                const b = Math.min(255, Math.floor(val * 255));
                return (
                  <div
                    key={i}
                    className="ommatidium-cell"
                    style={{
                      backgroundColor: `rgb(${Math.floor(b * 0.2)}, ${Math.floor(b * 0.7)}, ${b})`,
                    }}
                  />
                );
              })}
        </div>
      </div>

      <div className="config-group">
        <div className="control-row">
          <label>Campo Visual Panorámico (FOV):</label>
          <div className="slider-val-box">
            <input
              type="range"
              min="90"
              max="360"
              step="10"
              value={fov}
              onChange={(e) => handleFovChange(parseFloat(e.target.value))}
            />
            <span>{fov}°</span>
          </div>
        </div>

        <div className="control-row">
          <label>Número de Omatidios:</label>
          <div className="slider-val-box">
            <input
              type="range"
              min="16"
              max="64"
              step="4"
              value={ommatidia}
              onChange={(e) => handleOmmatidiaChange(parseInt(e.target.value, 10))}
            />
            <span>{ommatidia}</span>
          </div>
        </div>

        <div className="control-row">
          <label>Sensibilidad Fotorreceptores:</label>
          <div className="slider-val-box">
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.1"
              value={sens}
              onChange={(e) => handleSensChange(parseFloat(e.target.value))}
            />
            <span>{sens.toFixed(1)}x</span>
          </div>
        </div>

        {isLooming && (
          <div className="alert-box" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={14} />
            <span>ALERTA: SEÑAL LOOMING DETECTADA (Sombra amenazante en rápida expansión)</span>
          </div>
        )}
      </div>
    </div>
  );
};
