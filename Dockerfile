# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:26.13.1-bookworm-slim
ARG PYTHON_IMAGE=python:3.12.16-slim-bookworm

FROM ${NODE_IMAGE} AS web-build
WORKDIR /web
ENV ASTRO_TELEMETRY_DISABLED=1
COPY frontend/package.json frontend/package-lock.json frontend/.node-version ./
RUN test "$(node --version)" = "v$(cat .node-version)" \
    && npm install --global npm@11.12.1 \
    && npm ci --no-audit --no-fund
COPY frontend/ ./
ARG PUBLIC_SITE_URL=""
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL} PUBLIC_API_BASE_URL=""
RUN npm run build

FROM ${PYTHON_IMAGE} AS python-base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

FROM python-base AS python-deps
RUN python -m venv /opt/venv
COPY requirements.txt /tmp/requirements.txt
RUN /opt/venv/bin/python -m pip install --no-cache-dir --no-deps --only-binary=:all: -r /tmp/requirements.txt \
    && /opt/venv/bin/python -m pip check

FROM python-base AS runtime
RUN groupadd --gid 10001 intval \
    && useradd --uid 10001 --gid intval --create-home intval
ENV PATH="/opt/venv/bin:${PATH}" XDG_CACHE_HOME=/tmp/intval-cache
WORKDIR /app
COPY --from=python-deps /opt/venv /opt/venv
COPY app.py motor_valoracion.py iniciar_servicio.sh iniciar_streamlit.sh LICENSE ./
COPY .streamlit/config.toml ./.streamlit/config.toml
COPY valoracion/ ./valoracion/
COPY data/ ./data/
COPY --from=web-build /web/dist ./frontend/dist/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ['PORT'] + '/readyz', timeout=3).close()"]
ENTRYPOINT ["bash", "/app/iniciar_servicio.sh"]
