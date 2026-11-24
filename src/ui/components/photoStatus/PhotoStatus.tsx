import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheckBig, Clock, CircleX, Info, X } from "lucide-react";
import type { EmployeePhotoReviewStatus as PhotoStatusType } from "../../../domains/employee";
import { dismissNotice, isNoticeDismissed } from "../../../resourceCache";
import styles from "./style.module.css";

export type PhotoStatusAvailability = "loading" | "ready" | "unavailable";
const statuses = {
  PENDING: {
    title: "Foto em análise",
    message:
      "Sua fotografia foi enviada e está aguardando análise da Secretaria.",
    Icon: Clock,
    tone: "pending",
  },
  APPROVED: {
    title: "Foto aprovada",
    message: "Sua fotografia foi aprovada pela Secretaria.",
    Icon: CircleCheckBig,
    tone: "approved",
  },
  REJECTED: {
    title: "Fotografia rejeitada",
    message: "Envie uma nova foto para análise da Secretaria.",
    Icon: CircleX,
    tone: "rejected",
  },
} as const;
export default function PhotoStatus({
  status,
  availability,
  approvedPhotoId,
  rejectionId,
  rejectionReason,
  previousApproved,
}: {
  status?: PhotoStatusType;
  availability: PhotoStatusAvailability;
  approvedPhotoId?: string;
  rejectionId?: string;
  rejectionReason?: string | null;
  previousApproved?: boolean;
}) {
  const storageKey = approvedPhotoId
    ? "@CarteirinhaFuncionarios:approvedPhotoNotice:" +
      encodeURIComponent(approvedPhotoId)
    : undefined;
  const noticeId = status === "REJECTED" ? rejectionId : storageKey;
  const [dismissed, setDismissed] = useState<string>();
  let saved = false;
  if (status === "APPROVED" && storageKey) {
    try {
      saved = localStorage.getItem(storageKey) === "1";
    } catch {
      /* Mantém fechamento em memória. */
    }
  }
  if (status === "REJECTED" && rejectionId)
    saved = isNoticeDismissed(rejectionId);
  const close = () => {
    if (!noticeId) return;
    setDismissed(noticeId);
    if (status === "REJECTED") dismissNotice(noticeId);
    else if (storageKey) {
      try {
        localStorage.setItem(storageKey, "1");
      } catch {
        /* Mantém fechamento em memória. */
      }
    }
  };
  if (availability === "loading") return null;
  const current =
    availability === "ready" && status ? statuses[status] : undefined;
  if (availability === "ready" && !current) return null;
  if (current && noticeId && (saved || dismissed === noticeId)) return null;
  const Icon = current?.Icon ?? Info;
  return (
    <section
      className={
        styles.card +
        " " +
        (current ? styles[current.tone] : styles.neutral) +
        (noticeId ? " " + styles.dismissible : "")
      }
      aria-label="Situação da fotografia"
    >
      <Icon size={22} aria-hidden="true" className={styles.icon} />
      <div>
        <div role="status" aria-live="polite">
          <h2>{current?.title ?? "Status da foto indisponível"}</h2>
          {status === "REJECTED" && rejectionReason && (
            <p>
              <strong>Motivo:</strong> {rejectionReason}
            </p>
          )}
          <p>
            {status === "REJECTED" && previousApproved
              ? "A última foto enviada foi rejeitada. Sua foto aprovada anteriormente continua na carteirinha."
              : (current?.message ??
                "Não foi possível confirmar a situação atual. Verifique sua conexão e tente novamente.")}
          </p>
        </div>
        {current && status === "REJECTED" && (
          <Link to="/foto" className={styles.action}>
            Enviar nova foto
          </Link>
        )}
      </div>
      {current && noticeId && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={
            status === "REJECTED"
              ? "Fechar aviso de fotografia rejeitada"
              : "Fechar aviso de foto aprovada"
          }
          onClick={close}
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
