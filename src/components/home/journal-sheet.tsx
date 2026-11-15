import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './journal-icons';
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus({ preventScroll: true }); window.scrollTo(0, scrollY); };
  }, []);
  return <dialog ref={ref} className="journal-sheet" aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget && event.clientY < event.currentTarget.getBoundingClientRect().top) onClose(); }}>
    <div className="sheet-handle" aria-hidden="true" />
    <header className="sheet-heading"><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label="Close sheet" onClick={onClose}><Icon name="close" /></button></header>
    <div className="sheet-content">{children}</div>
  </dialog>;
}
