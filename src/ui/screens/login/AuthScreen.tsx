import { useLayoutEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { login, requestAccess, redeemActionToken } from '../../../api/employee';
import { setSession, useSession } from '../../../session';
import AuthLayout from '../../components/page/AuthLayout';
import { InputComp } from '../../components/input/InputComp';
import { InputPasswordComp } from '../../components/inputpassword/InputPasswordComp';
import { ErrorModalComp } from '../../components/ErrorModal/ErrorModalComp';
import { InternetWatcher } from '../../components/internetwatcher/InternetWatcher';
import styles from './style.module.css';

type Mode = 'login' | 'access' | 'recovery' | 'activate' | 'reset';
const titles = { login: 'Login', access: 'Primeiro acesso', recovery: 'Recuperar senha',
  activate: 'Ativar acesso', reset: 'Redefinir senha' };

export default function AuthScreen({ mode }: { mode: Mode }) {
  const token = useSession();
  const navigate = useNavigate();
  const locationState = useLocation().state;
  const action = mode === 'activate' || mode === 'reset';
  const emailForm = mode === 'access' || mode === 'recovery';
  const [actionToken] = useState(() => action ? new URLSearchParams(location.search).get('token') : null);
  useLayoutEffect(() => {
    if (action && location.search) history.replaceState(history.state, '', location.pathname);
  }, [action]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (mode === 'login' && token) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || notice) return;
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        const result = await login(email.trim(), password);
        if (result.profileType !== 'employee' || !result.token) throw new Error('Resposta de login inválida.');
        setSession(result.token);
        navigate('/', { replace: true });
      } else if (emailForm) {
        await requestAccess(email.trim(), mode === 'recovery');
        setNotice('Se a conta estiver apta, você receberá um link por e-mail.');
      } else {
        if (!actionToken) throw new Error('Link inválido. Solicite um novo link.');
        if (password.length < 8 || password !== confirm) throw new Error('Use pelo menos 8 caracteres e confirme a mesma senha.');
        await redeemActionToken(actionToken, password, mode === 'reset');
        setSession(null);
        setPassword('');
        setConfirm('');
        navigate('/login', { replace: true, state: { [mode === 'activate' ? 'activated' : 'reset']: true } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return <AuthLayout title={titles[mode]} variant={mode === 'login' ? 'classic' : 'default'}
    subtitle={mode === "recovery" ? "Vamos ajudar você a entrar novamente na sua conta." : undefined}>
    <form className={mode === "login" ? styles.subcontainer : styles.accessForm} onSubmit={submit}>
      <InternetWatcher />
      {mode === 'login' && <h1 className={styles.loginHeading}>Login</h1>}
      {mode === 'login' && locationState?.activated && <p role="status">Acesso ativado. Entre com o e-mail cadastrado e a senha que você definiu.</p>}
      {mode === 'login' && locationState?.reset && <p role="status">Senha redefinida. Entre com a nova senha.</p>}
      {mode === 'login' && locationState?.changedPassword && <p role="status">Senha alterada. Entre com a nova senha.</p>}
      {notice ? <p role="status">{notice}</p> : <>
        {mode === "access" && <p>Use o e-mail cadastrado pela Secretaria. Se ele estiver apto, você receberá um link para definir sua senha.</p>}
        {action && actionToken && <p>Escolha uma senha de pelo menos 8 caracteres e confirme no segundo campo.</p>}
        {mode === "recovery" && <p>Informe seu e-mail para receber as instruções de redefinição.</p>}
        <div className={styles.formFields}>
          {!action && <InputComp label="E-mail" placeholder="Seu e-mail" type="email" value={email} onChangeText={setEmail} />}
          {!emailForm && (!action || actionToken) && <InputPasswordComp label={action ? 'Nova senha' : 'Senha'} placeholder="Sua senha" autoComplete={action ? "new-password" : "current-password"} value={password} onChangeText={setPassword} />}
          {action && actionToken && <InputPasswordComp label="Confirmar nova senha" placeholder="Repita a senha" autoComplete="new-password" value={confirm} onChangeText={setConfirm} />}
        </div>
        {mode === 'login' && <Link className={styles.forgotPassword} to="/recuperar-senha">Esqueceu a sua senha?</Link>}
        {action && !actionToken && <p role="alert">Este link não contém um código válido. <Link to={mode === "activate" ? "/primeiro-acesso" : "/recuperar-senha"}>Solicitar novo link</Link>.</p>}
        <div className={mode === "login" ? styles.loginAction : styles.accessAction}>
          {busy ? <p className={styles.loginLoading} role="status">Aguarde…</p> :
            <button className="primary-action" disabled={action && !actionToken}>
              {mode === 'login' ? 'Entrar' : emailForm ? 'Enviar link' : 'Salvar senha'}
            </button>}
        </div>
      </>}
      {mode === 'login' ? <>
        <Link className={styles.firstAccessNotice} to="/primeiro-acesso">Solicitar primeiro acesso</Link>
        <Link className={styles.projectCreditsLink} to="/ajuda-acesso">Preciso de ajuda para acessar</Link>
        <Link className={styles.projectCreditsLink} to="/creditos">Conheça quem constrói este projeto</Link>
        <img src="/cps_logo_cor.png" className={styles.logocps} alt="Centro Paula Souza" />
      </> : <Link className={styles.accessBack} to="/login">Voltar ao login</Link>}
      <ErrorModalComp visible={Boolean(error)} error={error} onClose={() => setError('')} />
    </form>
  </AuthLayout>;
}
