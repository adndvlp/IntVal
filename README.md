# App de valoración de acciones USA y México

Aplicación local en Streamlit que descarga información de Yahoo Finance y compara, por acción:

- Precio de mercado
- Valor intrínseco con flujo de caja libre
- Valor intrínseco con EBIT convertido a NOPAT
- Valor intrínseco con EBITDA ajustado
- Valor intrínseco con utilidad neta
- Mediana de los cuatro modelos
- Precio objetivo promedio de analistas

La app incluye filtros, gráficas históricas y exportación a un archivo Excel con hojas separadas para USA y México.

## Instalación

Se recomienda Python 3.10 o posterior.

```bash
python -m venv .venv
```

### Windows

```powershell
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

También puedes ejecutar `ejecutar_app.bat`.

### macOS o Linux

```bash
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

También puedes ejecutar:

```bash
chmod +x ejecutar_app.sh
./ejecutar_app.sh
```

## Uso

1. Selecciona `USA`, `MX` o `Todos`.
2. Selecciona los tickers.
3. Ajusta la tasa de descuento, el factor conservador y los múltiplos.
4. Pulsa **Analizar empresas**.
5. Filtra la tabla, revisa las gráficas y descarga el Excel.

## Archivos principales

- `app.py`: interfaz Streamlit y gráficas.
- `motor_valoracion.py`: descarga, normalización, valoraciones y exportación a Excel.
- `requirements.txt`: dependencias.

## Consideraciones

- Yahoo Finance puede no entregar todos los campos para todos los tickers, especialmente objetivos de analistas de emisoras mexicanas.
- Las empresas financieras requieren una lectura diferente: la utilidad neta suele ser más útil que FCL, EBIT o EBITDA.
- La lista mexicana prioriza emisoras grandes y líquidas; puede editarse en `EMPRESAS_MX` dentro de `motor_valoracion.py`.
- Los resultados son aproximaciones educativas y no constituyen una recomendación de inversión.
