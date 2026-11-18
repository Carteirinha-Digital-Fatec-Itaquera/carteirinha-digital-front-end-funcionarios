import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, IdCard, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getCard, getProfile, verifyCard } from '../../../api/employee';
import type { EmployeeCredentialReasonCode } from '../../../domains/employee';
import { usePhotoUrl, useResource } from '../../../hooks';
import { InternetWatcher } from '../../components/internetwatcher/InternetWatcher';
import PageLayout from '../../components/page/PageLayout';
import { Status } from '../Status';
import styles from '../digitalstudent/style.module.css';
import qr from '../digitalStudentScan/styleQrCode.module.css';
import validation from '../validacao/style.module.css';

const perfilDefault = '/perfil_default.png';
const logoFatecPreto = '/fatec_itaquera_logo_preto.png';
const logoFatecBranco = '/fatec_itaquera_logo.png';
const logoCps = '/cps_logo_cor.png';
const logoCpsBranco = '/cps_logo_br.png';

const reasonLabels: Partial<Record<EmployeeCredentialReasonCode, string>> = {
  ACCOUNT_BLOCKED: 'Conta bloqueada.', ACCOUNT_ARCHIVED: 'Conta arquivada.',
  ADMISSION_FUTURE: 'O vínculo ainda não começou.', NO_ACTIVE_ASSIGNMENT: 'Nenhuma função vigente.',
  PHOTO_PENDING: 'Foto em análise.', PHOTO_REJECTED: 'Foto reprovada.', PHOTO_MISSING: 'Foto aprovada indisponível.',
};
const reason = (code: EmployeeCredentialReasonCode | null) =>
  (code && reasonLabels[code]) || 'Carteirinha indisponível para validação.';
const civilDate = (date: string) => date.split('-').reverse().join('/');
const validity = (kind: string, until: string | null) =>
  until ? civilDate(until) : kind === 'INDETERMINATE' ? 'Indeterminada' : 'Indisponível';
const assignmentStatus = { ACTIVE: 'Ativa', FUTURE: 'Futura', EXPIRED: 'Vencida', ENDED: 'Encerrada', ARCHIVED: 'Arquivada' };
const verificationUrl = (raw: string) => {
  try {
    const url = new URL(raw, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.pathname.startsWith('/funcionarios/verificar/') ? url.href : '';
  } catch { return ''; }
};

export function CardScreen() {
  const navigate = useNavigate();
  const result = useResource(getCard);
  const profile = useResource(getProfile);
  const [showBack, setShowBack] = useState(false);
  const card = result.data;
  const photoSrc = usePhotoUrl(card?.approvedPhotoUrl);
  if (!card) return <PageLayout title="Carteirinha" backTo="/"><Status {...result} /></PageLayout>;
  const validationUrl = verificationUrl(card.verificationUrl);
  return (
    <div className={styles.container}>
      <div className={styles.appWrapper}>
        <header className={styles.header}>
          <button aria-label="Voltar ao menu" className={styles.backButton} onClick={() => navigate("/")}>
            <ArrowLeft size={24} color="#ffffff" strokeWidth={3} />
          </button>
          <IdCard size={30} aria-hidden="true" />
          <span className={styles.headerTitle}>Carteirinha</span>
          <div style={{ width: 44 }} />
        </header>

        <InternetWatcher />

        <div className={styles.cardStage}>
          <div
            className={`${styles.cardViewport} ${showBack ? styles.cardViewportBack : ''}`}
            role="button" tabIndex={0} aria-label={showBack ? "Mostrar frente da carteirinha" : "Mostrar verso da carteirinha"}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setShowBack(!showBack); } }}
            onClick={() => setShowBack(!showBack)}
          >
            <div className={styles.cardInner}>
              
              <div className={`${styles.cardFace} ${styles.faceFront}`}>
                <div className={styles.frontBlock1}>
                  <img src={logoFatecPreto} className={styles.fatecLogoFront} alt="Fatec" />
                </div>

                <div className={styles.frontBlock2}>
                  <div className={styles.photoColumn}>
                    <div className={styles.photoFrame}>
                      <img src={photoSrc || perfilDefault} alt="Perfil" onError={(e) => e.currentTarget.src = perfilDefault} />
                    </div>
                  </div>
                  
                  <div className={styles.infoColumn}>
                
                    <h2 className={styles.studentName}>{card.displayName}</h2>
                    <p className={styles.courseName}>{card.activeAssignments.map(item => item.title).join(' · ')}</p>
                    <div className={styles.dataGrid}>
                      {card.registrationNumber && <div className={styles.dataItem}>Matrícula: {card.registrationNumber}</div>}
                      <div className={styles.dataItem}>Admissão: {civilDate(card.admissionDate)}</div>
                      <div className={styles.dataItem}>Validade: {validity(card.credential.validityKind, card.credential.validUntil)}</div>
                    </div>
                    <div className={styles.statusBox}>
                      <span className={styles.statusPill} style={{ backgroundColor: card.credential.valid ? 'var(--app-color-success)' : 'var(--app-color-danger)' }}>
                        {card.credential.valid ? 'Válida' : 'Inválida'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={styles.frontBlock3}>
                  <img src={logoCps} alt="CPS" className={styles.footerLogo} />
                  {/* <img src={logoSaoPaulo} alt="SP" className={styles.footerLogo} /> */}
                </div>
              </div>

              <div className={`${styles.cardFace} ${styles.faceBack}`}>
                <div className={styles.backBlock1}>
                  <div className={styles.backHeader}>
                    <img src={logoFatecBranco} alt="Fatec" className={styles.logoFatecBack} />
                    <img src={logoCpsBranco} alt="CPS" className={styles.logoCpsBack} /> 
                  </div>

                  <div className={styles.backMainRow}>
                    <div className={styles.institutionBox}>
                      {/* <p className={styles.instTitle}>FATEC ITAQUERA</p> */}
                      <div className={styles.backInfoCard}>
                        <p className={styles.instSub}>{card.institutionName}</p>
                      </div>
                      <div className={styles.instructions}>
                        
                        <p><ArrowRight color="#ffff" size={15}/>Documento pessoal e intransferível</p>
                        <p><span><ArrowRight color="#ffff" size={15}/></span> Validação via QR Code</p>
                      </div>
                    </div>
                    <div className={styles.qrContainer}>
                      {/* <QRCodeSVG value={validationUrl} size={100} /> */}
                      {card.credential.valid && validationUrl ? (
                        <QRCodeSVG value={validationUrl} size={70} marginSize={4} />
                      ) : (
                        <div className={styles.qrBlocked}>
                          <AlertCircle size={30} color="var(--app-color-danger)" />
                          <span>QR indisponível</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.backBlock2}>
                  <p className={styles.backUrl}>https://www.cps.sp.gov.br</p>
                  
                </div>
              </div>

            </div>
          </div>
        </div>

        {!card.credential.valid && <p role="status">{reason(card.credential.reasonCode)}</p>}
        <p className={styles.flipHint}>Toque para virar a carteirinha</p>
        <div className={styles.dotsRow}>
          <div className={`${styles.dot} ${!showBack ? styles.dotActive : ''}`} />
          <div className={`${styles.dot} ${showBack ? styles.dotActive : ''}`} />
        </div>
        {profile.data && <section className="information-panel"><h2>Funções</h2>
          <ul>{profile.data.assignments.map(item => <li key={item.id}>{item.title} · {assignmentStatus[item.effectiveStatus]}
            {item.startsOn && ' · Início: ' + civilDate(item.startsOn)}
            {item.validUntil && ' · Até: ' + civilDate(item.validUntil)}</li>)}</ul>
        </section>}
      </div>
    </div>
  );
}

export function QrScreen() {
  const navigate = useNavigate();
  const result = useResource(getCard);
  const card = result.data;
  const url = card && verificationUrl(card.verificationUrl);
  return <main className={qr.container}>
    <div className={qr.appWrapper}>
      <header className={qr.redHeader}>
        <button className={qr.backButton} aria-label="Voltar ao menu" onClick={() => navigate('/')}><ArrowLeft size={24} strokeWidth={3} /></button>
        <img src={logoFatecBranco} className={qr.logoTop} alt="Fatec Itaquera" />
      </header>
      <div className={qr.contentWrapper}><div className={qr.cardContainer}>
        <InternetWatcher />
        <h1 className={qr.mainTitle}>Validação da Carteirinha</h1>
        <Status {...result} />
        {card && <>
          <div className={qr.qrViewportContainer}>
            <div className={qr.qrCornerTopLeft} /><div className={qr.qrCornerTopRight} />
            <div className={qr.qrCornerBottomLeft} /><div className={qr.qrCornerBottomRight} />
            <div className={qr.qrWrapper}>
              {card.credential.valid && url ?
                <QRCodeSVG value={url} size={256} style={{ width: '100%', height: '100%' }} marginSize={4} title="QR Code da carteirinha" /> :
                <div className={qr.qrBlocked}><AlertCircle size={30} />{card.credential.valid ? 'Endereço de validação indisponível.' : reason(card.credential.reasonCode)}</div>}
            </div>
          </div>
          {card.credential.valid && url && <>
            <div className={qr.infoInstructionRow}><QrCode aria-hidden="true" className={qr.scanIcon} />
              <p className={qr.instructionText}>Leia o QR Code para validar sua carteirinha digital.</p></div>
            <a href={url}>Abrir página de validação</a>
          </>}
        </>}
      </div></div>
      <footer className={qr.footerLogos}><img src={logoCpsBranco} alt="Centro Paula Souza" className={qr.footerLogoImg} /></footer>
    </div>
  </main>;
}

export function VerificationScreen() {
  const { qrcode = '' } = useParams();
  const load = useCallback((signal: AbortSignal) => verifyCard(qrcode, signal), [qrcode]);
  const result = useResource(load);
  const credential = result.data;
  const image = usePhotoUrl(credential?.valid ? credential.photoUrl : null, false);
  return <PageLayout title="Validação da carteirinha" subtitle="Consulta pública da identificação funcional."
    backTo="/login" backLabel="Acessar Carteirinha Digital" brand={<img src={logoFatecBranco} alt="Fatec Itaquera" />} narrow roundedHeader>
    <Status {...result} />
    {credential && <>
      <section className={validation.card}>
        <h2 className={validation.cardHeaderTitle}>Funcionário</h2>
        {credential.valid ? <>
          <div className={validation.studentInfoSection}>
            {image && <img className={validation.avatar} src={image} alt="Foto da carteirinha" />}
            <div className={validation.studentDetails}>
              <p className={validation.studentName}>{credential.displayName}</p>
              {credential.activeAssignments.map((item, index) => <p key={index}>{item.title}</p>)}
            </div>
          </div>
          <p className={validation.badgeWrapper}>Carteirinha válida · Validade {validity(credential.validityKind, credential.validUntil)}</p>
        </> : <p role="status">Carteirinha inválida. {reason(credential.reasonCode)}</p>}
      </section>
      <p className={validation.timestamp}>Verificado em {new Date(credential.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
    </>}
    <footer className={validation.redFooter}><img src={logoCpsBranco} className={validation.govLogo} alt="Centro Paula Souza" /></footer>
  </PageLayout>;
}
