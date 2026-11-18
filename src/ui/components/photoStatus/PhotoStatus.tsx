import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheckBig, Clock, CircleX, Info, X } from 'lucide-react';
import type { EmployeePhotoReviewStatus as PhotoStatusType } from '../../../domains/employee';
import styles from './style.module.css';

export type PhotoStatusAvailability = 'loading' | 'ready' | 'unavailable';
const statuses = {
  PENDING: { title: 'Foto em análise', message: 'Sua fotografia foi enviada e está aguardando análise da Secretaria.', Icon: Clock, tone: 'pending' },
  APPROVED: { title: 'Foto aprovada', message: 'Sua fotografia foi aprovada pela Secretaria.', Icon: CircleCheckBig, tone: 'approved' },
  REJECTED: { title: 'Foto reprovada', message: 'Sua fotografia não foi aprovada. Envie uma nova foto para análise.', Icon: CircleX, tone: 'rejected' },
} as const;

export default function PhotoStatus({ status, availability, approvedPhotoId }: {
  status?: PhotoStatusType;
  availability: PhotoStatusAvailability;
  approvedPhotoId?: string;
}) {
  // Cada upload recebe um UUID próprio do backend. Guardar só o ID da foto
  // permite uma nova aprovação sem gravar nome, email, matrícula ou ID de conta.
  const storageKey = approvedPhotoId
    ? `@CarteirinhaFuncionarios:approvedPhotoNotice:${encodeURIComponent(approvedPhotoId)}`
    : undefined;
  const [dismissed, setDismissed] = useState(false);
  let savedDismissal = false;
  if (storageKey) {
    try { savedDismissal = localStorage.getItem(storageKey) === '1'; } catch { /* Fechamento local nesta montagem. */ }
  }
  const dismissApproval = () => {
    setDismissed(true);
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch { /* Fechamento local nesta montagem. */ }
    }
  };
  // Cache e sucesso do upload não confirmam o estado atual da análise.
  if (availability === 'loading') return null;
  const current = availability === 'ready' && (status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED') ? statuses[status] : null;
  if (availability === 'ready' && !current) return null;
  if (current && status === 'APPROVED' && (savedDismissal || dismissed)) return null;
  const Icon = current?.Icon ?? Info;
  return (
    <section className={`${styles.card} ${current ? styles[current.tone] : styles.neutral} ${current && status === 'APPROVED' ? styles.dismissible : ''}`} aria-label="Situação da fotografia">
      <Icon size={22} aria-hidden="true" className={styles.icon} />
      <div>
        <div role="status" aria-live="polite">
          <h2>{current?.title ?? 'Status da foto indisponível'}</h2>
          <p>{current?.message ?? 'Não foi possível confirmar a situação atual. Verifique sua conexão e acesse esta tela novamente.'}</p>
        </div>
        {current && status === 'REJECTED' && <Link to="/foto" className={styles.action}>Enviar nova foto</Link>}
      </div>
      {current && status === 'APPROVED' && (
        <button type="button" className={styles.dismiss} aria-label="Fechar aviso de foto aprovada" onClick={dismissApproval}>
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
