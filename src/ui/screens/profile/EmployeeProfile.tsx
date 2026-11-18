import { getProfile } from '../../../api/employee';
import { useResource } from '../../../hooks';
import { Link } from 'react-router-dom';
import PageLayout from '../../components/page/PageLayout';
import { Status } from '../Status';

const date = (value: string) => value.split('-').reverse().join('/');
const assignmentStatus = { ACTIVE: 'Vigente', FUTURE: 'Futura', EXPIRED: 'Vencida', ENDED: 'Encerrada', ARCHIVED: 'Arquivada' };

export default function EmployeeProfile() {
  const result = useResource(getProfile);
  const profile = result.data;
  return <PageLayout title="Meus dados" subtitle="Confira os dados cadastrados pela Secretaria." backTo="/" roundedHeader>
    <Status {...result} />
    {profile && <>
      <section className="information-panel">
        <h2>Dados cadastrais</h2>
        <dl>
          <dt>Nome completo</dt><dd>{profile.name}</dd>
          {profile.socialName && <><dt>Nome social</dt><dd>{profile.socialName}</dd></>}
          <dt>E-mail</dt><dd>{profile.email}</dd>
          {profile.registrationNumber && <><dt>Matrícula funcional</dt><dd>{profile.registrationNumber}</dd></>}
          {profile.rg && <><dt>RG</dt><dd>{profile.rg}</dd></>}
          <dt>Admissão</dt><dd>{date(profile.admissionDate)}</dd>
        </dl>
      </section>
      <section className="information-panel">
        <h2>Funções</h2>
        {profile.assignments.length ? <ul>{profile.assignments.map(item =>
          <li key={item.id}>{item.title} · {assignmentStatus[item.effectiveStatus]}
            {item.startsOn && ' · Início: ' + date(item.startsOn)}
            {item.validUntil && ' · Término: ' + date(item.validUntil)}</li>)}</ul> : <p>Nenhuma função cadastrada.</p>}
      </section>
      {!profile.photo.approvedPhotoId && <section className="information-panel">
        <h2>Foto da carteirinha</h2>
        {profile.photo.pendingPhotoId
          ? <p>Sua foto está em análise. <Link to="/foto">Acompanhar situação</Link></p>
          : <p>Você ainda não tem foto aprovada. <Link to="/foto">Enviar foto para análise</Link></p>}
      </section>}
      <p>Para corrigir um dado cadastral, <Link to="/suporte">abra uma solicitação</Link>.</p>
    </>}
  </PageLayout>;
}
