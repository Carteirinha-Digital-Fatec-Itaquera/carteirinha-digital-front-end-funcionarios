import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import CardFlip from "../../src/ui/components/cardFlip/CardFlip";
export function Harness() {
  const [version, setVersion] = useState(0);
  return (
    <div style={{ maxWidth: 600, margin: "30px auto" }}>
      <CardFlip
        key={version}
        front={
          <article
            aria-label="Face de teste frontal"
            style={{ padding: 24, minHeight: 140, background: "#eff4f5" }}
          >
            Frente sintética
          </article>
        }
        back={
          <article
            aria-label="Face de teste traseira"
            style={{ padding: 24, minHeight: 140, background: "#dceef2" }}
          >
            Verso sintético
          </article>
        }
      />
      <button onClick={() => setVersion((v) => v + 1)}>
        Recriar componente
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
