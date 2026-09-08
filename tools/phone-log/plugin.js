import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Консоль настоящего телефона в терминал: Web Inspector требует кабеля и
// пляски с меню «Разработка», а тут страница сама шлёт ошибки и состояние
// сцен на dev-сервер. Живёт только в `serve`, в сборку не попадает.
const ENDPOINT = '/__phone-log';
const MAX_BODY = 1024 * 1024;

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

// В терминал — только то, что требует внимания; полный поток лежит в файле.
const LOUD = /^(error|rejection|console\.error|webglcontext(lost|creationerror))$/;

export default function phoneLog({ logDir } = {}) {
  const dir = logDir || path.join(os.tmpdir(), 'vite-phone-log');
  const clientFile = fileURLToPath(new URL('./client.js', import.meta.url));

  return {
    name: 'phone-log',
    apply: 'serve',

    configureServer(server) {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.ndjson`);
      server.config.logger.info(`  \x1b[33m➜\x1b[0m  \x1b[1mphone log:\x1b[0m ${file}`);

      server.middlewares.use(async (req, res, next) => {
        if ((req.url || '').split('?')[0] !== ENDPOINT || req.method !== 'POST') return next();

        try {
          const { ua, events } = JSON.parse(await readBody(req));
          const device = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : 'desktop';

          for (const e of events) {
            fs.appendFileSync(file, `${JSON.stringify({ device, ...e })}\n`);
            if (!LOUD.test(e.kind)) continue;
            server.config.logger.error(
              `\x1b[31m[phone:${device}]\x1b[0m ${e.kind} · ${JSON.stringify(e.data).slice(0, 200)}`,
            );
          }

          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
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
