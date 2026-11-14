// The whole game behind one handler: /api/* is the backend, everything else is the front end.

import type { Handler } from './http';

export function createSiteHandler(api: Handler, statics: Handler): Handler {
  return (req) => (new URL(req.url).pathname.startsWith('/api') ? api(req) : statics(req));
}
