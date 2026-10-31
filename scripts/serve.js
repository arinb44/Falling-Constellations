// Static dev server: `bun scripts/serve.js [port]`. Serves the project root.
import { join, normalize } from 'node:path';

const root = join(import.meta.dir, '..');
const port = Number(process.env.PORT || process.argv[2] || 8000);

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = Bun.file(join(root, normalize(path).replace(/^(\.\.[/\\])+/, '')));
    return (await file.exists()) ? new Response(file) : new Response('Not found', { status: 404 });
  }
});
console.log(`Serving ${root} at http://localhost:${port}`);
