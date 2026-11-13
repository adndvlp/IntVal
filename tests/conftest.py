"""Aislamiento por defecto: ninguna consulta real, espera o caché compartida."""

import socket
from types import SimpleNamespace

import pytest
import streamlit as st

import motor_valoracion as motor
from tests.fixtures.datos_sinteticos import TickerSintetico


@pytest.fixture
def proveedor(monkeypatch):
    tickers = {}
    llamadas = []

    def obtener(ticker):
        llamadas.append(ticker)
        if ticker not in tickers:
            pytest.fail(f"Ticker no preparado: {ticker}")
        respuesta = tickers[ticker]
        if isinstance(respuesta, Exception):
            raise respuesta
        return respuesta

    monkeypatch.setattr(motor.yf, "Ticker", obtener)
    return tickers, llamadas


@pytest.fixture
def industrial(proveedor):
    ticker = TickerSintetico()
    proveedor[0]["TEST"] = ticker
    return ticker


@pytest.fixture
def config_simple():
    return motor.Configuracion(
        anos_proyeccion=3, tasa_descuento=0,
        multiplo_terminal_fcl=2, multiplo_terminal_ebit=2,
        multiplo_terminal_ebitda=2, multiplo_terminal_utilidad_neta=2,
        pausa_entre_tickers=0,
    )


@pytest.fixture(autouse=True)
def aislar_entorno(monkeypatch):
    def proveedor_no_preparado(*args, **kwargs):
        pytest.fail(f"Consulta de mercado sin fixture: {args!r}")

    original_socket = socket.socket

    class SocketSinRed(original_socket):
        def __init__(self, family=socket.AF_INET, *args, **kwargs):
            if family in (socket.AF_INET, socket.AF_INET6):
                pytest.fail("Socket de red no autorizado en las pruebas")
            super().__init__(family, *args, **kwargs)

    def dns_no_permitido(*args, **kwargs):
        pytest.fail("Resolución DNS no autorizada en las pruebas")

    monkeypatch.setattr(motor.yf, "Ticker", proveedor_no_preparado)
    # Reemplazar sólo la referencia del motor: AppTest necesita el sleep real
    # del módulo estándar para coordinar sus hilos.
    monkeypatch.setattr(motor, "time", SimpleNamespace(sleep=lambda _: None))
    monkeypatch.setattr(socket, "socket", SocketSinRed)
    monkeypatch.setattr(socket, "getaddrinfo", dns_no_permitido)
    motor.CACHE_FX.clear()
    st.cache_data.clear()
    yield
    motor.CACHE_FX.clear()
    st.cache_data.clear()
