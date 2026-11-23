import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formats, formatImage } from '../../tournament-formats.js';
import { avatarUrl } from '../../auth-client.js';
import { registeredProfiles, createClubTournament, tournamentClient } from '../../tournaments-api.js';
import { prepareCover, uploadTournamentCover } from '../../tournament-cover.js';
import { editCover } from '../../cover-editor.js';
import { money, tournamentFee } from '../../billing-api.js';
import { localToUtc, scheduleLabel, zoneLabel } from '../../tournament-schedule.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './CreateTournamentPage.css';

const MAX_PLAYERS = 64;
const MAX_JUDGES = 16;
const UUID = /^[a-f0-9-]{36}$/i;
const statusError = (error) => error?.name === 'UserUnAuthenticatedException' ? 'Ingresá a tu cuenta para crear torneos.' : error?.message || 'No pudimos completar la operación.';

function makeDraftKey(userId) { return `proveit:tournament-draft:v2:${userId}`; }
function owner(profile) { return profile?.owner?.split('::')[0] || ''; }
function localDateValue() {
  const date = new Date(Date.now() + 24 * 60 * 60_000);
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function ProfileAvatar({ profile }) {
  const [image, setImage] = useState('');
  useEffect(() => {
    let alive = true;
    if (profile.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (alive) setImage(url || ''); }).catch(() => {});
    return () => { alive = false; };
  }, [profile.id, profile.avatarPath]);
  return <span className="react-create-avatar">{image ? <img src={image} alt="" loading="lazy" /> : Array.from(profile.nickname || '?')[0]?.toUpperCase()}</span>;
}

function ChoiceCards({ legend, value, options, onChange }) {
  return <fieldset className="react-create-choice"><legend>{legend}</legend><div>{options.map(([key, label]) => <label key={key} className={value === key ? 'is-selected' : ''}><input type="radio" checked={value === key} onChange={() => onChange(key)} /><span>{label}</span></label>)}</div></fieldset>;
}

export default function CreateTournamentPage() {
  const navigate = useNavigate();
  const { status: authStatus, user, profile } = useAuth();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState({ name: '', activity: '', overview: '', description: '', count: 2, arbitrationMode: 'JUDGES', prizeExpected: false, prizeTitle: '', prizeHolder: '', startsLocal: localDateValue() });
  const [selectedFormat, setSelectedFormat] = useState('DUEL');
  const [participants, setParticipants] = useState([]);
  const [judges, setJudges] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [cover, setCover] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [coverWorking, setCoverWorking] = useState(false);
  const [prizeFile, setPrizeFile] = useState(null);
  const [fee, setFee] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retryRequest, setRetryRequest] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const tournamentId = useRef(crypto.randomUUID());
  const coverInput = useRef(null);
  const prizeInput = useRef(null);
  const coverAbort = useRef(null);
  const stageOne = useRef(null);
  const stageTwo = useRef(null);
  const cache = useRef(null);

  const noJudge = fields.arbitrationMode === 'ORGANIZER';
  const capacity = Number(fields.count);
  const selectedPeople = useMemo(() => profiles.filter((item) => participants.includes(item.id)), [profiles, participants]);
  const filteredPeople = useMemo(() => {
    const query = peopleQuery.trim().toLocaleLowerCase('es');
    return profiles.filter((item) => !query || item.nickname.toLocaleLowerCase('es').includes(query));
  }, [profiles, peopleQuery]);

  useEffect(() => {
    if (!cover) { setCoverUrl(''); return undefined; }
    const url = URL.createObjectURL(cover.blob);
    setCoverUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [cover]);

  useEffect(() => () => coverAbort.current?.abort(), []);

  const setField = useCallback((key, value) => setFields((current) => ({ ...current, [key]: value })), []);

  useEffect(() => {
    if (authStatus !== 'signed-in' || !user?.userId) return;
    let alive = true;
    const request = () => {
      try {
        const raw = sessionStorage.getItem(makeDraftKey(user.userId));
        const draft = raw ? JSON.parse(raw) : null;
        if (!alive) return;
        if (!draft) {
          setDraftReady(true);
          void tournamentFee().then((pricing) => { if (alive) setFee(pricing); }).catch((cause) => { if (alive) { setNotice(statusError(cause)); setError(true); } });
          return;
        }
        if (typeof draft.name === 'string') setField('name', draft.name);
        if (typeof draft.activity === 'string') setField('activity', draft.activity);
        if (typeof draft.overview === 'string') setField('overview', draft.overview);
        if (typeof draft.description === 'string') setField('description', draft.description);
        if (Number.isInteger(draft.participantLimit) && draft.participantLimit >= 2 && draft.participantLimit <= MAX_PLAYERS) setField('count', draft.participantLimit);
        if (['JUDGES', 'ORGANIZER'].includes(draft.arbitrationMode)) setField('arbitrationMode', draft.arbitrationMode);
        setField('prizeExpected', draft.prizeExpected === true || draft.prizeExpected === 'yes');
        for (const key of ['prizeTitle', 'prizeHolder', 'startsLocal']) if (typeof draft[key] === 'string') setField(key, draft[key]);
        if (formats.some((item) => item.id === draft.format)) setSelectedFormat(draft.format);
        if (UUID.test(draft.tournamentId || '')) tournamentId.current = draft.tournamentId;
        if (Array.isArray(draft.participants)) setParticipants(draft.participants.filter((id) => typeof id === 'string'));
        if (Array.isArray(draft.judges)) setJudges(draft.judges.filter((id) => typeof id === 'string'));
        if (typeof draft.coverPath === 'string' && draft.coverPath.startsWith(`tournament-covers/${user.userId}/${draft.tournamentId}/`)) cache.current = { ...(cache.current || {}), coverPath: draft.coverPath };
        if (draft.pendingRequest?.tournamentId === draft.tournamentId) setRetryRequest(draft.pendingRequest);
        if (draft.step === 2) setStep(2);
      } catch { /* Si un borrador está incompleto, el formulario sigue disponible. */ }
      if (alive) setDraftReady(true);
      void tournamentFee().then((pricing) => { if (alive) setFee(pricing); }).catch((cause) => { if (alive) { setNotice(statusError(cause)); setError(true); } });
    };
    setDraftReady(false);
    request();
    return () => { alive = false; };
  }, [authStatus, user?.userId, setField]);

  useEffect(() => {
    if (authStatus !== 'signed-in' || step !== 2) return undefined;
    let alive = true;
    setPeopleLoading(true);
    registeredProfiles().then((items) => {
      if (!alive) return;
      setProfiles(items.filter((item) => item.accountComplete));
      setPeopleLoading(false);
    }).catch((cause) => {
      if (alive) { setNotice(statusError(cause)); setError(true); setPeopleLoading(false); }
    });
    return () => { alive = false; };
  }, [authStatus, step]);

  useEffect(() => {
    if (!user?.userId || !draftReady) return;
    try {
      sessionStorage.setItem(makeDraftKey(user.userId), JSON.stringify({
        name: fields.name, activity: fields.activity, overview: fields.overview, description: fields.description,
        participantLimit: capacity, arbitrationMode: fields.arbitrationMode, prizeExpected: fields.prizeExpected,
        prizeTitle: fields.prizeTitle, prizeHolder: fields.prizeHolder, startsLocal: fields.startsLocal,
        participants, judges, format: selectedFormat, step, tournamentId: tournamentId.current,
        coverPath: cache.current?.coverPath || '', pendingRequest: retryRequest,
      }));
    } catch { /* El borrador es de sesión y nunca guarda teléfonos, correos ni imágenes originales. */ }
  }, [user?.userId, draftReady, fields, capacity, participants, judges, selectedFormat, step, retryRequest]);

  useEffect(() => {
    if (noJudge && judges.length) setJudges([]);
  }, [noJudge, judges.length]);

  useEffect(() => {
    if (capacity !== 2 && selectedFormat === 'DUEL') setSelectedFormat('ROUND_ROBIN');
  }, [capacity, selectedFormat]);

  useEffect(() => {
    if (step === 1) stageOne.current?.focus({ preventScroll: true });
    if (step === 2) stageTwo.current?.focus({ preventScroll: true });
  }, [step]);

  const schedulePreview = useMemo(() => {
    try {
      const utc = localToUtc(fields.startsLocal, zone);
      if (Date.parse(utc) <= Date.now()) return 'Elegí una fecha y hora futuras.';
      return scheduleLabel(utc, zone);
    } catch { return 'Elegí una fecha futura y válida.'; }
  }, [fields.startsLocal, zone]);

  const showNotice = (message, isError = false) => { setNotice(message); setError(isError); };

  const persistDraftNow = () => {
    if (!user?.userId) return;
    try { sessionStorage.setItem(makeDraftKey(user.userId), JSON.stringify({ ...fields, participantLimit: capacity, participants, judges, format: selectedFormat, step, tournamentId: tournamentId.current, coverPath: cache.current?.coverPath || '', pendingRequest: retryRequest })); } catch {}
  };

  async function chooseCover(file) {
    if (!file || coverWorking || saving) return;
    const abort = new AbortController();
    coverAbort.current?.abort();
    coverAbort.current = abort;
    setCoverWorking(true);
    try {
      const result = await editCover(file, cover?.framing || {}, abort.signal);
      if (result && !abort.signal.aborted) setCover({ ...result, sourceName: file.name });
    } catch (cause) { showNotice(statusError(cause), true); }
    finally { if (coverAbort.current === abort) { coverAbort.current = null; setCoverWorking(false); } }
  }

  function toggleSelection(role, id) {
    const target = role === 'participant' ? participants : judges;
    const setter = role === 'participant' ? setParticipants : setJudges;
    if (target.includes(id)) setter(target.filter((item) => item !== id));
    else {
      const limit = role === 'participant' ? capacity : MAX_JUDGES;
      if (target.length >= limit) return;
      const selectedOwners = profiles.filter((item) => target.includes(item.id)).map(owner);
      const candidate = profiles.find((item) => item.id === id);
      if (selectedOwners.includes(owner(candidate))) {
        showNotice('No podés elegir dos perfiles de la misma cuenta para el mismo rol.', true);
        return;
      }
      setter([...target, id]);
    }
    showNotice('');
  }

  function validateFirstStep() {
    if (fields.name.trim().length < 3) return showNotice('El nombre del torneo debe tener al menos 3 caracteres.', true), false;
    if (fields.activity.trim().length < 2) return showNotice('Indicá el juego o la actividad.', true), false;
    if (fields.description.trim().length < 10) return showNotice('Escribí reglas de al menos 10 caracteres.', true), false;
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > MAX_PLAYERS) return showNotice('Elegí entre 2 y 64 participantes.', true), false;
    if (coverWorking) return showNotice('Esperá a que termine de prepararse la imagen.', true), false;
    showNotice('');
    return true;
  }

  async function publish(event) {
    event.preventDefault();
    if (saving) return;
    if (step === 1) {
      if (validateFirstStep()) setStep(2);
      return;
    }
    if (!fee || !fee.enabled) return showNotice(fee ? 'La creación de torneos está pausada temporalmente.' : 'No pudimos confirmar la tarifa. Reintentá antes de publicar.', true);
    if (!retryRequest && !validateFirstStep()) { setStep(1); return; }
    if (selectedFormat === 'SWISS') return showNotice('El sistema suizo sigue en definición y todavía no se puede publicar.', true);
    if (selectedFormat === 'DOUBLE_ELIMINATION' && capacity < 3) return showNotice('La doble eliminación necesita al menos 3 participantes.', true);
    if (!retryRequest && participants.length !== capacity) return showNotice(`Elegí exactamente ${capacity} participantes. Seleccionaste ${participants.length}.`, true);
    if (!retryRequest && selectedFormat === 'DUEL' && capacity !== 2) return showNotice('El Duelo 1v1 necesita exactamente 2 participantes.', true);
    if (!retryRequest && !noJudge && !judges.length) return showNotice('Elegí al menos un juez o cambiá el torneo a «Sin juez».', true);
    if (!retryRequest && fields.prizeExpected && (!fields.prizeTitle.trim() || !fields.prizeHolder.trim())) return showNotice('Completá el nombre del premio y quién lo entrega.', true);

    let startsAt = retryRequest?.startsAt;
    if (!retryRequest) {
      try { startsAt = localToUtc(fields.startsLocal, zone); if (Date.parse(startsAt) <= Date.now()) throw new Error('Elegí una fecha y hora futuras.'); }
      catch (cause) { return showNotice(cause.message, true); }
    }

    setSaving(true);
    try {
      let coverPath = retryRequest?.coverPath || cache.current?.coverPath || null;
      if (!retryRequest && cover && !coverPath) {
        showNotice('Subiendo la portada…');
        coverPath = await uploadTournamentCover(tournamentId.current, cover.blob);
        cache.current = { ...(cache.current || {}), coverPath };
      }
      let prizeImagePath = retryRequest?.prizeImagePath || null;
      if (!retryRequest && fields.prizeExpected && prizeFile) {
        showNotice('Preparando la imagen del premio…');
        prizeImagePath = await uploadTournamentCover(tournamentId.current, await prepareCover(prizeFile));
      }
      let request = retryRequest;
      if (!request) {
        request = {
          tournamentId: tournamentId.current,
          name: fields.name.trim(), activity: fields.activity.trim(), overview: fields.overview.trim(), description: fields.description.trim(),
          conflicts: '', format: selectedFormat, participantIds: participants, judgeIds: noJudge ? [] : judges,
          participantLimit: capacity, arbitrationMode: fields.arbitrationMode, startsAt, timeZone: zone,
          prizeExpected: fields.prizeExpected,
          ...(fields.prizeExpected ? { prizeType: 'OTHER', prizeTitle: fields.prizeTitle.trim(), prizeDescription: '', prizeHolder: fields.prizeHolder.trim(), prizeFunder: '', prizeImagePath } : {}),
          coverPath, treasurerId: null,
        };
        setRetryRequest(request);
        try { sessionStorage.setItem(makeDraftKey(user.userId), JSON.stringify({ ...fields, participantLimit: capacity, participants, judges, format: selectedFormat, step, tournamentId: tournamentId.current, coverPath, pendingRequest: request })); } catch {}
      }
      showNotice(fee.participantAmountCents === 0 ? 'Creando torneo y enviando invitaciones…' : 'Preparando el cobro. Aún no se realizó ningún cobro.');
      const result = await createClubTournament(request);
      try { sessionStorage.removeItem(makeDraftKey(user.userId)); } catch {}
      if (result.status === 'EXEMPT') navigate(`/torneo?id=${encodeURIComponent(result.id)}`, { replace: true });
      else navigate(`/pago?id=${encodeURIComponent(result.id)}`, { replace: true });
    } catch (cause) {
      let known = Boolean(retryRequest);
      try {
        const client = await tournamentClient();
        const result = await client.models.TournamentPayment.get({ id: tournamentId.current });
        known ||= Boolean(result.data?.id);
      } catch { known = true; }
      if (!known) setRetryRequest(null);
      showNotice(`${statusError(cause)}${known ? ' El reintento conservará la misma solicitud para evitar duplicados.' : ''}`, true);
    } finally { setSaving(false); }
  }

  const clearDraft = () => {
    if (!user?.userId || saving) return;
    if (!window.confirm('¿Empezar otro torneo? El borrador actual se eliminará de esta sesión.')) return;
    try { sessionStorage.removeItem(makeDraftKey(user.userId)); } catch {}
    tournamentId.current = crypto.randomUUID();
    cache.current = null;
    setRetryRequest(null); setFields({ name: '', activity: '', overview: '', description: '', count: 2, arbitrationMode: 'JUDGES', prizeExpected: false, prizeTitle: '', prizeHolder: '', startsLocal: localDateValue() });
    setParticipants([]); setJudges([]); setSelectedFormat('DUEL'); setCover(null); setPrizeFile(null); setStep(1); showNotice('Borrador nuevo listo.');
  };

  useEffect(() => {
    const node = document.querySelector('[data-react-bracket-preview]');
    if (!node) return undefined;
    let live = true;
    let cleanup;
    void import('../../tournament-preview.js').then(({ renderTournamentPreview }) => {
      if (live) cleanup = renderTournamentPreview(node, { format: selectedFormat, count: Math.max(2, Math.min(MAX_PLAYERS, capacity || 2)), names: selectedPeople.map((item) => item.nickname) });
    });
    return () => { live = false; cleanup?.(); };
  }, [selectedFormat, capacity, selectedPeople]);

  if (authStatus === 'checking') return <main className="react-create-shell"><div className="react-create-surface"><p role="status">Comprobando tu cuenta…</p></div></main>;
  if (authStatus !== 'signed-in') return <main className="react-create-shell"><div className="react-create-surface"><p className="react-eyebrow">PROVEIT CLUB</p><h1>Entrá para crear tu torneo</h1><p>Tu sesión se verifica con el servicio del club antes de publicar.</p><Link className="react-primary" to="/ingresar">Ir a ingresar ↗</Link></div></main>;

  return (
    <main className="react-create-shell">
      <form className="react-create-surface" onSubmit={publish}>
        <header className="react-create-header"><div><p className="react-eyebrow">NUEVA COMPETENCIA</p><h1 ref={stageOne} tabIndex={-1}>Crear torneo</h1></div><span className="react-save-state">{retryRequest ? 'Solicitud preparada' : 'Borrador local'}</span></header>
        <ol className="react-create-steps" aria-label="Etapas de creación">{['El desafío', 'Preparar el encuentro'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-complete={index + 1 < step}><span>0{index + 1}</span>{label}</li>)}</ol>

        {step === 1 ? <section className="react-create-stage" aria-labelledby="react-create-stage-one">
          <h2 id="react-create-stage-one" className="react-create-sr-only">Datos del torneo</h2>
          <div className="react-create-grid">
            <div className="react-create-fields">
              <label>Nombre del torneo <b>*</b><input required minLength={3} maxLength={80} value={fields.name} onChange={(event) => setField('name', event.target.value)} placeholder="Copa del viernes" disabled={Boolean(retryRequest)} /></label>
              <label>Juego o actividad <b>*</b><input required minLength={2} maxLength={80} value={fields.activity} onChange={(event) => setField('activity', event.target.value)} placeholder="LoL, tenis, fútbol, trivia…" disabled={Boolean(retryRequest)} /></label>
              <label>Descripción <small>opcional</small><textarea maxLength={500} rows={2} value={fields.overview} onChange={(event) => setField('overview', event.target.value)} placeholder="Un encuentro para competir y compartir." disabled={Boolean(retryRequest)} /></label>
              <label>Reglas <b>*</b><textarea required minLength={10} maxLength={1000} rows={4} value={fields.description} onChange={(event) => setField('description', event.target.value)} placeholder="Cómo se compite, cómo se gana y qué pasa si hay empate." disabled={Boolean(retryRequest)} /></label>
              <label>Número de participantes <b>*</b><input type="number" min={2} max={MAX_PLAYERS} step={1} value={fields.count} onChange={(event) => { const count = Math.max(2, Math.min(MAX_PLAYERS, Number(event.target.value) || 2)); setField('count', count); }} disabled={Boolean(retryRequest)} /><small>De 2 a 64 cuentas. Se invitarán en la próxima etapa.</small></label>
              <ChoiceCards legend="¿El torneo cuenta con jurado?" value={fields.arbitrationMode} onChange={(value) => setField('arbitrationMode', value)} options={[[ 'JUDGES', 'Sí, invito juez' ], [ 'ORGANIZER', 'No, decido yo' ]]} />
              {noJudge && <p className="react-create-hint">Sin juez, el organizador decide el resultado final. Los invitados verán esta condición antes de confirmar.</p>}
              <ChoiceCards legend="¿Se prevé un premio?" value={fields.prizeExpected ? 'yes' : 'no'} onChange={(value) => setField('prizeExpected', value === 'yes')} options={[[ 'yes', 'Sí' ], [ 'no', 'No' ]]} />
            </div>
            <aside className="react-create-poster-area"><label>Imagen promocional <small>opcional</small></label><button type="button" className="react-create-poster" onClick={() => coverInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void chooseCover(event.dataTransfer.files[0]); }} disabled={Boolean(retryRequest)} aria-label="Elegir portada del torneo">
                {coverUrl ? <img src={coverUrl} alt="Vista previa de la portada" /> : <span className="react-create-poster-empty"><b>↗</b><span>Hacé clic o arrastrá una imagen.</span></span>}
                <span className="react-create-poster-gradient" /><span className="react-create-poster-caption"><small>{fields.activity || 'TU PRÓXIMO DESAFÍO'}</small><strong>{fields.name || 'El nombre lo ponés vos.'}</strong></span>
              </button><input ref={coverInput} type="file" className="react-create-file-hidden" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseCover(event.target.files?.[0])} /><div className="react-create-image-tools"><button type="button" onClick={() => coverInput.current?.click()} disabled={Boolean(retryRequest) || coverWorking}>{coverWorking ? 'Preparando…' : cover ? 'Cambiar imagen' : 'Agregar imagen'}</button>{cover && <button type="button" onClick={() => setCover(null)} disabled={Boolean(retryRequest)}>Quitar</button>}</div><p>Recomendado: <b>1080 × 1920 px · 9:16</b>, como una historia de Instagram. También podés adaptar fotos horizontales o cuadradas.</p><p>JPG, PNG o WebP · hasta 5 MB. Podés mover y ajustar el encuadre.</p>
            </aside>
          </div>
          <footer className="react-create-footer"><Link to="/torneos">Cancelar</Link><button type="button" className="react-primary" onClick={() => { if (validateFirstStep()) { setStep(2); setNotice(''); } }}>Siguiente etapa <span aria-hidden="true">↗</span></button></footer>
        </section> : <section className="react-create-stage" aria-labelledby="react-create-stage-two">
          <div className="react-create-stage-intro"><p className="react-eyebrow">PREPARAR EL ENCUENTRO</p><h2 ref={stageTwo} id="react-create-stage-two" tabIndex={-1}>Elegí con quién y cómo competir.</h2><p>Las invitaciones se enviarán al publicar.</p></div>
          {retryRequest && <div className="react-create-hint">Esta solicitud ya fue preparada. El reintento conserva su contenido para evitar crear o cobrar un duplicado. <button type="button" onClick={clearDraft}>Crear un torneo nuevo</button></div>}
          <div className="react-create-setup">
            <div className="react-create-main-options">
              <details open className="react-create-disclosure"><summary>01 · Participantes <span>{participants.length} / {capacity}</span></summary><div className="react-create-disclosure-body"><label>Buscar cuentas del club<input type="search" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder="Buscar por nick…" /></label><p className="react-create-help" role="status">{peopleLoading ? 'Cargando cuentas del club…' : `${profiles.length} cuentas disponibles. Cada invitado debe tener el perfil completo.`}</p><div className="react-create-selected">{selectedPeople.map((person) => <button type="button" key={person.id} onClick={() => toggleSelection('participant', person.id)} disabled={Boolean(retryRequest)} aria-label={`Quitar a ${person.nickname}`}><ProfileAvatar profile={person} />{person.nickname} <span aria-hidden="true">×</span></button>)}</div><div className="react-create-person-list">{filteredPeople.map((person) => <label key={person.id} className={participants.includes(person.id) ? 'is-selected' : ''}><input type="checkbox" checked={participants.includes(person.id)} onChange={() => toggleSelection('participant', person.id)} disabled={Boolean(retryRequest) || (!participants.includes(person.id) && participants.length >= capacity) || profiles.some((item) => item.id !== person.id && participants.includes(item.id) && owner(item) === owner(person))} /><ProfileAvatar profile={person} /><span>{person.nickname}</span><small>{participants.includes(person.id) ? '✓ Seleccionado' : 'Elegir'}</small></label>)}{!peopleLoading && !filteredPeople.length && <p>No hay perfiles para esa búsqueda.</p>}</div><button type="button" className="react-create-text-button" onClick={() => { setPeopleLoading(true); registeredProfiles().then((items) => setProfiles(items.filter((item) => item.accountComplete))).catch((cause) => showNotice(statusError(cause), true)).finally(() => setPeopleLoading(false)); }}>Actualizar lista ↻</button></div></details>
              <details open className="react-create-disclosure"><summary>02 · Formato de competencia</summary><div className="react-create-disclosure-body"><div className="react-create-formats">{formats.map((format) => <button type="button" key={format.id} className="react-create-format" aria-pressed={selectedFormat === format.id} disabled={Boolean(retryRequest) || format.comingSoon || (format.minParticipants && capacity < format.minParticipants)} onClick={() => setSelectedFormat(format.id)}><span dangerouslySetInnerHTML={{ __html: formatImage(format.id) }} /><b>{format.name}</b>{format.comingSoon && <small>En definición</small>}</button>)}</div><p className="react-create-help">{formats.find((item) => item.id === selectedFormat)?.description}</p><div data-react-bracket-preview className="react-create-bracket" /></div></details>
            </div>
            <aside className="react-create-side-options">
              {!noJudge && <details open className="react-create-disclosure"><summary>03 · Jurado y condiciones <span>{judges.length} elegidos</span></summary><div className="react-create-disclosure-body"><p className="react-create-help">Elegí jueces. Cada persona debe aceptar el cargo y sus condiciones.</p><div className="react-create-person-list react-create-judge-list">{filteredPeople.map((person) => <label key={person.id} className={judges.includes(person.id) ? 'is-selected' : ''}><input type="checkbox" checked={judges.includes(person.id)} onChange={() => toggleSelection('judge', person.id)} disabled={Boolean(retryRequest) || (!judges.includes(person.id) && judges.length >= MAX_JUDGES) || profiles.some((item) => item.id !== person.id && judges.includes(item.id) && owner(item) === owner(person))} /><ProfileAvatar profile={person} /><span>{person.nickname}</span><small>{judges.includes(person.id) ? '✓ Seleccionado' : 'Elegir'}</small></label>)}</div></div></details>}
              <details open className="react-create-disclosure"><summary>04 · Fecha y horario</summary><div className="react-create-disclosure-body"><label>Día y hora de inicio<input type="datetime-local" required value={fields.startsLocal} onChange={(event) => setField('startsLocal', event.target.value)} disabled={Boolean(retryRequest)} /></label><p className="react-create-help">Zona detectada automáticamente: {zoneLabel(zone)} · {zone.replaceAll('_', ' ')}</p><p className="react-create-help">{schedulePreview}</p></div></details>
              {fields.prizeExpected && <details open className="react-create-disclosure"><summary>05 · Definir premio</summary><div className="react-create-disclosure-body"><p className="react-create-help">Indicá qué se gana y quién se encarga de entregarlo.</p><label>Nombre del premio<input maxLength={120} value={fields.prizeTitle} onChange={(event) => setField('prizeTitle', event.target.value)} placeholder="Una cena para dos" disabled={Boolean(retryRequest)} /></label><label>Quién lo entrega<input maxLength={120} value={fields.prizeHolder} onChange={(event) => setField('prizeHolder', event.target.value)} placeholder="Persona u organización" disabled={Boolean(retryRequest)} /></label><label>Foto del premio (opcional)<input ref={prizeInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPrizeFile(event.target.files?.[0] || null)} disabled={Boolean(retryRequest)} /></label><p className="react-create-help">La entrega es externa a ProveIt. Cambiar las condiciones exige que todos vuelvan a aceptarlas.</p></div></details>}
              <section className="react-create-review"><p className="react-eyebrow">ANTES DE PUBLICAR</p><h3>{fields.name || 'Tu torneo'}</h3><p>{formats.find((item) => item.id === selectedFormat)?.name} · {capacity} participantes · {noJudge ? 'decide el organizador' : `${judges.length} jueces invitados`}</p><p>{schedulePreview}</p><p>{fee ? (fee.participantAmountCents === 0 ? 'Crear y participar es gratis.' : `Crear el torneo es gratis. Cada jugador paga ${money(fee.participantAmountCents ?? 50_000)} al aceptar.`) : 'Consultando tarifa…'}</p><small>Después del pago aprobado se confirmará el lugar en la sala.</small></section>
            </aside>
          </div>
          <footer className="react-create-footer"><button type="button" className="react-create-back" onClick={() => setStep(1)} disabled={saving}>← Etapa anterior</button><button className="react-primary" type="submit" disabled={saving || !fee || fee.enabled === false}>{saving ? 'Publicando…' : retryRequest ? 'Retomar publicación' : fee?.participantAmountCents === 0 ? 'Crear y enviar invitaciones' : 'Publicar torneo'} <span aria-hidden="true">↗</span></button></footer>
        </section>}
        {(notice || error) && <p className={`react-create-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{notice}</p>}
      </form>
    </main>
  );
}
