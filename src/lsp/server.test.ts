import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ptc-test-'));
const file = path.join(folder, 'main.ptc');
const SOURCE = 'var score = 0;\nfunction add(points) { score += points; }\non start {\n  add(1);\n  missing = 2;\n}\n';
fs.writeFileSync(file, SOURCE);
const uri = pathToFileURL(file).href;

const server = spawn(process.execPath, [path.resolve(import.meta.dirname, 'server.ts'), '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });
after(() => {
  server.kill();
  fs.rmSync(folder, { recursive: true, force: true });
});

let buffer = Buffer.alloc(0);
const waiting = new Map<number, (result: unknown) => void>();
const notifications: { method: string; params: unknown }[] = [];
server.stdout.on('data', (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const length = Number(/Content-Length: (\d+)/.exec(buffer.subarray(0, headerEnd).toString())?.[1]);
    if (buffer.length < headerEnd + 4 + length) return;
    const message = JSON.parse(buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString());
    buffer = buffer.subarray(headerEnd + 4 + length);
    if (message.id !== undefined && waiting.has(message.id)) {
      waiting.get(message.id)?.(message.result);
      waiting.delete(message.id);
    } else if (message.method) {
      notifications.push(message);
    }
  }
});

const send = (message: object): void => {
  const body = JSON.stringify({ jsonrpc: '2.0', ...message });
  server.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
};
let counter = 0;
const request = (method: string, params: object): Promise<any> => new Promise((resolve) => {
  counter += 1;
  waiting.set(counter, resolve);
  send({ id: counter, method, params });
});
const waitFor = async (check: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100 && !check(); attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
};

describe('language server over stdio', () => {
  it('answers like an editor expects', async () => {
    const initialized = await request('initialize', { processId: null, rootUri: null, capabilities: {} });
    assert.equal(initialized.capabilities.hoverProvider, true);
    send({ method: 'initialized', params: {} });
    send({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'ptc', version: 1, text: SOURCE } } });
    await waitFor(() => notifications.some((entry) => entry.method === 'textDocument/publishDiagnostics'));
    const published = notifications.find((entry) => entry.method === 'textDocument/publishDiagnostics')?.params as any;
    assert.equal(published.diagnostics[0].message, 'unknown variable "missing"');
    assert.equal(published.diagnostics[0].range.start.line, 4);

    const hovered = await request('textDocument/hover', { textDocument: { uri }, position: { line: 3, character: 3 } });
    assert.match(hovered.contents.value, /function add\(points\)/);

    const completed = await request('textDocument/completion', { textDocument: { uri }, position: { line: 3, character: 2 } });
    assert.ok(completed.some((item: any) => item.label === 'score'));

    const found = await request('textDocument/definition', { textDocument: { uri }, position: { line: 3, character: 3 } });
    assert.deepEqual(found.range.start, { line: 1, character: 9 });

    const used = await request('textDocument/references', { textDocument: { uri }, position: { line: 0, character: 5 }, context: { includeDeclaration: true } });
    assert.deepEqual(used.map((entry: any) => [entry.range.start.line, entry.range.start.character, entry.range.end.character]), [[0, 4, 9], [1, 23, 28]]);
  });
});
