import React, { useRef, useEffect } from "react";
import { FileText, Copy, Download, Trash2, X, ArrowDown } from "lucide-react";
import { TestLogEntry } from "../utils/constants";

interface TestLogDrawerProps {
  isOpen: boolean;
  isPaused: boolean;
  entries: TestLogEntry[];
  isAutoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClearLog: () => void;
  onClose: () => void;
}

export const TestLogDrawer: React.FC<TestLogDrawerProps> = ({
  isOpen,
  isPaused,
  entries,
  isAutoScroll,
  onToggleAutoScroll,
  onClearLog,
  onClose,
}) => {
  const tableWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAutoScroll && tableWrapperRef.current && isOpen) {
      tableWrapperRef.current.scrollTop = tableWrapperRef.current.scrollHeight;
    }
  }, [entries, isAutoScroll, isOpen]);

  const copyTsv = () => {
    if (entries.length === 0) return;
    const header = "Paso\tX\tY\tAngulo\tDist_Gota\tError_Ang\tAnt_L\tAnt_R\tContraste\tP9_L_R\tDNa_L_R\tFwd\tYaw\tVelocidad\tEstado\n";
    const rows = entries
      .map(
        (e) =>
          `${e.step}\t${e.x}\t${e.y}\t${e.angleDeg}\t${e.dist}\t${e.errDeg}\t${e.antL}\t${e.antR}\t${e.contrast}\t${e.p9}\t${e.dna}\t${e.fwd}\t${e.yaw}\t${e.speed}\t${e.badgeText}`
      )
      .join("\n");

    navigator.clipboard.writeText(header + rows);
  };

  const exportCsv = () => {
    if (entries.length === 0) return;
    const header = "Paso,X,Y,Angulo,Dist_Gota,Error_Ang,Ant_L,Ant_R,Contraste,P9,DNa,Fwd,Yaw,Velocidad,Estado\n";
    const rows = entries
      .map(
        (e) =>
          `${e.step},${e.x},${e.y},${e.angleDeg},${e.dist},${e.errDeg},${e.antL},${e.antR},${e.contrast},"${e.p9}","${e.dna}",${e.fwd},${e.yaw},${e.speed},"${e.badgeText}"`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moscabrain_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`test-log-drawer ${!isOpen ? "collapsed" : ""}`}>
      <div className="test-log-header">
        <div className="test-log-title">
          <FileText size={14} />
          <strong>Log Cinemático y Neuronal en Vivo</strong>
          <span className="badge">{entries.length} pasos</span>
          <span
            style={{
              fontSize: "9px",
              padding: "2px 6px",
              background: isPaused ? "rgba(251, 191, 36, 0.2)" : "rgba(16, 185, 129, 0.2)",
              color: isPaused ? "var(--accent-gold)" : "var(--accent-green)",
              border: "1px solid currentColor",
            }}
          >
            {isPaused ? "PAUSADO" : "EN VIVO"}
          </span>
        </div>

        <div className="test-log-actions">
          <button
            className={`mini-btn ${isAutoScroll ? "active" : ""}`}
            onClick={onToggleAutoScroll}
            title="Alternar desplazamiento automático"
          >
            <ArrowDown size={11} />
            <span>AUTO-SCROLL: {isAutoScroll ? "ON" : "OFF"}</span>
          </button>

          <button className="mini-btn" onClick={onClearLog} title="Limpiar registros">
            <Trash2 size={11} />
            <span>LIMPIAR</span>
          </button>

          <button className="mini-btn" onClick={copyTsv} title="Copiar en formato TSV">
            <Copy size={11} />
            <span>COPIAR</span>
          </button>

          <button className="mini-btn" onClick={exportCsv} title="Descargar como CSV">
            <Download size={11} />
            <span>CSV</span>
          </button>

          <button className="mini-btn" onClick={onClose} title="Cerrar consola">
            <X size={11} />
            <span>CERRAR</span>
          </button>
        </div>
      </div>

      <div className="test-log-table-wrapper" ref={tableWrapperRef}>
        <table className="test-log-table">
          <thead>
            <tr>
              <th>Paso</th>
              <th>Pos (X, Y)</th>
              <th>Ángulo θ</th>
              <th>Dist. Gota</th>
              <th>Error Ang.</th>
              <th>Antena (L / R)</th>
              <th>Contraste</th>
              <th>Motores (P9 / DNa)</th>
              <th>Fwd / Yaw</th>
              <th>Velocidad</th>
              <th>Comportamiento</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                  Esperando telemetría del simulador...
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.step}>
                  <td>#{e.step}</td>
                  <td>({e.x}, {e.y})</td>
                  <td>{e.angleDeg}°</td>
                  <td>{e.dist}</td>
                  <td>{e.errDeg}</td>
                  <td>{e.antL} / {e.antR}</td>
                  <td>{e.contrast}</td>
                  <td>P9:{e.p9} | DNa:{e.dna}</td>
                  <td>{e.fwd} | {e.yaw}</td>
                  <td>{e.speed} px/f</td>
                  <td>
                    <span className={`badge-behavior badge-${e.badgeType}`}>
                      {e.badgeText}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
