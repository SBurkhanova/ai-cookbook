import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createApp } from './app.js';
import { initStore } from './store/recipeStore.js';
import { initCache } from './services/cache.js';

const PORT = process.env.PORT || 4000;

// Open the app in the browser once the server is listening (dev convenience).
// Skipped when NO_OPEN=1 (Docker/CI); never crashes the server if open-cli is absent.
function openBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  try {
    spawn('open-cli', [url], { stdio: 'ignore', shell: true, detached: true }).unref();
  } catch { /* dev convenience only */ }
}

const storeKind = await initStore();
const cacheKind = await initCache();
const app = createApp();
app.listen(PORT, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? 'LIVE (Claude)' : 'DEMO (no API key)';
  console.log(`AI Cookbook (Hard) API at http://localhost:${PORT} — ${mode}, store: ${storeKind}, cache: ${cacheKind}`);
  openBrowser(`http://localhost:${PORT}`);
});
