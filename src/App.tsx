import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { InstallPWAButton } from './components/installpwa/InstallPWAButton';
import { setSession, useSession } from './session';
import { getProfile } from './api/employee';
import { useResource } from './hooks';
import { Status } from './ui/screens/Status';
import PageLayout from './ui/components/page/PageLayout';
import AuthScreen from './ui/screens/login/AuthScreen';
import MainMenu from './ui/screens/mainmenu/MainMenuScreen';
import SupportScreen from './ui/screens/support/SupportScreen';
import Credits from './ui/screens/credits/ProjectCreditsScreen';
import { CardScreen, QrScreen, VerificationScreen } from './ui/screens/credential/CredentialScreens';
import PhotoScreen from './ui/screens/uploadimage/PhotoScreen';
import { Institution, Settings } from './ui/screens/config/Settings';
import { useEffect } from 'react';

function VerifiedSession() {
  const profile = useResource(getProfile);
  if (!profile.data) return <PageLayout title="Portal de Funcionários" narrow>
    <Status loading={profile.loading} error={profile.error} reload={profile.reload} />
    <Link to="/ajuda-acesso">Ajuda para acessar</Link>
    <button className="secondary-action" onClick={() => setSession(null)}>Sair</button>
  </PageLayout>;
  return <Outlet />;
}

function Protected() {
  const token = useSession();
  return token ? <VerifiedSession key={token} /> : <Navigate to="/login" replace />;
}

export default function App() {
  useEffect(() => {
    try {
      const filter = localStorage.getItem('carteirinha-funcionarios.accessibility');
      if (filter) document.documentElement.dataset.accessibility = filter;
    } catch { /* Preferências indisponíveis. */ }
  }, []);
  return <BrowserRouter>
  <Routes>
    <Route path="/login" element={<AuthScreen key="login" mode="login" />} />
    <Route path="/primeiro-acesso" element={<AuthScreen key="access" mode="access" />} />
    <Route path="/recuperar-senha" element={<AuthScreen key="recovery" mode="recovery" />} />
    <Route path="/ativar-acesso" element={<AuthScreen key="activate" mode="activate" />} />
    <Route path="/redefinir-senha" element={<AuthScreen key="reset" mode="reset" />} />
    <Route path="/funcionarios/verificar/:qrcode" element={<VerificationScreen />} />
    <Route path="/creditos" element={<Credits />} />
    <Route path="/ajuda-acesso" element={<PageLayout title="Ajuda para acessar a carteirinha" backTo="/login" backLabel="Voltar ao login" narrow>
      <p>Solicite um <Link to="/primeiro-acesso">link de primeiro acesso</Link> ou <Link to="/recuperar-senha">recupere sua senha</Link>.</p>
      <p>Se precisar de ajuda, consulte os contatos da unidade.</p><Institution embedded />
    </PageLayout>} />
    <Route element={<Protected />}>
      <Route index element={<MainMenu />} />
      <Route path="/carteirinha" element={<CardScreen />} />
      <Route path="/qr" element={<QrScreen />} />
      <Route path="/foto" element={<PhotoScreen />} />
      <Route path="/config" element={<Settings />} />
      <Route path="/unidade" element={<Institution />} />
      <Route path="/suporte/:id?" element={<SupportScreen />} />
    </Route>
    <Route path="*" element={<PageLayout title="Página indisponível" backTo="/" />} />
  </Routes>
  <InstallPWAButton />
</BrowserRouter>;
}
