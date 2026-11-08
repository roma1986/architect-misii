// Читання даних у Node.js для інструментів (montecarlo, check-data, build-single).
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_FILES } from '../js/data.js';

export async function loadDataNode(dir) {
  const out = {};
  for (const name of DATA_FILES) out[name] = JSON.parse(await fs.readFile(path.join(dir, `${name}.json`), 'utf8'));
  return out;
}
