import { useState, type SubmitEvent } from 'react';
import Modal from '../../components/Modal';
import { configurationFields } from './model';
import { validConfiguration } from './configuration-storage';
import type { Configuration } from './types';
export default function SettingsDialog({
  value,
  defaults,
  onSave,
  onClose,
}: {
  value: Configuration;
  defaults: Configuration;
  onSave: (value: Configuration) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Configuration>(() => ({ ...value }));
  const [invalid, setInvalid] = useState<string[]>([]);
  function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validConfiguration(draft)) {
      const controls = [
        ...e.currentTarget.querySelectorAll<HTMLInputElement>('input'),
      ];
      setInvalid(controls.filter((c) => !c.validity.valid).map((c) => c.name));
      controls.find((c) => !c.validity.valid)?.focus();
      return;
    }
    onSave({ ...draft });
    onClose();
  }
  return (
    <Modal
      title="Ajustes de valoración"
      closeLabel="Cerrar ajustes"
      onClose={onClose}
      className="settings-dialog"
    >
      <h2>Ajustes de valoración</h2>
      <form onSubmit={submit} action="#ajustes" method="post">
        {[
          {
            title: 'Tasas de descuento',
            fields: configurationFields.slice(0, 2),
          },
          {
            title: 'Crecimiento y márgenes',
            fields: configurationFields.slice(2, 5),
          },
          {
            title: 'Valores al final de la proyección',
            fields: configurationFields.slice(5),
          },
        ].map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            <div className="settings-fields">
              {group.fields.map((f) => (
                <div className="field" key={f.key}>
                  <label htmlFor={`setting-${f.key}`}>{f.label}</label>
                  <input
                    id={`setting-${f.key}`}
                    name={f.key}
                    type="number"
                    inputMode="decimal"
                    required
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={
                      Number.isFinite(draft[f.key])
                        ? Number((draft[f.key] * f.scale).toPrecision(12))
                        : ''
                    }
                    aria-invalid={invalid.includes(f.key)}
                    aria-describedby={
                      invalid.includes(f.key)
                        ? `setting-error-${f.key}`
                        : undefined
                    }
                    onInvalid={() =>
                      setInvalid((v) => [...new Set([...v, f.key])])
                    }
                    onBlur={(e) => {
                      if (!e.currentTarget.validity.valid)
                        setInvalid((v) => [...new Set([...v, f.key])]);
                    }}
                    onChange={(e) => {
                      setInvalid((v) => v.filter((k) => k !== f.key));
                      setDraft((old) => ({
                        ...old,
                        [f.key]:
                          e.target.value === ''
                            ? NaN
                            : Number(e.target.value) / f.scale,
                      }));
                    }}
                  />
                  {invalid.includes(f.key) && (
                    <p id={`setting-error-${f.key}`} className="field-error">
                      Introduce un valor entre {f.min} y {f.max}, en pasos de{' '}
                      {f.step}.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <p className="settings-help">
          Proyección de diez años. Los ajustes se aplican al siguiente análisis.
        </p>
        <div className="dialog-actions">
          <button
            type="button"
            onClick={() => {
              setDraft({ ...defaults });
              setInvalid([]);
            }}
          >
            Restablecer
          </button>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary-action" type="submit">
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
