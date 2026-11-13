import { useEffect, useRef, useState } from 'react';
import { obtenerMetadatos } from '../lib/api';

const mensajes = {
  inicial: 'Sin comprobar.',
  pendiente: 'Comprobando conexión…',
  disponible: 'Conexión disponible. El catálogo está preparado.',
  error: 'No se pudo comprobar la conexión. Puedes reintentar.',
};

export default function EstadoServicio({ baseUrl = '' }: { baseUrl?: string }) {
  const [estado, setEstado] = useState<keyof typeof mensajes>('inicial');
  const peticion = useRef<AbortController | null>(null);
  useEffect(() => () => peticion.current?.abort(), []);

  async function comprobar() {
    const controller = new AbortController();
    peticion.current = controller;
    setEstado('pendiente');
    try {
      await obtenerMetadatos(baseUrl, controller.signal);
      if (!controller.signal.aborted) setEstado('disponible');
    } catch {
      if (!controller.signal.aborted) setEstado('error');
    }
  }

  return (
    <div className="service-status">
      <button
        type="button"
        onClick={comprobar}
        disabled={estado === 'pendiente'}
      >
        Comprobar conexión
      </button>
      <p role="status">{mensajes[estado]}</p>
    </div>
  );
}
