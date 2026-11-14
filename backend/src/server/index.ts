// The API on its own. Start with `npm run api`. Use this when a front end runs somewhere else.
//
//   PORT         default 3001
//   HOST         default 127.0.0.1 (set 0.0.0.0 to accept connections from other machines)
//   CORS_ORIGIN  e.g. "*" or "http://localhost:3000". Needed when a front end on another origin calls this.
//   JEV_URL      the Jev model server's /v1/systemone URL. Set to "" to disable the jev director.
//   EVENTS_DIR   where the team's event CSVs are (default: ../events from where you start it)

import { appOptionsFromEnv, createApp } from './app';
import { listen } from './listen';

listen(createApp(appOptionsFromEnv(process.env)).handler, 'DIWhy API (try /api/health)');
