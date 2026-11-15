// A small local language model (Qwen3 8B, through Ollama) that writes the texts on the player's
// phone. It is a writer, never a rule maker: it never touches the game state, its answer is forced
// into a JSON shape, and phone.ts checks every word that comes back. If the model is not running,
// is slow, or answers with nonsense, `chat` returns null and the game carries on with its own lines.

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

export interface PhoneModelOptions {
  /** Ollama's address, e.g. http://127.0.0.1:11434 */
  url: string;
  model?: string; // default qwen3:8b
  timeoutMs?: number; // default 12000
  fetch?: FetchFn;
}

export const DEFAULT_PHONE_URL = 'http://127.0.0.1:11434';
export const DEFAULT_PHONE_MODEL = 'qwen3:8b';

export class PhoneModel {
  readonly model: string;
  /** The last thing that went wrong, for the server log and tests. */
  lastError?: string;
  private url: string;
  private timeoutMs: number;
  private fetchFn: FetchFn;
  private warned = false;

  constructor(opts: PhoneModelOptions) {
    this.url = opts.url.replace(/\/+$/, '');
    this.model = opts.model ?? DEFAULT_PHONE_MODEL;
    this.timeoutMs = opts.timeoutMs ?? 12_000;
    this.fetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
  }

  /** Ask for one JSON answer matching `schema`. null on any failure. */
  async chat(system: string, user: string, schema: object, seed: number): Promise<unknown | null> {
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The abort stops a real request; the race makes sure a fetch that ignores it can't hang the phone.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctl.abort();
        reject(new Error(`no answer within ${this.timeoutMs} ms`));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([this.ask(system, user, schema, seed, ctl.signal), timeout]);
    } catch (err) {
      this.lastError = ctl.signal.aborted ? `no answer within ${this.timeoutMs} ms` : err instanceof Error ? err.message : String(err);
      if (!this.warned) {
        this.warned = true; // say it once, so a switched-off model does not flood the log
        console.warn(`DIWhy phone: using the built-in texts (${this.lastError}). Start it with: ollama serve (model ${this.model})`);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async ask(system: string, user: string, schema: object, seed: number, signal: AbortSignal): Promise<unknown> {
    const res = await this.fetchFn(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        stream: false,
        think: false, // Qwen3 would otherwise spend its time reasoning before it answers
        format: schema,
        keep_alive: '30m', // keep the model loaded between texts
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // A seed from the game makes a replay write nearly the same texts.
        options: { temperature: 0.8, top_p: 0.9, num_predict: 260, seed: seed >>> 0 },
      }),
    });
    if (!res.ok) throw new Error(`the model server answered ${res.status}`);
    const body = (await res.json()) as { message?: { content?: unknown } };
    const content = body.message?.content;
    if (typeof content !== 'string') throw new Error('the model server sent no message');
    // Some builds still wrap an answer in <think> tags; drop them before parsing.
    return JSON.parse(content.replace(/<think>[\s\S]*?<\/think>/g, '').trim());
  }
}
