import { useEffect, useRef } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Wpisz opis kampanii...',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || '';
    }
  }, [value]);

  function run(command: string, commandValue?: string) {
    if (typeof document === 'undefined') return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML ?? '');
  }

  function setHeading() {
    run('formatBlock', 'h2');
  }

  function setParagraph() {
    run('formatBlock', 'p');
  }

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/70">
      <div className="flex flex-wrap gap-2 border-b border-white/10 p-2">
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs" onClick={() => run('bold')}>
          B
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs italic" onClick={() => run('italic')}>
          I
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs underline" onClick={() => run('underline')}>
          U
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs" onClick={setHeading}>
          H2
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs" onClick={setParagraph}>
          P
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs" onClick={() => run('insertUnorderedList')}>
          • Lista
        </button>
        <button type="button" className="brand-cta-outline px-2.5 py-1.5 text-xs" onClick={() => run('insertOrderedList')}>
          1. Lista
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        data-placeholder={placeholder}
        className="wysiwyg-editor min-h-36 px-3 py-2.5 text-sm text-white outline-none"
        onInput={() => onChange(editorRef.current?.innerHTML ?? '')}
      />
    </div>
  );
}
