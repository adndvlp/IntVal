"""Caracterización del contrato público y del snapshot local anterior a F2."""

import hashlib
import json

import motor_valoracion as motor


def test_universo_heredado_conserva_simbolos_orden_y_fuentes_de_f1():
    valores = {
        "EMPRESAS_USA": motor.EMPRESAS_USA,
        "EMPRESAS_MX": motor.EMPRESAS_MX,
        "FUENTES_UNIVERSO": motor.FUENTES_UNIVERSO,
    }
    contenido = json.dumps(valores, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    assert hashlib.sha256(contenido).hexdigest() == '0eccd1e38ec685a8b9eb2667366c8d45cbeb87e21c15cfdcbfba7641e94cf21b'
    assert len(motor.EMPRESAS_USA) == 500
    assert len(motor.EMPRESAS_MX) == 104
    assert motor.EMPRESAS == motor.EMPRESAS_USA + motor.EMPRESAS_MX


def test_fachada_mantiene_las_operaciones_publicas_de_f1():
    nombres = [
        "mercado_de_ticker", "eliminar_duplicados", "numero_valido", "normalizar_etiqueta",
        "obtener_fila", "ultimo_valor", "alinear_series", "convertir_serie",
        "obtener_info_segura", "obtener_precio_actual", "obtener_objetivo_analistas",
        "obtener_acciones", "ultimo_cierre_simbolo", "obtener_tipo_cambio",
        "calcular_cagr", "estimar_tasa_impuestos", "construir_fcl", "construir_ebitda",
        "margen_normalizado", "proyectar_valor", "por_accion", "rendimiento", "es_financiera",
        "crear_resultado_error", "analizar_ticker", "escribir_excel", "main",
    ]
    assert all(callable(getattr(motor, nombre)) for nombre in nombres)
