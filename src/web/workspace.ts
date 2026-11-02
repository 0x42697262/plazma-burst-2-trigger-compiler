import { directoryOf, resolvePath } from '../lang/file-paths.ts';
import { DEFAULT_FILE, EXAMPLES_ROOT, IMPORT_STATEMENT, LEADING_SLASH, STORAGE, WORKSPACE_ROOT } from './keys.ts';

export class Workspace {
  private readonly files = new Map<string, string>();
  private current = DEFAULT_FILE;
  private readonly storage: Storage | null;

  constructor(storage: Storage | null) {
    this.storage = storage;
    const saved = storage?.getItem(STORAGE.files);
    if (saved) {
      for (const [file, text] of Object.entries(JSON.parse(saved) as Record<string, string>)) this.files.set(file, text);
      this.current = storage?.getItem(STORAGE.active) ?? DEFAULT_FILE;
    }
    if (!this.files.has(this.current)) this.current = this.list()[0] ?? DEFAULT_FILE;
  }

  get isEmpty(): boolean {
    return this.files.size === 0;
  }

  get active(): string {
    return this.current;
  }

  list(): string[] {
    return [...this.files.keys()].sort();
  }

  get(file: string): string | null {
    return this.files.get(file) ?? null;
  }

  set(file: string, text: string): void {
    this.files.set(file, text);
    this.save();
  }

  remove(file: string): void {
    this.files.delete(file);
    if (this.current === file) this.current = this.list()[0] ?? DEFAULT_FILE;
    this.save();
  }

  activate(file: string): void {
    this.current = file;
    this.save();
  }

  workspacePath(name: string): string {
    return resolvePath(WORKSPACE_ROOT, name.replace(LEADING_SLASH, ''));
  }

  loadExample(examples: Readonly<Record<string, string>>, path: string): void {
    const root = directoryOf(path);
    const copies = new Map<string, string>();
    const visit = (file: string): void => {
      const text = examples[file];
      if (text === undefined || copies.has(file)) return;
      copies.set(file, text);
      for (const match of text.matchAll(IMPORT_STATEMENT)) visit(resolvePath(directoryOf(file), match[1] ?? ''));
    };
    visit(path);
    this.files.clear();
    for (const [file, text] of copies) this.files.set(WORKSPACE_ROOT + file.slice(root.length + 1), text);
    this.current = WORKSPACE_ROOT + path.slice(root.length + 1);
    this.save();
  }

  private save(): void {
    this.storage?.setItem(STORAGE.files, JSON.stringify(Object.fromEntries(this.files)));
    this.storage?.setItem(STORAGE.active, this.current);
  }
}

export const isExample = (file: string): boolean => file.startsWith(EXAMPLES_ROOT);
