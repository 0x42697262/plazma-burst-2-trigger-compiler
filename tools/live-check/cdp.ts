import { METHOD, TARGETS_URL } from './keys.ts';
import { POLL_MILLISECONDS, SOCKET_OPEN } from './constants.ts';
import { TEXT } from './text.ts';

type Target = { type: string; url: string; webSocketDebuggerUrl: string };
type Reply = { id?: number; result?: { result?: { value?: unknown } } };

export const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function listTargets(port: number): Promise<Target[]> {
  try {
    const response = await fetch(TARGETS_URL(port));
    return (await response.json()) as Target[];
  } catch {
    return [];
  }
}

export async function waitFor<Result>(check: () => Promise<Result | null | false>, timeout: number, what: string): Promise<Result> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await check();
    if (result !== null && result !== false) return result;
    await sleep(POLL_MILLISECONDS);
  }
  throw new Error(TEXT.timeout(what));
}

export class Session {
  private readonly socket: WebSocket;
  private readonly pending = new Map<number, (reply: Reply) => void>();
  private counter = 0;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (event: MessageEvent<string>) => {
      const reply = JSON.parse(event.data) as Reply;
      const resolve = reply.id === undefined ? undefined : this.pending.get(reply.id);
      if (resolve && reply.id !== undefined) {
        this.pending.delete(reply.id);
        resolve(reply);
      }
    });
    socket.addEventListener('close', () => {
      for (const resolve of this.pending.values()) resolve({});
      this.pending.clear();
    });
  }

  static async open(target: Target): Promise<Session> {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve());
      socket.addEventListener('error', () => reject(new Error(target.url)));
    });
    return new Session(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<Reply> {
    if (this.socket.readyState !== SOCKET_OPEN) return Promise.resolve({});
    this.counter += 1;
    const id = this.counter;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const reply = await this.send(METHOD.evaluate, { expression, awaitPromise: true, returnByValue: true });
    return reply.result?.result?.value;
  }

  close(): void {
    this.socket.close();
  }
}
