import fs from 'node:fs';
import path from 'node:path';
import { prefixFromFile } from '../cli/main.ts';
import { checkConversion } from './check.ts';
import { convertMap } from './convert.ts';
import type { Style } from './convert.ts';
import type { Report } from './compare.ts';
import { DEFAULT_OUT, FILE_ENCODING, FLAG, FLAG_START, SOURCE_EXTENSION, STYLE, VALUE_FLAGS, XML_EXTENSION } from './keys.ts';
import { EXIT_FAILURE, SHOWN_DIFFERENCES } from './constants.ts';
import { TEXT } from './text.ts';

export type Output = { out: (line: string) => void; err: (line: string) => void };
type Options = { file: string; out: string; prefix: string | null; style: Style; check: boolean };

class UsageError extends Error {}

function parseArguments(argv: readonly string[]): Options | null {
  let file: string | null = null;
  const values = new Map<string, string>();
  const switches = new Set<string>();
  for (let position = 0; position < argv.length; position++) {
    const argument = argv[position] ?? '';
    if (argument === FLAG.help) return null;
    if (VALUE_FLAGS.has(argument)) {
      const value = argv[position + 1];
      if (value === undefined) throw new UsageError(TEXT.missingValue(argument));
      values.set(argument, value);
      position++;
    } else if (argument === FLAG.raw || argument === FLAG.check) {
      switches.add(argument);
    } else if (argument.startsWith(FLAG_START)) {
      throw new UsageError(TEXT.unknownFlag(argument));
    } else {
      file = argument;
    }
  }
  if (file === null) throw new UsageError(TEXT.missingFile);
  return { file, out: values.get(FLAG.out) ?? DEFAULT_OUT, prefix: values.get(FLAG.prefix) ?? null, style: switches.has(FLAG.raw) ? STYLE.raw : STYLE.functions, check: switches.has(FLAG.check) };
}

export function reportLines(report: Report): string[] {
  if (report.compileError !== null) return [TEXT.report.compileFailed(report.compileError)];
  const expected = [...report.expected.values()].reduce((sum, count) => sum + count, 0);
  const lines = [TEXT.report.summary(report.matching, report.compared, expected, report.unexpected.length)];
  for (const [reason, count] of report.expected) lines.push(TEXT.report.expected(reason, count));
  for (const difference of report.unexpected.slice(0, SHOWN_DIFFERENCES)) lines.push(TEXT.report.unexpected(difference));
  if (report.unexpected.length > SHOWN_DIFFERENCES) lines.push(TEXT.report.more(report.unexpected.length - SHOWN_DIFFERENCES));
  return lines;
}

export const reportPassed = (report: Report): boolean => report.compileError === null && report.unexpected.length === 0;

export function main(argv: readonly string[], output: Output): number {
  let options: Options | null;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    output.err(TEXT.error(error.message));
    return EXIT_FAILURE;
  }
  if (options === null) {
    output.out(TEXT.usage);
    return 0;
  }
  let xml: string;
  try {
    xml = fs.readFileSync(options.file, FILE_ENCODING);
  } catch (error) {
    output.err(TEXT.error(error instanceof Error ? error.message : String(error)));
    return EXIT_FAILURE;
  }
  const label = path.basename(options.file);
  const conversion = convertMap(xml, { style: options.style, label });
  fs.mkdirSync(options.out, { recursive: true });
  const target = path.join(options.out, path.basename(options.file).replace(XML_EXTENSION, '') + SOURCE_EXTENSION);
  fs.writeFileSync(target, conversion.source);
  output.out(TEXT.wrote(target));
  for (const note of conversion.notes) output.out(TEXT.note(note));
  if (!options.check) return 0;
  const { report } = checkConversion(conversion, options.prefix ?? prefixFromFile(target));
  for (const line of reportLines(report)) output.out(line);
  const passed = reportPassed(report);
  output.out(passed ? TEXT.report.passed : TEXT.report.failed);
  return passed ? 0 : EXIT_FAILURE;
}
