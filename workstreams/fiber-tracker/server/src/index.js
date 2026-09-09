import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { SqliteStatusStore } from './store.js';
import { csvSource } from '@one-stop/shared/ingest/sources';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = Number(process.env.PORT) || 5174;

const store = new SqliteStatusStore(
  process.env.ONE_STOP_DB || path.join(REPO, 'server', 'data', 'one-stop.db'),
);

const source = csvSource({
  csvPath: path.join(REPO, 'data', 'raw', 'MMR_Cutsheet.csv'),
  colorsPath: path.join(REPO, 'data', 'generated', 'mmr_cell_colors.json'),
});

const app = createApp({ store, source });

const server = app.listen(PORT, () => {
  console.log(`one-stop api on http://localhost:${PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
