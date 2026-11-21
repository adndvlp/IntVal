// QA del diseño actual; las capturas candidatas no reemplazan referencias aprobadas.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const result = spawnSync(
  resolve('../.venv/bin/python'),
  [resolve('../qa_ui5.py')],
  { stdio: 'inherit', env: process.env },
);
process.exit(result.status ?? 1);
