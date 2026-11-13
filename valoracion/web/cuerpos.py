"""Límite ASGI antes del parser JSON, incluso sin Content-Length."""

from fastapi.responses import JSONResponse


class LimiteCuerpo:
    def __init__(self, app, max_bytes):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] != "POST":
            return await self.app(scope, receive, send)
        cabeceras = dict(scope.get("headers", []))
        largo = cabeceras.get(b"content-length")
        try:
            excede = largo is not None and int(largo) > self.max_bytes
        except ValueError:
            excede = True
        cuerpo = bytearray()
        while not excede:
            mensaje = await receive()
            if mensaje["type"] == "http.disconnect":
                return
            fragmento = mensaje.get("body", b"")
            if len(cuerpo) + len(fragmento) > self.max_bytes:
                excede = True
                break
            cuerpo.extend(fragmento)
            if not mensaje.get("more_body", False):
                break
        if excede:
            respuesta = JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "BODY_TOO_LARGE",
                        "message": "La solicitud supera el tamaño permitido.",
                        "fields": [],
                        "retryable": False,
                    }
                },
            )
            return await respuesta(scope, receive, send)
        entregado = False

        async def reproducir():
            nonlocal entregado
            if not entregado:
                entregado = True
                return {"type": "http.request", "body": bytes(cuerpo), "more_body": False}
            return await receive()

        await self.app(scope, reproducir, send)
