"""Construye y verifica la imagen F11; no publica ni instala herramientas del host."""

import argparse
import hashlib
import json
import math
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parent


class RecursosHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rutas = set()
        self.origenes_api = []

    def handle_starttag(self, tag, attrs):
        valores = dict(attrs)
        if tag == "astro-island" and "props" in valores:
            props = json.loads(valores["props"])
            if "baseUrl" in props:
                self.origenes_api.append(props["baseUrl"][1])
        if tag in {"script", "img"}:
            valor = valores.get("src")
        elif tag == "link" and valores.get("rel") in {"stylesheet", "modulepreload", "icon"}:
            valor = valores.get("href")
        else:
            return
        if valor:
            partes = urllib.parse.urlsplit(valor)
            if not partes.netloc and not partes.scheme:
                self.rutas.add(valor)


def verificar_http(request):
    """El mismo recorrido se prueba con ASGI y, en CI, contra la imagen por HTTP."""
    checks = []

    def exigir(nombre, condicion):
        checks.append({"name": nombre, "passed": bool(condicion)})
        if not condicion:
            raise RuntimeError(f"Falló el smoke: {nombre}")

    def obtener(ruta):
        estado, cabeceras, cuerpo = request("GET", ruta)
        exigir(f"{ruta}: HTTP 200", estado == 200)
        return cabeceras, cuerpo

    activos = set()
    for ruta in ("/", "/app/", "/metodologia/"):
        headers, body = obtener(ruta)
        exigir(f"{ruta}: HTML", headers.get("content-type", "").startswith("text/html"))
        exigir(f"{ruta}: HTML revalidable", headers.get("cache-control") == "no-cache")
        parser = RecursosHTML()
        parser.feed(body.decode())
        if ruta != "/metodologia/":
            exigir(f"{ruta}: API del mismo origen", parser.origenes_api == [""])
        activos.update(urllib.parse.urljoin(ruta, valor) for valor in parser.rutas)
    exigir(
        "build contiene JS y CSS",
        any(p.endswith(".js") for p in activos) and any(p.endswith(".css") for p in activos),
    )
    for ruta in sorted(activos):
        headers, body = obtener(ruta)
        if ruta.endswith(".js"):
            exigir(
                f"{ruta}: MIME JS",
                headers.get("content-type", "").split(";")[0]
                in {"text/javascript", "application/javascript"}
                and not body.lstrip().startswith(b"<"),
            )
        if ruta.endswith(".css"):
            exigir(f"{ruta}: MIME CSS", headers.get("content-type", "").startswith("text/css"))
        if ruta.startswith("/_astro/"):
            exigir(f"{ruta}: caché por contenido", "immutable" in headers.get("cache-control", ""))
    for ruta in ("/app", "/metodologia"):
        status, headers, _ = request("GET", ruta + "?fuente=demo")
        exigir(
            f"{ruta}: redirect conserva query",
            status == 307 and headers.get("location", "").endswith(ruta + "/?fuente=demo"),
        )
    for ruta in ("/inexistente", "/_astro/inexistente.js"):
        status, _, _ = request("GET", ruta)
        exigir(f"{ruta}: 404 real", status == 404)
    for ruta in ("/api", "/api/v1/inexistente"):
        status, headers, body = request("GET", ruta)
        exigir(
            f"{ruta}: error JSON 404",
            status == 404
            and headers.get("content-type") == "application/json"
            and json.loads(body)["error"]["code"] == "NOT_FOUND",
        )
    status, _, _ = request("POST", "/api/v1/meta", {})
    exigir("API conserva 405", status == 405)
    for ruta in ("/healthz", "/readyz"):
        _, body = obtener(ruta)
        exigir(f"{ruta}: salud JSON", json.loads(body) == {"status": "ok"})
    _, body = obtener("/api/v1/meta")
    meta = json.loads(body)
    exigir(
        "demo habilitada sin Mercado",
        meta["default_source"] == "demo"
        and not next(s["enabled"] for s in meta["sources"] if s["id"] == "market"),
    )
    tickers = ["DEMO-USA", "DEMO-MX.MX", "DEMO-INCOMPLETA"]
    status, _, body = request(
        "POST",
        "/api/v1/analyses",
        {"client_request_id": str(uuid4()), "source": "demo", "tickers": tickers},
    )
    exigir("análisis aceptado", status == 202)
    base = "/api/v1/analyses/" + json.loads(body)["id"]
    deadline = time.monotonic() + 60
    while True:
        _, body = obtener(base)
        job = json.loads(body)
        if job["state"] in {"completed", "failed", "cancelled"}:
            break
        if time.monotonic() >= deadline:
            raise RuntimeError("El análisis demo no terminó en 60 segundos.")
        time.sleep(0.1)
    exigir(
        "análisis completo: tres empresas", job["state"] == "completed" and job["processed"] == 3
    )
    _, body = obtener(base + "/results?limit=100")
    rows = {r["ticker"]: r for r in json.loads(body)["items"]}
    exigir("snapshot completo", set(rows) == set(tickers))
    for ticker, esperado in [("DEMO-USA", 116.1879930510067), ("DEMO-MX.MX", 209.138387491812)]:
        exigir(
            f"mediana {ticker}",
            math.isclose(rows[ticker]["median"]["value_per_share"], esperado, rel_tol=1e-10),
        )
    exigir("ausencia conservada", rows["DEMO-INCOMPLETA"]["median"]["value_per_share"] is None)
    _, body = obtener(base + "/companies/DEMO-USA/prices?period=1y")
    exigir("histórico sintético", json.loads(body)["price_kind"] == "synthetic")
    _, body = obtener(base + "/companies/DEMO-USA/financials")
    exigir("unidad financiera conservada", json.loads(body)["unit"] == "millions")
    headers, body = obtener(base + "/export.xlsx")
    exigir(
        "Excel MIME y descarga",
        headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        and "attachment" in headers.get("content-disposition", ""),
    )
    with zipfile.ZipFile(BytesIO(body)) as libro:
        exigir("Excel válido", libro.testzip() is None and "xl/workbook.xml" in libro.namelist())
        textos = b"".join(libro.read(n) for n in libro.namelist() if n.endswith(".xml"))
        exigir("Excel incluye las tres empresas", all(t.encode() in textos for t in tickers))
    return {"checks": checks, "snapshot": rows}


class SinRedireccion(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def transporte(base):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SinRedireccion())

    def request(method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            base + path, data=data, method=method, headers={"Content-Type": "application/json"}
        )
        try:
            response = opener.open(req, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return (
                response.status,
                {k.lower(): v for k, v in response.headers.items()},
                response.read(),
            )

    return request


def verificar_apagado(codigo, registro):
    # Uvicorn vuelve a emitir SIGTERM tras completar el lifespan: Docker puede
    # registrar 143. El código por sí solo no demuestra un cierre ordenado.
    if codigo not in {0, 143} or not all(
        mensaje in registro
        for mensaje in ("Application shutdown complete.", "Finished server process")
    ):
        raise RuntimeError(f"El apagado SIGTERM no fue completo (código {codigo}).")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--image", help="Verificar una imagen ya construida en lugar de construir otra."
    )
    args = parser.parse_args()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S-%fZ")
    output = ROOT / "temp" / "distribucion-qa" / stamp
    output.mkdir(parents=True)
    manifest = {"schema": "intval-distribution-qa-1", "status": "started", "commands": []}
    docker, cid = shutil.which("docker"), None

    def command(arguments, *, check=True):
        print("Ejecutando:", " ".join(arguments), flush=True)
        result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True, timeout=1200)
        log = f"command-{len(manifest['commands']):02}.log"
        (output / log).write_text(result.stdout + result.stderr)
        manifest["commands"].append({"argv": arguments, "exit_code": result.returncode, "log": log})
        if check and result.returncode:
            raise RuntimeError(f"Falló el comando; revisa {output / log}\n{result.stderr[-2000:]}")
        return result

    try:
        if not docker:
            raise RuntimeError(
                "Docker no está disponible. La verificación real de imagen también se ejecuta en el workflow Distribución; no se instala Docker automáticamente."
            )
        manifest["docker_version"] = command(
            [docker, "version", "--format", "{{.Server.Version}}"]
        ).stdout.strip()
        image = args.image or f"intval-f11:{stamp.lower()}"
        if not args.image:
            command([docker, "build", "--progress=plain", "--tag", image, "."])
        image_info = json.loads(command([docker, "image", "inspect", image]).stdout)[0]
        manifest["image"] = {k: image_info[k] for k in ("Id", "RepoTags", "Architecture", "Os")}
        manifest["runtime_user"] = image_info["Config"]["User"]
        runtime = command(
            [
                docker,
                "run",
                "--rm",
                "--entrypoint",
                "python",
                image,
                "-c",
                "import json, os, shutil; print(json.dumps({'uid':os.getuid(),'node':shutil.which('node'),'npm':shutil.which('npm')}))",
            ]
        )
        info = json.loads(runtime.stdout)
        if info["uid"] == 0 or info["node"] or info["npm"]:
            raise RuntimeError("La imagen final debe ejecutar sin root ni Node/npm.")
        command([docker, "run", "--rm", "--entrypoint", "python", image, "-m", "pip", "check"])
        command(
            [
                docker,
                "run",
                "--rm",
                "--entrypoint",
                "python",
                image,
                "motor_valoracion.py",
                "--help",
            ]
        )
        for env, code in [("", 1), ("PORT=0", 64)]:
            result = command(
                [docker, "run", "--rm", *(["--env", env] if env else []), image], check=False
            )
            if result.returncode != code or "PORT" not in result.stderr:
                raise RuntimeError("La imagen no rechaza PORT ausente/inválido como se esperaba.")
        cid = f"intval-f11-{stamp.lower()}"
        command(
            [
                docker,
                "run",
                "--detach",
                "--name",
                cid,
                "--read-only",
                "--tmpfs",
                "/tmp:rw,nosuid,size=128m",
                "--env",
                "PORT=9137",
                "--env",
                "VALORACION_DEMO=1",
                "--env",
                "VALORACION_MARKET_ENABLED=0",
                "--publish",
                "127.0.0.1::9137",
                image,
            ]
        )
        details = json.loads(command([docker, "inspect", cid]).stdout)[0]
        port = details["NetworkSettings"]["Ports"]["9137/tcp"][0]["HostPort"]
        request = transporte(f"http://127.0.0.1:{port}")
        deadline = time.monotonic() + 60
        while True:
            try:
                if request("GET", "/readyz")[0] == 200:
                    break
            except (OSError, urllib.error.URLError):
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError("El contenedor no alcanzó /readyz en 60 segundos.")
            time.sleep(0.25)
        manifest.update(verificar_http(request))
        cmdline = command(
            [
                docker,
                "exec",
                cid,
                "python",
                "-c",
                "print(open('/proc/1/cmdline','rb').read().decode().replace(chr(0),' '))",
            ]
        ).stdout
        if "uvicorn" not in cmdline or "--workers 1" not in cmdline:
            raise RuntimeError("PID 1 no corresponde al Uvicorn de un worker esperado.")
        healthcheck = image_info["Config"]["Healthcheck"]["Test"]
        if healthcheck[0] != "CMD":
            raise RuntimeError("La imagen no contiene el health check ejecutable esperado.")
        command([docker, "exec", cid, *healthcheck[1:]])
        command([docker, "stop", "--time", "10", cid])
        exit_code = int(command([docker, "inspect", "--format", "{{.State.ExitCode}}", cid]).stdout)
        logs = command([docker, "logs", cid])
        verificar_apagado(exit_code, logs.stdout + logs.stderr)
        manifest["shutdown"] = {"signal": "SIGTERM", "exit_code": exit_code}
        manifest["status"] = "passed"
        print("Imagen y smoke aprobados; no se publicó ningún servicio.", flush=True)
        return 0
    except KeyboardInterrupt:
        manifest["status"] = "interrupted"
        return 130
    except Exception as error:
        manifest["status"], manifest["error"] = "failed", str(error)
        print(str(error), file=sys.stderr)
        return 1
    finally:
        if cid:
            try:
                command([docker, "logs", cid], check=False)
                command([docker, "rm", "--force", cid], check=False)
            except (OSError, subprocess.SubprocessError) as error:
                manifest["cleanup_error"] = str(error)
        manifest["source_commit"] = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True
        ).stdout.strip()
        manifest["source_dirty"] = bool(
            subprocess.run(
                ["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True
            ).stdout.strip()
        )
        manifest["sha256"] = {
            nombre: hashlib.sha256((ROOT / nombre).read_bytes()).hexdigest()
            for nombre in ("Dockerfile", "requirements.txt", "frontend/package-lock.json")
        }
        (output / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
        )
        print("Evidencia:", output / "manifest.json", flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
