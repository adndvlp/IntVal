import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const autoStarted = useRef(false);
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
      autoStarted.current = true;
      setSubmitting(true);
      setFormError(null);
      setCancelError(null);
      setReference(null);
      dispatch({ type: 'begin', generation: current });
      saveSession(key, { source: request.source, suppressed: false, request });
      try {
        const job = await api.create(request);
        if (current !== generation.current) {
          await api.cancel(job.id).catch(() => undefined);
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
    [acceptJob, api, key],
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
      configuration: matching?.request?.configuration
        ? {
            ...editableConfiguration(meta.configuration),
            ...matching.request.configuration,
          }
        : editableConfiguration(meta.configuration),
    });
    if (saved?.analysis && saved.source !== source)
      void api.cancel(saved.analysis.id).catch(() => undefined);
    if (matching?.analysis && !matching.suppressed) {
      autoStarted.current = true;
      const current = ++generation.current;
      dispatch({ type: 'begin', generation: current });
      setReference({ ...matching.analysis, source, generation: current });
    } else if (matching?.request && !matching.suppressed) {
      autoStarted.current = true;
      void create(matching.request);
    } else {
      autoStarted.current = matching?.suppressed ?? false;
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
  useEffect(() => {
    if (
      !draft ||
      draft.source !== 'demo' ||
      catalog?.source !== 'demo' ||
      autoStarted.current
    )
      return;
    autoStarted.current = true;
    const tickers = catalog.items.map((c) => c.ticker);
    setDraft((old) => (old ? { ...old, selected: tickers } : old));
    void create({
      client_request_id: crypto.randomUUID(),
      source: 'demo',
      tickers,
      configuration: { ...draft.configuration },
    });
  }, [catalog, create, draft]);

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
      generation.current += 1;
      autoStarted.current = suppressed;
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
      invalidate(source, false);
      setDraft({ ...draft, source, market: 'all', selected: [], extras: '' });
    },
    [draft, invalidate],
  );
  const clear = useCallback(() => {
    if (draft) invalidate(draft.source, true);
  }, [draft, invalidate]);

  async function submit() {
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
      return !!(await create({
        client_request_id: crypto.randomUUID(),
        source: draft.source,
        tickers,
        configuration: { ...draft.configuration },
      }));
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
      acceptJob(await api.cancel(ref.id), ref);
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
    setDraft((old) =>
      old
        ? {
            ...old,
            market,
            selected: old.selected.filter(
              (t) =>
                market === 'all' ||
                catalog?.items.some(
                  (c) => c.ticker === t && c.market === market,
                ),
            ),
          }
        : old,
    );
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
            selected: catalog.items
              .filter((t) => old.market === 'all' || t.market === old.market)
              .map((t) => t.ticker),
          }
        : old,
    );
  const selectNone = () =>
    setDraft((old) => (old ? { ...old, selected: [] } : old));
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
    meta,
    metadataQuery,
    catalog,
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
    toggleTicker,
    selectAll,
    selectNone,
    changeExtras,
    selectCompany,
    canRetryCreate: !!pendingRequest.current,
    loadingRows: !!reference && after < processed,
  };
}
