"""QA de UI-5 en un comando; conserva evidencia, sin aprobar baselines ni publicar."""

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
REQUIRED_PROJECTS = {
    "desktop",
    "mobile",
    "firefox-desktop",
    "firefox-mobile",
    "webkit-desktop",
    "webkit-mobile",
}
REQUIRED_UI5 = ("UI5 · diseño integrado", "UI5 · seis paletas", "UI5 · gráficas")


def validate_report(report, required_projects=REQUIRED_PROJECTS):
    errors = []
    stats = report.get("stats", {})
    if not stats.get("expected") or stats.get("unexpected") or stats.get("flaky"):
        errors.append("Hay pruebas fallidas, inestables o ninguna prueba aprobada.")
    if report.get("errors"):
        errors.append("Playwright informa errores generales.")
    projects, ui5 = set(), {}

    def visit(suite):
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                if (
                    test.get("status") != "expected"
                    or test.get("expectedStatus", "passed") != "passed"
                ):
                    continue
                project = test.get("projectName")
                projects.add(project)
                for prefix in REQUIRED_UI5:
                    if spec.get("title", "").startswith(prefix):
                        ui5.setdefault(project, set()).add(prefix)
        for child in suite.get("suites", []):
            visit(child)

    for suite in report.get("suites", []):
        visit(suite)
    if not required_projects <= projects:
        errors.append("Falta un proyecto de la matriz Chromium/Firefox/WebKit, escritorio/móvil.")
    if any(
        set(REQUIRED_UI5) - ui5.get(p, set()) for p in required_projects if not p.endswith("mobile")
    ):
        errors.append("Falta la matriz UI5 en uno de los tres motores.")
    return errors


def combine_reports(reports):
    return {
        "stats": {
            key: sum(r.get("stats", {}).get(key, 0) for r in reports)
            for key in ["expected", "unexpected", "flaky", "skipped", "duration"]
        },
        "suites": [suite for report in reports for suite in report.get("suites", [])],
        "errors": [error for report in reports for error in report.get("errors", [])],
    }


def browser_environment(node, original=None):
    env = dict(os.environ if original is None else original)
    env["PATH"] = str(Path(node).parent) + os.pathsep + env.get("PATH", "")
    env["ASTRO_TELEMETRY_DISABLED"] = "1"
    env["PLAYWRIGHT_HTML_OPEN"] = "never"
    env.pop("PLAYWRIGHT_CHANNEL", None)
    env.pop("F10_VISUAL", None)
    return env


def tree_hash(directory):
    digest = hashlib.sha256()
    for path in sorted(p for p in directory.rglob("*") if p.is_file()):
        digest.update(path.relative_to(directory).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def find_node(prepare=False):
    expected = (FRONTEND / ".node-version").read_text().strip().lstrip("v")
    local = ROOT / "temp/ui5-runtime"
    prepared = local / "node_modules/node/bin/node"
    candidates = [prepared, Path("/tmp/valoracion-f6-node/node_modules/node/bin/node")]
    if found := shutil.which("node"):
        candidates.append(Path(found))
    for candidate in candidates:
        if candidate.is_file():
            version = subprocess.check_output([str(candidate), "--version"], text=True).strip()
            if version.lstrip("v") == expected:
                return candidate.resolve(), version
    if prepare and (npm := shutil.which("npm")):
        print(
            f"Preparando Node {expected} en temp/ui5-runtime; sin cambiar Node global.", flush=True
        )
        subprocess.check_call(
            [
                npm,
                "install",
                "--prefix",
                str(local),
                "--no-audit",
                "--no-fund",
                "--save-exact",
                f"node@{expected}",
            ]
        )
        version = subprocess.check_output([str(prepared), "--version"], text=True).strip()
        if version.lstrip("v") == expected:
            return prepared.resolve(), version
    raise RuntimeError(
        f"No se encontró Node {expected}, la versión fijada en frontend/.node-version."
    )


def inspect_browsers(node, env):
    code = """
const fs = require('node:fs');
const p = require('playwright');
process.stdout.write(JSON.stringify({
  version: require('@playwright/test/package.json').version,
  engines: Object.fromEntries(['chromium', 'firefox', 'webkit'].map(k => [k, {
    executable: p[k].executablePath(), installed: fs.existsSync(p[k].executablePath())
  }]))
}));
"""
    return json.loads(
        subprocess.check_output([str(node), "-e", code], cwd=FRONTEND, env=env, text=True)
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Inspeccionar sin descargar, abrir puertos o ejecutar navegadores.",
    )
    args = parser.parse_args()
    node, version = find_node(prepare=not args.check)
    if not (ROOT / ".venv/bin/python").is_file():
        raise RuntimeError("Falta la .venv de Python del proyecto.")
    cli = FRONTEND / "node_modules/@playwright/test/cli.js"
    if not cli.is_file():
        raise RuntimeError("Faltan las dependencias fijadas del frontend.")
    env = browser_environment(node)
    browsers = inspect_browsers(node, env)
    if not all(value["installed"] for value in browsers["engines"].values()):
        # Reutilizar primero navegadores existentes; preparar sólo una caché del proyecto si faltan.
        env["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / "temp/ui5-browsers")
        browsers = inspect_browsers(node, env)
    expected = json.loads((FRONTEND / "package.json").read_text())["devDependencies"][
        "@playwright/test"
    ]
    if browsers["version"] != expected:
        raise RuntimeError("La instalación de Playwright no coincide con package.json.")
    missing = [name for name, value in browsers["engines"].items() if not value["installed"]]
    if args.check:
        print(
            json.dumps(
                {
                    "node": version,
                    "playwright": expected,
                    "browsers_missing": missing,
                    "free_gib": round(shutil.disk_usage(ROOT).free / 2**30, 2),
                },
                indent=2,
            )
        )
        return 0
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S-%fZ")
    output = ROOT / "temp/ui5-qa" / stamp
    output.mkdir(parents=True)
    manifest = {
        "schema": "intval-ui5-qa-1",
        "started_at": stamp,
        "node": version,
        "python": sys.version.split()[0],
        "playwright": expected,
        "status": "started",
        "visual_review": "pending",
        "commands": [],
    }
    report_path = output / "report.json"
    env["PLAYWRIGHT_JSON_OUTPUT_FILE"] = str(report_path)
    env["PLAYWRIGHT_HTML_REPORT"] = str(output / "html-report")
    env["UI5_QA"] = "1"

    def run(arguments):
        command = [str(node), *arguments]
        print("Ejecutando:", " ".join(command), flush=True)
        try:
            code = subprocess.call(command, cwd=FRONTEND, env=env)
        except KeyboardInterrupt:
            manifest["commands"].append({"arguments": arguments, "exit_code": 130})
            raise
        manifest["commands"].append({"arguments": arguments, "exit_code": code})
        if code:
            raise RuntimeError(f"El comando terminó con código {code}; la evidencia se conserva.")

    try:
        if missing:
            print("Preparando únicamente navegadores de QA:", ", ".join(missing), flush=True)
            run([str(cli), "install", *missing])
        reports = []
        for label, projects in [
            ("chromium", ["desktop"]),
            ("remaining", sorted(REQUIRED_PROJECTS - {"desktop"})),
        ]:
            stage = output / label
            env["PLAYWRIGHT_JSON_OUTPUT_FILE"] = str(stage / "report.json")
            env["PLAYWRIGHT_HTML_REPORT"] = str(stage / "html-report")
            try:
                run(
                    [
                        str(cli),
                        "test",
                        *[f"--project={p}" for p in projects],
                        f"--output={stage / 'test-results'}",
                        "--reporter=list,html,json",
                    ]
                )
            finally:
                if (stage / "report.json").is_file():
                    reports.append(json.loads((stage / "report.json").read_text()))
                    report_path.write_text(json.dumps(combine_reports(reports)))
            failures = validate_report(reports[-1], set(projects))
            if failures:
                raise RuntimeError(" ".join(failures))
        report = combine_reports(reports)
        failures = validate_report(report)
        manifest["stats"] = report.get("stats")
        if failures:
            raise RuntimeError(" ".join(failures))
        run(["scripts/asset-budget.mjs"])
        manifest["build_sha256"] = tree_hash(FRONTEND / "dist")
        manifest["lock_sha256"] = hashlib.sha256(
            (FRONTEND / "package-lock.json").read_bytes()
        ).hexdigest()
        manifest["captures"] = [
            str(p.relative_to(output)) for p in sorted(output.rglob("ui5-*.png"))
        ]
        manifest["measurements"] = [
            str(p.relative_to(output)) for p in sorted(output.rglob("performance.json"))
        ]
        if not manifest["captures"] or not manifest["measurements"]:
            raise RuntimeError("Faltan capturas o mediciones del build probado.")
        manifest["status"] = "automated_passed_visual_review_pending"
        print("Pruebas automáticas aprobadas. Capturas pendientes de inspección.", flush=True)
        return 0
    except KeyboardInterrupt:
        manifest["status"] = "interrupted"
        manifest["error"] = "Ejecución interrumpida; no se acredita el cierre de UI-5."
        print(manifest["error"], file=sys.stderr, flush=True)
        return 130
    except (RuntimeError, OSError, ValueError) as error:
        manifest["status"] = "failed"
        manifest["error"] = str(error)
        print(str(error), file=sys.stderr, flush=True)
        return 1
    finally:
        if report_path.is_file():
            manifest["stats"] = json.loads(report_path.read_text()).get("stats")
        manifest["finished_at"] = datetime.now(timezone.utc).isoformat()
        if (FRONTEND / "dist").is_dir():
            manifest["build_sha256"] = tree_hash(FRONTEND / "dist")
        revision = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True
        )
        manifest["source_commit"] = revision.stdout.strip() if revision.returncode == 0 else None
        dirty = subprocess.run(
            ["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True
        )
        manifest["source_dirty"] = bool(dirty.stdout.strip()) if dirty.returncode == 0 else None
        manifest["captures"] = [
            str(p.relative_to(output)) for p in sorted(output.rglob("ui5-*.png"))
        ]
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print("Evidencia:", output / "manifest.json", flush=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from None
