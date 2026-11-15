import { useState, type SubmitEvent } from 'react';
import CompanyPicker from './CompanyPicker';
import { configurationFields } from './model';
import type { useAnalysis } from './use-analysis';

export type AnalysisState = ReturnType<typeof useAnalysis>;
const formTitle = 'Construye tu análisis.';

export default function AnalysisForm({
  analysis,
  onSubmitted,
}: {
  analysis: AnalysisState;
  onSubmitted?: () => void;
}) {
  const { draft, meta } = analysis;
  const [invalid, setInvalid] = useState<string[]>([]);
  if (!draft || !meta) return null;
  const marketEnabled = meta.sources.some(
    (s) => s.id === 'market' && s.enabled,
  );
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await analysis.submit();
    if (ok) onSubmitted?.();
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
      <fieldset>
        <legend>Supuestos principales</legend>
        <p className="field-help" id="discount-help">
          Tasas manuales para diez años. La tasa de empresa no es un WACC
          estimado automáticamente.
        </p>
        {configurationFields.slice(0, 2).map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={f.key}>{f.label}</label>
            <input
              id={f.key}
              name={f.key}
              type="number"
              inputMode="decimal"
              required
              min={f.min}
              max={f.max}
              step={f.step}
              value={
                Number.isFinite(draft.configuration[f.key])
                  ? Number(
                      (draft.configuration[f.key] * f.scale).toPrecision(12),
                    )
                  : ''
              }
              aria-invalid={invalid.includes(f.key)}
              aria-describedby={`discount-help${invalid.includes(f.key) ? ` ${f.key}-error` : ''}`}
              onInvalid={() => setInvalid((v) => [...new Set([...v, f.key])])}
              onBlur={(e) => {
                const valid = e.currentTarget.validity.valid;
                setInvalid((v) =>
                  valid
                    ? v.filter((k) => k !== f.key)
                    : [...new Set([...v, f.key])],
                );
              }}
              onChange={(e) => {
                setInvalid((v) => v.filter((k) => k !== f.key));
                analysis.changeConfiguration(
                  f.key,
                  e.target.value === ''
                    ? NaN
                    : Number(e.target.value) / f.scale,
                );
              }}
            />
            {invalid.includes(f.key) && (
              <p className="field-error" id={`${f.key}-error`}>
                Introduce un valor entre {f.min} y {f.max}.
              </p>
            )}
          </div>
        ))}
        <details className="assumptions">
          <summary>Más supuestos de valoración</summary>
          <p className="field-help">
            Factores de crecimiento y margen, y múltiplos terminales manuales.
          </p>
          {configurationFields.slice(2).map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                name={f.key}
                type="number"
                inputMode="decimal"
                required
                min={f.min}
                max={f.max}
                step={f.step}
                value={
                  Number.isFinite(draft.configuration[f.key])
                    ? Number(
                        (draft.configuration[f.key] * f.scale).toPrecision(12),
                      )
                    : ''
                }
                aria-invalid={invalid.includes(f.key)}
                aria-describedby={
                  invalid.includes(f.key) ? `${f.key}-error` : undefined
                }
                onInvalid={() => setInvalid((v) => [...new Set([...v, f.key])])}
                onBlur={(e) => {
                  const valid = e.currentTarget.validity.valid;
                  setInvalid((v) =>
                    valid
                      ? v.filter((k) => k !== f.key)
                      : [...new Set([...v, f.key])],
                  );
                }}
                onChange={(e) => {
                  setInvalid((v) => v.filter((k) => k !== f.key));
                  analysis.changeConfiguration(
                    f.key,
                    e.target.value === ''
                      ? NaN
                      : Number(e.target.value) / f.scale,
                  );
                }}
              />
              {invalid.includes(f.key) && (
                <p className="field-error" id={`${f.key}-error`}>
                  Introduce un valor entre {f.min} y {f.max}.
                </p>
              )}
            </div>
          ))}
        </details>
      </fieldset>
    </form>
  );
}
