import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney, formatNumber, formatPercent } from './model';
import type { Company, Financials, Prices } from './types';

export type ChartKind = 'comparison' | 'prices' | 'financials' | 'margins';
export const series = [
  { id: 'fcl', label: 'Proxy FCL', color: '#086a4d' },
  { id: 'nopat', label: 'Proxy NOPAT', color: '#385a9c' },
  { id: 'ebitda_adjusted', label: 'Proxy EBITDA ajustado', color: '#926515' },
  { id: 'net_income', label: 'Proxy utilidad neta', color: '#9e3b4e' },
] as const;
const common = {
  margin: { top: 12, right: 20, bottom: 12, left: 12 },
  accessibilityLayer: true,
};
const axis = (value: number) =>
  formatNumber(value, Math.abs(value) < 0.01 ? 6 : 2);
type YearRow = { year: number } & Partial<
  Record<
    'revenue' | 'fcl' | 'ebit' | 'ebitda' | 'net_income' | 'nopat',
    number | null
  >
>;

export default function Charts({
  kind,
  company,
  prices,
  financials,
}: {
  kind: ChartKind;
  company: Company;
  prices?: Prices;
  financials?: Financials;
}) {
  const comparison = [
    {
      label: 'Precio de mercado',
      value: company.market_price,
      fill: '#66776a',
    },
    ...series.map((s) => ({
      label: s.label,
      value:
        company.proxies.find((p) => p.id === s.id)?.value_per_share ?? null,
      fill: s.color,
    })),
    {
      label: 'Mediana de proxies',
      value: company.median.value_per_share,
      fill: '#142824',
    },
    {
      label: 'Objetivo de analistas',
      value: company.analyst_target.value,
      fill: '#74508d',
    },
  ];
  const titles = {
    comparison: 'Comparación por acción',
    prices: 'Precio histórico',
    financials: 'Históricos financieros',
    margins: 'Márgenes históricos',
  };
  const financialLines = [
    { key: 'revenue', label: 'Ingresos', color: '#142824' },
    { key: 'fcl', label: 'FCL', color: series[0].color },
    { key: 'ebit', label: 'EBIT', color: series[1].color },
    { key: 'ebitda', label: 'EBITDA', color: series[2].color },
    { key: 'net_income', label: 'Utilidad neta', color: series[3].color },
  ] as const;
  const marginLines = [
    { key: 'fcl', label: 'Margen FCL', color: series[0].color },
    { key: 'nopat', label: 'Margen NOPAT', color: series[1].color },
    { key: 'ebitda', label: 'Margen EBITDA bruto', color: series[2].color },
    { key: 'net_income', label: 'Margen neto', color: series[3].color },
  ] as const;
  const lines = kind === 'margins' ? marginLines : financialLines;
  const rows: YearRow[] | undefined =
    kind === 'margins' ? financials?.margins.items : financials?.items;
  return (
    <figure
      className="company-figure"
      aria-label={`${titles[kind]} de ${company.ticker}`}
    >
      <figcaption>
        <h3>{titles[kind]}</h3>
        <p>
          {kind === 'financials'
            ? `Millones de ${financials?.currency ?? 'moneda no disponible'}`
            : kind === 'margins'
              ? 'Porcentaje de los ingresos'
              : `${prices?.currency ?? company.currency ?? 'Moneda no disponible'} · por acción`}
        </p>
      </figcaption>
      <div className="chart-canvas" data-chart={kind}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          initialDimension={{ width: 640, height: 320 }}
        >
          {kind === 'comparison' ? (
            <BarChart
              {...common}
              data={comparison}
              layout="vertical"
              margin={{ ...common.margin, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={axis} />
              <YAxis
                type="category"
                dataKey="label"
                width={155}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(v) =>
                  formatMoney(
                    typeof v === 'number' ? v : null,
                    company.currency,
                  )
                }
              />
              <Bar
                dataKey="value"
                name="Valor por acción"
                isAnimationActive={false}
                radius={[0, 3, 3, 0]}
              />
            </BarChart>
          ) : kind === 'prices' ? (
            <LineChart {...common} data={prices?.items}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={45} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={axis} width={65} />
              <Tooltip
                formatter={(v) =>
                  formatMoney(
                    typeof v === 'number' ? v : null,
                    prices?.currency ?? null,
                  )
                }
              />
              <Line
                dataKey="value"
                name={
                  prices?.price_kind === 'synthetic'
                    ? 'Precio sintético'
                    : 'Cierre ajustado'
                }
                stroke={series[0].color}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <LineChart {...common} data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={kind === 'margins' ? formatPercent : axis}
                width={75}
              />
              <Tooltip
                formatter={(v) =>
                  kind === 'margins'
                    ? formatPercent(typeof v === 'number' ? v : null)
                    : `${formatNumber(typeof v === 'number' ? v : null, 6)} millones ${financials?.currency ?? ''}`
                }
              />
              <Legend />
              {lines.map((l) => (
                <Line
                  key={l.key}
                  dataKey={l.key}
                  name={l.label}
                  stroke={l.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>Ver datos de la gráfica</summary>
        <div
          className="data-scroll"
          tabIndex={0}
          role="region"
          aria-label="Datos de la gráfica, desplazables horizontalmente"
        >
          {kind === 'comparison' ? (
            <table>
              <caption>Datos de comparación por acción</caption>
              <thead>
                <tr>
                  <th scope="col">Serie</th>
                  <th scope="col">Valor por acción</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.label}>
                    <th scope="row">{c.label}</th>
                    <td>{formatMoney(c.value, company.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : kind === 'prices' ? (
            <table>
              <caption>Datos del precio histórico</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">
                    Precio ({prices?.currency ?? 'moneda no disponible'})
                  </th>
                </tr>
              </thead>
              <tbody>
                {prices?.items.map((r) => (
                  <tr key={r.date}>
                    <th scope="row">{r.date}</th>
                    <td>{formatMoney(r.value, prices.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <caption>
                {kind === 'margins'
                  ? 'Datos de márgenes · porcentajes'
                  : 'Datos financieros · millones'}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Año</th>
                  {lines.map((l) => (
                    <th key={l.key} scope="col">
                      {l.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={r.year}>
                    <th scope="row">{r.year}</th>
                    {lines.map((l) => (
                      <td key={l.key}>
                        {kind === 'margins'
                          ? formatPercent(r[l.key])
                          : formatNumber(r[l.key], 6)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </details>
      <p className="chart-note">
        Los valores ausentes se muestran como «—» y mantienen huecos en las
        series.
      </p>
    </figure>
  );
}
