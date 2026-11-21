import { it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { parseWorkspaceRoute, useWorkspaceRoute } from './workspace-route';
it('fragmentos válidos, símbolos codificados y destinos mal formados no fabrican un detalle', () => {
  expect(parseWorkspaceRoute('#empresa/PE%26OLES.MX')).toEqual({
    screen: 'results',
    ticker: 'PE&OLES.MX',
  });
  expect(parseWorkspaceRoute('#resultados')).toEqual({ screen: 'results' });
  expect(parseWorkspaceRoute('#historial')).toEqual({ screen: 'history' });
  for (const hash of [
    '',
    '#desconocido',
    '#empresa/%E0%A4%A',
    '#empresa/../../secret',
  ])
    expect(parseWorkspaceRoute(hash)).toEqual({ screen: 'selection' });
});

it('devuelve el foco a la empresa después de la navegación atrás, que puede mover el foco', async () => {
  history.replaceState({}, '', '/#resultados');
  const link = document.createElement('a');
  link.href = '#empresa/DEMO-USA';
  link.textContent = 'Aurora';
  document.body.append(link);
  link.focus();
  const { result, unmount } = renderHook(() => useWorkspaceRoute());
  const back = vi.spyOn(history, 'back').mockImplementation(() => {
    setTimeout(() => {
      link.blur();
      history.replaceState({}, '', '/#resultados');
      dispatchEvent(new PopStateEvent('popstate'));
    }, 0);
  });
  try {
    act(() => result.current.navigate('#empresa/DEMO-USA'));
    act(() => result.current.closeDetail());
    await waitFor(() => expect(location.hash).toBe('#resultados'));
    await waitFor(() => expect(document.activeElement).toBe(link));
    expect(result.current.route.ticker).toBeUndefined();
  } finally {
    back.mockRestore();
    unmount();
    link.remove();
  }
});

it('espera a que termine el cambio de fragmento antes de devolver el foco', () => {
  history.replaceState({}, '', '/#resultados');
  const link = document.createElement('a');
  link.href = '#empresa/DEMO-USA';
  document.body.append(link);
  link.focus();
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  const frame = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((cb) => {
      frames.set(++id, cb);
      return id;
    });
  const cancel = vi
    .spyOn(window, 'cancelAnimationFrame')
    .mockImplementation((id) => {
      frames.delete(id);
    });
  const { result, unmount } = renderHook(() => useWorkspaceRoute());
  try {
    act(() => result.current.navigate('#empresa/DEMO-USA'));
    act(() => {
      history.replaceState({}, '', '/#resultados');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    act(() => {
      link.blur();
      dispatchEvent(new HashChangeEvent('hashchange'));
    });
    act(() => {
      for (const callback of frames.values()) callback(0);
      frames.clear();
    });
    expect(document.activeElement).toBe(link);
  } finally {
    unmount();
    frame.mockRestore();
    cancel.mockRestore();
    link.remove();
  }
});
