import type { SubmitEvent } from 'react';
import CompanyPicker from './CompanyPicker';
import type { useAnalysis } from './use-analysis';

export type AnalysisState = ReturnType<typeof useAnalysis>;
const formTitle = 'Construye tu análisis.';

export default function AnalysisForm({
  analysis,
  onAnalyze,
}: {
  analysis: AnalysisState;
  onAnalyze?: () => void;
}) {
  const { draft, meta } = analysis;
  if (!draft || !meta) return null;
  const marketEnabled = meta.sources.some(
    (s) => s.id === 'market' && s.enabled,
  );
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await analysis.submit(onAnalyze);
  }
  return (
    <form
      className="analysis-form"
      action={`${analysis.api.baseUrl}/api/v1/analyses`}
      method="post"
      aria-label={formTitle}
      onSubmit={submit}
    >
      <h2 className="sr-only" id="form-heading">
        {formTitle}
      </h2>
      <fieldset className="source-options">
        <legend>Fuente de datos</legend>
        {(['market', 'demo'] as const).map((s) => (
          <label
            key={s}
            className={draft.source === s ? 'choice active' : 'choice'}
          >
            <input
              type="radio"
              name="source"
              value={s}
              checked={draft.source === s}
              onChange={() => analysis.changeSource(s)}
            />
            <span>{s === 'market' ? 'Mercado' : 'Demostración'}</span>
          </label>
        ))}
      </fieldset>
      <p className="field-help">
        {draft.source === 'demo'
          ? `Datos sintéticos · referencia ${meta.demo.reference_date}. No son empresas reales.`
          : 'Yahoo Finance. La consulta empieza cuando solicitas un análisis.'}
      </p>
      {draft.source === 'market' && !marketEnabled && (
        <p className="inline-warning">
          Mercado está deshabilitado en este entorno. Puedes explorar la
          demostración.
        </p>
      )}
      <CompanyPicker key={draft.source} analysis={analysis} />
      <fieldset className="extra-symbols">
        <legend className="sr-only">Símbolos adicionales</legend>
        {draft.source === 'market' && (
          <div className="field">
            <label htmlFor="extra-tickers">Símbolos adicionales</label>
            <textarea
              id="extra-tickers"
              name="extra_tickers"
              rows={2}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={draft.extras}
              onChange={(e) => analysis.changeExtras(e.target.value)}
              aria-describedby="extras-help"
            />
            <p id="extras-help" className="field-help">
              Separados por espacios o comas. Ejemplo: AAPL, PE&amp;OLES.MX. Se
              normalizan y se eliminan duplicados.
            </p>
          </div>
        )}
      </fieldset>
    </form>
  );
}
