import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, IdCard, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getCard, getProfile, verifyCard } from "../../../api/employee";
import type { EmployeeCredentialReasonCode } from "../../../domains/employee";
import { usePhotoUrl, useResource } from "../../../hooks";
import { InternetWatcher } from "../../components/internetwatcher/InternetWatcher";
import PageLayout from "../../components/page/PageLayout";
import { Status } from "../Status";
import styles from "./card.module.css";
import qr from "../digitalStudentScan/styleQrCode.module.css";
import validation from "../validacao/style.module.css";

const perfilDefault = "/perfil_default.png";
const logoFatecPreto = "/fatec_itaquera_logo_preto.png";
const logoFatecBranco = "/fatec_itaquera_logo.png";
const logoCps = "/cps_logo_cor.png";
const logoCpsBranco = "/cps_logo_br.png";

const reasonLabels: Partial<Record<EmployeeCredentialReasonCode, string>> = {
  ACCOUNT_BLOCKED: "Conta bloqueada.",
  ACCOUNT_ARCHIVED: "Conta arquivada.",
  ADMISSION_FUTURE: "O vínculo ainda não começou.",
  NO_ACTIVE_ASSIGNMENT: "Nenhuma função vigente.",
  PHOTO_PENDING: "Foto em análise.",
  PHOTO_REJECTED: "Foto reprovada.",
  PHOTO_MISSING: "Foto aprovada indisponível.",
};
const reason = (code: EmployeeCredentialReasonCode | null) =>
  (code && reasonLabels[code]) || "Carteirinha indisponível para validação.";
const civilDate = (date: string) => date.split("-").reverse().join("/");
const validity = (kind: string, until: string | null) =>
  until
    ? civilDate(until)
    : kind === "INDETERMINATE"
      ? "Indeterminada"
      : "Indisponível";
const assignmentStatus = {
  ACTIVE: "Ativa",
  FUTURE: "Futura",
  EXPIRED: "Vencida",
  ENDED: "Encerrada",
  ARCHIVED: "Arquivada",
};
const verificationUrl = (raw: string) => {
  try {
    const url = new URL(raw, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname.startsWith("/funcionarios/verificar/")
      ? url.href
      : "";
  } catch {
    return "";
  }
};

export function CardScreen() {
  const navigate = useNavigate();
  const result = useResource(getCard);
  const profile = useResource(getProfile);
  const [showBack, setShowBack] = useState(false);
  const card = result.data;
  const photoSrc = usePhotoUrl(card?.approvedPhotoUrl);
  if (!card)
    return (
      <PageLayout title="Carteirinha" backTo="/">
        <Status {...result} />
      </PageLayout>
    );
  const validationUrl = verificationUrl(card.verificationUrl);
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <button aria-label="Voltar ao menu" onClick={() => navigate("/")}>
          <ArrowLeft aria-hidden="true" />
        </button>
        <h1>
          <IdCard aria-hidden="true" /> Carteirinha funcional
        </h1>
      </header>
      <div className={styles.content}>
        <InternetWatcher />
        <div className={styles.cardStage}>
          <article
            className={styles.card}
            aria-label={
              showBack ? "Verso da carteirinha" : "Frente da carteirinha"
            }
          >
            {!showBack ? (
              <>
                <div className={styles.institutionalHeader}>
                  <img src={logoFatecPreto} alt="Fatec Itaquera" />
                  <img src={logoCps} alt="Centro Paula Souza" />
                  <p>
                    Governo do Estado
                    <br />
                    <strong>de São Paulo</strong>
                  </p>
                </div>
                <div className={styles.frontBody}>
                  <dl className={styles.frontData}>
                    <div>
                      <dt>Nome</dt>
                      <dd className={styles.name}>{card.displayName}</dd>
                    </div>
                    <div>
                      <dt>Unidade</dt>
                      <dd>{card.institutionName}</dd>
                    </div>
                    <div>
                      <dt>Função</dt>
                      <dd>
                        {card.activeAssignments
                          .map((item) => item.title)
                          .join(" · ") || "Nenhuma função vigente"}
                      </dd>
                    </div>
                  </dl>
                  <div className={styles.photoFrame}>
                    <img
                      src={photoSrc || perfilDefault}
                      alt="Fotografia do funcionário"
                      onError={(e) => {
                        e.currentTarget.src = perfilDefault;
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.backBand}>
                  <span>Identificação funcional</span>
                </div>
                <div className={styles.backContent}>
                  <dl className={styles.backData}>
                    <div>
                      <dt>Matrícula funcional</dt>
                      <dd>{card.registrationNumber || "Não informada"}</dd>
                    </div>
                    <div>
                      <dt>Admissão</dt>
                      <dd>{civilDate(card.admissionDate)}</dd>
                    </div>
                    <div>
                      <dt>Validade</dt>
                      <dd>
                        {validity(
                          card.credential.validityKind,
                          card.credential.validUntil,
                        )}
                      </dd>
                    </div>
                    {profile.data?.rg && (
                      <div>
                        <dt>RG</dt>
                        <dd>{profile.data.rg}</dd>
                      </div>
                    )}
                  </dl>
                  <div className={styles.backDetails}>
                    <div>
                      <p className={styles.unit}>{card.institutionName}</p>
                      <p>
                        Documento pessoal e intransferível. Apresente a
                        carteirinha para identificação e utilize o QR Code para
                        consultar sua validade.
                      </p>
                      <span className={styles.cardStatus}>
                        {card.credential.valid
                          ? "Carteirinha válida"
                          : reason(card.credential.reasonCode)}
                      </span>
                    </div>
                    <div className={styles.qrColumn}>
                      <img src={logoFatecPreto} alt="Fatec Itaquera" />
                      <div className={styles.qrContainer}>
                        {card.credential.valid && validationUrl ? (
                          <QRCodeSVG
                            value={validationUrl}
                            size={100}
                            marginSize={4}
                            title="QR Code da carteirinha"
                          />
                        ) : (
                          <div className={styles.qrBlocked}>
                            <AlertCircle aria-hidden="true" size={24} />
                            <span>QR indisponível</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </article>
        </div>
        <button
          className={styles.flipButton}
          onClick={() => setShowBack(!showBack)}
          aria-label={
            showBack
              ? "Mostrar frente da carteirinha"
              : "Mostrar verso da carteirinha"
          }
        >
          {showBack ? "Mostrar frente" : "Mostrar verso"}
        </button>
        <p className={styles.sideLabel} aria-live="polite">
          {showBack ? "Verso" : "Frente"}
        </p>
        {!card.credential.valid && (
          <p role="status" className={styles.availability}>
            {reason(card.credential.reasonCode)}
          </p>
        )}
        {profile.data && (
          <section className="information-panel">
            <h2>Funções</h2>
            <ul>
              {profile.data.assignments.map((item) => (
                <li key={item.id}>
                  {item.title} · {assignmentStatus[item.effectiveStatus]}
                  {item.startsOn && " · Início: " + civilDate(item.startsOn)}
                  {item.validUntil && " · Até: " + civilDate(item.validUntil)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

export function QrScreen() {
  const navigate = useNavigate();
  const result = useResource(getCard);
  const card = result.data;
  const url = card && verificationUrl(card.verificationUrl);
  return (
    <main className={qr.container}>
      <div className={qr.appWrapper}>
        <header className={qr.redHeader}>
          <button
            className={qr.backButton}
            aria-label="Voltar ao menu"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={24} color="white" strokeWidth={3} />
          </button>
          <img
            src={logoFatecBranco}
            className={qr.logoTop}
            alt="Fatec Itaquera"
          />
        </header>
        <div className={qr.contentWrapper}>
          <div className={qr.cardContainer}>
            <InternetWatcher />
            <h1 className={qr.mainTitle}>Validação da Carteirinha</h1>
            <Status {...result} />
            {card && (
              <>
                <div className={qr.qrViewportContainer}>
                  <div className={qr.qrCornerTopLeft} />
                  <div className={qr.qrCornerTopRight} />
                  <div className={qr.qrCornerBottomLeft} />
                  <div className={qr.qrCornerBottomRight} />
                  <div className={qr.qrWrapper}>
                    {card.credential.valid && url ? (
                      <QRCodeSVG
                        value={url}
                        size={256}
                        style={{ width: "100%", height: "100%" }}
                        marginSize={4}
                        title="QR Code da carteirinha"
                      />
                    ) : (
                      <div className={qr.qrBlocked}>
                        <AlertCircle size={30} />
                        {card.credential.valid
                          ? "Endereço de validação indisponível."
                          : reason(card.credential.reasonCode)}
                      </div>
                    )}
                  </div>
                </div>
                {card.credential.valid && url && (
                  <>
                    <div className={qr.infoInstructionRow}>
                      <QrCode aria-hidden="true" className={qr.scanIcon} />
                      <p className={qr.instructionText}>
                        Leia o QR Code para validar sua carteirinha digital.
                      </p>
                    </div>
                    <a href={url}>Abrir página de validação</a>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <footer className={qr.footerLogos}>
          <img
            src={logoCpsBranco}
            alt="Centro Paula Souza"
            className={qr.footerLogoImg}
          />
        </footer>
      </div>
    </main>
  );
}

export function VerificationScreen() {
  const { qrcode = "" } = useParams();
  const load = useCallback(
    (signal: AbortSignal) => verifyCard(qrcode, signal),
    [qrcode],
  );
  const result = useResource(load);
  const credential = result.data;
  const image = usePhotoUrl(
    credential?.valid ? credential.photoUrl : null,
    false,
  );
  return (
    <PageLayout
      title="Validação da carteirinha"
      subtitle="Consulta pública da identificação funcional."
      backTo="/login"
      backLabel="Acessar Carteirinha Digital"
      brand={<img src={logoFatecBranco} alt="Fatec Itaquera" />}
      narrow
      roundedHeader
    >
      <Status {...result} />
      {credential && (
        <>
          <section className={validation.card}>
            <h2 className={validation.cardHeaderTitle}>Funcionário</h2>
            {credential.valid ? (
              <>
                <div className={validation.studentInfoSection}>
                  {image && (
                    <img
                      className={validation.avatar}
                      src={image}
                      alt="Foto da carteirinha"
                    />
                  )}
                  <div className={validation.studentDetails}>
                    <p className={validation.studentName}>
                      {credential.displayName}
                    </p>
                    {credential.activeAssignments.map((item, index) => (
                      <p key={index}>{item.title}</p>
                    ))}
                  </div>
                </div>
                <p className={validation.badgeWrapper}>
                  Carteirinha válida · Validade{" "}
                  {validity(credential.validityKind, credential.validUntil)}
                </p>
              </>
            ) : (
              <p role="status">
                Carteirinha inválida. {reason(credential.reasonCode)}
              </p>
            )}
          </section>
          <p className={validation.timestamp}>
            Verificado em{" "}
            {new Date(credential.checkedAt).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        </>
      )}
      <footer className={validation.redFooter}>
        <img
          src={logoCpsBranco}
          className={validation.govLogo}
          alt="Centro Paula Souza"
        />
      </footer>
    </PageLayout>
  );
}
