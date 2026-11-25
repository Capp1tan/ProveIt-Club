import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import ThemeToggle from './theme/ThemeToggle.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import { avatarUrl, signOut } from '../auth-client.js';
import { initializeAccess } from '../badges.js';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage.jsx'));
const CreateTournamentPage = lazy(() => import('./pages/CreateTournamentPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const FriendsPage = lazy(() => import('./pages/FriendsPage.jsx'));
const PaymentPage = lazy(() => import('./pages/PaymentPage.jsx'));
const TournamentPage = lazy(() => import('./pages/TournamentPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

function LegacyRedirect({ to }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function LegacyProfileRedirect() {
  const location = useLocation();
  const profileId = new URLSearchParams(location.search).get('id');
  const target = profileId ? `/perfil/${encodeURIComponent(profileId)}` : '/perfil';
  return <Navigate to={`${target}${location.hash}`} replace />;
}

function ReactPathRedirect() {
  const location = useLocation();
  const target = location.pathname.replace(/^\/react(?=\/|$)/, '') || '/';
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

function ProfileNavLink({ profile }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [image, setImage] = useState('');
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setImage('');
    if (profile?.id && profile.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (active) setImage(url || ''); }).catch(() => {});
    return () => { active = false; };
  }, [profile?.id, profile?.avatarPath]);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  async function logout() {
    if (signingOut) return;
    setSigningOut(true); setError('');
    try { await signOut(); setOpen(false); navigate('/', { replace: true }); }
    catch (cause) { setError(cause?.message || 'No pudimos cerrar la sesión.'); }
    finally { setSigningOut(false); }
  }
  const label = profile?.nickname ? `Abrir menú de ${profile.nickname}` : 'Abrir menú de perfil';
  return <div className="react-profile-menu" ref={menuRef}>
    <button className="react-profile-nav" type="button" aria-label={label} title={label} aria-expanded={open} aria-haspopup="true" aria-controls="reactProfileMenu" onClick={() => { setOpen((value) => !value); setError(''); }}>
      {image ? <img src={image} alt="" /> : <span aria-hidden="true">{Array.from(profile?.nickname || 'P')[0]?.toUpperCase()}</span>}
    </button>
    {open && <section className="react-profile-popover" id="reactProfileMenu" aria-label="Menú de perfil">
      <p className="react-profile-greeting">Qué bueno verte, <strong>{profile?.nickname || 'competidor'}</strong></p>
      <Link to="/perfil" onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.7-3.6 3-5.5 7-5.5s6.3 1.9 7 5.5"/></svg> Mi perfil</Link>
      <Link to="/amigos" onClick={() => setOpen(false)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 19c.5-3.1 2.5-4.8 6-4.8s5.5 1.7 6 4.8m1-13a3 3 0 0 1 0 5.8m1 2.4c2.4.7 3.7 2.3 4 4.8"/></svg> Amigos</Link>
      <button type="button" onClick={() => void logout()} disabled={signingOut}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5m4-4 4-4-4-4m4 4H9"/></svg> {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
      {error && <p className="react-profile-menu-error" role="alert">{error}</p>}
    </section>}
  </div>;
}

function AppLayout() {
  const { status, profile } = useAuth();
  const [isCreator, setIsCreator] = useState(false);
  useEffect(() => {
    let active = true;
    setIsCreator(false);
    if (status === 'signed-in') {
      void initializeAccess().then((access) => {
        if (active) setIsCreator(Boolean(access?.isCreator));
      }).catch(() => {
        if (active) setIsCreator(false);
      });
    }
    return () => { active = false; };
  }, [status]);
  useEffect(() => {
    document.body.classList.add('proveit-theme');
    const routeClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a.participant-trigger, a.react-history-link');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      event.preventDefault();
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
      document.querySelectorAll('.club-search-dialog[open]').forEach((dialog) => dialog.close());
      const noticePanel = document.getElementById('clubNotificationsPanel');
      if (noticePanel) { noticePanel.hidden = true; document.querySelector('.notification-bell')?.setAttribute('aria-expanded', 'false'); }
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    document.addEventListener('click', routeClick);
    return () => { document.removeEventListener('click', routeClick); document.body.classList.remove('proveit-theme'); };
  }, []);
  useEffect(() => {
    if (status !== 'signed-in') return;
    let alive = true;
    void import('../chat-dock.js').catch((error) => { if (alive) console.error('No se pudo iniciar la bandeja de chat:', error); });
    return () => { alive = false; };
  }, [status]);
  return (
    <div className="react-app">
      <header className="react-topbar">
        <Link className="react-brand" to="/" aria-label="ProveIt Club, inicio">
          <span className="react-mark" aria-hidden="true">P</span>
          <span>prove<span className="react-brand-dot">.</span>it<small>CLUB</small></span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link className="react-nav-directory" to="/torneos">Torneos</Link>
          <Link className="react-nav-friends" to="/amigos">Amigos</Link>
        </nav>
        <div className="react-header-actions">
          {isCreator && <Link className="react-nav-admin" to="/admin"><span className="admin-long">Administración</span><span className="admin-short">Admin</span></Link>}
          <GlobalSearch />
          <NotificationsPanel />
          <ThemeToggle />
          {status === 'signed-in' ? <ProfileNavLink profile={profile} /> : <Link className="react-account-link" to="/ingresar">{status === 'checking' ? 'Cuenta…' : 'Ingresar'}</Link>}
        </div>
      </header>
      <Suspense fallback={<div className="react-route-loading" role="status">Abriendo ProveIt…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/torneos" element={<DirectoryPage />} />
          <Route path="/crear-torneo" element={<CreateTournamentPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/perfil/:profileId" element={<ProfilePage />} />
          <Route path="/ingresar" element={<AuthPage />} />
          <Route path="/amigos" element={<FriendsPage />} />
          <Route path="/pago" element={<PaymentPage />} />
          <Route path="/torneo" element={<TournamentPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/index.html" element={<LegacyRedirect to="/" />} />
          <Route path="/crear-torneo.html" element={<LegacyRedirect to="/crear-torneo" />} />
          <Route path="/simular-torneo.html" element={<LegacyRedirect to="/crear-torneo" />} />
          <Route path="/perfil.html" element={<LegacyProfileRedirect />} />
          <Route path="/torneo.html" element={<LegacyRedirect to="/torneo" />} />
          <Route path="/torneos.html" element={<LegacyRedirect to="/torneos" />} />
          <Route path="/pago.html" element={<LegacyRedirect to="/pago" />} />
          <Route path="/amigos.html" element={<LegacyRedirect to="/amigos" />} />
          <Route path="/admin.html" element={<LegacyRedirect to="/admin" />} />
          <Route path="/react" element={<ReactPathRedirect />} />
          <Route path="/react/*" element={<ReactPathRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <footer className="react-footer">
        <span>ProveIt Club</span><span>Decirlo es fácil, demostralo.</span>
        <a href="mailto:leorivero744@gmail.com">Contacto</a>
      </footer>
    </div>
  );
}

export default function App() {
  return <AppLayout />;
}
