import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import './RewardChestPreview.css';

const tiers = [
  { id: 'gray', name: 'Común', chance: 44, rewards: ['Descuento 10 %', 'Descuento 25 %'] },
  { id: 'blue', name: 'Poco común', chance: 25, rewards: ['Descuento 50 %', 'Descuento 75 %', 'Entrada gratis'] },
  { id: 'violet', name: 'Raro', chance: 15, rewards: ['Escudo anti pérdida de PP'] },
  { id: 'pink', name: 'Muy raro', chance: 10, rewards: ['Doble PP por victoria', 'Marco de perfil', 'Fondo de perfil', 'Título de perfil'] },
  { id: 'red', name: 'Legendario', chance: 5, rewards: ['Tarjeta Steam · US$5'] },
  { id: 'gold', name: 'Épico', chance: 1, rewards: ['Premio sorpresa'] },
];
const rewardPool = tiers.flatMap((tier) => tier.rewards.map((label) => ({ ...tier, label })));
const cardWidth = 160;
const cardGap = 12;
const targetIndex = 28;

function drawPreviewReward() {
  let roll = Math.random() * 100;
  let tier = tiers[0];
  for (const candidate of tiers) {
    roll -= candidate.chance;
    if (roll < 0) { tier = candidate; break; }
  }
  return { ...tier, label: tier.rewards[Math.floor(Math.random() * tier.rewards.length)] };
}

function makeReel(winner) {
  const items = Array.from({ length: 35 }, () => rewardPool[Math.floor(Math.random() * rewardPool.length)]);
  items[targetIndex] = winner;
  return items;
}

function ChestArt({ opening = false }) {
  return <motion.div className={`reward-chest-art${opening ? ' is-opening' : ''}`} animate={opening ? { y: [0, -5, 0], rotate: [0, -1, 1, 0] } : { y: [0, -3, 0] }} transition={opening ? { duration: 0.58, ease: 'easeInOut' } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>
    <motion.div className="reward-chest-lid" animate={opening ? { rotateX: -112, y: -16 } : { rotateX: 0, y: 0 }} transition={{ duration: 0.68, ease: [0.2, 0.8, 0.2, 1] }} />
    <div className="reward-chest-body"><span className="reward-chest-band" /><span className="reward-chest-lock"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12v10H6z" /></svg></span></div>
    <span className="reward-chest-ground" />
  </motion.div>;
}

export default function RewardChestPreview() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('ready');
  const [winner, setWinner] = useState(null);
  const [reel, setReel] = useState([]);
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const windowRef = useRef(null);
  const winnerRef = useRef(null);
  const titleId = useId();

  function beginOpen() {
    const selected = drawPreviewReward();
    setWinner(selected);
    setReel(makeReel(selected));
    x.set(0);
    if (reducedMotion) { setStage('revealed'); return; }
    setStage('unlocking');
  }

  function resetPreview() {
    x.set(0); setWinner(null); setReel([]); setStage('ready');
  }

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (stage !== 'unlocking') return undefined;
    const timer = window.setTimeout(() => setStage('spinning'), 720);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'spinning' || !winner || !winnerRef.current || !windowRef.current) return undefined;
    let frame = 0;
    let controls;
    let active = true;
    frame = window.requestAnimationFrame(() => {
      const viewport = windowRef.current.getBoundingClientRect();
      const selected = winnerRef.current.getBoundingClientRect();
      const destination = viewport.left + viewport.width / 2 - (selected.left + selected.width / 2);
      controls = animate(x, destination, { duration: 5.2, ease: [0.08, 0.83, 0.16, 1] });
      controls.then(() => { if (active) setStage('revealed'); });
    });
    return () => { active = false; window.cancelAnimationFrame(frame); controls?.stop(); };
  }, [stage, winner, x]);

  return <section className="reward-chest-preview league-panel" aria-labelledby="reward-chest-preview-title">
    <div className="reward-chest-preview-copy"><p className="league-eyebrow">RECOMPENSAS DEL CLUB</p><h2 id="reward-chest-preview-title">Un cofre al terminar el torneo.</h2><p>Las recompensas se guardarán en tu inventario para que elijas cuándo usarlas.</p></div>
    <button className="reward-chest-preview-button" type="button" onClick={() => { resetPreview(); setOpen(true); }}><span className="reward-chest-mini" aria-hidden="true">◇</span><span><strong>Probar apertura</strong><small>Simulación visual · no acredita premios</small></span><b aria-hidden="true">↗</b></button>

    <AnimatePresence>
      {open && <motion.div className="reward-chest-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <motion.section className="reward-chest-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ type: 'spring', stiffness: 290, damping: 28 }}>
          <header className="reward-chest-dialog-head"><div><p className="league-eyebrow">PROVEIT CLUB · COFRES</p><h2 id={titleId}>Una sorpresa para tu recorrido.</h2></div><button className="reward-chest-close" type="button" onClick={() => setOpen(false)} aria-label="Cerrar vista previa">×</button></header>
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
                <div className={`reward-chest-won rarity-${winner?.id}`}><span className="reward-chest-won-icon" aria-hidden="true">{winner?.id === 'red' ? '$' : winner?.id === 'gold' ? '✦' : winner?.id === 'violet' ? '⬡' : winner?.id === 'pink' ? '◇' : winner?.id === 'blue' ? '↗' : '%'}</span><small>{winner?.name} · {winner?.chance}%</small><h3>{winner?.label}</h3></div>
                <p className="reward-chest-stage-label">Así se vería tu recompensa en el inventario.</p>
              </motion.div>}
            </AnimatePresence>
          </div>
          {stage === 'ready' && <div className="reward-chest-odds" aria-label="Probabilidades y posibles recompensas">{tiers.map((tier) => <div className={`rarity-${tier.id}`} key={tier.id}><span><i />{tier.name}<b>{tier.chance}%</b></span><small>{tier.rewards.join(' · ')}</small></div>)}</div>}
          <div className="reward-chest-dialog-footer"><p>Porcentaje por rareza. Resultado de muestra: no se acredita ni guarda. El sorteo real se validará en el servidor.</p>{stage === 'ready' ? <button className="reward-chest-open-button" type="button" onClick={beginOpen}>Abrir cofre de prueba <span aria-hidden="true">↗</span></button> : stage === 'revealed' ? <button className="reward-chest-open-button" type="button" onClick={resetPreview}>Probar otra apertura</button> : <span className="reward-chest-spinning-note">La animación no cambia la recompensa sorteada.</span>}</div>
        </motion.section>
      </motion.div>}
    </AnimatePresence>
  </section>;
}
