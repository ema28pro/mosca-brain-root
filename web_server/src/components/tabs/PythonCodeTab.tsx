import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export const PythonCodeTab: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const code = `from moscabrain import FlyAgent

# 1. Instanciar agente con conectoma de FlyWire
fly = FlyAgent()

# 2. Configurar visión retinotópica
fly.vision.configure(fov_horizontal=270, ommatidia_count=32, sensitivity=1.0)

# 3. Inyectar dopamina o trigger
fly.reward(amount=1.0, reason="azucar")

# 4. Ciclo sensorial-motor
action = fly.step()
print(f"Estado: {action.state.name}, Empuje: {action.forward_thrust}")
`;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="tab-content active">
      <div className="sub-header">
        <h3>Código Python Equivalente</h3>
        <button className="btn btn-secondary btn-sm" onClick={copyCode}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? "COPIADO" : "COPIAR CÓDIGO"}</span>
        </button>
      </div>

      <pre className="code-preview">
        <code>{code}</code>
      </pre>
    </div>
  );
};
