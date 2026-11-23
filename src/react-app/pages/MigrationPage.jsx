import { Link } from 'react-router-dom';

const stages = [
  ['Base y navegación', 'React Router, carga por pantalla y una entrada segura para la nueva aplicación.'],
  ['Cuenta y navegación social', 'Sesiones de Cognito, perfil, amistades y preferencias compartidas.'],
  ['Torneos', 'Directorio, creación, pagos, sala de espera, llaves y resultados.'],
  ['Chat y administración', 'Mensajes, permisos, panel administrativo y herramientas del club.'],
];

export default function MigrationPage() {
  return (
    <main className="react-content-page">
      <p className="react-eyebrow">MIGRACIÓN SEGURA</p>
      <h1>ProveIt está cambiando por etapas.</h1>
      <p>La aplicación nueva vive en una ruta aislada. Cada flujo se mantiene en el sitio actual hasta que su reemplazo React conserve datos, permisos y comportamiento.</p>
      <ol className="react-stage-list">{stages.map(([title, detail], index) => <li key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{title}</b><p>{detail}</p></div></li>)}</ol>
      <Link className="react-secondary" to="/">Volver al inicio React</Link>
    </main>
  );
}
