import { TRAILING_LINE_END, UID_ATTRIBUTE, XML_LINE_END } from './keys.ts';
import { TEXT } from './text.ts';
import { EmitError } from './check.ts';

const uidsIn = (xml: string): Set<string> => new Set([...xml.matchAll(UID_ATTRIBUTE)].map((match) => match[1] ?? ''));

export function appendToMap(mapXml: string, compiledXml: string): string {
  const existing = uidsIn(mapXml);
  const clash = [...uidsIn(compiledXml)].find((uid) => existing.has(uid));
  if (clash !== undefined) throw new EmitError(TEXT.uidInMap(clash));
  return mapXml.replace(TRAILING_LINE_END, '') + XML_LINE_END + compiledXml;
}
