export type Action = { opcode: number; targetA: string; targetB: string };

export type Trigger = { uid: string; enabled: boolean; maxCalls: number; actions: readonly Action[] };

export type Timer = { uid: string; target: string; enabled: boolean; maxCalls: number; delay: number };

export type Program = { triggers: readonly Trigger[]; timers: readonly Timer[] };
