import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

const basePhotos = [
  {
    id: 'cards',
    src: '/carousel/cartas-800.webp',
    alt: 'Amigos compartiendo una partida de cartas.',
    title: 'Cartas entre amigos',
    detail: 'Un encuentro del club · Imagen ilustrativa',
  },
  {
    id: 'padel',
    src: '/carousel/padel-800.webp',
    alt: 'Amigos compitiendo en una cancha de pádel.',
    title: 'Pádel entre amigos',
    detail: 'Un encuentro del club · Imagen ilustrativa',
  },
  {
    id: 'award',
    src: '/community/winner-award.jpg',
    alt: 'Entrega ilustrativa de un certificado de reconocimiento.',
    title: 'Entrega de premio',
    detail: 'Foto ilustrativa del Salón de la fama',
  },
  {
    id: 'shooter',
    src: '/carousel/shooter-800.webp',
    alt: 'Una persona celebrando una partida de videojuegos.',
    title: 'Videojuegos entre amigos',
    detail: 'Un encuentro del club · Imagen ilustrativa',
  },
];

const spring = { type: 'spring', stiffness: 135, damping: 24, mass: 1.25 };
const openingSeconds = 0.9;
const confettiColors = ['#8189ff', '#56d5ff', '#ffd86a', '#ff7b9d', '#a8f078', '#f4f6ff'];
const confettiPieces = Array.from({ length: 46 }, (_, index) => {
  const angle = (index / 46) * Math.PI * 2;
  const distance = 100 + ((index * 47) % 200);
  return {
    id: index,
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance + 110 + ((index * 13) % 70),
    rotate: (index % 2 ? 1 : -1) * (220 + ((index * 19) % 420)),
    color: confettiColors[index % confettiColors.length],
    delay: (index % 9) * 0.018,
    size: 5 + (index % 5),
  };
});
const fireworkBursts = [
  { id: 'left', x: '29%', y: '32%', count: 16, radius: 72 },
  { id: 'right', x: '72%', y: '27%', count: 18, radius: 92 },
  { id: 'center', x: '51%', y: '22%', count: 13, radius: 60 },
].map((burst) => ({
  ...burst,
  rays: Array.from({ length: burst.count }, (_, index) => {
    const angle = (index / burst.count) * Math.PI * 2;
    return { id: index, x: Math.cos(angle) * burst.radius, y: Math.sin(angle) * burst.radius };
  }),
}));

export default function WinnerGallery({ championName, tournamentName, championAvatar }) {
  const galleryId = useId();
  const galleryRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const audioRef = useRef(null);
  const playbackTokenRef = useRef(0);
  const audioStartedRef = useRef(false);
  const audioFallbackRef = useRef(false);
  const audioStartTimeRef = useRef(0);
  const celebrationTimerRef = useRef(0);
  const reduceMotion = useReducedMotion();
  const photos = useMemo(() => {
    if (!championAvatar) return basePhotos;
    return [...basePhotos, {
      id: 'champion',
      src: championAvatar,
      alt: `Foto de perfil de ${championName}, último campeón del club.`,
      title: championName,
      detail: `Último campeón · ${tournamentName}`,
    }];
  }, [championAvatar, championName, tournamentName]);
  const [activePosition, setActivePosition] = useState(2);
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [openingProgress, setOpeningProgress] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const selectedIndex = ((activePosition % photos.length) + photos.length) % photos.length;
  const selectedPhoto = photos[selectedIndex];
  const positions = Array.from({ length: 7 }, (_, slot) => {
    const distance = slot - 3;
    const virtualPosition = activePosition + distance;
    const photoIndex = ((virtualPosition % photos.length) + photos.length) % photos.length;
    const depth = Math.abs(distance);
    return {
      photo: photos[photoIndex],
      virtualPosition,
      distance,
      depth,
      y: Math.min(depth * 9, 18),
      scale: depth === 0 ? 1.04 : depth === 1 ? 0.84 : depth === 2 ? 0.68 : 0.56,
      rotate: distance * 2.5,
      opacity: depth === 0 ? 1 : depth === 1 ? 0.78 : depth === 2 ? 0.48 : 0.25,
      zIndex: 10 - depth,
    };
  });
  const cardWidth = Math.min(212, Math.max(128, galleryWidth * 0.245));
  const step = Math.min(178, Math.max(76, galleryWidth * 0.21));

  useEffect(() => {
    const audio = new Audio('/audio/winner-gallery-open.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
      window.clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let frame = 0;
    let celebrationStarted = false;
    const animateOpening = () => {
      if (!audioStartedRef.current) {
        frame = window.requestAnimationFrame(animateOpening);
        return;
      }
      const audio = audioRef.current;
      const elapsed = audioFallbackRef.current
        ? (performance.now() - audioStartTimeRef.current) / 1000
        : audio?.currentTime || 0;
      const progress = Math.min(1, elapsed / openingSeconds);
      setOpeningProgress(progress);
      if (progress >= 1 && !celebrationStarted) {
        celebrationStarted = true;
        setShowCelebration(true);
        window.clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = window.setTimeout(() => setShowCelebration(false), 2100);
      }
      if (progress < 1 || (audio && !audio.paused && !audio.ended)) {
        frame = window.requestAnimationFrame(animateOpening);
      }
    };
    frame = window.requestAnimationFrame(animateOpening);
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, celebrationKey]);

  useEffect(() => {
    if (isOpen || isPaused || reduceMotion || photos.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActivePosition((position) => position + 1);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isOpen, isPaused, photos, reduceMotion]);

  useEffect(() => {
    const element = galleryRef.current;
    if (!element) return undefined;
    const measure = () => setGalleryWidth(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const previousInert = appRoot?.inert ?? false;
    const previousAriaHidden = appRoot?.getAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePhoto();
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current
        ?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = previousInert;
        if (previousAriaHidden === null) appRoot.removeAttribute('aria-hidden');
        else appRoot.setAttribute('aria-hidden', previousAriaHidden);
      }
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);

  function openPhoto(virtualPosition) {
    const playbackToken = ++playbackTokenRef.current;
    setActivePosition(virtualPosition);
    setOpeningProgress(0);
    setShowCelebration(false);
    setCelebrationKey((key) => key + 1);
    audioStartedRef.current = false;
    audioFallbackRef.current = false;
    setIsOpen(true);
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback && typeof playback.then === 'function') {
      playback.then(() => {
        if (playbackToken !== playbackTokenRef.current) return;
        audioStartedRef.current = true;
      }).catch(() => {
        if (playbackToken !== playbackTokenRef.current) return;
        audioFallbackRef.current = true;
        audioStartTimeRef.current = performance.now();
        audioStartedRef.current = true;
      });
    } else {
      audioStartedRef.current = true;
    }
  }

  function closePhoto() {
    playbackTokenRef.current += 1;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    audioStartedRef.current = false;
    setIsOpen(false);
    setOpeningProgress(0);
    setShowCelebration(false);
    window.clearTimeout(celebrationTimerRef.current);
  }

  return (
    <div className="react-winner-gallery-root">
      <div
        className="react-winner-gallery"
        ref={galleryRef}
        role="region"
        aria-label="Galería de momentos y reconocimientos del club"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocusCapture={() => setIsPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
        }}
      >
        {positions.map(({ photo, virtualPosition, distance, depth, y, scale, rotate, opacity, zIndex }) => (
          <motion.button
            key={virtualPosition}
            className={`react-winner-photo${distance === 0 ? ' is-selected' : ''}`}
            type="button"
            aria-label={`Ampliar foto: ${photo.title}`}
            style={{ width: galleryWidth ? `${cardWidth}px` : '24%', zIndex }}
            initial={false}
            animate={{
              x: distance * step,
              y: reduceMotion ? 0 : y,
              scale: reduceMotion ? (depth === 0 ? 1 : 0.82) : scale,
              rotate: reduceMotion ? 0 : rotate,
              opacity,
            }}
            whileHover={reduceMotion ? undefined : { scale: depth === 0 ? 1.08 : scale * 1.04, y: y - 5 }}
            whileTap={reduceMotion ? undefined : { scale: depth === 0 ? 1.01 : scale * 0.98 }}
            transition={reduceMotion ? { duration: 0.12 } : spring}
            onClick={() => openPhoto(virtualPosition)}
          >
            <motion.img
              src={photo.src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable="false"
            />
          </motion.button>
        ))}
        <p className="react-sr-only" aria-live="polite">Foto destacada: {selectedPhoto.title}</p>
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen ? (
            <>
          <motion.div
            className="react-winner-gallery-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: 'easeOut' }}
            onClick={closePhoto}
          >
            <motion.section
              ref={dialogRef}
              className="react-winner-gallery-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${galleryId}-title`}
              aria-describedby={`${galleryId}-detail`}
              initial={false}
              style={{ opacity: 0.56 + (0.44 * openingProgress), scale: 0.66 + (0.34 * openingProgress) }}
              onClick={(event) => event.stopPropagation()}
            >
              <button ref={closeButtonRef} className="react-winner-gallery-close" type="button" aria-label="Cerrar foto ampliada" onClick={closePhoto}>×</button>
              <motion.img
                className="react-winner-gallery-expanded"
                src={selectedPhoto.src}
                alt={selectedPhoto.alt}
                draggable="false"
              />
              <div className="react-winner-gallery-caption">
                <p className="react-eyebrow">SALÓN DE LA FAMA · PROVEIT CLUB</p>
                <h2 id={`${galleryId}-title`}>{selectedPhoto.title}</h2>
                <p id={`${galleryId}-detail`}>{selectedPhoto.detail}</p>
                {selectedPhoto.id !== 'champion' ? <small>Último campeón: {championName} · {tournamentName}</small> : null}
              </div>
            </motion.section>
          </motion.div>
              {showCelebration ? (
                <div className="react-winner-celebration" key={celebrationKey} aria-hidden="true">
                  {confettiPieces.map((piece) => (
                    <motion.i
                      className="react-winner-confetti"
                      key={`confetti-${piece.id}`}
                      style={{ '--confetti-color': piece.color, '--confetti-size': `${piece.size}px` }}
                      initial={{ x: 0, y: 0, rotate: 0, scale: 0, opacity: 1 }}
                      animate={{ x: piece.x, y: piece.y, rotate: piece.rotate, scale: 1, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0.3 : 1.5, delay: reduceMotion ? 0 : piece.delay, ease: [0.12, 0.72, 0.22, 1] }}
                    />
                  ))}
                  {fireworkBursts.map((burst, burstIndex) => (
                    <div className="react-winner-firework" key={burst.id} style={{ left: burst.x, top: burst.y, '--firework-color': confettiColors[(burstIndex + 1) % confettiColors.length] }}>
                      <span className="react-winner-firework-ring" />
                      {burst.rays.map((ray) => (
                        <motion.i
                          key={ray.id}
                          initial={{ x: 0, y: 0, scale: 0.35, opacity: 1 }}
                          animate={{ x: ray.x, y: ray.y, scale: 1, opacity: 0 }}
                          transition={{ duration: reduceMotion ? 0.3 : 1.1, ease: 'easeOut' }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
