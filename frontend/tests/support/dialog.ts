import { vi } from 'vitest';
export function mockDialogs() {
  // JSDOM carece de la API modal; simular sólo apertura/cierre y sus eventos.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      writable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    },
    close: {
      configurable: true,
      writable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      }),
    },
    requestClose: {
      configurable: true,
      writable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        if (this.dispatchEvent(new Event('cancel', { cancelable: true })))
          this.close();
      }),
    },
  });
}
export function mountShell() {
  document.body.innerHTML =
    '<h1 id="contenido" tabindex="-1">Elige las empresas</h1><nav aria-label="Principal"><a href="#contenido" data-analysis-nav>Analizar</a><a href="#resultados" data-results-nav hidden>Resultados</a><a href="#contenido" data-history-nav>Historial</a></nav>';
}
