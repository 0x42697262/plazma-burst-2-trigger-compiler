import { DECIMAL_NUMBER_LIKE, RADIX_NUMBER_LIKE } from './keys.ts';

export const editorTurnsIntoNumber = (text: string): boolean =>
  (DECIMAL_NUMBER_LIKE.test(text) || RADIX_NUMBER_LIKE.test(text)) && String(Number(text)) !== text;
