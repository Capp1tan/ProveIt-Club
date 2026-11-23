// Amplify v6 separa el listener que intercambia el `code` OAuth por una sesión.
// Tiene que cargarse en la entrada de la SPA para procesar el retorno de Google
// antes de que AuthProvider consulte el estado de la cuenta.
import 'aws-amplify/auth/enable-oauth-listener';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import './styles.css';
import './theme/theme.css';

class AppErrorBoundary extends React.Component {
  state = { failed: false, detail: '' };
  static getDerivedStateFromError(error) { return { failed: true, detail: import.meta.env.DEV ? error?.message || String(error) : '' }; }
  componentDidCatch(error) { console.error('Error al renderizar ProveIt React:', error); }
  render() {
    if (this.state.failed) return <main className="react-app-error" role="alert"><h1>No pudimos abrir esta pantalla</h1><p>La sesión y los datos siguen intactos. Recargá para intentar de nuevo; si persiste, contactá al equipo de ProveIt.</p>{this.state.detail && <pre>{this.state.detail}</pre>}<button type="button" onClick={() => window.location.reload()}>Recargar</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
