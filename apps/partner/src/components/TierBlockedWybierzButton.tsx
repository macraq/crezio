import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TierBlockedWybierzButtonProps = {
  applicationId: string;
  /** Po zmianie (np. inna kampania) zamyka tooltip z tapu */
  resetKey?: string;
};

/**
 * Przycisk „Wybierz” zablokowany przez pakiet — tooltip w portalu (fixed),
 * żeby nie powiększać poziomego scrolla w tabeli z overflow-x-auto.
 */
export default function TierBlockedWybierzButton({ applicationId, resetKey = '' }: TierBlockedWybierzButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hasHover, setHasHover] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(hover: hover)').matches : true
  );
  const [hoverOpen, setHoverOpen] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const visible = hasHover ? hoverOpen : touchOpen;

  const updatePos = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left + r.width / 2, top: r.top });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    const update = () => setHasHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    if (!visible) {
      setPos(null);
      return;
    }
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [visible, updatePos]);

  useEffect(() => {
    setTouchOpen(false);
    setHoverOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (hasHover || !touchOpen) return;
    const onDoc = () => setTouchOpen(false);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [hasHover, touchOpen]);

  const tipId = `tip-pakiet-${applicationId}`;

  const bubble =
    visible && pos ? (
      <div
        role="tooltip"
        id={tipId}
        className="pointer-events-none fixed z-[9999] w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-center text-xs leading-snug text-slate-100 shadow-lg"
        style={{
          left: pos.left,
          top: pos.top,
          transform: 'translate(-50%, calc(-100% - 8px))',
        }}
      >
        Niedostępne w Twoim pakiecie
        <span
          className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-[6px] border-transparent border-t-slate-900/95"
          aria-hidden
        />
      </div>
    ) : null;

  return (
    <>
      <div
        ref={wrapRef}
        className="inline-flex cursor-not-allowed"
        onClick={(e) => {
          e.stopPropagation();
          if (!hasHover) {
            setTouchOpen((v) => !v);
          }
        }}
        onMouseEnter={() => {
          if (hasHover) setHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (hasHover) setHoverOpen(false);
        }}
      >
        <button
          type="button"
          className="brand-cta-outline text-xs pointer-events-none opacity-70"
          disabled
          tabIndex={-1}
          aria-describedby={tipId}
        >
          Wybierz
        </button>
      </div>
      {typeof document !== 'undefined' && bubble ? createPortal(bubble, document.body) : null}
    </>
  );
}
