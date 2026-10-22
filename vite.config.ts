import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

const SHIP_DIR = fileURLToPath(new URL('./src/ship3d', import.meta.url));

const PUBLIC_SHIP = fileURLToPath(new URL('./public/ship', import.meta.url));

/** Dev only: lets editor.html read and write what it edits: the ship's plan (`ship.json`, `variants/*.json`), `materials.json`, `prefabs.json` and the detail textures in `public/ship`. Nothing in the build. */
function shipEditor(): Plugin
{
  let savedAt = 0;
  const NAME = /^[a-z0-9_-]{1,40}$/;
  /** The file `kind` / `name` stands for, or null when it is not one the editor may touch. */
  const fileOf = (kind: string | null, name: string | null) =>
  {
    if (kind === 'materials') return `${SHIP_DIR}/materials.json`;
    if (kind === 'prefabs') return `${SHIP_DIR}/prefabs.json`;
    if (kind && kind !== 'plans') return null;
    return name && NAME.test(name) ? (name === 'ship' ? `${SHIP_DIR}/ship.json` : `${SHIP_DIR}/variants/${name}.json`) : null;
  };
  const valid: Record<string, (d: Record<string, unknown>) => boolean> = {
    plans: d => Array.isArray(d.rooms) && Array.isArray(d.props),
    materials: d => Array.isArray(d.materials) && Array.isArray(d.textures),
    prefabs: d => Array.isArray(d.prefabs),
  };

  return {
    name: 'ship-editor',
    apply: 'serve',
    configureServer(server)
    {
      const q = (req: { url?: string }) => new URL(req.url ?? '', 'http://x').searchParams;
      server.middlewares.use('/__ship/list', (_req, res) =>
      {
        const dir = `${SHIP_DIR}/variants`;
        const variants = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : [];
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(['ship', ...variants]));
      });
      server.middlewares.use('/__ship/load', (req, res) =>
      {
        const file = fileOf(q(req).get('kind'), q(req).get('name'));
        if (!file || !existsSync(file)) { res.statusCode = 404; res.end('no such file'); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(readFileSync(file, 'utf8'));
      });
      server.middlewares.use('/__ship/save', (req, res) =>
      {
        const kind = q(req).get('kind') ?? 'plans';
        const file = fileOf(kind, q(req).get('name'));
        if (req.method !== 'POST' || !file) { res.statusCode = 400; res.end('bad request'); return; }
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () =>
        {
          try
          {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!valid[kind]?.(data)) throw new Error(`not a ${kind} file`);
            mkdirSync(`${SHIP_DIR}/variants`, { recursive: true });
            savedAt = Date.now();
            writeFileSync(file, JSON.stringify(data, null, 1));
            res.end('ok');
          }
          catch (e)
          {
            res.statusCode = 400;
            res.end(String(e));
          }
        });
      });
      // the detail textures: which there are and how big, and a new one (a 512x512 PNG)
      server.middlewares.use('/__ship/textures', (_req, res) =>
      {
        const list = existsSync(PUBLIC_SHIP)
          ? readdirSync(PUBLIC_SHIP).filter(f => f.endsWith('.png')).map(f => ({ name: f.slice(0, -4), bytes: statSync(`${PUBLIC_SHIP}/${f}`).size }))
          : [];
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(list));
      });
      server.middlewares.use('/__ship/texture', (req, res) =>
      {
        const name = q(req).get('name');
        if (req.method !== 'POST' || !name || !NAME.test(name)) { res.statusCode = 400; res.end('bad request'); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', c => { size += c.length; if (size <= 2 * 1024 * 1024) chunks.push(c); });
        req.on('end', () =>
        {
          const png = Buffer.concat(chunks);
          const isPng = png.length > 33 && png.readUInt32BE(0) === 0x89504e47 && png.readUInt32BE(4) === 0x0d0a1a0a;
          if (size > 2 * 1024 * 1024 || !isPng || png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512)
          {
            res.statusCode = 400;
            res.end('a 512x512 PNG of at most 2 MB is needed');
            return;
          }
          mkdirSync(PUBLIC_SHIP, { recursive: true });
          writeFileSync(`${PUBLIC_SHIP}/${name}.png`, png);
          res.end('ok');
        });
      });
    },
    // the editor already holds what it wrote: do not reload its page (and lose its undo) because the file changed
    handleHotUpdate({ file })
    {
      if (file.startsWith(SHIP_DIR) && file.endsWith('.json') && Date.now() - savedAt < 3000) return [];
    },
  };
}

export default defineConfig({
  plugins: [
    shipEditor(),
    vue({
      script: {
        defineModel: true
      }
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/assets/styles/shared/vars.scss" as *;
          @use "@/assets/styles/shared/mixins.scss" as *;
        `
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      },
      preserveSymlinks: true,
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
