import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

type CollapsibleClampProps = {
  /** Liczba widocznych linii w stanie zwiniętym (domyślnie 4). */
  lines?: number;
  contentClassName: string;
} & ({ variant: 'text'; text: string } | { variant: 'html'; html: string });

/**
 * Treść zwijana do kilku linii; przycisk Rozwiń/Zwiń tylko gdy treść faktycznie się ucina.
 */
export default function CollapsibleClamp(props: CollapsibleClampProps) {
  const lines = props.lines ?? 4;
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const contentKey = props.variant === 'text' ? props.text : props.html;

  useEffect(() => {
    setExpanded(false);
  }, [contentKey]);

  const clampStyle: CSSProperties | undefined = expanded
    ? undefined
    : {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: lines,
        overflow: 'hidden',
      };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      if (expanded) {
        setShowToggle(true);
        return;
      }
      setShowToggle(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentKey, expanded, lines]);

  return (
    <div className="mt-4">
      {props.variant === 'html' ? (
        <div
          ref={ref}
          style={clampStyle}
          className={props.contentClassName}
          dangerouslySetInnerHTML={{ __html: props.html }}
        />
      ) : (
        <div ref={ref} style={clampStyle} className={`${props.contentClassName} whitespace-pre-wrap`}>
          {props.text}
        </div>
      )}
      {showToggle ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-sm font-medium text-emerald-300/95 underline decoration-emerald-400/50 underline-offset-2 transition hover:text-emerald-200"
        >
          {expanded ? 'Zwiń' : 'Rozwiń'}
        </button>
      ) : null}
    </div>
  );
}
