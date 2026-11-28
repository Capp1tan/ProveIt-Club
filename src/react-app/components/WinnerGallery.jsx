import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';

const emptyPhotos = [];
const secondsPerPhoto = 8;

const spring = { type: 'spring', stiffness: 135, damping: 24, mass: 1.25 };
const openingStartSeconds = 1.05;
const celebrationSeconds = 1.25;
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

function WinnerPhotoCard({ photo, virtualPosition, distance, depth, x, scale, rotate, opacity, zIndex, cardWidth, step, progress, reduceMotion, onOpen }) {
  const y = useTransform(progress, [0, 1], [-distance * step, -(distance - 1) * step]);
  return (
    <motion.button
      className="react-winner-photo"
      type="button"
      aria-label={`Ampliar foto: ${photo.title}`}
      style={{ width: cardWidth, zIndex, x, y }}
      initial={false}
      animate={{
        scale: reduceMotion ? (depth === 0 ? 1 : 0.82) : scale,
        rotate: reduceMotion ? 0 : rotate,
        opacity,
      }}
      whileHover={reduceMotion ? undefined : { scale: scale * 1.08, x: x - 4, zIndex: 30 }}
      whileTap={reduceMotion ? undefined : { scale: depth === 0 ? 1.01 : scale * 0.98 }}
      transition={reduceMotion ? { duration: 0.12 } : spring}
      onClick={() => onOpen(virtualPosition)}
    >
      <motion.img src={photo.src} alt="" loading="lazy" decoding="async" draggable="false" />
    </motion.button>
  );
}

export default function WinnerGallery({ photos: galleryPhotos = emptyPhotos }) {
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
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const progress = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const photos = Array.isArray(galleryPhotos) ? galleryPhotos : emptyPhotos;
  const [activePosition, setActivePosition] = useState(2);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const [galleryHeight, setGalleryHeight] = useState(0);
  const [openingProgress, setOpeningProgress] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationKey, setCelebrationKey] = useState(0);
  const selectedIndex = photos.length ? ((activePosition % photos.length) + photos.length) % photos.length : 0;
  const selectedPhoto = photos[selectedIndex];
  const positions = photos.length ? Array.from({ length: 7 }, (_, slot) => {
    const distance = slot - 3;
    const virtualPosition = activePosition + distance;
    const photoIndex = ((virtualPosition % photos.length) + photos.length) % photos.length;
    const depth = Math.abs(distance);
    return {
      photo: photos[photoIndex],
      virtualPosition,
      distance,
      depth,
      x: distance * 10,
      scale: depth === 0 ? 1 : depth === 1 ? 0.84 : depth === 2 ? 0.68 : 0.56,
      rotate: distance * 2.5,
      opacity: depth === 0 ? 1 : depth === 1 ? 0.78 : depth === 2 ? 0.48 : 0.25,
      zIndex: 10 - depth,
    };
  }) : [];
  const cardWidth = Math.min(320, Math.max(180, galleryWidth * 0.42));
  const step = Math.min(86, Math.max(62, galleryHeight * 0.22));

  useAnimationFrame((_, delta) => {
    if (isOpen || isDragging || reduceMotion || document.hidden || photos.length < 2) return;
    const next = progress.get() + Math.min(delta, 48) / (secondsPerPhoto * 1000);
    if (next >= 1) {
      const steps = Math.floor(next);
      setActivePosition((position) => position + steps);
      progress.set(next - steps);
    } else {
      progress.set(next);
    }
  });

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
      const progress = Math.min(1, Math.max(0, (elapsed - openingStartSeconds) / (celebrationSeconds - openingStartSeconds)));
      setOpeningProgress(progress);
      if (elapsed >= celebrationSeconds && !celebrationStarted) {
        celebrationStarted = true;
        setShowCelebration(true);
        window.clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = window.setTimeout(() => setShowCelebration(false), 2100);
      }
      if (elapsed < celebrationSeconds || (audio && !audio.paused && !audio.ended)) {
        frame = window.requestAnimationFrame(animateOpening);
      }
    };
    frame = window.requestAnimationFrame(animateOpening);
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, celebrationKey]);

  useEffect(() => {
    const element = galleryRef.current;
    if (!element || !photos.length) return undefined;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setGalleryWidth(bounds.width);
      setGalleryHeight(bounds.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [photos.length]);

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

  function handlePointerDown(event) {
    if (!photos.length || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const card = event.target.closest?.('.react-winner-photo');
    if (!card) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startPosition: activePosition + progress.get(),
      moved: false,
    };
    card.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaY) < 6) return;
    drag.moved = true;
    const nextPosition = drag.startPosition + deltaY / step;
    const wholePosition = Math.floor(nextPosition);
    setActivePosition(wholePosition);
    progress.set(nextPosition - wholePosition);
  }

  function handlePointerEnd(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
  }

  function openPhoto(virtualPosition) {
    if (suppressClickRef.current) return;
    const playbackToken = ++playbackTokenRef.current;
    setActivePosition(virtualPosition);
    progress.set(0);
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
        className={`${photos.length ? 'react-winner-gallery' : 'react-winner-gallery-empty'}${isDragging ? ' is-dragging' : ''}`}
        ref={photos.length ? galleryRef : undefined}
        role={photos.length ? 'region' : undefined}
        aria-label={photos.length ? 'Fotos de ganadores y reconocimientos del club. Arrastrá hacia arriba o abajo para recorrerlas.' : undefined}
        onPointerDown={photos.length ? handlePointerDown : undefined}
        onPointerMove={photos.length ? handlePointerMove : undefined}
        onPointerUp={photos.length ? handlePointerEnd : undefined}
        onPointerCancel={photos.length ? handlePointerEnd : undefined}
      >
        {photos.length ? positions.map((position) => (
          <WinnerPhotoCard {...position} key={position.virtualPosition} cardWidth={galleryWidth ? `${cardWidth}px` : '24%'} step={step} progress={progress} reduceMotion={reduceMotion} onOpen={openPhoto} />
        )) : (
          <div className="react-winner-gallery-coming-soon" role="status">
            <span className="react-winner-gallery-coming-soon-icon" aria-hidden="true">✦</span>
            <p className="react-eyebrow">SALÓN DE LA FAMA · PROVEIT CLUB</p>
            <h3>Próximamente</h3>
            <p>Muy pronto, fotos de quienes hicieron historia en el club.</p>
          </div>
        )}
        {photos.length > 0 ? <p className="react-sr-only" aria-live="polite">Foto destacada: {selectedPhoto?.title}</p> : null}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && selectedPhoto ? (
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
