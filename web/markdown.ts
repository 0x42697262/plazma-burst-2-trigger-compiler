import { HTML_ESCAPES, MARKDOWN } from './keys.ts';
import { TEXT } from './text.ts';

const escapeHtml = (text: string): string => HTML_ESCAPES.reduce((result, [raw, escaped]) => result.split(raw).join(escaped), text);

export const renderMarkdown = (markdown: string): string => escapeHtml(markdown)
  .replace(MARKDOWN.codeBlock, (_, code: string) => TEXT.html.pre(code))
  .replace(MARKDOWN.code, (_, code: string) => TEXT.html.code(code))
  .replace(MARKDOWN.bold, (_, text: string) => TEXT.html.bold(text))
  .replace(MARKDOWN.newline, TEXT.html.lineBreak);
