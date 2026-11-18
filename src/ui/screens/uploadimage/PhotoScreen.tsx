import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../api/config/apiClient';
import { getPhoto, getProfile, removePhoto, uploadPhoto } from '../../../api/employee';
import { usePhotoUrl, useResource } from '../../../hooks';
import { compressImage } from '../../../utils/imageProcessing';
import MessageModal from '../../components/MessageModal/MessageModal';
import PageLayout from '../../components/page/PageLayout';
import { Status } from '../Status';
import styles from './style.module.css';

export default function PhotoScreen() {
  const photo = useResource(getPhoto);
  const profile = useResource(getProfile);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<{ file: File; url: string; id: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const pending = photo.data?.pending;
  const approved = photo.data?.approved;
  const pendingUrl = usePhotoUrl(pending?.contentUrl);
  const approvedUrl = usePhotoUrl(approved?.contentUrl);
  const rejected = profile.data?.credential.reasonCode === 'PHOTO_REJECTED' || pending?.reviewStatus === 'REJECTED';

  useEffect(() => {
    if (draft) return () => URL.revokeObjectURL(draft.url);
  }, [draft]);

  async function prepare(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const compressed = await compressImage(file);
      setDraft({ file: compressed, url: URL.createObjectURL(compressed), id: crypto.randomUUID() });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function mutate(remove: boolean) {
    if (busy || !photo.data || (!remove && !draft)) return;
    setConfirmRemoval(false);
    setBusy(true);
    setError('');
    try {
      if (remove) await removePhoto({ expectedVersion: photo.data.version, requestId: crypto.randomUUID() });
      else if (draft) await uploadPhoto(draft.file, photo.data.version, draft.id);
      setDraft(undefined);
      setNotice(remove ? 'Foto removida.' : 'Foto recebida e encaminhada para análise.');
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409
        ? 'A situação da foto mudou. Confira o estado atualizado antes de tentar novamente.'
        : (e as Error).message);
    } finally {
      photo.reload();
      profile.reload();
      setBusy(false);
    }
  }

  const preview = draft?.url || pendingUrl || approvedUrl;
  return <PageLayout title="Enviar fotografia" subtitle="Use uma foto com fundo neutro, rosto centralizado e sem óculos escuros." backTo="/" narrow roundedHeader>
    <div className={styles.container}>
      <Status {...photo} />
      <div className={styles.box}>
        <img src={preview || '/upload_avatar.png'} className={preview ? styles.userImage : styles.placeholderImage} alt={draft ? 'Prévia da nova foto' : 'Foto da carteirinha'} />
      </div>
      {photo.data && <p role="status">{pending?.reviewStatus === 'PENDING' ? 'Foto em análise.' :
        rejected ? 'A foto não foi aprovada.' : approved ? 'Foto aprovada na carteirinha.' : 'Nenhuma foto em análise ou aprovada.'}</p>}
      {pending?.reviewReason && <p>{pending.reviewReason}</p>}
      <p>Como deseja enviar sua foto?</p>
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" ref={camera} hidden onChange={e => void prepare(e.currentTarget)} />
      <input type="file" accept="image/jpeg,image/png,image/webp" ref={gallery} hidden onChange={e => void prepare(e.currentTarget)} />
      <div className="action-row">
        <button className={styles.button} disabled={busy} onClick={() => camera.current?.click()}>Tirar Foto</button>
        <button className={styles.button} disabled={busy} onClick={() => gallery.current?.click()}>Galeria</button>
      </div>
      <button className={styles.button} disabled={busy || !draft || !photo.data} onClick={() => void mutate(false)}>{busy ? 'Aguarde…' : 'Confirmar Envio'}</button>
      {(approved || pending) && <button className="secondary-action" disabled={busy} onClick={() => setConfirmRemoval(true)}>Remover foto</button>}
      <button className="secondary-action" disabled={busy} onClick={() => { photo.reload(); profile.reload(); }}>Atualizar situação</button>
      {error && <p role="alert">{error}</p>}
    </div>
    {notice && <MessageModal visible tone="success" title="Fotografia" message={notice} confirmText="OK" onConfirm={() => setNotice('')} />}
    {confirmRemoval && <MessageModal visible tone="warning" title="Remover foto?" message="A foto aprovada e a foto em análise serão retiradas da sua carteirinha." confirmText="Remover" cancelText="Cancelar" onCancel={() => setConfirmRemoval(false)} onConfirm={() => void mutate(true)} />}
  </PageLayout>;
}
