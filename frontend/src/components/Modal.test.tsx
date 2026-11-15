import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Modal, { requestDialogClose } from './Modal';
import { mockDialogs } from '../../tests/support/dialog';
let closedBy: PropertyDescriptor | undefined;
beforeEach(() => {
  mockDialogs();
  closedBy = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'closedBy',
  );
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'closedBy');
});
afterEach(() => {
  cleanup();
  if (closedBy)
    Object.defineProperty(HTMLDialogElement.prototype, 'closedBy', closedBy);
  vi.restoreAllMocks();
});
function show() {
  const close = vi.fn();
  render(
    <Modal title="Detalle" onClose={close}>
      <h2>Contenido</h2>
      <button type="button">Control</button>
    </Modal>,
  );
  const dialog = screen.getByRole('dialog') as HTMLDialogElement;
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    top: 100,
    right: 400,
    bottom: 400,
    width: 300,
    height: 300,
    x: 100,
    y: 100,
    toJSON: () => ({}),
  });
  const pointer = (type: string, x: number, target: Element = dialog) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: x,
      button: 0,
    });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(target, event);
  };
  return { close, dialog, pointer };
}
it('usa un modal nativo; sólo cierra un gesto que empieza y termina fuera', () => {
  const { close, pointer } = show();
  pointer('pointerdown', 200);
  pointer('pointerup', 20);
  expect(close).not.toHaveBeenCalled();
  pointer('pointerdown', 20);
  pointer('pointerup', 200);
  expect(close).not.toHaveBeenCalled();
  pointer('pointerdown', 200);
  pointer('pointerup', 200);
  expect(close).not.toHaveBeenCalled();
  pointer('pointerdown', 20);
  pointer('pointerup', 20);
  expect(close).toHaveBeenCalledTimes(1);
});
it('respeta cancel y no interpreta como fondo un control de apariencia fuera del rectángulo', () => {
  const { close, dialog, pointer } = show();
  const button = screen.getByRole('button', { name: 'Control' });
  pointer('pointerdown', 20, button);
  pointer('pointerup', 20, button);
  expect(close).not.toHaveBeenCalled();
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  pointer('pointerdown', 20);
  pointer('pointerup', 20);
  expect(dialog.open).toBe(true);
  expect(close).not.toHaveBeenCalled();
});
it('el fallback de requestClose honra cancel antes de cerrar', () => {
  const { close, dialog } = show();
  Object.defineProperty(dialog, 'requestClose', { value: undefined });
  const block = (e: Event) => e.preventDefault();
  dialog.addEventListener('cancel', block);
  requestDialogClose(dialog);
  expect(close).not.toHaveBeenCalled();
  dialog.removeEventListener('cancel', block);
  requestDialogClose(dialog);
  expect(close).toHaveBeenCalledTimes(1);
});
