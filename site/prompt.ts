import readline from 'node:readline/promises';
import { KEY, LINE_END } from './keys.ts';
import { DATA } from './events.ts';

export class PromptCancelled extends Error {}

export type Prompter = { ask(question: string): Promise<string>; askHidden(question: string): Promise<string> };

export const hasTerminal = (): boolean => process.stdin.isTTY && process.stdout.isTTY;

async function ask(question: string): Promise<string> {
  const lines = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await lines.question(question);
  } finally {
    lines.close();
  }
}

function askHidden(question: string): Promise<string> {
  const input = process.stdin;
  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let typed = '';
    const finish = (error: Error | null): void => {
      input.off(DATA, onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write(LINE_END);
      if (error === null) resolve(typed);
      else reject(error);
    };
    function onData(chunk: string): void {
      for (const character of chunk) {
        if (character === KEY.enter || character === KEY.newline) return finish(null);
        if (character === KEY.interrupt || character === KEY.endOfText) return finish(new PromptCancelled());
        if (character === KEY.backspace || character === KEY.backspaceAlternative) typed = typed.slice(0, -1);
        else typed += character;
      }
    }
    input.on(DATA, onData);
  });
}

export const terminalPrompter: Prompter = { ask, askHidden };
