import { defineConfig, type Plugin } from 'vite';

/**
 * Serves the backend API (/api/*) from the same dev server as the page, so `npm run dev` is the
 * whole thing: one process, one port, no CORS. It loads the real backend code, so editing the
 * engine, service or server restarts the API (open games are cleared when that happens).
 * The standalone server (`npm run api`) runs the same code.
 */
function backendApi(): Plugin {
  return {
    name: 'diwhy-api',
    configureServer(server) {
      let listener: Promise<(req: any, res: any) => Promise<void>> | null = null;

      const load = async () => {
        const { createApp, appOptionsFromEnv } = await server.ssrLoadModule('/src/server/app.ts');
        const { nodeListener } = await server.ssrLoadModule('/src/server/node.ts');
        return nodeListener(createApp(appOptionsFromEnv(process.env)).handler);
      };

      server.watcher.on('change', (file) => {
        if (/\/src\/(server|service|engine|data|directors)\//.test(file)) listener = null;
      });

      server.middlewares.use('/api', async (req, res) => {
        listener ??= load();
        await (await listener)(req, res);
      });
    },
  };
}

export default defineConfig({ plugins: [backendApi()] });
