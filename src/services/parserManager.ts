import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Parser, Language } from 'web-tree-sitter';
import { Logger } from '../utils/logger';

/* ---------------------------------- 型 ---------------------------------- */
type Lang =
  | 'javascript' | 'typescript' | 'tsx' | 'python'
  | 'css' | 'ruby'
  | 'csharp' | 'c' | 'cpp' | 'go' | 'rust' | 'java'
  | 'ini' | 'regex';

/** VSCode の `languageId` → 本ライブラリで扱うキー */
const ID_MAP: Record<string, Lang | undefined> = {
  javascript: 'javascript',
  typescript: 'typescript',
  typescriptreact: 'tsx',
  tsx: 'tsx',
  python: 'python',
  ruby: 'ruby',
  csharp: 'csharp', 'c#': 'csharp', cs: 'csharp',
  c: 'c',
  cpp: 'cpp', 'c++': 'cpp',
  go: 'go',
  rust: 'rust',
  java: 'java',

  // データ & スタイル
  css: 'css',    scss: 'css',  less: 'css',
  ini: 'ini',    properties: 'ini',
  regex: 'regex'
};

/** 事前ビルド済み `.wasm` ファイル名 */
const LANG_TO_WASM: Record<Lang, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  python: 'tree-sitter-python.wasm',

  css: 'tree-sitter-css.wasm',
  ruby: 'tree-sitter-ruby.wasm',

  csharp: 'tree-sitter-c-sharp.wasm',
  c: 'tree-sitter-cpp.wasm', // CはCppパーサーで代用
  cpp: 'tree-sitter-cpp.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  java: 'tree-sitter-java.wasm',

  ini: 'tree-sitter-ini.wasm',
  regex: 'tree-sitter-regex.wasm'
};

/* ============================= ParserManager ============================ */
export class ParserManager {
  private static instance: ParserManager;
  private cache = new Map<Lang, Parser>();
  private initialized = false;
  private initPromise?: Promise<void>;
  private logger = Logger.getInstance('ParserManager');
  private constructor(private readonly ctx: vscode.ExtensionContext) {}

  /** シングルトン取得 */
  static getInstance(ctx: vscode.ExtensionContext): ParserManager {
    if (!this.instance) this.instance = new ParserManager(ctx);
    return this.instance;
  }

  /**
   * リソースの解放
   */
  dispose(): void {
    // パーサーのキャッシュをクリア
    this.cache.forEach(_parser => {
      // Tree-sitterのParser自体にはdisposeメソッドがないが、
      // キャッシュをクリアしてGCの対象にする
    });
    this.cache.clear();
    this.initialized = false;
    this.logger.info('ParserManager disposed');
    ParserManager.instance = undefined as any;
  }

  /** languageId から Parser を返す（未キャッシュならロード） */
  async getParser(langId: string): Promise<Parser | null> {
    const lang = ID_MAP[langId.toLowerCase()];
    if (!lang) return null;                         // 非対応言語

    if (!this.cache.has(lang)) {
      await this.ensureInit();

      let wasmPath: string | undefined;
      const customGrammarDir = process.env.MATOMERU_GRAMMAR_DIR;

      if (customGrammarDir) {
        // 環境変数で指定されたディレクトリからWASMを読み込む
        wasmPath = path.join(customGrammarDir, LANG_TO_WASM[lang]);
        this.logger.info(`Using custom grammar dir: ${customGrammarDir} for ${lang}`);
      } else {
        // 通常の実行時のパス
        const baseDir =
          ['out', 'dist'].find(d =>
            fs.existsSync(path.join(this.ctx.extensionPath, d, 'grammars'))
          ) ?? 'out';
        
        // WASMファイルを探すパスの候補
        const wasmPaths = [
          path.join(this.ctx.extensionPath, baseDir, 'grammars', LANG_TO_WASM[lang]),
          path.join(this.ctx.extensionPath, baseDir, 'grammars', 'wasm', LANG_TO_WASM[lang])
        ];

        // 存在するパスを探す
        wasmPath = wasmPaths.find(p => fs.existsSync(p));
      }
      
      if (!wasmPath || !fs.existsSync(wasmPath)) {
        this.logger.error(`No WASM file found for language '${lang}'`);
        return null;
      }

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
  async ensureInit(): Promise<void> {
    if (this.initialized) return;
    
    // 既に初期化中の場合は同じPromiseを返す
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // 初期化Promiseを作成・キャッシュ
    this.initPromise = (async () => {
      await Parser.init();        // ← ここで WASM ランタイムを準備
      this.initialized = true;
    })();
    
    return this.initPromise;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getCachedParserCount(): number {
    return this.cache.size;
  }
}
