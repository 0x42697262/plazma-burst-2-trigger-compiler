import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CompletionItemKind, DiagnosticSeverity, MarkupKind, ProposedFeatures, SymbolKind, TextDocumentSyncKind, TextDocuments, createConnection,
} from 'vscode-languageserver/node';
import type { CompletionItem, Diagnostic, DocumentSymbol, InitializeResult } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { complete, definition, diagnose, diagnoseAssembly, hover, references, symbols } from '../service/service.ts';
import type { CompletionKind, ServiceDiagnostic, SymbolKind as ServiceSymbolKind } from '../service/service.ts';
import { ASSEMBLY_EXTENSION, FILE_ENCODING, SERVER_NAME, TRIGGER_CHARACTERS, WORD_AT } from './keys.ts';
import { sourcePath } from '../cli/sources.ts';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const pathOf = (uri: string): string => fileURLToPath(uri);

const read = (file: string): string | null => {
  const open = documents.get(pathToFileURL(sourcePath(file)).href);
  if (open) return open.getText();
  try {
    return fs.readFileSync(sourcePath(file), FILE_ENCODING);
  } catch {
    return null;
  }
};

const COMPLETION_KINDS: Record<CompletionKind, CompletionItemKind> = {
  keyword: CompletionItemKind.Keyword,
  function: CompletionItemKind.Function,
  variable: CompletionItemKind.Variable,
  constant: CompletionItemKind.Constant,
  value: CompletionItemKind.EnumMember,
  action: CompletionItemKind.Method,
  group: CompletionItemKind.Enum,
  kind: CompletionItemKind.Class,
  property: CompletionItemKind.Property,
};

const SYMBOL_KINDS: Record<ServiceSymbolKind, SymbolKind> = {
  function: SymbolKind.Function,
  variable: SymbolKind.Variable,
  constant: SymbolKind.Constant,
  object: SymbolKind.Object,
  event: SymbolKind.Event,
  array: SymbolKind.Array,
};

const toDiagnostic = (document: TextDocument, entry: ServiceDiagnostic): Diagnostic => {
  const lineEnd = document.offsetAt({ line: entry.line + 1, character: 0 }) - document.offsetAt({ line: entry.line, character: 0 });
  return {
    range: { start: { line: entry.line, character: 0 }, end: { line: entry.line, character: Math.max(0, lineEnd - 1) } },
    message: entry.message,
    severity: entry.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    source: SERVER_NAME,
  };
};

const validate = (document: TextDocument): void => {
  const file = pathOf(document.uri);
  const found = file.endsWith(ASSEMBLY_EXTENSION) ? diagnoseAssembly(document.getText()) : diagnose(document.getText(), file, read, { environment: process.env });
  void connection.sendDiagnostics({ uri: document.uri, diagnostics: found.map((entry) => toDiagnostic(document, entry)) });
};

connection.onInitialize((): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    completionProvider: { triggerCharacters: TRIGGER_CHARACTERS },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    documentSymbolProvider: true,
  },
  serverInfo: { name: SERVER_NAME },
}));

documents.onDidChangeContent((change) => {
  validate(change.document);
  for (const other of documents.all()) if (other.uri !== change.document.uri) validate(other);
});

connection.onCompletion((parameters): CompletionItem[] => {
  const document = documents.get(parameters.textDocument.uri);
  if (!document) return [];
  const position = { line: parameters.position.line, column: parameters.position.character };
  return complete(document.getText(), position, pathOf(document.uri), read).map((item) => ({
    label: item.label,
    kind: COMPLETION_KINDS[item.kind],
    detail: item.detail,
    documentation: item.documentation === '' ? undefined : { kind: MarkupKind.Markdown, value: item.documentation },
    insertText: item.insertText,
  }));
});

connection.onHover((parameters) => {
  const document = documents.get(parameters.textDocument.uri);
  if (!document) return null;
  const text = hover(document.getText(), { line: parameters.position.line, column: parameters.position.character }, pathOf(document.uri), read);
  return text === null ? null : { contents: { kind: MarkupKind.Markdown, value: text } };
});

connection.onDefinition((parameters) => {
  const document = documents.get(parameters.textDocument.uri);
  if (!document) return null;
  const found = definition(document.getText(), { line: parameters.position.line, column: parameters.position.character }, pathOf(document.uri), read);
  if (!found) return null;
  const position = { line: found.line, character: found.column };
  return { uri: pathToFileURL(found.file).href, range: { start: position, end: position } };
});

connection.onReferences((parameters) => {
  const document = documents.get(parameters.textDocument.uri);
  if (!document) return [];
  const position = { line: parameters.position.line, column: parameters.position.character };
  const { line, character } = parameters.position;
  const word = document.getText({ start: { line, character: 0 }, end: { line: line + 1, character: 0 } });
  const found = references(document.getText(), position, pathOf(document.uri), read);
  const length = WORD_AT(word, character);
  return found.map((entry) => ({
    uri: pathToFileURL(entry.file).href, range: { start: { line: entry.line, character: entry.column }, end: { line: entry.line, character: entry.column + length } },
  }));
});

connection.onDocumentSymbol((parameters): DocumentSymbol[] => {
  const document = documents.get(parameters.textDocument.uri);
  if (!document) return [];
  return symbols(document.getText()).map((entry) => {
    const range = { start: { line: entry.line, character: entry.column }, end: { line: entry.line, character: entry.column + entry.name.length } };
    return { name: entry.name, kind: SYMBOL_KINDS[entry.kind], range, selectionRange: range };
  });
});

documents.listen(connection);
connection.listen();
