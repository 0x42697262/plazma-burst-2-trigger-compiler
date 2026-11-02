import { CURRENT_SEGMENT, PARENT_SEGMENT, PATH_SEPARATOR } from './keys.ts';

const segmentsOf = (file: string): string[] => file.split(PATH_SEPARATOR);

export const directoryOf = (file: string): string => {
  const segments = segmentsOf(file);
  segments.pop();
  return segments.join(PATH_SEPARATOR);
};

export function resolvePath(directory: string, relative: string): string {
  const base = relative.startsWith(PATH_SEPARATOR) ? [] : segmentsOf(directory);
  const result: string[] = [];
  for (const segment of [...base, ...segmentsOf(relative)]) {
    if (segment === CURRENT_SEGMENT || (segment === '' && result.length > 0)) continue;
    if (segment === PARENT_SEGMENT && result.length > 0 && result[result.length - 1] !== PARENT_SEGMENT && result[result.length - 1] !== '') result.pop();
    else result.push(segment);
  }
  return result.join(PATH_SEPARATOR);
}

export function relativePath(fromDirectory: string, to: string): string {
  const from = segmentsOf(fromDirectory).filter((segment) => segment !== '');
  const target = segmentsOf(to).filter((segment) => segment !== '');
  let shared = 0;
  while (shared < from.length && shared < target.length && from[shared] === target[shared]) shared += 1;
  return [...from.slice(shared).map(() => PARENT_SEGMENT), ...target.slice(shared)].join(PATH_SEPARATOR);
}
