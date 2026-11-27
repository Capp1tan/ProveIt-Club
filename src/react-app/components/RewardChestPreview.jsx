import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { communityAction } from '../../community-api.js';
import { chestTiers, drawChestReward, formatChestChance } from '../../../shared/chest-rewards.ts';
import './RewardChestPreview.css';

const rewardPool = chestTiers.flatMap((tier) => tier.rewards.map((label) => ({ ...tier, label })));
const targetIndex = 28;
const REEL_DURATION_SECONDS = 6.7;
const STOP_SUSPENSE_MS = 320;
const REVEAL_FALLBACK_MS = Math.ceil(REEL_DURATION_SECONDS * 1000) + STOP_SUSPENSE_MS + 350;

function makeReel(winner) {
  const items = Array.from({ length: 35 }, () => rewardPool[Math.floor(Math.random() * rewardPool.length)]);
  items[targetIndex] = winner;
  return items;
}

function effectSound(context, type) {
  const tone = (frequency, duration, wave = 'sine', volume = 0.035, endFrequency = frequency) => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.025, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.addEventListener('ended', () => { oscillator.disconnect(); gain.disconnect(); }, { once: true });
  };

  if (type === 'open') {
    tone(720, 0.12, 'triangle', 0.035, 390);
    tone(118, 0.22, 'sine', 0.075, 54);
    tone(1460, 0.08, 'sine', 0.018, 820);
  } else if (type === 'transition') {
    const duration = 0.72;
    const length = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(now);
    source.addEventListener('ended', () => { source.disconnect(); filter.disconnect(); gain.disconnect(); }, { once: true });
  } else if (type === 'reveal') {
    tone(523, 0.46, 'sine', 0.055, 523);
    window.setTimeout(() => tone(659, 0.48, 'sine', 0.045, 659), 90);
    window.setTimeout(() => tone(784, 0.66, 'sine', 0.05, 784), 180);
  }
}

function ChestArt({ opening = false }) {
  return <motion.div className={`reward-chest-art${opening ? ' is-opening' : ''}`} animate={opening ? { y: [0, -5, 0], rotate: [0, -1, 1, 0] } : { y: [0, -3, 0] }} transition={opening ? { duration: 0.58, ease: 'easeInOut' } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>
    <motion.div className="reward-chest-lid" animate={opening ? { rotateX: -112, y: -16 } : { rotateX: 0, y: 0 }} transition={{ duration: 0.68, ease: [0.2, 0.8, 0.2, 1] }} />
    <div className="reward-chest-body"><span className="reward-chest-band" /><span className="reward-chest-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12v10H6z" /></svg></span></div>
    <span className="reward-chest-ground" />
  </motion.div>;
}

export default function RewardChestPreview({ profileId }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('ready');
  const [winner, setWinner] = useState(null);
  const [reel, setReel] = useState([]);
  const [inventory, setInventory] = useState({ available: [], openedCount: 0, recentRewards: [] });
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [revealMessage, setRevealMessage] = useState('');
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const windowRef = useRef(null);
  const winnerRef = useRef(null);
  const audioRef = useRef(null);
  const titleId = useId();

  function playSound(type) {
    try {
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) return;
      audioRef.current ||= new Constructor();
      if (audioRef.current.state === 'suspended') void audioRef.current.resume();
      effectSound(audioRef.current, type);
    } catch { /* La interfaz sigue funcionando si el navegador silencia audio. */ }
  }

  useEffect(() => {
    if (!profileId) return undefined;
    let active = true;
    void communityAction('CHESTS', { targetProfileId: profileId }).then((result) => {
      if (active) setInventory({ available: result.available || [], openedCount: result.openedCount || 0, recentRewards: result.recentRewards || [] });
    }).catch((error) => { if (active) setNotice(error.message || 'No pudimos cargar tus cofres.'); }).finally(() => { if (active) setInventoryLoading(false); });
    return () => { active = false; };
  }, [profileId]);

  useEffect(() => () => { if (audioRef.current && audioRef.current.state !== 'closed') void audioRef.current.close(); }, []);

  function resetPreview() {
    x.set(0); setWinner(null); setReel([]); setStage('ready'); setNotice(''); setRevealMessage(''); setPreviewOnly(false);
  }

  async function beginOpen(preview = false) {
    if (requesting || (stage !== 'ready' && stage !== 'revealed')) return;
    const chest = inventory.available[0];
    if (!preview && !chest) { setNotice('No tenés cofres disponibles todavía.'); return; }
    setRequesting(true); setNotice(''); setPreviewOnly(preview); setRevealMessage(''); playSound('open');
    try {
      const selected = preview ? drawChestReward() : (await communityAction('OPEN_CHEST', { targetProfileId: profileId, chestId: chest.id })).reward;
      setWinner(selected);
      setReel(makeReel(selected));
      x.set(0);
      if (!preview) {
        setInventory((current) => ({ ...current, available: current.available.filter((item) => item.id !== chest.id), openedCount: current.openedCount + 1, recentRewards: [{ id: chest.id, label: selected.label, rarity: selected.name, openedAt: new Date().toISOString() }, ...current.recentRewards].slice(0, 8) }));
        window.dispatchEvent(new Event('proveit:chest-opened'));
        setRevealMessage('La recompensa quedó guardada en tu historial.');
      } else setRevealMessage('Vista previa: no consume un cofre ni acredita una recompensa.');
      if (reducedMotion) { setStage('revealed'); playSound('reveal'); }
      else setStage('unlocking');
    } catch (error) { setNotice(error.message || 'No se pudo abrir el cofre.'); }
    finally { setRequesting(false); }
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (stage !== 'unlocking') return undefined;
    const timer = window.setTimeout(() => { playSound('transition'); setStage('spinning'); }, 720);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'spinning' || !winner) return undefined;
    let frame = 0;
    let controls;
    let active = true;
    let fallback;
    let revealTimer;
    const reveal = () => {
      if (!active) return;
      playSound('reveal');
      setStage('revealed');
    };
    const startWhenMounted = () => {
      if (!active) return;
      if (!windowRef.current || !winnerRef.current) { frame = window.requestAnimationFrame(startWhenMounted); return; }
      const viewport = windowRef.current.getBoundingClientRect();
      const selected = winnerRef.current.getBoundingClientRect();
      const safeHalfWidth = Math.max(0, (selected.width - 28) / 2);
      const randomOffset = (Math.random() * 2 - 1) * safeHalfWidth;
      const selectorPosition = viewport.left + viewport.width / 2 + randomOffset;
      const destination = selectorPosition - (selected.left + selected.width / 2);
      controls = animate(x, destination, { duration: REEL_DURATION_SECONDS, ease: [0.08, 0.77, 0.12, 1] });
      fallback = window.setTimeout(reveal, REVEAL_FALLBACK_MS);
      controls.finished.then(() => {
        window.clearTimeout(fallback);
        if (active) revealTimer = window.setTimeout(reveal, STOP_SUSPENSE_MS);
      }, () => window.clearTimeout(fallback));
    };
    frame = window.requestAnimationFrame(startWhenMounted);
    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
      window.clearTimeout(revealTimer);
      controls?.stop();
    };
  }, [stage, winner, x]);

  return <section className="reward-chest-preview league-panel" aria-labelledby="reward-chest-preview-title">
    <div className="reward-chest-preview-copy"><p className="league-eyebrow">RECOMPENSAS DEL CLUB</p><h2 id="reward-chest-preview-title">Tus cofres se acumulan.</h2><p>Recibís un cofre al finalizar cada torneo en el que participes. Abrilos cuando quieras.</p><p className="reward-chest-inventory-count" aria-live="polite">{inventoryLoading ? 'Cargando inventario…' : <><strong>{inventory.available.length}</strong> {inventory.available.length === 1 ? 'cofre disponible' : 'cofres disponibles'} · <strong>{inventory.openedCount}</strong> abiertos</>}</p></div>
    <div className="reward-chest-preview-actions"><button className="reward-chest-preview-button" type="button" onClick={() => { resetPreview(); setOpen(true); }}><span className="reward-chest-mini" aria-hidden="true">◇</span><span><strong>{inventory.available.length ? 'Abrir un cofre' : 'Ver cofres'}</strong><small>{inventoryLoading ? 'Cargando inventario…' : inventory.available.length ? `${inventory.available.length} acumulado${inventory.available.length === 1 ? '' : 's'}` : 'Consultar probabilidades y animación'}</small></span><b aria-hidden="true">↗</b></button><p>Al llegar a 100 cofres abiertos, desbloqueás un logro.</p></div>
    {inventory.recentRewards.length > 0 && <div className="reward-chest-history"><strong>Últimas recompensas</strong><ul>{inventory.recentRewards.slice(0, 3).map((item) => <li key={item.id}><span>{item.label}</span><small>{item.rarity}</small></li>)}</ul></div>}
    {notice && !open && <p className="reward-chest-notice" role="status">{notice}</p>}

    <AnimatePresence>
      {open && <motion.div className="reward-chest-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.38, ease: 'easeInOut' } }} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <motion.section className="reward-chest-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <header className="reward-chest-dialog-head"><div><p className="league-eyebrow">PROVEIT CLUB · COFRES</p><h2 id={titleId}>Una sorpresa para tu recorrido.</h2><p className="reward-chest-dialog-count">Tenés <strong>{inventory.available.length}</strong> {inventory.available.length === 1 ? 'cofre guardado' : 'cofres guardados'}.</p></div><button className="reward-chest-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar vista previa">×</button></header>
          <div className={`reward-chest-opening${stage === 'revealed' ? ' has-reveal' : ''}`}>
            <div className={`reward-chest-spotlight${stage === 'unlocking' || stage === 'spinning' ? ' is-charged' : ''}`} />
            <AnimatePresence mode="wait" initial={false}>
              {stage === 'ready' || stage === 'unlocking' ? <motion.div className="reward-chest-closed-stage" key="closed" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
                <ChestArt opening={stage === 'unlocking'} />
                <p className="reward-chest-stage-label" role="status">{stage === 'unlocking' ? 'El cofre se está abriendo…' : 'Tu próximo torneo puede traer algo especial.'}</p>
              </motion.div> : stage === 'spinning' ? <motion.div className="reward-chest-reel-stage" key="reel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="reward-chest-stage-label" role="status">Buscando la recompensa…</p>
                <div className="reward-chest-reel-window" ref={windowRef}>
                  <span className="reward-chest-reel-marker" aria-hidden="true" />
                  <motion.div className="reward-chest-reel-track" style={{ x }}>
                    {reel.map((item, index) => <div className={`reward-chest-reel-item rarity-${item.id}`} key={`${item.id}-${index}`} ref={index === targetIndex ? winnerRef : undefined}>
                      <span className="reward-chest-item-symbol" aria-hidden="true">{item.id === 'red' ? '$' : item.id === 'gold' ? '✦' : item.id === 'violet' ? '⬡' : item.id === 'pink' ? '◇' : item.id === 'blue' ? '↗' : '%'}</span><strong>{item.label}</strong><small>{item.name}</small>
                    </div>)}
                  </motion.div>
                </div>
              </motion.div> : <motion.div className="reward-chest-reveal-stage" key="reward" initial={{ opacity: 0, y: 14, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
                <div className="reward-chest-confetti" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--piece': i }} />)}</div>
                <div className={`reward-chest-won rarity-${winner?.id}`}><span className="reward-chest-won-icon" aria-hidden="true">{winner?.id === 'red' ? '$' : winner?.id === 'gold' ? '✦' : winner?.id === 'violet' ? '⬡' : winner?.id === 'pink' ? '◇' : winner?.id === 'blue' ? '↗' : '%'}</span><small>{winner?.name} · {formatChestChance(winner?.chance)}%</small><h3>{winner?.label}</h3></div>
                <p className="reward-chest-stage-label">{revealMessage}</p>
              </motion.div>}
            </AnimatePresence>
          </div>
          {notice && open && <p className="reward-chest-notice" role="alert">{notice}</p>}
          {stage === 'ready' && <div className="reward-chest-odds" aria-label="Probabilidades y posibles recompensas">{chestTiers.map((tier) => <div className={`rarity-${tier.id}`} key={tier.id}><span><i />{tier.name}<b>{formatChestChance(tier.chance)}%</b></span><small>{tier.rewards.join(' · ')}</small></div>)}</div>}
          <div className="reward-chest-dialog-footer"><p>La recompensa queda guardada al confirmar la apertura. La vista previa no consume cofres.</p>{stage === 'ready' ? <div className="reward-chest-footer-actions">{inventory.available.length > 0 && <button className="reward-chest-open-button" type="button" disabled={requesting} onClick={() => void beginOpen(false)}>{requesting ? 'Abriendo…' : 'Abrir cofre'} <span aria-hidden="true">↗</span></button>}<button className="reward-chest-preview-link" type="button" disabled={requesting} onClick={() => void beginOpen(true)}>Probar animación</button></div> : stage === 'revealed' ? <div className="reward-chest-footer-actions"><button className="reward-chest-open-button" type="button" onClick={resetPreview}>Volver al inventario</button></div> : <span className="reward-chest-spinning-note">La animación está sincronizada con la selección del servidor.</span>}</div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  </section>;
}
