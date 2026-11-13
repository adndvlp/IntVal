"""F2-R07: el script público conserva la CLI desde otro directorio."""

from pathlib import Path
import subprocess
import sys


def test_script_heredado_acepta_help_desde_otro_directorio(tmp_path):
    script = Path('motor_valoracion.py').resolve()
    proceso = subprocess.run(
        [sys.executable, str(script), '--help'], cwd=tmp_path,
        text=True, capture_output=True, timeout=20,
    )
    assert proceso.returncode == 0, proceso.stderr
    assert '--mercado' in proceso.stdout
    assert '--ticker' in proceso.stdout
    assert '--output' in proceso.stdout
