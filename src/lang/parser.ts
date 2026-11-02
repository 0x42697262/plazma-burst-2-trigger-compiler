import type { Declaration, Expression, Location, SourceFile, Statement, Target, TemplatePart } from './ast.ts';
import { SourceError, tokenize } from './lexer.ts';
import type { StringPart, Token } from './lexer.ts';
import { COMPOUND_ASSIGNMENTS, EVENT, KEYWORD, PRECEDENCE, PUNCTUATOR } from './keys.ts';
import { TEXT } from './text.ts';

class Parser {
  private readonly tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private get current(): Token {
    return this.tokens[this.position] ?? this.tokens[this.tokens.length - 1] as Token;
  }

  private location(): Location {
    return { line: this.current.line };
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
    while (!this.atEnd()) declarations.push(this.declaration());
    return { declarations };
  }

  private declaration(): Declaration {
    const location = this.location();
    if (this.accept(KEYWORD.var)) {
      const name = this.identifier();
      const array = this.accept(PUNCTUATOR.openBracket);
      if (array) this.expect(PUNCTUATOR.closeBracket);
      const value = !array && this.accept(PUNCTUATOR.assign) ? this.expression() : null;
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'var', name, array, value, location };
    }
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
    const exported = this.accept(KEYWORD.export);
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
    if (exported) this.fail(TEXT.quoted(KEYWORD.function));
    if (this.accept(KEYWORD.on)) {
      const eventLine = this.current.line;
      const event = this.identifier();
      if (event !== EVENT.start && event !== EVENT.join) throw new SourceError(eventLine, TEXT.unknownEvent(event));
      return { kind: 'on', event, body: this.block(), location };
    }
    if (this.accept(KEYWORD.every)) {
      if (this.current.kind !== 'number') this.fail(TEXT.number);
      const frames = Number(this.next().text);
      return { kind: 'every', frames, body: this.block(), location };
    }
    return this.fail(TEXT.topLevel);
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
    if (this.accept(KEYWORD.wait)) {
      const frames = this.parenthesized();
      this.expect(PUNCTUATOR.semicolon);
      return { kind: 'wait', frames, location };
    }
    const statement = this.simpleStatement(location);
    this.expect(PUNCTUATOR.semicolon);
    return statement;
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
    if (expression.kind === 'index') return { kind: 'index', array: expression.array, index: expression.index };
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
      return { kind: 'string', parts: token.parts.map(templatePart), location };
    }
    if (this.accept(KEYWORD.true)) return { kind: 'boolean', value: true, location };
    if (this.accept(KEYWORD.false)) return { kind: 'boolean', value: false, location };
    if (this.accept(PUNCTUATOR.at)) return { kind: 'reference', name: this.identifier(), location };
    if (this.isPunctuator(PUNCTUATOR.openParen)) return this.parenthesized();
    if (token.kind !== 'identifier') return this.fail(TEXT.expression);
    const name = this.identifier();
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
      return { kind: 'index', array: name, index, location };
    }
    return { kind: 'name', name, location };
  }
}

function templatePart(part: StringPart): TemplatePart {
  if (part.kind === 'text') return part;
  const parser = new Parser(tokenize(part.source, part.line));
  const expression = parser.expression();
  if (!parser.atEnd()) throw new SourceError(part.line, TEXT.expected(TEXT.quoted(PUNCTUATOR.closeBrace), TEXT.expression));
  return { kind: 'expression', expression };
}

export const parseSource = (source: string): SourceFile => new Parser(tokenize(source)).sourceFile();
