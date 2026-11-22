"""F11: las páginas y la API comparten origen sin un fallback SPA global."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from qa_distribucion import verificar_apagado, verificar_http
from valoracion.web.ajustes import Ajustes
from valoracion.web.contratos import contenido_openapi
from valoracion.web.distribucion import create_app


@pytest.mark.parametrize("codigo", [0, 143])
def test_smoke_acepta_sigterm_solo_con_cierre_completo(codigo):
    verificar_apagado(codigo, "Application shutdown complete.\nFinished server process [1]")


@pytest.mark.parametrize(
    "codigo,registro",
    [
        (137, "Application shutdown complete.\nFinished server process [1]"),
        (143, "Started server process [1]"),
        (0, "Application shutdown complete."),
    ],
)
def test_smoke_rechaza_apagado_forzado_o_incompleto(codigo, registro):
    with pytest.raises(RuntimeError, match="apagado"):
        verificar_apagado(codigo, registro)


@pytest.fixture
def estaticos(tmp_path):
    raiz = tmp_path / "build con espacios"
    for nombre, texto in {
        "index.html": '<html><title>IntVal</title><h1>Analizar</h1><astro-island props=\'{"baseUrl":[0,""]}\'></astro-island><script src="/_astro/app.abcdef.js"></script><link rel="stylesheet" href="/_astro/app.abcdef.css"></html>',
        "app/index.html": '<html><title>IntVal</title><h1>Analizar</h1><astro-island props=\'{"baseUrl":[0,""]}\'></astro-island></html>',
        "metodologia/index.html": "<html><h1>Cómo se calcula</h1></html>",
        "404.html": "<html><h1>Página no encontrada</h1></html>",
        "_astro/app.abcdef.js": "export const version = 1;",
        "_astro/app.abcdef.css": "body { color: black; }",
        "favicon.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
        "images/font.woff2": "fuente de prueba",
        "api/index.html": "NO DEBE SERVIRSE",
        "api/v1/inexistente/index.html": "NO DEBE SERVIRSE",
    }.items():
        destino = raiz / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(texto, encoding="utf-8")
    return raiz


@pytest.fixture
def sitio(estaticos):
    with TestClient(
        create_app(Ajustes(demo=True, mercado_habilitado=False), directorio=estaticos)
    ) as client:
        yield client


@pytest.mark.parametrize("ruta", ["/", "/app/", "/index.html", "/app/index.html"])
def test_entrada_web_responde_al_recargar_app(sitio, ruta):
    response = sitio.get(ruta)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "IntVal" in response.text
    assert response.headers["cache-control"] == "no-cache"


@pytest.mark.parametrize("ruta", ["/app", "/metodologia"])
def test_redireccion_de_directorios_conserva_query(sitio, ruta):
    response = sitio.get(ruta + "?fuente=demo", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"].endswith(ruta + "/?fuente=demo")
    final = sitio.get(response.headers["location"])
    assert final.status_code == 200


@pytest.mark.parametrize(
    "ruta,mimes",
    [
        ("/_astro/app.abcdef.js", {"text/javascript", "application/javascript"}),
        ("/_astro/app.abcdef.css", {"text/css"}),
        ("/favicon.svg", {"image/svg+xml"}),
        ("/images/font.woff2", {"font/woff2"}),
    ],
)
def test_activos_mime_head_y_revalidacion(sitio, ruta, mimes):
    response = sitio.get(ruta)
    assert response.status_code == 200
    assert response.headers["content-type"].split(";")[0] in mimes
    assert response.headers["x-content-type-options"] == "nosniff"
    assert ("immutable" in response.headers["cache-control"]) == ruta.startswith("/_astro/")
    head = sitio.head(ruta)
    assert head.status_code == 200 and head.content == b""
    cached = sitio.get(ruta, headers={"If-None-Match": response.headers["etag"]})
    assert cached.status_code == 304 and not cached.content


@pytest.mark.parametrize("ruta", ["/ausente", "/otra/ruta", "/_astro/ausente.js"])
def test_paginas_ausentes_son_404_reales(sitio, ruta):
    response = sitio.get(ruta)
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("text/html")
    assert "Página no encontrada" in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("ruta", ["/api", "/api/v1/inexistente", "/%61pi/inexistente"])
@pytest.mark.parametrize("metodo", ["GET", "POST", "PATCH", "HEAD"])
def test_api_desconocida_no_devuelve_html_ni_redirige(sitio, ruta, metodo):
    response = sitio.request(metodo, ruta, headers={"Accept": "text/html"})
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    if metodo != "HEAD":
        assert response.json()["error"]["code"] == "NOT_FOUND"


@pytest.mark.parametrize("metodo,ruta", [("POST", "/api/v1/meta"), ("GET", "/api/v1/analyses")])
def test_metodo_incorrecto_conserva_el_405_de_api(sitio, metodo, ruta):
    response = sitio.request(metodo, ruta)
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_salud_y_contrato_siguen_siendo_de_api(sitio):
    assert sitio.get("/healthz").json() == {"status": "ok"}
    assert sitio.get("/readyz").json() == {"status": "ok"}
    assert sitio.get("/api/v1/meta").json()["default_source"] == "demo"
    assert sitio.get("/openapi.json").json() == json.loads(contenido_openapi())


def test_readiness_detecta_perdida_de_un_activo_sin_afectar_liveness(sitio, estaticos):
    (estaticos / "_astro/app.abcdef.js").unlink()
    response = sitio.get("/readyz")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert sitio.get("/healthz").status_code == 200


@pytest.mark.parametrize(
    "nombre",
    ["index.html", "app/index.html", "metodologia/index.html", "404.html", "_astro/app.abcdef.js"],
)
def test_build_incompleto_impide_arrancar(estaticos, nombre):
    (estaticos / nombre).unlink()
    with pytest.raises(RuntimeError, match="build completo"):
        create_app(directorio=estaticos)


def test_directorio_inexistente_impide_arrancar(tmp_path):
    with pytest.raises(RuntimeError, match="build completo"):
        create_app(directorio=tmp_path / "no-existe")


def test_no_sirve_archivos_fuera_del_build(estaticos, tmp_path):
    secreto = tmp_path / "secreto.txt"
    secreto.write_text("PRIVADO", encoding="utf-8")
    (estaticos / "enlace.txt").symlink_to(secreto)
    with TestClient(create_app(directorio=estaticos)) as client:
        for ruta in ["/enlace.txt", "/%2e%2e/secreto.txt", "/.git/config"]:
            response = client.get(ruta)
            assert response.status_code == 404
            assert "PRIVADO" not in response.text


def test_directorio_default_no_depende_del_cwd(monkeypatch, estaticos, tmp_path):
    monkeypatch.setattr("valoracion.web.distribucion.DIRECTORIO_DEFAULT", estaticos)
    monkeypatch.chdir(tmp_path)
    with TestClient(create_app()) as client:
        assert client.get("/").status_code == 200


def test_mismo_smoke_de_imagen_corre_con_api_y_estaticos_reales(sitio):
    def request(method, path, body=None):
        response = sitio.request(method, path, json=body, follow_redirects=False)
        return response.status_code, dict(response.headers), response.content

    resultado = verificar_http(request)
    assert resultado["checks"] and all(c["passed"] for c in resultado["checks"])
    assert len(resultado["snapshot"]) == 3


def test_activos_grandes_negocian_gzip_sin_alterar_su_contenido(sitio, estaticos):
    texto = "// comentario de prueba\n" * 500
    (estaticos / "_astro/grande.abcdef.js").write_text(texto)
    compressed = sitio.get("/_astro/grande.abcdef.js", headers={"Accept-Encoding": "gzip"})
    assert compressed.status_code == 200
    assert compressed.headers["content-encoding"] == "gzip"
    assert "Accept-Encoding" in compressed.headers["vary"]
    assert compressed.text == texto
    identity = sitio.get("/_astro/grande.abcdef.js", headers={"Accept-Encoding": "identity"})
    assert "content-encoding" not in identity.headers
    assert identity.content == compressed.content


@pytest.mark.skipif(
    not (Path(__file__).resolve().parents[2] / "frontend/dist/index.html").is_file(),
    reason="El build Astro se verifica en el job de imagen; las pruebas Python puras usan archivos aislados.",
)
def test_smoke_asgi_del_build_astro_real():
    with TestClient(create_app(Ajustes(demo=True, mercado_habilitado=False))) as client:

        def request(method, path, body=None):
            response = client.request(method, path, json=body, follow_redirects=False)
            return response.status_code, dict(response.headers), response.content

        result = verificar_http(request)
        assert all(c["passed"] for c in result["checks"])
