import { useEffect, useRef, type ReactNode } from 'react';

export default function Dialog({ children, onClose, title, className }: { children: ReactNode; onClose: () => void; title: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={className} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}>
    <div className="dialog-heading"><h2>{title}</h2><button autoFocus onClick={onClose} aria-label="Close dialog">Close</button></div>
    {children}
  </dialog>;
}
