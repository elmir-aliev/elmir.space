import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ENDPOINT = '/__design-mode';
const CLIENT_ROUTE = `${ENDPOINT}/client.js`;
const MAX_BODY = 8 * 1024 * 1024;

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export default function designMode({ dumpDir } = {}) {
  const dir = dumpDir || path.join(os.tmpdir(), 'vite-design-mode');
  const clientFile = fileURLToPath(new URL('./client.js', import.meta.url));

  return {
    name: 'design-mode',
    apply: 'serve',

    configureServer(server) {
      fs.mkdirSync(dir, { recursive: true });
      server.config.logger.info(`  \x1b[33m➜\x1b[0m  \x1b[1mdesign mode:\x1b[0m ⌘⇧D в браузере → ${dir}`);

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url || '').split('?')[0];

        if (url === CLIENT_ROUTE) {
          res.setHeader('content-type', 'application/javascript; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(fs.readFileSync(clientFile, 'utf8'));
          return;
        }

        if (url !== ENDPOINT || req.method !== 'POST') return next();

        try {
          const payload = JSON.parse(await readBody(req));
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = path.join(dir, `${stamp}-context.json`);
          fs.writeFileSync(file, JSON.stringify(payload, null, 2));

          const count = payload.selections?.length ?? 0;
          const note = (payload.requested_change || '').split('\n')[0].slice(0, 60);
          server.config.logger.info(
            `\x1b[33m[design-mode]\x1b[0m ${count} элем. → ${path.basename(file)}${note ? ` · ${note}` : ''}`,
          );

          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, file }));
        } catch (err) {
          res.statusCode = 400;
          res.end(String(err.message || err));
        }
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        {
          tag: 'script',
          children: `(function(){'use strict';\n${fs.readFileSync(clientFile, 'utf8')}\n})();`,
          injectTo: 'body',
        },
      ],
    },
  };
}
