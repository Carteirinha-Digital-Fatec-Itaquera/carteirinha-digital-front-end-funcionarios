import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, Globe, Mail, MapPin, Phone, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { changePassword, getInstitution } from '../../../api/employee';
import { useResource } from '../../../hooks';
import { setSession } from '../../../session';
import PageLayout from '../../components/page/PageLayout';
import Modal from '../../components/modal/Modal';
import { Status } from '../Status';
import styles from './style.module.css';
import help from '../help/style.module.css';

const preference = 'carteirinha-funcionarios.accessibility';
const daltonismoTypes = [
  { id: 'normal', name: 'Padrão', desc: 'Cores originais' },
  { id: 'protanopia', name: 'Protanopia', desc: 'Percepção reduzida do vermelho' },
  { id: 'protanomaly', name: 'Protanomalia', desc: 'Alteração parcial do vermelho' },
  { id: 'deuteranopia', name: 'Deuteranopia', desc: 'Percepção reduzida do verde' },
  { id: 'deuteranomaly', name: 'Deuteranomalia', desc: 'Alteração parcial do verde' },
  { id: 'tritanopia', name: 'Tritanopia', desc: 'Percepção reduzida de azul e amarelo' },
];

function readPreference() {
  try { return localStorage.getItem(preference) ?? 'normal'; } catch { return 'normal'; }
}
export function Settings() {
  const navigate = useNavigate();
  const [currentFilter, setCurrentFilter] = useState(readPreference);
  useEffect(() => { document.documentElement.dataset.accessibility = currentFilter; }, [currentFilter]);
  const [modalDaltonismo, setModalDaltonismo] = useState(false);
  const [modalSenha, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [onLoading, setLoading] = useState(false);
  const [error, setError] = useState('');
  function setModalSenha(open: boolean) {
    if (onLoading) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setPasswordModal(open);
  }
  function applyAccessibilityFilter(id: string) {
    try { localStorage.setItem(preference, id); } catch { /* Preferência aplicada nesta página. */ }
    setCurrentFilter(id);
  }
  async function handlePasswordChange(event: FormEvent) {
    event.preventDefault();
    if (onLoading) return;
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      setError('Use pelo menos 8 caracteres e confirme a mesma senha.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSession(null);
      navigate('/login', { replace: true, state: { changedPassword: true } });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  return (
    <PageLayout title="Configurações" subtitle="Personalize sua experiência e gerencie suas preferências de acesso." backTo="/" icon={<SettingsIcon size={22} />} roundedHeader>


      <div className={styles.main}>
        
        {/* Futura feature para aplicação do modo noturno */}
        {/* <button type="button" className={styles.menuRow} onClick={toggleTheme}>
          <div className={styles.menuRowLeft}>
            <Moon className={styles.iconRed} />
            <div>
              <h3>Modo Noturno</h3>
              <p>Alterar tema claro/escuro</p>
            </div>
          </div>
          <div className={`${styles.toggleSwitch} ${isDarkMode ? styles.toggleActive : ''}`}>
            <div className={styles.toggleThumb} />
          </div>
        </div> */}

        <button type="button" className={styles.menuRow} onClick={() => setModalDaltonismo(true)}>
          <div className={styles.menuRowLeft}>
            <Eye className={styles.iconRed} />
            <div>
              <h3>Acessibilidade Visual</h3>
              <p>Ajustar cores para daltonismo</p>
            </div>
          </div>
        </button>

        <button type="button" className={styles.menuRow} onClick={() => setModalSenha(true)}>
          <div className={styles.menuRowLeft}>
            <ShieldCheck className={styles.iconRed} />
            <div>
              <h3>Alterar Senha de Acesso</h3>
              <p>Modificar as credenciais de entrada</p>
            </div>
          </div>
        </button>
      </div>

      {/* MODAL: DALTONISMO */}
      {modalDaltonismo && (
        <Modal label="Acessibilidade visual" onClose={() => setModalDaltonismo(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Selecione o Grau de Daltonismo</h3>
            <div className={styles.optionsList}>
              {daltonismoTypes.map((type) => (
                <button 
                  key={type.id} 
                  className={`${styles.optionButton} ${currentFilter === type.id ? styles.activeOption : ''}`}
                  onClick={() => applyAccessibilityFilter(type.id)}
                >
                  <div style={{ textAlign: 'left' }}>
                    <strong>{type.name}</strong>
                    <p className={styles.optionDesc}>{type.desc}</p>
                  </div>
                  {currentFilter === type.id && <Check size={18} color="var(--primary-fatec)" />}
                </button>
              ))}
            </div>
            <button className={styles.closeButton} onClick={() => setModalDaltonismo(false)}>Concluir</button>
          </div>
        </Modal>
      )}

      {/* MODAL: ALTERAR SENHA */}
      {modalSenha && (
        <Modal label="Alterar senha" onClose={() => setModalSenha(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3>Criar Nova Senha</h3>
            <form onSubmit={handlePasswordChange} className={styles.passwordForm}>
              {error && <p role="alert">{error}</p>}
              <div className={styles.inputGroup}>
                <label htmlFor="config-current-password">Senha atual</label>
                <input id="config-current-password" type="password" autoComplete="current-password" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="config-new-password">Nova Senha</label>
                <input id="config-new-password"
                  type="password" 
                  placeholder="Mínimo 8 caracteres" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="config-confirm-password">Confirme a Nova Senha</label>
                <input id="config-confirm-password"
                  type="password" 
                  placeholder="Digite novamente" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required
                />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setModalSenha(false)}>Cancelar</button>
                <button type="submit" className={styles.submitButton} disabled={onLoading}>
                  {onLoading ? "A guardar..." : "Guardar Senha"}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}


    </PageLayout>
  );
}

export function Institution({ embedded = false }: { embedded?: boolean }) {
  const result = useResource(getInstitution);
  const unit = result.data;
  const address = unit && [unit.address, unit.city, unit.state, unit.postalCode].filter(Boolean).join(' · ');
  const contacts = unit ? [
    { label: 'Endereço', value: address, Icon: MapPin },
    { label: 'Telefone', value: unit.phone, Icon: Phone },
    { label: 'E-mail', value: unit.email, Icon: Mail, href: unit.email ? 'mailto:' + unit.email : undefined },
    { label: 'Site', value: unit.website, Icon: Globe, href: unit.website && /^https?:\/\//i.test(unit.website) ? unit.website : undefined },
  ] : [];
  const content = <>
    <Status {...result} />
    {unit && <section className={help.contentWrapper}>
      <p className={help.faleConoscoLabel}>{unit.shortName}</p>
      <h2 className={help.mainTitle}>Contatos</h2>
      <div className={help.contactList}>
        {contacts.map(({ Icon, label, value, href }) => value && <div className={help.contactCard} key={label}>
          <span className={help.iconCircle}><Icon aria-hidden="true" /></span>
          <div className={help.contactInfo}><strong>{label}</strong>
            <p>{href ? <a href={href}>{value}</a> : value}</p>
          </div>
        </div>)}
      </div>
    </section>}
    {!embedded && <footer className={help.footerLogos}><img className={help.footerLogoImg} src="/cps_logo_br.png" alt="Centro Paula Souza" /></footer>}
  </>;
  return embedded ? content : <PageLayout title="Informações da Unidade" subtitle="Encontre os canais de atendimento da sua instituição." backTo="/" roundedHeader>{content}</PageLayout>;
}
