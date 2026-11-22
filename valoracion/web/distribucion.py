"""Un solo servicio ASGI para la API y el build estático de Astro."""

from pathlib import Path

from fastapi import FastAPI
from starlette.datastructures import MutableHeaders
from starlette.middleware.gzip import GZipMiddleware
from starlette.staticfiles import StaticFiles
from starlette.types import Message, Receive, Scope, Send

from .ajustes import Ajustes
from .aplicacion import create_app as crear_api
from .trabajos import GestorTrabajos

DIRECTORIO_DEFAULT = Path(__file__).resolve().parents[2] / "frontend" / "dist"
PAGINAS = ("index.html", "app/index.html", "metodologia/index.html", "404.html")


def create_app(
    ajustes: Ajustes | None = None,
    *,
    directorio: Path | None = None,
    gestor: GestorTrabajos | None = None,
) -> FastAPI:
    raiz = Path(directorio if directorio is not None else DIRECTORIO_DEFAULT).resolve()
    if not all((raiz / nombre).is_file() for nombre in PAGINAS) or not any(
        (raiz / "_astro").glob("*.js")
    ):
        raise RuntimeError(
            "Falta un build completo en frontend/dist. Ejecuta npm ci y npm run build "
            "en frontend antes de iniciar el servicio, o utiliza la imagen Docker."
        )
    archivos = tuple(p for p in raiz.rglob("*") if p.is_file())

    def estaticos_listos() -> bool:
        return all(p.is_file() for p in archivos)

    app = crear_api(ajustes, gestor=gestor, preparacion_extra=estaticos_listos)
    estaticos = GZipMiddleware(
        StaticFiles(directory=raiz, html=True, follow_symlink=False),
        minimum_size=1024,
        compresslevel=5,
    )
    no_encontrado = app.router.default

    async def servir(scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or path == "/api" or path.startswith("/api/"):
            await no_encontrado(scope, receive, send)
            return

        async def cabeceras(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Cache-Control"] = (
                    "no-store"
                    if message["status"] >= 400
                    else "public, max-age=31536000, immutable"
                    if path.startswith("/_astro/")
                    else "no-cache"
                )
            await send(message)

        await estaticos(scope, receive, cabeceras)

    # El default se ejecuta después de resolver rutas, métodos y redirecciones.
    # Un montaje raíz consumiría también los matches parciales (405) de la API.
    app.router.default = servir
    return app
