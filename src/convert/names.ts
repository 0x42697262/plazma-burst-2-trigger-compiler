import { BUILTIN, COMPILE_TIME_BUILTIN, KEYWORDS } from '../lang/keys.ts';
import { CONSTRUCTORS } from '../objects/keys.ts';
import { VALUE_GROUP_LIST } from '../opcodes/values.ts';
import { LETTER_PREFIX, RESERVED_EXTRA, STARTS_WITH_LETTER, TRIGGER_WORD, UID_MARK, WORD_SPLIT } from './keys.ts';
import { FIRST_COPY } from './constants.ts';

const RESERVED: ReadonlySet<string> = new Set([
  ...KEYWORDS, ...Object.values(BUILTIN), ...Object.values(COMPILE_TIME_BUILTIN), ...Object.keys(CONSTRUCTORS), ...RESERVED_EXTRA, ...VALUE_GROUP_LIST.map((group) => group.name),
]);

export class Namer {
  private readonly taken = new Set<string>();

  has(name: string): boolean {
    return this.taken.has(name);
  }

  fromUid(uid: string, dropTriggerWord = false): string {
    let words = uid.replace(UID_MARK, '').split(WORD_SPLIT).filter((word) => word !== '');
    if (dropTriggerWord && words[0]?.toLowerCase() === TRIGGER_WORD && words.length > 1 && STARTS_WITH_LETTER.test(words[1] ?? '')) words = words.slice(1);
    const joined = words.map((word, index) => (index === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : word.charAt(0).toUpperCase() + word.slice(1))).join('');
    return this.claim(STARTS_WITH_LETTER.test(joined) ? joined : LETTER_PREFIX + joined);
  }

  claim(base: string): string {
    let name = base;
    for (let number = FIRST_COPY; RESERVED.has(name) || this.taken.has(name); number++) name = base + String(number);
    this.taken.add(name);
    return name;
  }
}
