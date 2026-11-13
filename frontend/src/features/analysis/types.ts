import type { components } from '../../lib/generated/api';

type Schemas = components['schemas'];
export type Source = Schemas['SolicitudAnalisis']['source'];
export type Market = Schemas['EmpresaCatalogo']['market'] | 'all';
export type Configuration = Required<Schemas['ConfiguracionWeb']>;
export type EffectiveConfiguration = Schemas['ConfiguracionEfectiva'];
export type Metadata = Schemas['Metadatos'];
export type Catalog = Schemas['Catalogo'];
export type Job = Schemas['EstadoTrabajo'];
export type Company = Schemas['ResultadoPublicado'];
export type ResultsPage = Schemas['PaginaResultados'];
export type CreateRequest = Schemas['SolicitudAnalisis'];
export type Prices = Schemas['PreciosHistoricos'];
export type Financials = Schemas['FinancierosHistoricos'];
export type ApiError = Schemas['ErrorDetalle'];
export type Snapshot = { job: Job; rows: Company[] };
export type Filters = {
  market: Market;
  status: Company['status'] | 'all';
  minUpside: number | null;
};
