import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IdCard,
  Settings,
  Info,
  MessageSquare,
  Camera,
  QrCode,
  LogOut,
  UserRound,
} from "lucide-react";
import { InternetWatcher } from "../../components/internetwatcher/InternetWatcher";
import MessageModal from "../../components/MessageModal/MessageModal";
import StudentPhoto from "../../components/studentPhoto/StudentPhoto";
import PhotoStatus from "../../components/photoStatus/PhotoStatus";
import { usePhotoUrl, useResource } from "../../../hooks";
import { getPhoto, getProfile } from "../../../api/employee";
import { setSession } from "../../../session";
import useUnreadRequests from "./useUnreadRequests";
import styles from "./style.module.css";

export default function MainMenuScreen() {
  const navigate = useNavigate();
  const unreadRequests = useUnreadRequests();
  const profile = useResource(getProfile);
  const photo = useResource(getPhoto);
  const photoSrc = usePhotoUrl(photo.data?.approved?.contentUrl);
  const rejection =
    !photo.data?.pending &&
    photo.data?.latestAttempt?.reviewStatus === "REJECTED"
      ? photo.data.latestAttempt
      : undefined;
  const status =
    photo.data?.pending?.reviewStatus ??
    (rejection ? "REJECTED" : photo.data?.approved?.reviewStatus);
  const [messageDialog, setMessageDialog] = useState<"logout" | "photo" | null>(
    null,
  );
  const logoFatec = "/fatec_itaquera_logo.png";
  return (
    <div className={styles.container}>
      <div className={styles.mobileWrapper}>
        <InternetWatcher />

        <div className={styles.redHeader}>
          <img src={logoFatec} className={styles.logo} alt="Logo Fatec" />
        </div>

        <div className={styles.subcontainer}>
          <div className={styles.avatarWrapper}>
            <StudentPhoto src={photoSrc} />
          </div>

          <h1 className={styles.welcomeText}>
            Bem-vindo(a),{" "}
            {profile.data?.displayName ?? (
              <span aria-label="Carregando nome">Carregando seus dados…</span>
            )}
          </h1>
          <p className={styles.intro}>
            Acesse sua identificação e acompanhe suas solicitações.
          </p>
          {photo.data && !photo.data.approved && !photo.data.pending && (
            <p>
              Você ainda não tem uma foto aprovada.{" "}
              <Link to="/foto">Envie uma foto para análise</Link>.
            </p>
          )}

          <PhotoStatus
            key={
              rejection?.photoId ??
              photo.data?.approved?.id ??
              "without-approved-photo"
            }
            status={status}
            approvedPhotoId={photo.data?.approved?.id}
            rejectionId={
              rejection
                ? rejection.photoId + ":" + (rejection.reviewedAt ?? "")
                : undefined
            }
            rejectionReason={rejection?.reviewReason}
            previousApproved={!!photo.data?.approved}
            availability={
              photo.data ? "ready" : photo.loading ? "loading" : "unavailable"
            }
          />

          {photo.error && (
            <p role="alert">
              {photo.error} Os dados anteriores serão atualizados quando a
              conexão voltar.
            </p>
          )}
          {profile.error && <p role="alert">{profile.error}</p>}
          <div className={styles.gridContainer}>
            <button
              className={`${styles.menuCard} ${styles.fullWidth}`}
              onClick={() => navigate("/carteirinha")}
            >
              <IdCard className={styles.icon} strokeWidth={1.5} />
              <p>Carteirinha</p>
            </button>

            <button
              className={styles.menuCard}
              onClick={() => setMessageDialog("photo")}
            >
              <Camera className={styles.icon} strokeWidth={1.5} />
              <p>Enviar Foto</p>
            </button>

            <button className={styles.menuCard} onClick={() => navigate("/qr")}>
              <QrCode className={styles.icon} strokeWidth={1.5} />
              <p>QR Code</p>
            </button>

            <button
              className={styles.menuCard}
              onClick={() => navigate("/meus-dados")}
            >
              <UserRound className={styles.icon} strokeWidth={1.5} />
              <p>Meu Perfil</p>
            </button>

            <button
              className={styles.menuCard}
              onClick={() => navigate("/suporte")}
              aria-label={
                unreadRequests
                  ? `Solicitações: ${unreadRequests > 99 ? "mais de 99" : unreadRequests} com atualizações não lidas`
                  : "Solicitações"
              }
            >
              {!!unreadRequests && (
                <span className={styles.notificationBadge} aria-hidden="true">
                  {unreadRequests > 99 ? "99+" : unreadRequests}
                </span>
              )}
              <MessageSquare className={styles.icon} strokeWidth={1.5} />
              <p>Solicitações</p>
            </button>

            <button
              className={styles.menuCard}
              onClick={() => navigate("/config")}
            >
              <Settings className={styles.icon} strokeWidth={1.5} />
              <p>Configurações</p>
            </button>

            <button
              className={styles.menuCard}
              onClick={() => navigate("/unidade")}
            >
              <Info className={styles.icon} strokeWidth={1.5} />
              <p>Informações da Unidade</p>
            </button>
          </div>

          <Link
            className={styles.projectCreditsLink}
            to="/creditos"
            state={{ from: "/" }}
          >
            Créditos de quem constrói o projeto
          </Link>

          <button
            type="button"
            className={styles.logoutCotainerButton}
            onClick={() => setMessageDialog("logout")}
          >
            Deslogar
            <LogOut className={styles.iconLogout}></LogOut>
          </button>

          {messageDialog === "photo" && (
            <MessageModal
              visible
              tone="info"
              title="Antes de enviar sua foto"
              message="Para uma boa identificação, use fundo neutro, mantenha o rosto centralizado e evite óculos escuros."
              confirmText="Continuar"
              cancelText="Cancelar"
              onCancel={() => setMessageDialog(null)}
              onConfirm={() => {
                setMessageDialog(null);
                navigate("/foto");
              }}
            />
          )}

          {messageDialog === "logout" && (
            <MessageModal
              visible
              tone="warning"
              title="Deseja sair do app?"
              message="Sua sessão será encerrada neste dispositivo. Para acessar a carteirinha novamente, será necessário fazer login."
              confirmText="Sair"
              cancelText="Cancelar"
              onCancel={() => setMessageDialog(null)}
              onConfirm={() => setSession(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
