import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Parser, Language } from 'web-tree-sitter';
import { Logger } from '../utils/logger';

/* ---------------------------------- 型 ---------------------------------- */
type Lang =
  | 'javascript' | 'typescript' | 'python'
  | 'json' | 'css' | 'php' | 'ruby'
  | 'csharp' | 'c' | 'cpp' | 'go' | 'rust' | 'java'
  | 'bash' | 'html';

/** VSCode の `languageId` → 本ライブラリで扱うキー */
const ID_MAP: Record<string, Lang | undefined> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  php: 'php',
  ruby: 'ruby',
  csharp: 'csharp', 'c#': 'csharp', cs: 'csharp',
  c: 'c',
  cpp: 'cpp', 'c++': 'cpp',
  go: 'go',
  rust: 'rust',
  java: 'java',

  // スクリプト
  bash: 'bash',
  shellscript: 'bash',

  // マークアップ
  html: 'html',

  // データ & スタイル
  json: 'json',  jsonc: 'json',
  css: 'css',    scss: 'css',  less: 'css',
};

/** 事前ビルド済み `.wasm` ファイル名 */
const LANG_TO_WASM: Record<Lang, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  python: 'tree-sitter-python.wasm',

  json: 'tree-sitter-json.wasm',
  css: 'tree-sitter-css.wasm',
  php: 'tree-sitter-php.wasm',
  ruby: 'tree-sitter-ruby.wasm',

  csharp: 'tree-sitter-c-sharp.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',

  bash: 'tree-sitter-bash.wasm',
  html: 'tree-sitter-html.wasm'
};

/* ============================= ParserManager ============================ */
export class ParserManager {
  private static instance: ParserManager;
  private cache = new Map<Lang, Parser>();
  private initialized = false;
  private logger = Logger.getInstance('ParserManager');
  private constructor(private readonly ctx: vscode.ExtensionContext) {}

  /** シングルトン取得 */
  static getInstance(ctx: vscode.ExtensionContext): ParserManager {
    if (!this.instance) this.instance = new ParserManager(ctx);
    return this.instance;
  }

  /** languageId から Parser を返す（未キャッシュならロード） */
  async getParser(langId: string): Promise<Parser | null> {
    const lang = ID_MAP[langId.toLowerCase()];
    if (!lang) return null;                         // 非対応言語

    if (!this.cache.has(lang)) {
      await this.ensureInit();

      // grammars （out/ または dist/）を探索
      const baseDir =
        ['out', 'dist'].find(d =>
          fs.existsSync(path.join(this.ctx.extensionPath, d, 'grammars'))
        ) ?? 'out';

      const wasmPath = path.join(
        this.ctx.extensionPath,
        baseDir,
        'grammars',
        LANG_TO_WASM[lang]
      );

      try {
        const langWasm = await Language.load(wasmPath);
        const parser = new Parser();
        parser.setLanguage(langWasm);
        this.cache.set(lang, parser);
      } catch (err) {
        this.logger.error(`failed to load '${lang} ${err}'`);
        return null;
      }
    }
    return this.cache.get(lang)!;
  }

  /** Parser.init() を一度だけ呼び出す */
  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    await Parser.init();        // ← ここで WASM ランタイムを準備
    this.initialized = true;
  }
}
