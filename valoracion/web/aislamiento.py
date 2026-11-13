"""Adquisiciones en procesos propios, terminables y sin estado global de FX.

El pipe sólo intercambia objetos producidos por nuestro hijo (no datos pickle
del cliente). Un watchdog termina el proceso incluso si recv está leyendo una
respuesta parcial: no quedan hilos con I/O bloqueado ocupando el worker.
"""

import multiprocessing
import pickle
import threading

from valoracion import servicio
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.proveedores.yahoo import ProveedorYahoo

MAX_RESPUESTA = 4 * 1024 * 1024


class ErrorProveedor(Exception):
    def __init__(self):
        super().__init__("No se pudieron obtener los datos de la empresa.")


class ErrorInfraestructura(Exception):
    def __init__(self, code="ACQUISITION_FAILED"):
        self.code = code
        super().__init__("La adquisición no terminó dentro de sus límites operativos.")


def crear_proveedor(source):
    # La misma instancia vive durante el lote; cache_fx nunca es la caché CLI.
    return ProveedorDemo() if source == "demo" else ProveedorYahoo(cache_fx={})


def _servir(conexion, source, fabrica):
    try:
        proveedor = fabrica(source)
        while True:
            operacion, argumentos = conexion.recv()
            try:
                if operacion == "analysis":
                    respuesta = servicio.analizar_empresa(
                        *argumentos, proveedor=proveedor
                    ).como_registros()
                elif operacion == "prices":
                    respuesta = servicio.obtener_precio_historico(*argumentos, proveedor=proveedor)
                elif operacion == "financials":
                    respuesta = servicio.obtener_historicos_financieros(
                        *argumentos, proveedor=proveedor
                    )
                else:
                    raise ValueError("Operación interna desconocida.")
                mensaje = pickle.dumps(("ok", respuesta), protocol=5)
                if len(mensaje) > MAX_RESPUESTA:
                    mensaje = pickle.dumps(("infra", None))
            except Exception:
                # Ninguna excepción del proveedor cruza a resultados, logs o Excel.
                mensaje = pickle.dumps(("provider", None))
            conexion.send_bytes(mensaje)
    except (EOFError, BrokenPipeError, OSError):
        pass
    finally:
        conexion.close()


class EjecutorAislado:
    def __init__(self, source, timeout, fabrica=crear_proveedor):
        contexto = multiprocessing.get_context("spawn")
        self._conexion, hijo = contexto.Pipe()
        self._proceso = contexto.Process(target=_servir, args=(hijo, source, fabrica), daemon=True)
        self._timeout = timeout
        self._cerrado = False
        try:
            self._proceso.start()
        except Exception:
            self._conexion.close()
            raise ErrorInfraestructura() from None
        finally:
            hijo.close()

    @property
    def vivo(self):
        return self._proceso.is_alive()

    def _terminar(self):
        if self.vivo:
            self._proceso.kill()

    def ejecutar(self, operacion, *argumentos):
        watchdog = threading.Timer(self._timeout, self._terminar)
        watchdog.daemon = True
        watchdog.start()
        try:
            self._conexion.send((operacion, argumentos))
            estado, respuesta = pickle.loads(self._conexion.recv_bytes(MAX_RESPUESTA))
        except (EOFError, OSError, ValueError):
            self.cerrar()
            raise ErrorInfraestructura() from None
        finally:
            watchdog.cancel()
            watchdog.join()
        if estado == "provider":
            raise ErrorProveedor()
        if estado != "ok":
            self.cerrar()
            raise ErrorInfraestructura()
        return respuesta

    def cerrar(self):
        if not self._cerrado:
            self._cerrado = True
            self._conexion.close()
            self._terminar()
            self._proceso.join(timeout=2)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.cerrar()
