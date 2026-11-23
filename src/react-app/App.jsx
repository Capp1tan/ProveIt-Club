import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import ThemeToggle from './theme/ThemeToggle.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import { avatarUrl } from '../auth-client.js';
import { initializeAccess } from '../badges.js';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage.jsx'));
const CreateTournamentPage = lazy(() => import('./pages/CreateTournamentPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.jsx'));
const FriendsPage = lazy(() => import('./pages/FriendsPage.jsx'));
const PaymentPage = lazy(() => import('./pages/PaymentPage.jsx'));
const TournamentPage = lazy(() => import('./pages/TournamentPage.jsx'));
const MigrationPage = lazy(() => import('./pages/MigrationPage.jsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.jsx'));

function ProfileNavLink({ profile }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let active = true;
    setImage('');
    if (profile?.id && profile.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (active) setImage(url || ''); }).catch(() => {});
    return () => { active = false; };
  }, [profile?.id, profile?.avatarPath]);
  const label = profile?.nickname ? `Mi perfil: ${profile.nickname}` : 'Mi perfil';
  return <Link className="react-profile-nav" to="/perfil" aria-label={label} title={label}>{image ? <img src={image} alt="" /> : <span aria-hidden="true">{Array.from(profile?.nickname || 'P')[0]?.toUpperCase()}</span>}</Link>;
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
    let alive = true;
    const routeClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest?.('a[href^="/react/"]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      event.preventDefault();
      const url = new URL(anchor.href, location.href);
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
      document.querySelectorAll('.club-search-dialog[open]').forEach((dialog) => dialog.close());
      const noticePanel = document.getElementById('clubNotificationsPanel');
      if (noticePanel) { noticePanel.hidden = true; document.querySelector('.notification-bell')?.setAttribute('aria-expanded', 'false'); }
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    document.addEventListener('click', routeClick);
    return () => { alive = false; document.removeEventListener('click', routeClick); document.body.classList.remove('proveit-theme'); };
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
          <Route path="/migracion" element={<MigrationPage />} />
          <Route path="/admin" element={<AdminPage />} />
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
