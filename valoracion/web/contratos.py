"""Exportación reproducible del esquema real, independiente del entorno y CWD."""

import argparse
import json
from pathlib import Path

from .ajustes import Ajustes
from .aplicacion import create_app

DESTINO_DEFAULT = Path(__file__).resolve().parents[2] / "contracts" / "openapi.v1.json"


def contenido_openapi() -> str:
    return (
        json.dumps(create_app(Ajustes()).openapi(), ensure_ascii=False, indent=2, sort_keys=True)
        + "\n"
    )


def exportar_openapi(destino: Path = DESTINO_DEFAULT) -> None:
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(contenido_openapi(), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DESTINO_DEFAULT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        if (
            not args.output.is_file()
            or args.output.read_text(encoding="utf-8") != contenido_openapi()
        ):
            print("OpenAPI desactualizado: ejecuta python -m valoracion.web.contratos.")
            return 1
    else:
        exportar_openapi(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
