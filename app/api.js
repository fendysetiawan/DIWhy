// The front door's only contact with the backend: the list of projects, and starting a game.
// (The rules and the events live in the backend. See backend/API.md.)

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the game server. Start it with: npm run play");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data && data.error && data.error.message) || `Something went wrong (${res.status}).`);
  return data;
}

/** [{ id, title, job, blurb, fromPlan, quote: { budget, days } }] */
export const listProjects = async () => (await call("/api/projects")).projects;

/** Start a game. `owner` is the character id; `project` is a project id. */
export const createGame = (body) => call("/api/games", { method: "POST", body });
