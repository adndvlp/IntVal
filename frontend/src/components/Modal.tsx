import { useEffect, useRef, type ReactNode } from 'react';

export function requestDialogClose(dialog: HTMLDialogElement) {
  if (typeof dialog.requestClose === 'function') dialog.requestClose();
  else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true })))
    dialog.close();
}
export default function Modal({
  title,
  onClose,
  children,
  className = '',
  closeLabel = 'Cerrar',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closed = useRef(onClose);
  closed.current = onClose;
  useEffect(() => {
    const dialog = ref.current!;
    const close = () => {
      if (dialog.open) return;
      dialog.returnValue = '';
      closed.current();
    };
    dialog.addEventListener('close', close);
    let pressed = false,
      pointer = -1;
    const outside = (e: PointerEvent) => {
      if (
        e.target !== dialog &&
        e.target instanceof Node &&
        dialog.contains(e.target)
      )
        return false;
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };
    const down = (e: PointerEvent) => {
      pointer = e.pointerId;
      pressed = e.button === 0 && outside(e);
    };
    const up = (e: PointerEvent) => {
      if (pressed && pointer === e.pointerId && outside(e))
        requestDialogClose(dialog);
      pressed = false;
    };
    const cancel = () => {
      pressed = false;
    };
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('pointerdown', down);
      dialog.addEventListener('pointerup', up);
      dialog.addEventListener('pointercancel', cancel);
    }
    dialog.showModal();
    return () => {
      dialog.removeEventListener('close', close);
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('pointerup', up);
      dialog.removeEventListener('pointercancel', cancel);
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`ui-dialog ${className}`}
      aria-label={title}
      {...{ closedby: 'any' }}
    >
      <button
        autoFocus
        className="dialog-close"
        type="button"
        aria-label={closeLabel}
        onClick={() => requestDialogClose(ref.current!)}
      >
        ×
      </button>
      {children}
    </dialog>
  );
}
