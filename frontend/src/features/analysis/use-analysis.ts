import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import {
  configurationChanged,
  configurationFields,
  editableConfiguration,
  initialView,
  normalizeTickers,
  terminal,
  viewReducer,
} from './model';
import { AnalysisApi, ApiFault, retryDelay, retryQuery } from './transport';
import {
  historyKey,
  readHistory,
  saveHistory,
  mergeHistory,
  requestIdentity,
  type HistoryEntry,
} from './analysis-history';
import {
  configurationKey,
  readConfiguration,
  saveConfiguration,
  validConfiguration,
} from './configuration-storage';
import {
  cleanSelection,
  indexCatalog,
  readSelection,
  saveSelection,
  selectionKey,
} from './catalog-model';
import type {
  Configuration,
  CreateRequest,
  Job,
  Market,
  Source,
} from './types';

export type Draft = {
  source: Source;
  market: Market;
  selected: string[];
  extras: string;
  configuration: Configuration;
};
type Saved = {
  source: Source;
  suppressed: boolean;
  request?: CreateRequest;
  analysis?: { id: string; dataset: string };
};
type Reference = {
  id: string;
  dataset: string;
  source: Source;
  generation: number;
};
const isSource = (s: unknown): s is Source => s === 'demo' || s === 'market';
function readSession(key: string): Saved | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      !value ||
      typeof value !== 'object' ||
      !('source' in value) ||
      !isSource(value.source) ||
      !('suppressed' in value) ||
      typeof value.suppressed !== 'boolean'
    )
      return null;
    const saved = value as Saved;
    if (
      saved.analysis &&
      (!saved.analysis.id ||
        typeof saved.analysis.id !== 'string' ||
        typeof saved.analysis.dataset !== 'string')
    )
      return null;
    if (
      saved.request &&
      (!Array.isArray(saved.request.tickers) ||
        !saved.request.tickers.every((t) => typeof t === 'string') ||
        saved.request.source !== saved.source ||
        typeof saved.request.client_request_id !== 'string' ||
        !saved.request.configuration ||
        !configurationFields.every((f) =>
          Number.isFinite(saved.request?.configuration?.[f.key]),
        ))
    )
      return null;
    return saved;
  } catch {
    return null;
  }
}
function saveSession(key: string, value: Saved) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* La vista funciona aunque el navegador no permita almacenar la referencia. */
  }
}
const message = (e: unknown) =>
  e instanceof ApiFault
    ? e.message
    : 'No se pudo completar la operación. Puedes reintentar.';

export function useAnalysis({
  baseUrl,
  initialSource,
}: {
  baseUrl: string;
  initialSource?: string;
}) {
  const api = useMemo(() => new AnalysisApi(baseUrl), [baseUrl]);
  const client = useQueryClient();
  const key = `intval.analysis.v1:${api.baseUrl}`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, dispatch] = useReducer(viewReducer, initialView);
  const [reference, setReference] = useState<Reference | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const generation = useRef(0);
  const initialized = useRef(false);
  const creating = useRef<number | null>(null);
  const mounted = useRef(false);
  const pendingRequest = useRef<CreateRequest | null>(null);
  const initialSaved = useRef<Saved | null>(null);
  const metadataQuery = useQuery({
    queryKey: ['intval', baseUrl, 'metadata'],
    queryFn: ({ signal }) => api.metadata(signal),
    staleTime: 60_000,
    retry: retryQuery,
    retryDelay,
    refetchOnWindowFocus: false,
  });
  const meta = metadataQuery.data;
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    readHistory(historyKey(api.baseUrl)),
  );
  const clearedCreates = useRef(new Set<number>());
  const requestedSelection = useRef<CreateRequest | null>(null);
  const historyLimit = meta?.limits.max_retained ?? 1;
  const remember = useCallback(
    (job: Job, request?: CreateRequest, labels?: string[]) => {
      setHistory((old) =>
        mergeHistory(old, job, historyLimit, request, labels),
      );
    },
    [historyLimit],
  );
  useEffect(() => {
    if (!meta) return;
    if (history.length > historyLimit)
      setHistory((old) => old.slice(0, historyLimit));
    else saveHistory(historyKey(api.baseUrl), history);
  }, [history, historyLimit, meta, api.baseUrl]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const acceptJob = useCallback(
    (job: Job, ref: Reference) => {
      if (ref.generation !== generation.current || job.source !== ref.source)
        return;
      dispatch({ type: 'job', generation: ref.generation, job });
      client.setQueryData<Job>(
        ['intval', baseUrl, ref.source, ref.dataset, ref.id, 'status'],
        (old) => (!old || old.revision <= job.revision ? job : old),
      );
    },
    [baseUrl, client],
  );

  const create = useCallback(
    async (request: CreateRequest) => {
      if (creating.current === generation.current) return;
      const current = ++generation.current;
      creating.current = current;
      pendingRequest.current = structuredClone(request);
      setSubmitting(true);
      setFormError(null);
      setCancelError(null);
      setReference(null);
      dispatch({ type: 'begin', generation: current });
      saveSession(key, { source: request.source, suppressed: false, request });
      try {
        const job = await api.create(request);
        remember(job, request);
        if (current !== generation.current) {
          if (clearedCreates.current.has(current)) {
            const cancelled = await api.cancel(job.id).catch(() => null);
            if (cancelled) remember(cancelled, request);
          }
          return;
        }
        saveSession(key, {
          source: request.source,
          suppressed: false,
          request,
          analysis: { id: job.id, dataset: job.dataset_version },
        });
        pendingRequest.current = null;
        if (!mounted.current) return;
        const ref = {
          id: job.id,
          dataset: job.dataset_version,
          source: job.source,
          generation: current,
        };
        acceptJob(job, ref);
        setReference(ref);
        return job;
      } catch (e) {
        if (current === generation.current && mounted.current)
          dispatch({ type: 'error', generation: current, message: message(e) });
      } finally {
        if (creating.current === current) creating.current = null;
        if (current === generation.current && mounted.current)
          setSubmitting(false);
      }
    },
    [acceptJob, api, key, remember],
  );

  useEffect(() => {
    if (!meta || initialized.current) return;
    initialized.current = true;
    const saved = readSession(key);
    const query =
      initialSource ??
      new URLSearchParams(window.location.search).get('fuente');
    const source = isSource(query)
      ? query
      : (saved?.source ?? meta.default_source);
    const matching = saved?.source === source ? saved : null;
    initialSaved.current = matching;
    setDraft({
      source,
      market: 'all',
      selected: matching?.request?.tickers ?? [],
      extras: '',
      configuration:
        readConfiguration(configurationKey(api.baseUrl)) ??
        (matching?.request?.configuration
          ? {
              ...editableConfiguration(meta.configuration),
              ...matching.request.configuration,
            }
          : editableConfiguration(meta.configuration)),
    });
    if (saved?.analysis && !saved.suppressed) {
      const current = ++generation.current;
      dispatch({ type: 'begin', generation: current });
      setReference({
        ...saved.analysis,
        source: saved.source,
        generation: current,
      });
    } else if (saved?.request && !saved.suppressed) {
      void create(saved.request);
    } else {
      saveSession(key, { source, suppressed: matching?.suppressed ?? false });
    }
  }, [api, create, initialSource, key, meta]);

  const dataset =
    draft?.source === 'demo' ? meta?.demo.version : meta?.methodology_version;
  const catalogQuery = useQuery({
    queryKey: ['intval', baseUrl, draft?.source, dataset, 'catalog'],
    queryFn: ({ signal }) => api.catalog(draft!.source, signal),
    enabled: !!draft && !!meta,
    staleTime: 60_000,
    retry: retryQuery,
    retryDelay,
    refetchOnWindowFocus: false,
  });
  const catalog = catalogQuery.data;
  const catalogIndex = useMemo(
    () => indexCatalog(catalog?.items ?? []),
    [catalog],
  );
  const selectionScope =
    draft && catalog?.source === draft.source
      ? selectionKey(baseUrl, draft.source, catalog.dataset_version)
      : null;
  const restoredSelection = useRef<string | null>(null);
  const [selectionReady, setSelectionReady] = useState<string | null>(null);
  useEffect(() => {
    if (
      !selectionScope ||
      !draft ||
      restoredSelection.current === selectionScope
    )
      return;
    restoredSelection.current = selectionScope;
    const restoredRequest =
      requestedSelection.current?.source === draft.source
        ? requestedSelection.current
        : null;
    requestedSelection.current = null;
    const saved = restoredRequest ? null : readSelection(selectionScope);
    const request =
      restoredRequest ??
      (initialSaved.current?.source === draft.source
        ? initialSaved.current.request
        : undefined);
    const selected = cleanSelection(
      restoredRequest?.tickers ?? saved?.selected ?? draft.selected,
      catalogIndex,
    );
    // Las referencias antiguas pueden contener símbolos adicionales de mercado.
    const extras =
      draft.source === 'market'
        ? (saved?.extras ??
          (request?.tickers
            .filter((t) => !catalogIndex.byTicker.has(t))
            .join(', ') ||
            draft.extras))
        : '';
    setDraft((old) =>
      old?.source === draft.source ? { ...old, selected, extras } : old,
    );
    setSelectionReady(selectionScope);
  }, [selectionScope, catalogIndex, draft]);
  useEffect(() => {
    if (!selectionScope || selectionReady !== selectionScope || !draft) return;
    const selected = cleanSelection(draft.selected, catalogIndex);
    if (
      selected.length !== draft.selected.length ||
      selected.some((t, i) => t !== draft.selected[i])
    ) {
      setDraft((old) =>
        old?.source === draft.source ? { ...old, selected } : old,
      );
      return;
    }
    saveSelection(selectionScope, { selected, extras: draft.extras });
  }, [selectionScope, selectionReady, catalogIndex, draft]);
  const statusQuery = useQuery({
    queryKey: [
      'intval',
      baseUrl,
      reference?.source,
      reference?.dataset,
      reference?.id,
      'status',
    ],
    queryFn: async ({ signal }) => {
      const job = await api.status(reference!.id, signal);
      if (job.source !== reference!.source)
        throw new ApiFault('INVALID_RESPONSE');
      return job;
    },
    enabled: !!reference,
    staleTime: 0,
    retry: retryQuery,
    retryDelay,
    refetchInterval: (q) =>
      q.state.error || (q.state.data && terminal(q.state.data.state))
        ? false
        : 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (q) => !q.state.data || !terminal(q.state.data.state),
  });
  useEffect(() => {
    if (statusQuery.data && reference)
      dispatch({
        type: 'job',
        generation: reference.generation,
        job: statusQuery.data,
      });
  }, [reference, statusQuery.data]);

  useEffect(() => {
    if (view.current) {
      const accepted = readSession(key);
      remember(
        view.current.job,
        accepted?.analysis?.id === view.current.job.id
          ? accepted.request
          : undefined,
        view.current.rows.length
          ? view.current.rows.slice(0, 3).map((c) => c.company_name)
          : undefined,
      );
    }
  }, [view.current, remember, key]);
  const backgroundEntries = history.filter(
    (e) => e.id !== reference?.id && !e.expired && !terminal(e.state),
  );
  const background = useQueries({
    queries: backgroundEntries.map((e) => ({
      queryKey: ['intval', baseUrl, e.source, e.dataset, e.id, 'status'],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const job = await api.status(e.id, signal);
        if (job.source !== e.source) throw new ApiFault('INVALID_RESPONSE');
        return job;
      },
      staleTime: 1000,
      retry: retryQuery,
      retryDelay,
      refetchInterval: (q: { state: { data?: Job; error: unknown } }) =>
        q.state.error || (q.state.data && terminal(q.state.data.state))
          ? false
          : 5000,
      refetchOnWindowFocus: false,
    })),
  });
  const backgroundVersion = background
    .map(
      (q, i) =>
        `${backgroundEntries[i]!.id}:${q.data?.revision}:${q.error instanceof ApiFault ? q.error.status : ''}`,
    )
    .join('|');
  useEffect(() => {
    background.forEach((q, i) => {
      if (q.data) remember(q.data);
      else if (
        q.error instanceof ApiFault &&
        [404, 410].includes(q.error.status)
      ) {
        const id = backgroundEntries[i]!.id;
        setHistory((old) =>
          old.map((e) =>
            e.id === id && !e.expired ? { ...e, expired: true } : e,
          ),
        );
      }
    });
  }, [backgroundVersion, remember]);

  const after = view.current?.rows.length ?? 0;
  const processed =
    statusQuery.data?.processed ?? view.current?.job.processed ?? 0;
  const resultsQuery = useQuery({
    queryKey: [
      'intval',
      baseUrl,
      reference?.source,
      reference?.dataset,
      reference?.id,
      'results',
      after,
    ],
    queryFn: ({ signal }) => api.results(reference!.id, after, signal),
    enabled:
      !!reference && view.current?.job.id === reference.id && after < processed,
    staleTime: Infinity,
    retry: retryQuery,
    retryDelay,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    if (resultsQuery.data && reference)
      dispatch({
        type: 'rows',
        generation: reference.generation,
        id: reference.id,
        after,
        items: resultsQuery.data.items,
      });
  }, [after, reference, resultsQuery.data]);

  const invalidate = useCallback(
    (nextSource: Source, suppressed: boolean) => {
      const previous = reference?.id ?? view.current?.job.id;
      if (creating.current !== null)
        clearedCreates.current.add(creating.current);
      generation.current += 1;
      pendingRequest.current = null;
      setReference(null);
      setSubmitting(false);
      setCancelPending(false);
      setCancelError(null);
      setFormError(null);
      dispatch({ type: 'clear', generation: generation.current });
      saveSession(key, { source: nextSource, suppressed });
      if (previous)
        void api.cancel(previous).catch(() => {
          if (mounted.current)
            setCancelError(
              'No se confirmó la cancelación anterior. Puedes continuar; sus resultados permanecen separados.',
            );
        });
    },
    [api, key, reference, view.current],
  );
  const changeSource = useCallback(
    (source: Source) => {
      if (!draft || source === draft.source) return;
      setDraft({ ...draft, source, market: 'all', selected: [], extras: '' });
    },
    [draft],
  );
  const clear = useCallback(() => {
    if (draft) invalidate(draft.source, true);
  }, [draft, invalidate]);

  function openAnalysis(entry: HistoryEntry, restoreSelection = true) {
    const current = ++generation.current;
    pendingRequest.current = null;
    setSubmitting(false);
    setFormError(null);
    setCancelError(null);
    const request = entry.request;
    if (request && restoreSelection) {
      requestedSelection.current = request;
      restoredSelection.current = null;
      setDraft((old) =>
        old
          ? {
              ...old,
              source: entry.source,
              selected: request.tickers,
              extras: '',
              market: 'all',
            }
          : old,
      );
    }
    saveSession(key, {
      source: entry.source,
      suppressed: false,
      request,
      analysis: { id: entry.id, dataset: entry.dataset },
    });
    dispatch({ type: 'begin', generation: current });
    setReference({
      id: entry.id,
      dataset: entry.dataset,
      source: entry.source,
      generation: current,
    });
  }
  function cancelSubmission() {
    const previous =
      view.previous && history.find((e) => e.id === view.previous!.job.id);
    clear();
    if (previous) openAnalysis(previous, false);
  }
  function commitConfiguration(value: Configuration) {
    if (!validConfiguration(value)) return false;
    setDraft((old) => (old ? { ...old, configuration: { ...value } } : old));
    saveConfiguration(configurationKey(api.baseUrl), value);
    return true;
  }
  async function submit(onStart?: () => void) {
    if (!draft || !meta || !catalog || catalog.source !== draft.source) return;
    try {
      if (
        !configurationFields.every(
          (f) =>
            Number.isFinite(draft.configuration[f.key]) &&
            draft.configuration[f.key] * f.scale >= f.min &&
            draft.configuration[f.key] * f.scale <= f.max,
        )
      )
        throw new Error(
          'Revisa los intervalos de los supuestos antes de analizar.',
        );
      const tickers = normalizeTickers(
        draft.selected,
        draft.extras,
        draft.source,
        meta.limits.max_tickers,
        catalog.items.map((c) => c.ticker),
      );
      const request: CreateRequest = {
        client_request_id: crypto.randomUUID(),
        source: draft.source,
        tickers,
        configuration: { ...draft.configuration },
      };
      const existing = history.find(
        (e) =>
          !e.expired &&
          !terminal(e.state) &&
          e.request &&
          requestIdentity(e.request) === requestIdentity(request),
      );
      if (existing) {
        openAnalysis(existing);
        onStart?.();
        return true;
      }
      onStart?.();
      return !!(await create(request));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Revisa la selección.');
    }
  }
  async function cancel() {
    if (!reference) return;
    const ref = reference;
    setCancelPending(true);
    setCancelError(null);
    try {
      const job = await api.cancel(ref.id);
      remember(job);
      acceptJob(job, ref);
    } catch (e) {
      if (ref.generation === generation.current) setCancelError(message(e));
    } finally {
      if (ref.generation === generation.current) setCancelPending(false);
    }
  }
  const changeConfiguration = (field: keyof Configuration, value: number) =>
    setDraft((old) =>
      old
        ? { ...old, configuration: { ...old.configuration, [field]: value } }
        : old,
    );
  const changeMarket = (market: Market) =>
    setDraft((old) => (old ? { ...old, market } : old));
  const selectTickers = (tickers: string[], checked: boolean) => {
    setFormError(null);
    setDraft((old) => {
      if (!old || catalog?.source !== old.source) return old;
      const selected = new Set(old.selected);
      for (const ticker of tickers) {
        if (!catalogIndex.byTicker.has(ticker)) continue;
        if (checked) selected.add(ticker);
        else selected.delete(ticker);
      }
      return { ...old, selected: [...selected] };
    });
  };
  const toggleTicker = (ticker: string) =>
    setDraft((old) =>
      old
        ? {
            ...old,
            selected: old.selected.includes(ticker)
              ? old.selected.filter((t) => t !== ticker)
              : [...old.selected, ticker],
          }
        : old,
    );
  const selectAll = () =>
    setDraft((old) =>
      old && catalog
        ? {
            ...old,
            selected: [
              ...new Set([
                ...old.selected,
                ...catalog.items
                  .filter(
                    (t) => old.market === 'all' || t.market === old.market,
                  )
                  .map((t) => t.ticker),
              ]),
            ],
          }
        : old,
    );
  const selectNone = () => {
    setFormError(null);
    setDraft((old) => (old ? { ...old, selected: [], extras: '' } : old));
  };
  const changeExtras = (extras: string) =>
    setDraft((old) => (old ? { ...old, extras } : old));
  const retryCreate = async () => {
    if (pendingRequest.current) await create(pendingRequest.current);
  };
  const snapshot = view.current?.rows.length
    ? view.current
    : (view.previous ?? view.current);
  const request = readSession(key)?.request;
  let tickersChanged = false;
  if (draft && snapshot && request) {
    try {
      tickersChanged =
        JSON.stringify(
          normalizeTickers(
            draft.selected,
            draft.extras,
            draft.source,
            meta?.limits.max_tickers ?? 650,
            catalog?.items.map((c) => c.ticker),
          ),
        ) !== JSON.stringify(request.tickers);
    } catch {
      tickersChanged = true;
    }
  }
  const dirty =
    !!draft &&
    !!snapshot &&
    (configurationChanged(draft.configuration, snapshot.job.configuration) ||
      tickersChanged);
  const transportError = statusQuery.error ?? resultsQuery.error;
  const unavailable =
    transportError instanceof ApiFault &&
    [404, 410].includes(transportError.status);
  useEffect(() => {
    if (unavailable && reference)
      setHistory((old) =>
        old.map((e) =>
          e.id === reference.id && !e.expired ? { ...e, expired: true } : e,
        ),
      );
  }, [unavailable, reference]);
  async function reconnect() {
    await statusQuery.refetch();
    if (resultsQuery.error) await resultsQuery.refetch();
  }
  const selectCompany = useCallback(
    (ticker: string) => dispatch({ type: 'select', ticker }),
    [],
  );

  return {
    api,
    history,
    openAnalysis,
    commitConfiguration,
    cancelSubmission,
    meta,
    metadataQuery,
    catalog,
    catalogIndex,
    selectionReady:
      selectionReady === selectionScope && selectionScope !== null,
    catalogQuery,
    draft,
    view,
    snapshot,
    reference,
    dirty,
    submitting,
    formError,
    cancelPending,
    cancelError,
    transportError,
    unavailable,
    changeSource,
    clear,
    submit,
    cancel,
    retryCreate,
    reconnect,
    changeConfiguration,
    changeMarket,
    selectTickers,
    toggleTicker,
    selectAll,
    selectNone,
    changeExtras,
    selectCompany,
    canRetryCreate: !!pendingRequest.current,
    loadingRows: !!reference && after < processed,
  };
}
