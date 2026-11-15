import { useEffect, useRef, useState } from 'react';
import { ApiFault, AnalysisApi } from './transport';
import type { Snapshot } from './types';
export function useExport(api: AnalysisApi, id?: string) {
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPending(false);
    setError(null);
    busy.current = false;
    return () => request.current?.abort();
  }, [id]);
  async function download(snapshot: Snapshot) {
    if (busy.current) return;
    busy.current = true;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError(null);
    try {
      const file = await api.download(
        snapshot.job.id,
        snapshot.job.source,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob),
        a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.hidden = true;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof ApiFault
            ? e.message
            : 'No se pudo descargar el Excel. Puedes reintentar.',
        );
    } finally {
      if (request.current === controller && !controller.signal.aborted) {
        request.current = null;
        busy.current = false;
        setPending(false);
      }
    }
  }
  return { pending, error, download };
}
export default function ExportButton({
  snapshot,
  state,
  unavailable,
}: {
  snapshot: Snapshot;
  state: ReturnType<typeof useExport>;
  unavailable: boolean;
}) {
  return (
    <div className="export-control">
      <button
        type="button"
        disabled={
          state.pending || unavailable || snapshot.job.state !== 'completed'
        }
        onClick={() => void state.download(snapshot)}
      >
        {state.pending ? 'Preparando Excel…' : 'Excel'}
        <span aria-hidden="true">↓</span>
      </button>
      {state.error && (
        <p role="status" className="inline-warning">
          {state.error}
        </p>
      )}
    </div>
  );
}
