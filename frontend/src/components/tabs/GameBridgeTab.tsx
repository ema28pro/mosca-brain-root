import React, { useState } from "react";

export const GameBridgeTab: React.FC = () => {
  const [stereoMode, setStereoMode] = useState("split");

  const snippet = `# En el bucle de tu videojuego (Pygame, Gym, etc.):
keys = bridge.step_frame(screen_array)

if keys["SPACE"]:
    player.jump()

# Si gana puntos -> ¡Dopamina!
if score_increased:
    bridge.reward(amount=1.0, reason="punto")

# Si choca -> ¡Castigo aversivo!
if crashed:
    bridge.punish(amount=0.8, reason="choque")
`;

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Conector de Pantalla y Teclas (GameBridge)</h3>
        <span className="tag">Doom / Mario / Flappy / Pong</span>
      </div>

      <p style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.4 }}>
        Permite que el conectoma juegue a cualquier videojuego alimentando la imagen de pantalla
        y traduciendo el disparo de sus neuronas motoras descendentes en pulsaciones de teclado.
      </p>

      <div className="config-group">
        <div className="control-row">
          <label>Visión del Juego en Ojos Compuestos:</label>
          <select
            value={stereoMode}
            onChange={(e) => setStereoMode(e.target.value)}
            style={{
              background: "#141b27",
              color: "#fff",
              border: "1px solid var(--panel-border)",
              padding: "5px 8px",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
            }}
          >
            <option value="split">Mitad Dividida (Ojo Izq = Mitad Izq | Ojo Der = Mitad Der)</option>
            <option value="duplicate">Imagen Completa Duplicada en Ambos Ojos</option>
          </select>
        </div>

        <div className="sub-header" style={{ marginTop: "6px" }}>
          <h4>Mapeo de Neuronas a Teclas</h4>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "11px" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "6px 8px",
              border: "1px solid var(--panel-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Avance (DNp01):</span>
            <kbd style={{ background: "#1e293b", padding: "2px 6px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              UP / W
            </kbd>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "6px 8px",
              border: "1px solid var(--panel-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Giro Izq (DNp02):</span>
            <kbd style={{ background: "#1e293b", padding: "2px 6px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              LEFT / A
            </kbd>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "6px 8px",
              border: "1px solid var(--panel-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Giro Der (DNp02):</span>
            <kbd style={{ background: "#1e293b", padding: "2px 6px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>
              RIGHT / D
            </kbd>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "6px 8px",
              border: "1px solid var(--panel-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Salto (Giant Fiber):</span>
            <kbd style={{ background: "#1e293b", padding: "2px 6px", fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>
              SPACE
            </kbd>
          </div>
        </div>

        <div className="sub-header" style={{ marginTop: "10px" }}>
          <h4>Líneas Clave para Modificar tu Juego</h4>
        </div>
        <pre className="code-preview" style={{ fontSize: "10px", padding: "8px" }}>
          <code>{snippet}</code>
        </pre>
      </div>
    </div>
  );
};
