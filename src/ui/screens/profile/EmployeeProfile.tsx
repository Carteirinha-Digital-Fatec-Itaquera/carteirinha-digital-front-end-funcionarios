import { getProfile } from "../../../api/employee";
import { useResource } from "../../../hooks";
import { Link } from "react-router-dom";
import PageLayout from "../../components/page/PageLayout";
import { Status } from "../Status";
import styles from "./style.module.css";

const date = (value: string) => value.split("-").reverse().join("/");
const assignmentStatus = {
  ACTIVE: "Vigente",
  FUTURE: "Futura",
  EXPIRED: "Vencida",
  ENDED: "Encerrada",
  ARCHIVED: "Arquivada",
};

export default function EmployeeProfile() {
  const result = useResource(getProfile);
  const profile = result.data;
  return (
    <PageLayout
      title="Meu Perfil"
      subtitle="Confira os dados cadastrados pela Secretaria."
      backTo="/"
      roundedHeader
    >
      <Status {...result} />
      {profile && (
        <div className={styles.layout}>
          <div className={styles.intro}>
            <div>
              <h2>{profile.displayName}</h2>
              <p>Seu cadastro no Portal de Funcionários</p>
            </div>
          </div>
          <section className={styles.panel}>
            <h2>Dados pessoais</h2>
            <dl className={styles.fields}>
              <div>
                <dt>Nome completo</dt>
                <dd>{profile.name}</dd>
              </div>
              {profile.socialName && (
                <div>
                  <dt>Nome social</dt>
                  <dd>{profile.socialName}</dd>
                </div>
              )}
              {profile.rg && (
                <div>
                  <dt>RG</dt>
                  <dd>{profile.rg}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className={styles.panel}>
            <h2>Contato e situação cadastral</h2>
            <dl className={styles.fields}>
              <div>
                <dt>E-mail</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>Situação da conta</dt>
                <dd>
                  {
                    {
                      ACTIVE: "Ativa",
                      BLOCKED: "Bloqueada",
                      ARCHIVED: "Arquivada",
                    }[profile.accountStatus]
                  }
                </dd>
              </div>
            </dl>
          </section>
          <section className={styles.panel}>
            <h2>Vínculo institucional</h2>
            <dl className={styles.fields}>
              <div>
                <dt>Matrícula funcional</dt>
                <dd>{profile.registrationNumber || "Não informada"}</dd>
              </div>
              <div>
                <dt>Admissão</dt>
                <dd>{date(profile.admissionDate)}</dd>
              </div>
            </dl>
            <h3>Funções</h3>
            {profile.assignments.length ? (
              <ul className={styles.assignments}>
                {profile.assignments.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span className={styles.status}>
                      {assignmentStatus[item.effectiveStatus]}
                    </span>
                    {item.startsOn && " · Início: " + date(item.startsOn)}
                    {item.validUntil && " · Término: " + date(item.validUntil)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma função cadastrada.</p>
            )}
          </section>
          {!profile.photo.approvedPhotoId && (
            <section className={styles.panel}>
              <h2>Foto da carteirinha</h2>
              {profile.photo.pendingPhotoId ? (
                <p>
                  Sua foto está em análise.{" "}
                  <Link to="/foto">Acompanhar situação</Link>
                </p>
              ) : (
                <p>
                  Você ainda não tem foto aprovada.{" "}
                  <Link to="/foto">Enviar foto para análise</Link>
                </p>
              )}
            </section>
          )}
          <p className={styles.guidance}>
            Para corrigir um dado cadastral,{" "}
            <Link to="/suporte">abra uma solicitação</Link>.
          </p>
        </div>
      )}
    </PageLayout>
  );
}
