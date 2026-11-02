export type Action = { opcode: number; targetA: string; targetB: string };

export type Trigger = { uid: string; enabled: boolean; maxCalls: number; actions: readonly Action[] };

export type StartTimer = { uid: string; target: string };

export type Program = { triggers: readonly Trigger[]; startTimer: StartTimer | null };
