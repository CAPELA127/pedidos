import fs from 'fs';
const txt = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
export const env = {};
for (const line of txt.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i === -1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}
