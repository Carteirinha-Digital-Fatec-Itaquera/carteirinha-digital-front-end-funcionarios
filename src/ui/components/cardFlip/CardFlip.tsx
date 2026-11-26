import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./style.module.css";

type Props = { front: ReactNode; back: ReactNode };

export default function CardFlip({ front, back }: Props) {
  const [showBack, setShowBack] = useState(false);
  const [turning, setTurning] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hintId = useId();
  const stateId = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  function finish() {
    clearTimeout(timer.current);
    locked.current = false;
    setTurning(false);
  }

  function flip() {
    if (locked.current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    locked.current = !reduced;
    setTurning(!reduced);
    setShowBack((previous) => !previous);
    if (!reduced) timer.current = setTimeout(finish, 800);
  }

  return (
    <>
      <div className={styles.viewport}>
        <div
          className={styles.inner + (showBack ? " " + styles.flipped : "")}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "transform"
            )
              finish();
          }}
        >
          <div className={styles.face} aria-hidden={showBack} inert={showBack}>
            {front}
          </div>
          <div
            className={styles.face + " " + styles.back}
            aria-hidden={!showBack}
            inert={!showBack}
          >
            {back}
          </div>
        </div>
        <button
          type="button"
          className={styles.surface}
          aria-label={
            showBack
              ? "Verso da carteirinha. Mostrar frente da carteirinha"
              : "Frente da carteirinha. Mostrar verso da carteirinha"
          }
          aria-pressed={showBack}
          aria-describedby={hintId + " " + stateId}
          data-turning={turning}
          onClick={flip}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!event.repeat) flip();
            }
          }}
        />
      </div>
      <p id={hintId} className={styles.hint}>
        Toque para virar a carteirinha
      </p>
      <span
        id={stateId}
        className={styles.state}
        aria-live="polite"
        aria-atomic="true"
      >
        {showBack ? "Verso da carteirinha" : "Frente da carteirinha"}
      </span>
    </>
  );
}
