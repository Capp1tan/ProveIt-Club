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

function photoPositions(photos, selectedId) {
  const selectedIndex = Math.max(0, photos.findIndex((photo) => photo.id === selectedId));
  return photos.map((photo, index) => {
    const distance = index - selectedIndex;
    const depth = Math.abs(distance);
    return {
      photo,
      distance,
      depth,
      x: distance * 178,
      y: Math.min(depth * 9, 18),
      scale: depth === 0 ? 1.04 : depth === 1 ? 0.84 : 0.68,
      rotate: distance * 2.5,
      opacity: depth === 0 ? 1 : depth === 1 ? 0.78 : 0.48,
      zIndex: 10 - depth,
    };
  });
}

export default function WinnerGallery({ championName, tournamentName, championAvatar }) {
  const galleryId = useId();
  const galleryRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
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
  const [selectedId, setSelectedId] = useState('award');
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [galleryWidth, setGalleryWidth] = useState(0);
  const selectedPhoto = photos.find((photo) => photo.id === selectedId) || photos[2];
  const positions = photoPositions(photos, selectedPhoto.id);
  const cardWidth = Math.min(212, Math.max(128, galleryWidth * 0.245));
  const step = Math.min(178, Math.max(76, galleryWidth * 0.21));

  useEffect(() => {
    if (isOpen || isPaused || reduceMotion || photos.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setSelectedId((current) => {
        const index = photos.findIndex((photo) => photo.id === current);
        return photos[(index + 1) % photos.length].id;
      });
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
        setIsOpen(false);
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

  function openPhoto(photo) {
    setSelectedId(photo.id);
    setIsOpen(true);
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
        {positions.map(({ photo, distance, depth, y, scale, rotate, opacity, zIndex }) => (
          <motion.button
            key={photo.id}
            className={`react-winner-photo${photo.id === selectedPhoto.id ? ' is-selected' : ''}`}
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
            onClick={() => openPhoto(photo)}
          >
            <motion.img
              layoutId={`${galleryId}-${photo.id}`}
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
          <motion.div
            className="react-winner-gallery-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: 'easeOut' }}
            onClick={() => setIsOpen(false)}
          >
            <motion.section
              ref={dialogRef}
              className="react-winner-gallery-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${galleryId}-title`}
              aria-describedby={`${galleryId}-detail`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
              transition={reduceMotion ? { duration: 0.12 } : spring}
              onClick={(event) => event.stopPropagation()}
            >
              <button ref={closeButtonRef} className="react-winner-gallery-close" type="button" aria-label="Cerrar foto ampliada" onClick={() => setIsOpen(false)}>×</button>
              <motion.img
                className="react-winner-gallery-expanded"
                layoutId={`${galleryId}-${selectedPhoto.id}`}
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
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
