import { useEffect, useId, useRef, useState } from 'react';

export default function SettingHelp({ label, children }) {
  const id = useId();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!open) return;
    function dismiss(event) {
      if (event.type === 'keydown' ? event.key === 'Escape' : !root.current?.contains(event.target)) {
        setOpen(false);
        setPinned(false);
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', dismiss);
    };
  }, [open]);

  return (
    <span
      ref={root}
      style={{ position: 'relative', display: 'inline-flex' }}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setOpen(true); }}
      onPointerLeave={event => {
        if (event.pointerType === 'mouse' && !pinned && !root.current?.contains(document.activeElement)) setOpen(false);
      }}
      onBlur={event => {
        if (!root.current?.contains(event.relatedTarget)) {
          setOpen(false);
          setPinned(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={`Help: ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setOpen(true); }}
        onClick={() => { setOpen(!pinned); setPinned(!pinned); }}
        style={{ border: '1px solid currentColor', borderRadius: '50%', minWidth: 24, minHeight: 24, padding: 0, lineHeight: 1 }}
      >?</button>
      <span
        id={id}
        hidden={!open}
        style={{ position: 'absolute', insetInlineEnd: 0, top: '100%', zIndex: 20, width: 'min(17rem, 75vw)', padding: '0.65rem', border: '1px solid #68879b', borderRadius: '0.5rem', background: '#102a39', color: 'white', whiteSpace: 'normal', fontWeight: 400 }}
      >{children}</span>
    </span>
  );
}
