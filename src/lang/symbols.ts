import type { Names } from '../compiler/names.ts';
import { ARRAY_LENGTH, ELEMENT_CLOSE, ELEMENT_OPEN, LOCAL_SEPARATOR, RETURN_NAME, SHADOW_SEPARATOR, STACK_NAME, TEMP_NAME } from './keys.ts';
import { FIRST_SHADOW } from './constants.ts';
import { VARIABLE_MARK, INTERNAL_MARK, USER_SEPARATOR } from '../compiler/keys.ts';

export type SymbolEntry =
  | { kind: 'variable'; name: string; constant: false }
  | { kind: 'constant'; text: string }
  | { kind: 'array'; base: string; length: string };

export type FunctionInfo = { name: string; params: string[]; paramVariables: string[]; returnVariable: string; exported: boolean };

export type Loop = { breakLabel: string; continueLabel: string };

export const elementName = (names: Names, base: string, indexText: string): string =>
  `${VARIABLE_MARK}${names.prefix}${USER_SEPARATOR}${base}${ELEMENT_OPEN}${indexText}${ELEMENT_CLOSE}${VARIABLE_MARK}`;

export const stackElementName = (names: Names, pointer: string): string =>
  `${VARIABLE_MARK}${names.prefix}${INTERNAL_MARK}${STACK_NAME}${ELEMENT_OPEN}${pointer}${ELEMENT_CLOSE}${VARIABLE_MARK}`;

export const arrayLengthName = (names: Names, base: string): string => names.variable(`${base}${LOCAL_SEPARATOR}${ARRAY_LENGTH}`);

export const functionReturnName = (names: Names, name: string): string => names.internalVariable(`${name}${LOCAL_SEPARATOR}${RETURN_NAME}`);

export const parameterName = (names: Names, functionName: string, parameter: string): string =>
  names.variable(`${functionName}${LOCAL_SEPARATOR}${parameter}`);

export class Frame {
  readonly key: string;
  readonly isFunction: boolean;
  readonly frameVariables: string[] = [];
  readonly loops: Loop[] = [];
  private readonly names: Names;
  private readonly scopes: Map<string, SymbolEntry>[] = [new Map<string, SymbolEntry>()];
  private readonly declared = new Map<string, number>();
  private temps = 0;
  private hidden = 0;

  constructor(names: Names, key: string, isFunction: boolean) {
    this.names = names;
    this.key = key;
    this.isFunction = isFunction;
  }

  private qualified(name: string): string {
    return `${this.key}${LOCAL_SEPARATOR}${name}`;
  }

  private localName(name: string): string {
    return this.isFunction ? this.names.variable(this.qualified(name)) : this.names.internalVariable(INTERNAL_MARK + this.qualified(name));
  }

  bindParameter(name: string, variable: string): void {
    this.scope().set(name, { kind: 'variable', name: variable, constant: false });
    this.declared.set(name, 1);
    this.frameVariables.push(variable);
  }

  declare(name: string): string {
    const count = (this.declared.get(name) ?? 0) + 1;
    this.declared.set(name, count);
    const variable = this.localName(count < FIRST_SHADOW ? name : `${name}${SHADOW_SEPARATOR}${count}`);
    this.scope().set(name, { kind: 'variable', name: variable, constant: false });
    if (!this.frameVariables.includes(variable)) this.frameVariables.push(variable);
    return variable;
  }

  hiddenVariable(hint: string): string {
    this.hidden += 1;
    const variable = this.names.internalVariable(`${this.isFunction ? '' : INTERNAL_MARK}${this.qualified(`${hint}${this.hidden}`)}`);
    this.frameVariables.push(variable);
    return variable;
  }

  lookup(name: string): SymbolEntry | null {
    for (let depth = this.scopes.length - 1; depth >= 0; depth--) {
      const entry = this.scopes[depth]?.get(name);
      if (entry) return entry;
    }
    return null;
  }

  enter(): void {
    this.scopes.push(new Map<string, SymbolEntry>());
  }

  leave(): void {
    this.scopes.pop();
  }

  private scope(): Map<string, SymbolEntry> {
    return this.scopes[this.scopes.length - 1] as Map<string, SymbolEntry>;
  }

  temp(): string {
    this.temps += 1;
    return this.tempName(this.temps);
  }

  private tempName(index: number): string {
    return this.names.internalVariable(`${this.isFunction ? '' : INTERNAL_MARK}${this.qualified(`${TEMP_NAME}${index}`)}`);
  }

  get tempMark(): number {
    return this.temps;
  }

  release(mark: number): void {
    this.temps = mark;
  }

  liveTemps(): string[] {
    return Array.from({ length: this.temps }, (_, index) => this.tempName(index + 1));
  }
}
