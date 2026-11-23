"""Proveedores locales importables por procesos spawn; nunca acceden a la red."""

import time
from types import SimpleNamespace

from tests.fixtures.datos_sinteticos import TickerSintetico
from valoracion.proveedores.demo import ProveedorDemo
from valoracion.proveedores.yahoo import ProveedorYahoo


class ProveedorControlado(ProveedorDemo):
    def obtener_empresa(self, ticker):
        if ticker == "BLOQUEADO":
            time.sleep(120)
        if ticker == "FALLA":
            raise RuntimeError("/Users/privado/token-secreto")
        return super().obtener_empresa("DEMO-USA")


def fabrica_controlada(source):
    assert source in {"demo", "market"}
    return ProveedorControlado()


class ErrorYahooPrueba(Exception):
    response = SimpleNamespace(status_code=401)


def fabrica_yahoo_rechazado(source):
    return ProveedorYahoo(
        ticker_factory=lambda _: TickerSintetico(
            get_info_result=ErrorYahooPrueba("cookie=SECRETO"), info={}
        )
    )
