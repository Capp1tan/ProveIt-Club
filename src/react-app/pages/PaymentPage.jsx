import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { checkPayment, money } from '../../billing-api.js';
import { deleteTournament } from '../../maintenance-api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './PaymentPage.css';

const UUID = /^[0-9a-f-]{36}$/i;

export default function PaymentPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const { status: authStatus } = useAuth();
  const [row, setRow] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [removing, setRemoving] = useState(false);

  const update = useCallback(async (manual = false) => {
    if (authStatus !== 'signed-in' || !manual && document.hidden) return;
    setChecking(true);
    try {
      if (!UUID.test(id || '')) throw new Error('El enlace no incluye una solicitud válida.');
      const result = await checkPayment(id);
      if (!result) throw new Error('No encontramos esta solicitud en tu cuenta. Ingresá con la cuenta que inició este pago.');
      let checkoutUrl = null;
      if (result.checkoutUrl) {
        checkoutUrl = new URL(result.checkoutUrl);
        if (checkoutUrl.protocol !== 'https:' || !['www.mercadopago.com.ar', 'sandbox.mercadopago.com.ar'].includes(checkoutUrl.hostname)) throw new Error('Dirección de pago inválida.');
      }
      setRow(result); setError('');
      if (checkoutUrl) {
        const qrData = await QRCode.toDataURL(checkoutUrl.href, { width: 260, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#101310', light: '#ffffff' } });
        setQr(qrData);
      } else setQr('');
    } catch (cause) { setError(cause?.name === 'UserUnAuthenticatedException' ? 'Ingresá con tu cuenta para consultar este pago.' : cause?.message || 'No pudimos consultar el pago.'); }
    finally { setChecking(false); setLoading(false); }
  }, [authStatus, id]);

  useEffect(() => { if (authStatus === 'signed-in') void update(true); else if (authStatus !== 'checking') setLoading(false); }, [authStatus, update]);
  useEffect(() => {
    if (authStatus !== 'signed-in') return undefined;
    const poll = window.setInterval(() => { if (!document.hidden) void update(); }, 15_000);
    const visible = () => { if (!document.hidden) void update(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(poll); document.removeEventListener('visibilitychange', visible); };
  }, [authStatus, update]);

  async function removeRequest() {
    if (removing || !window.confirm('¿Eliminar esta solicitud? No vuelvas a pagar un enlace guardado. Si ya pagaste, la eliminación no devuelve el dinero.')) return;
    setRemoving(true);
    try { await deleteTournament(id); navigate('/torneos', { replace: true }); }
    catch (cause) { setError(cause?.message || 'No pudimos eliminar la solicitud.'); setRemoving(false); }
  }

  if (authStatus !== 'signed-in' && !loading) return <main className="react-payment-page"><section className="react-payment-card"><p className="react-eyebrow">PROVEIT CLUB · PAGO</p><h1>Ingresá para consultar este pago</h1><p>{error || 'Solo la cuenta que inició la solicitud puede ver su estado.'}</p><Link className="react-primary" to="/ingresar">Ingresar ↗</Link></section></main>;
  if (loading) return <main className="react-payment-page"><section className="react-payment-card"><p role="status">Consultando el estado de pago…</p></section></main>;

  const entry = row?.kind === 'ENTRY';
  const tournamentId = entry ? row?.tournamentId : row?.id;
  const expired = row?.expiresAt && Date.parse(row.expiresAt) <= Date.now();
  const approved = ['APPROVED', 'EXEMPT'].includes(row?.status);

  return <main className="react-payment-page">
    <section className="react-payment-card">
      <p className="react-eyebrow">{row?.paymentMode === 'TEST' ? 'MODO DE PRUEBA · SIN COBRO REAL' : entry ? 'INSCRIPCIÓN INDIVIDUAL' : 'CREACIÓN DE TORNEO'}</p>
      <h1>{row?.tournamentName || 'Estado del pago'}</h1>
      {row && <p className="react-payment-amount">{money(row.amountCents)}</p>}
      {error && <p className="react-payment-error" role="alert">{error}</p>}
      {!row ? <><h2>No pudimos consultar el pago</h2><p>Revisá la conexión o intentá nuevamente.</p></>
        : row.deletedAt ? <><h2>Solicitud eliminada</h2><p>No vuelvas a pagar este enlace. La eliminación no realiza reembolsos. Si ya pagaste, contactá al administrador.</p></>
        : approved ? <><h2>{row.status === 'EXEMPT' ? 'Torneo creado sin cargo' : 'Pago confirmado'}</h2><p>{entry ? row.entryConfirmed ? 'Tu inscripción fue confirmada. No vuelvas a pagar este enlace.' : 'Tu pago está guardado. Entrá al torneo para revisar y aceptar las condiciones vigentes. Si fue cancelado, contactá al administrador; no vuelvas a pagar.' : 'Tu torneo ya está habilitado y las invitaciones fueron enviadas.'}</p><Link className="react-primary" to={`/torneo?id=${encodeURIComponent(tournamentId)}`}>Entrar a la sala de espera ↗</Link></>
        : row?.status === 'REVERSED' ? <><h2>Pago revertido</h2><p>El cobro fue devuelto o recibió un contracargo. Contactá al administrador.</p></>
          : expired ? <><h2>El enlace de pago venció</h2><p>Si pagaste, usá «Consultar pago» para comprobar su acreditación antes de volver a pagar. Si no pagaste, volvé al torneo. Si el enlace no se puede renovar, contactá al administrador antes de volver a pagar.</p><Link to={`/torneo?id=${encodeURIComponent(tournamentId)}`}>Volver al torneo ↗</Link></>
            : <><h2>Esperando tu pago</h2><p>{entry ? 'Tu lugar se confirma cuando Mercado Pago apruebe la inscripción. No hace falta enviar comprobantes.' : 'El torneo se habilita cuando Mercado Pago confirme el cobro. No hace falta enviar comprobantes.'}</p>
              {entry ? <Link className="react-secondary" to={`/torneo?id=${encodeURIComponent(tournamentId)}`}>Volver al torneo</Link> : <button type="button" className="react-payment-danger" disabled={removing} onClick={() => void removeRequest()}>{removing ? 'Eliminando…' : 'Eliminar solicitud'}</button>}
              {row?.checkoutUrl && <div className="react-payment-checkout"><a className="react-primary" href={row.checkoutUrl} rel="noopener noreferrer">{row.paymentMode === 'TEST' ? 'Abrir pago de prueba ↗' : 'Pagar con Mercado Pago ↗'}</a>{qr && <img className="react-payment-qr" src={qr} width="260" height="260" alt="QR para abrir este pago en Mercado Pago" />}<p>Desde otro dispositivo, escaneá el QR con la cámara para abrir el mismo checkout.</p></div>}
              {!row?.checkoutUrl && <p>Preparando el enlace de pago. Consultá nuevamente en unos segundos.</p>}
              {row?.expiresAt && <small>Vence: {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.expiresAt))}</small>}
            </>}
      <div className="react-payment-footer"><button type="button" onClick={() => void update(true)} disabled={checking}>{checking ? 'Consultando…' : 'Consultar pago ↻'}</button><Link to="/torneos">Volver a torneos</Link></div>
    </section>
  </main>;
}
