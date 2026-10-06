// Arayüzü (Vite) Docker içinde derler.
//
// Neden: Windows Smart App Control açıkken Vite'in native dosyaları (rolldown, tailwind oxide)
// engellenebiliyor. Linux container'ında bu sorun yok; çıktı yine dist/renderer'a yazılır.
// node_modules container'a özel bir Docker volume'unda tutulur, Windows'takine dokunulmaz.
import { spawnSync } from 'node:child_process';

const project = process.cwd().replaceAll('\\', '/');
const result = spawnSync(
  'docker',
  [
    'run', '--rm',
    '-v', `${project}:/app`,
    '-v', 'create-hazal-app-ui-modules:/app/node_modules',
    '-w', '/app',
    'node:24',
    'sh', '-c', 'npm install --ignore-scripts --no-audit --no-fund --loglevel=error && npx vite build',
  ],
  { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } },
);
process.exit(result.status ?? 1);
