export const TEXT = Object.freeze({
  pcode: '--tamper-check works only with --target triggers: the p-code target runs every handler from one dispatch trigger, so its jumps cannot carry a flow token.',
  badMode: (mode: string): string => `Unknown --tamper-check mode "${mode}"; use off, report or enforce.`,
  badLayer: (layer: string): string => `Unknown --tamper-layers entry "${layer}"; use flow, entry, value and watchdog, separated by commas.`,
  protectedArray: (name: string): string => `protected works only on single values, not on the array ${name}.`,
  protectedExport: (name: string): string => `${name} cannot be protected and exported: the host map writes exported values, so the check could not follow them.`,
  protectedSync: (name: string): string => `${name} is protected and cannot be synced: other players' games write synced values, so the check could not follow them.`,
  protectedAction: (name: string): string => `${name} is protected and cannot be passed to action(): the action could write it without the check.`,
  protectedMap: (name: string): string => `${name} is protected and cannot be used in a map block trigger: it would run without the check.`,
  protectedUnchecked: (name: string): string => `${name} is protected, but --tamper-check is off (or its value layer is), so nothing checks it.`,
  tamperUnused: 'on tamper { } runs only with --tamper-check report or enforce; it is left out.',
  waitInTamper: 'wait() does not work in on tamper { }: enforce turns the program off right after the block.',
});
