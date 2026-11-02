import type { Instruction } from '../compiler/ir.ts';
import type { MachineItem } from '../compiler/lower.ts';
import { layout } from '../compiler/layout.ts';
import type { LayoutResult } from '../compiler/layout.ts';
import type { Names } from '../compiler/names.ts';
import type { Trigger } from '../program/types.ts';
import type { PcodeObfuscation, PcodeResult } from '../pcode/pcode.ts';
import { encodeTexts } from './texts.ts';
import type { EncodedText } from './texts.ts';
import { buildInit, initCall, initLabel, planCheck, variablesOf } from './init.ts';
import type { CheckPlan, Variables } from './init.ts';
import { createRandom } from './random.ts';
import { finishFlow, flowControl, groupIntoSelectors, insertPredicates, insertRunChecks } from './flow.ts';
import type { FlowContext } from './flow.ts';
import { OBFUSCATION_LABEL } from './keys.ts';

export type Obfuscation = { seed: string };

export type ObfuscatedLayout = LayoutResult & { machineUids: Set<string> };

const PURPOSE = Object.freeze({ texts: 'texts', predicates: 'predicates', groups: 'groups', run: 'run', flow: 'flow', pcode: 'pcode' });

export type Obfuscator = {
  variables: Variables;
  mapDependent: readonly string[];
  prepare: (instructions: readonly Instruction[], entries: ReadonlySet<string>, callInit: boolean) => Instruction[];
  texts: () => readonly EncodedText[];
  layout: (items: readonly MachineItem[]) => ObfuscatedLayout;
  pcode: () => PcodeObfuscation;
  finishPcode: (pcode: PcodeResult) => Trigger[];
};

export function createObfuscator(names: Names, options: Obfuscation, hostNames: readonly string[]): Obfuscator {
  const random = (purpose: string) => createRandom(options.seed, purpose);
  const variables = variablesOf(names);
  const init = initLabel(names);
  const initUid = names.triggerUid(init);
  let plan: CheckPlan = planCheck([], random(PURPOSE.texts));
  const context = (purpose: string, dispatchUid: string): FlowContext => ({ names, random: random(purpose), vars: variables, check: plan.expected, dispatchUid });
  return {
    variables,
    mapDependent: [variables.base, variables.last, variables.state],
    prepare: (instructions, entries, callInit) => {
      const encoded = encodeTexts(instructions, names, hostNames);
      plan = planCheck(encoded.texts, random(PURPOSE.texts));
      if (!callInit) return encoded.instructions;
      return encoded.instructions.flatMap((instruction) =>
        (instruction.kind === 'label' && entries.has(instruction.label) ? [instruction, ...initCall(initUid, variables.failed)] : [instruction]));
    },
    texts: () => plan.texts,
    layout: (items) => {
      const dispatchUid = names.triggerUid(names.freshLabel(OBFUSCATION_LABEL.dispatch));
      const predicated = insertPredicates(items, context(PURPOSE.predicates, dispatchUid));
      const grouped = groupIntoSelectors(predicated, context(PURPOSE.groups, dispatchUid));
      const checked = insertRunChecks(grouped.items, grouped.groupLabels, context(PURPOSE.run, dispatchUid));
      const flowContext = context(PURPOSE.flow, dispatchUid);
      const laid = layout(checked, names, flowControl(flowContext));
      const flow = finishFlow(laid, flowContext);
      const first = flow.region[0]?.uid ?? dispatchUid;
      const last = flow.region.at(-1)?.uid ?? dispatchUid;
      const built = buildInit(names, init, plan, { first, last, size: flow.region.length });
      return {
        ...laid,
        triggers: [...built.triggers, flow.dispatcher, ...flow.region],
        machineUids: new Set([...built.triggers.map((trigger) => trigger.uid), flow.dispatcher.uid]),
      };
    },
    pcode: () => {
      const shuffler = random(PURPOSE.pcode);
      return { initUid, check: variables.check, base: variables.base, size: variables.size, failed: variables.failed, expected: plan.expected, shuffle: shuffler.shuffle };
    },
    finishPcode: (pcode) => {
      const first = pcode.handlerUids[0] ?? pcode.baseUid;
      const last = pcode.handlerUids.at(-1) ?? pcode.baseUid;
      return buildInit(names, init, plan, { first, last, size: pcode.handlerUids.length }).triggers;
    },
  };
}
