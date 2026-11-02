import type { Declaration, Expression, Import, Location, MatchArm, ObjectTree, SourceFile, Statement, Target, TemplatePart } from './ast.ts';
import { SourceError, tokenize } from './lexer.ts';
import type { StringPart, Token } from './lexer.ts';
import { COMPOUND_ASSIGNMENTS, EVENT, KEYWORD, OBJECT_AT, PRECEDENCE, PUNCTUATOR, UID_MARK } from './keys.ts';
import { isObjectKeyword } from '../objects/objects.ts';
import { VALUE_GROUP_LIST, valueGroup } from '../opcodes/values.ts';

const fail = (location: Location, message: string): never => {
  throw new SourceError(location.line, message, location.file);
};
import { TEXT } from './text.ts';

class Parser {
  private readonly tokens: Token[];
  private readonly file: string | undefined;
  private position = 0;

  constructor(tokens: Token[], file: string | undefined) {
    this.tokens = tokens;
    this.file = file;
  }

  private peek(offset: number): Token {
    return this.tokens[this.position + offset] ?? this.tokens[this.tokens.length - 1] as Token;
  }

  private get current(): Token {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1] as Token;
  }

  private location(): Location {
    return this.file === undefined ? { line: this.current.line } : { line: this.current.line, file: this.file };
  }

  private describe(token: Token): string {
    return token.kind === 'end' ? TEXT.endOfFile : TEXT.quoted(token.text);
  }

  private fail(what: string): never {
    throw new SourceError(this.current.line, TEXT.expected(what, this.describe(this.current)));
  }

  private isPunctuator(text: string): boolean {
    return this.current.kind === 'punctuator' && this.current.text === text;
  }

  private isKeyword(text: string): boolean {
    return this.current.kind === 'keyword' && this.current.text === text;
  }

  private next(): Token {
    const token = this.current;
    this.position += 1;
    return token;
  }

  private accept(text: string): boolean {
    if (!this.isPunctuator(text) && !this.isKeyword(text)) return false;
    this.position += 1;
    return true;
  }

  private expect(text: string): void {
    if (!this.accept(text)) this.fail(TEXT.quoted(text));
  }

  private identifier(): string {
    if (this.current.kind !== 'identifier') this.fail(TEXT.identifier);
    return this.next().text;
  }

  atEnd(): boolean {
    return this.current.kind === 'end';
  }

  sourceFile(): SourceFile {
    const declarations: Declaration[] = [];
    const imports: Import[] = [];
    while (!this.atEnd()) {
      if (this.isKeyword(KEYWORD.import)) {
        const location = this.location();
        this.next();
        if (this.current.kind !== 'string') this.fail(TEXT.string);
        imports.push({ path: this.stringText(this.next()), location });
        this.expect(PUNCTUATOR.semicolon);
      } else {
        declarations.push(this.declaration());
      }
    }
    return { declarations, imports };
  }

  private declaration(): Declaration {
    const location = this.location();
    if (this.accept(KEYWORD.var)) return this.variableDeclaration(location, false);
    if (this.accept(KEYWORD.const)) {
      const name = this.identifier();
      this.expect(PUNCTUATOR.assign);
      const value = this.expression();
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'const', name, value, location };
    }
    if (this.accept(KEYWORD.extern)) {
      const name = this.identifier();
      let hostName = name;
      if (this.accept(PUNCTUATOR.assign)) {
        if (this.current.kind !== 'string') this.fail(TEXT.string);
        hostName = this.stringText(this.next());
      }
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'extern', name, hostName, location };
    }
    if (this.current.kind === 'identifier' && isObjectKeyword(this.current.text) && this.peek(1).kind === 'identifier') {
      return this.objectDeclaration(location);
    }
    const exported = this.accept(KEYWORD.export);
    if (exported && this.accept(KEYWORD.var)) return this.variableDeclaration(location, true);
    if (this.accept(KEYWORD.function)) {
      const name = this.identifier();
      this.expect(PUNCTUATOR.openParen);
      const params: string[] = [];
      if (!this.isPunctuator(PUNCTUATOR.closeParen)) {
        do params.push(this.identifier());
        while (this.accept(PUNCTUATOR.comma));
      }
      this.expect(PUNCTUATOR.closeParen);
      return { kind: 'function', name, params, body: this.block(), exported, location };
    }
    if (exported) this.fail(TEXT.exportable);
    if (this.accept(KEYWORD.on)) {
      const eventLine = this.current.line;
      const event = this.identifier();
      if (event !== EVENT.start && event !== EVENT.join && event !== EVENT.chat) throw new SourceError(eventLine, TEXT.unknownEvent(event));
      return { kind: 'on', event, body: this.block(), location };
    }
    if (this.accept(KEYWORD.every)) {
      if (this.current.kind !== 'number') this.fail(TEXT.number);
      const frames = Number(this.next().text);
      return { kind: 'every', frames, body: this.block(), location };
    }
    return this.fail(TEXT.topLevel);
  }

  private variableDeclaration(location: Location, exported: boolean): Declaration {
    const name = this.identifier();
    const array = this.accept(PUNCTUATOR.openBracket);
    if (array) this.expect(PUNCTUATOR.closeBracket);
    const value = !array && this.accept(PUNCTUATOR.assign) ? this.expression() : null;
    this.expect(PUNCTUATOR.semicolon);
    return { kind: 'var', name, array, value, exported, location };
  }

  private objectDeclaration(location: Location): Declaration {
    const keyword = this.next().text;
    const name = this.identifier();
    let dimensions = 0;
    while (this.accept(PUNCTUATOR.openBracket)) {
      this.expect(PUNCTUATOR.closeBracket);
      dimensions += 1;
    }
    this.expect(PUNCTUATOR.assign);
    if (dimensions > 0) {
      const tree = this.objectTree(dimensions, name, location);
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'object', keyword, name, uid: '', x: null, y: null, tree, location };
    }
    if (this.current.kind !== 'string') this.fail(TEXT.string);
    const uid = this.stringText(this.next());
    if (!uid.startsWith(UID_MARK)) throw new SourceError(location.line, TEXT.objectUid(name));
    let positionX: number | null = null;
    let positionY: number | null = null;
    if (this.isWord(OBJECT_AT)) {
      this.next();
      positionX = this.signedNumber();
      this.expect(PUNCTUATOR.comma);
      positionY = this.signedNumber();
    }
    this.expect(PUNCTUATOR.semicolon);
    return { kind: 'object', keyword, name, uid, x: positionX, y: positionY, tree: null, location };
  }

  private objectTree(depth: number, name: string, location: Location): ObjectTree[] {
    this.expect(PUNCTUATOR.openBracket);
    const items: ObjectTree[] = [];
    if (!this.isPunctuator(PUNCTUATOR.closeBracket)) {
      do {
        if (depth > 1) {
          items.push(this.objectTree(depth - 1, name, location));
        } else {
          if (this.current.kind !== 'string') this.fail(TEXT.string);
          const uid = this.stringText(this.next());
          if (!uid.startsWith(UID_MARK)) throw new SourceError(location.line, TEXT.objectUid(name), this.file);
          items.push(uid);
        }
      } while (this.accept(PUNCTUATOR.comma));
    }
    this.expect(PUNCTUATOR.closeBracket);
    return items;
  }

  private isWord(word: string): boolean {
    return this.current.kind === 'identifier' && this.current.text === word;
  }

  private signedNumber(): number {
    const negative = this.accept(PUNCTUATOR.minus);
    if (this.current.kind !== 'number') return this.fail(TEXT.number);
    const value = Number(this.next().text);
    return negative ? -value : value;
  }

  private stringText(token: Token): string {
    if (token.kind !== 'string') return this.fail(TEXT.string);
    return token.parts.map((part) => (part.kind === 'text' ? part.text : this.fail(TEXT.string))).join('');
  }

  private block(): Statement[] {
    this.expect(PUNCTUATOR.openBrace);
    const body: Statement[] = [];
    while (!this.isPunctuator(PUNCTUATOR.closeBrace)) {
      if (this.atEnd()) this.fail(TEXT.quoted(PUNCTUATOR.closeBrace));
      body.push(this.statement());
    }
    this.expect(PUNCTUATOR.closeBrace);
    return body;
  }

  private statement(): Statement {
    const location = this.location();
    if (this.isPunctuator(PUNCTUATOR.openBrace)) return { kind: 'block', body: this.block(), location };
    if (this.accept(KEYWORD.let)) {
      const statement = this.letRest(location);
      this.expect(PUNCTUATOR.semicolon);
      return statement;
    }
    if (this.accept(KEYWORD.if)) return this.ifRest(location);
    if (this.accept(KEYWORD.while)) {
      const condition = this.parenthesized();
      return { kind: 'while', condition, body: this.block(), location };
    }
    if (this.accept(KEYWORD.for)) return this.forRest(location);
    if (this.accept(KEYWORD.break)) {
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'break', location };
    }
    if (this.accept(KEYWORD.continue)) {
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'continue', location };
    }
    if (this.accept(KEYWORD.return)) {
      const value = this.isPunctuator(PUNCTUATOR.semicolon) ? null : this.expression();
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'return', value, location };
    }
    if (this.accept(KEYWORD.match)) return this.matchRest(location);
    if (this.accept(KEYWORD.wait)) {
      const frames = this.parenthesized();
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'wait', frames, location };
    }
    const statement = this.simpleStatement(location);
    this.expect(PUNCTUATOR.semicolon);
    return statement;
  }

  private matchRest(location: Location): Statement {
    const subject = this.parenthesized();
    this.expect(PUNCTUATOR.openBrace);
    const arms: MatchArm[] = [];
    while (!this.accept(PUNCTUATOR.closeBrace)) {
      if (this.atEnd()) this.fail(TEXT.quoted(PUNCTUATOR.closeBrace));
      const armLocation = this.location();
      let patterns: Expression[] | null = null;
      if (this.current.kind === 'identifier' && this.current.text === PUNCTUATOR.wildcard) {
        this.next();
      } else {
        patterns = [];
        do patterns.push(this.expression());
        while (this.accept(PUNCTUATOR.comma));
      }
      this.expect(PUNCTUATOR.arrow);
      const body = this.isPunctuator(PUNCTUATOR.openBrace) ? this.block() : [this.statement()];
      arms.push({ patterns, body, location: armLocation });
    }
    return { kind: 'match', subject, arms, location };
  }

  private letRest(location: Location): Statement {
    const name = this.identifier();
    const value = this.accept(PUNCTUATOR.assign) ? this.expression() : null;
    return { kind: 'let', name, value, location };
  }

  private ifRest(location: Location): Statement {
    const condition = this.parenthesized();
    const then = this.block();
    let otherwise: Statement[] | null = null;
    if (this.accept(KEYWORD.else)) {
      const elseLocation = this.location();
      otherwise = this.accept(KEYWORD.if) ? [this.ifRest(elseLocation)] : this.block();
    }
    return { kind: 'if', condition, then, otherwise, location };
  }

  private forRest(location: Location): Statement {
    if (this.accept(KEYWORD.player)) {
      const name = this.identifier();
      return { kind: 'forPlayer', name, body: this.block(), location };
    }
    this.expect(PUNCTUATOR.openParen);
    let init: Statement | null = null;
    if (!this.isPunctuator(PUNCTUATOR.semicolon)) {
      const initLocation = this.location();
      init = this.accept(KEYWORD.let) ? this.letRest(initLocation) : this.simpleStatement(initLocation);
    }
    this.expect(PUNCTUATOR.semicolon);
    const condition = this.isPunctuator(PUNCTUATOR.semicolon) ? null : this.expression();
    this.expect(PUNCTUATOR.semicolon);
    const step = this.isPunctuator(PUNCTUATOR.closeParen) ? null : this.simpleStatement(this.location());
    this.expect(PUNCTUATOR.closeParen);
    return { kind: 'for', init, condition, step, body: this.block(), location };
  }

  private simpleStatement(location: Location): Statement {
    const expression = this.expression();
    const operatorText = this.current.text;
    const isAssign = this.isPunctuator(PUNCTUATOR.assign);
    const compound = this.current.kind === 'punctuator' ? COMPOUND_ASSIGNMENTS[operatorText] : undefined;
    if (!isAssign && compound === undefined) return { kind: 'expression', expression, location };
    this.next();
    const target = this.targetOf(expression);
    return { kind: 'assign', target, operator: compound ?? null, value: this.expression(), location };
  }

  private targetOf(expression: Expression): Target {
    if (expression.kind === 'name') return { kind: 'name', name: expression.name };
    if (expression.kind === 'index' && !expression.more) return { kind: 'index', array: expression.array, index: expression.index };
    throw new SourceError(expression.location.line, TEXT.assignTarget);
  }

  private parenthesized(): Expression {
    this.expect(PUNCTUATOR.openParen);
    const expression = this.expression();
    this.expect(PUNCTUATOR.closeParen);
    return expression;
  }

  expression(level = 0): Expression {
    const operators = PRECEDENCE[level];
    if (!operators) return this.unary();
    let left = this.expression(level + 1);
    for (;;) {
      const operator = operators.find((candidate) => this.isPunctuator(candidate));
      if (operator === undefined) return left;
      const location = this.location();
      this.next();
      const right = this.expression(level + 1);
      left = { kind: 'binary', operator, left, right, location };
    }
  }

  private unary(): Expression {
    const location = this.location();
    if (this.accept(PUNCTUATOR.minus)) {
      const operand = this.unary();
      if (operand.kind === 'number') return { ...operand, text: String(-Number(operand.text)) };
      return { kind: 'unary', operator: '-', operand, location };
    }
    if (this.accept(PUNCTUATOR.not)) return { kind: 'unary', operator: '!', operand: this.unary(), location };
    return this.primary();
  }

  private primary(): Expression {
    const location = this.location();
    const token = this.current;
    if (token.kind === 'number') {
      this.next();
      return { kind: 'number', text: String(Number(token.text)), location };
    }
    if (token.kind === 'string') {
      this.next();
      return { kind: 'string', parts: token.parts.map((part) => templatePart(part, this.file)), location };
    }
    if (this.accept(KEYWORD.true)) return { kind: 'boolean', value: true, location };
    if (this.accept(KEYWORD.false)) return { kind: 'boolean', value: false, location };
    if (this.accept(PUNCTUATOR.at)) return { kind: 'reference', name: this.identifier(), location };
    if (this.isPunctuator(PUNCTUATOR.openParen)) return this.parenthesized();
    if (token.kind !== 'identifier') return this.fail(TEXT.expression);
    const name = this.identifier();
    if (this.accept(PUNCTUATOR.dot)) {
      const member = this.identifier();
      const group = valueGroup(name) ?? fail(location, TEXT.unknownValueGroup(name, VALUE_GROUP_LIST.map((entry) => entry.name)));
      const text = group.members.get(member) ?? fail(location, TEXT.unknownValueMember(name, member));
      return { kind: 'named', group: name, member, paramKind: group.paramKind, text, location };
    }
    if (this.accept(PUNCTUATOR.openParen)) {
      const args: Expression[] = [];
      if (!this.isPunctuator(PUNCTUATOR.closeParen)) {
        do args.push(this.expression());
        while (this.accept(PUNCTUATOR.comma));
      }
      this.expect(PUNCTUATOR.closeParen);
      return { kind: 'call', callee: name, args, location };
    }
    if (this.accept(PUNCTUATOR.openBracket)) {
      const index = this.expression();
      this.expect(PUNCTUATOR.closeBracket);
      const more: Expression[] = [];
      while (this.accept(PUNCTUATOR.openBracket)) {
        more.push(this.expression());
        this.expect(PUNCTUATOR.closeBracket);
      }
      return more.length > 0 ? { kind: 'index', array: name, index, more, location } : { kind: 'index', array: name, index, location };
    }
    return { kind: 'name', name, location };
  }
}

function templatePart(part: StringPart, file: string | undefined): TemplatePart {
  if (part.kind === 'text') return part;
  const parser = new Parser(tokenize(part.source, part.line), file);
  const expression = parser.expression();
  if (!parser.atEnd()) throw new SourceError(part.line, TEXT.expected(TEXT.quoted(PUNCTUATOR.closeBrace), TEXT.expression));
  return { kind: 'expression', expression };
}

export function parseSource(source: string, file?: string): SourceFile {
  try {
    return new Parser(tokenize(source), file).sourceFile();
  } catch (error) {
    if (error instanceof SourceError && error.file === undefined) error.file = file;
    throw error;
  }
}
