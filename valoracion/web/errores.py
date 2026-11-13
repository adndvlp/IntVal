"""Errores públicos del transporte: mensajes fijos, sin excepciones del proveedor."""


class FalloWeb(Exception):
    def __init__(self, status, code, message, *, retryable=False, fields=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.retryable = retryable
        self.fields = fields or []

    def detalle(self):
        return {
            "code": self.code,
            "message": self.message,
            "fields": self.fields,
            "retryable": self.retryable,
        }
