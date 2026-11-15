import { configurationFields } from './model';
import type { Configuration } from './types';
export const configurationKey = (baseUrl: string) =>
  `intval.configuration.v1:${baseUrl}`;
export function validConfiguration(value: unknown): value is Configuration {
  if (!value || typeof value !== 'object') return false;
  return configurationFields.every((f) => {
    const raw = (value as Configuration)[f.key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return false;
    const v = raw * f.scale;
    return (
      Number.isFinite(v) &&
      v >= f.min &&
      v <= f.max &&
      Math.abs((v - f.min) / f.step - Math.round((v - f.min) / f.step)) < 1e-7
    );
  });
}
export function readConfiguration(key: string): Configuration | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return v?.version === 1 && validConfiguration(v.value)
      ? (Object.fromEntries(
          configurationFields.map((f) => [f.key, v.value[f.key]]),
        ) as Configuration)
      : null;
  } catch {
    return null;
  }
}
export function saveConfiguration(key: string, value: Configuration) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, value }));
  } catch {
    /* Guardar sigue funcionando durante la visita. */
  }
}
