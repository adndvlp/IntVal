"""Proveedores locales importables por procesos spawn; nunca acceden a la red."""

import time

from valoracion.proveedores.demo import ProveedorDemo


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
