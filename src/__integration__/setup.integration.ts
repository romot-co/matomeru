/* eslint-disable */
// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as vscode from 'vscode';
import { jest } from '@jest/globals';
// import * as path from 'path'; // トップレベルの path import は jest.mock 内では直接使えないことがある

// jest.mock の直前でパスを解決していたものも削除
// const resolvedProjectRootForMock = path.resolve(__dirname, '../..'); 

// ❶ VSCode の簡易モック (必要最小限のみ)
jest.mock('vscode', () => {
  const pathModule = require('path'); // ファクトリ関数内で path を require
  const resolvedProjectRootInFactory = pathModule.resolve(__dirname, '../..');
  return {
    Uri: { 
      file: (p: string) => ({ fsPath: p, scheme: 'file' }),
      joinPath: (uri: any, ...pathSegments: string[]) => ({ 
        fsPath: pathModule.join(uri.fsPath, ...pathSegments), // ここでも pathModule を使う
        scheme: 'file'
      })
    },
    window: {
      createOutputChannel: () => ({
        appendLine: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
      }),
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn()
    },
    workspace: {
      getConfiguration: () => ({
        get: jest.fn().mockImplementation((key) => {
          if (key === 'verboseCompression') return false;
          if (key === 'matomeru.grammars.source') return 'extension';
          return undefined;
        })
      }),
      workspaceFolders: [
        { uri: { fsPath: resolvedProjectRootInFactory, scheme: 'file' } } // ファクトリ関数内で解決したパスを使用
      ],
      onDidChangeWorkspaceFolders: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      createFileSystemWatcher: jest.fn().mockReturnValue({
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        onDidDelete: jest.fn(),
        dispose: jest.fn()
      })
    },
    ExtensionMode: {
      Production: 1,
      Development: 2,
      Test: 3,
    },
    l10n: { // l10n API のモックを修正
      t: (key: string, ...args: any[]) => {
        let messagePart = '';
        if (args && args.length > 0) {
          try {
            // args の各要素が string, number, boolean の場合にのみ join する
            const stringArgs = args.map(arg => {
              if (arg === null || arg === undefined) return '';
              if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
                return String(arg);
              }
              // 予期せぬ型の場合は型情報を文字列化
              return `[${typeof arg}: ${String(arg).slice(0, 30)}]`; // sliceで長さを制限
            });
            messagePart = stringArgs.join(' ');
          } catch (e) {
            // join でエラーが起きた場合 (通常はありえないが念のため)
            const errorMessage = e instanceof Error ? e.message : String(e);
            messagePart = `[Error joining args: ${errorMessage.slice(0, 50)}]`; // sliceで長さを制限
          }
        }
        return `${key}${messagePart ? ' ' + messagePart : ''}`;
      }
    },
    ExtensionKind: {
      UI: 1,
      Workspace: 2,
      Web: 3
    }
  };
}, { virtual: true });

// Loggerのモック
jest.mock('../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
  };

  return {
    Logger: {
      getInstance: jest.fn().mockReturnValue(mockLogger)
    }
  };
});

// ★★★ ParserManager のモックを復活させる ★★★
jest.mock('../services/parserManager', () => {
  const mockParser = {
    parse: (code) => {
      // コメントを探して削除するシンプルなモック実装
      const commentRanges = [];
      
      let linePos = 0;
      while ((linePos = code.indexOf('//', linePos)) !== -1) {
        const lineEnd = code.indexOf('\n', linePos);
        const end = lineEnd !== -1 ? lineEnd : code.length;
        commentRanges.push({ startIndex: linePos, endIndex: end });
        linePos = end + 1;
        if (linePos >= code.length) break;
      }
      
      let blockPos = 0;
      while ((blockPos = code.indexOf('/*', blockPos)) !== -1) {
        const blockEnd = code.indexOf('*/', blockPos);
        if (blockEnd === -1) break;
        commentRanges.push({ startIndex: blockPos, endIndex: blockEnd + 2 });
        blockPos = blockEnd + 2;
        if (blockPos >= code.length) break;
      }
      
      return {
        rootNode: {
          descendantsOfType: (type) => type === 'comment' ? commentRanges : []
        }
      };
    },
    setLanguage: jest.fn()
  };
  
  const mockInstance = {
    getParser: jest.fn().mockImplementation((langId) => {
      if (langId === 'javascript' || langId === 'typescript' || langId === 'tsx') {
        return Promise.resolve(mockParser);
      }
      return Promise.resolve(null); // 未サポート言語
    }),
    dispose: jest.fn()
  };
  
  return {
    ParserManager: {
      getInstance: jest.fn().mockReturnValue(mockInstance)
    }
  };
});

// 環境変数で Tree-sitter の .wasm ファイルが格納されているディレクトリを指定
// MATOMERU_GRAMMAR_DIR は ParserManager の中で環境変数から読み込まれる想定
// ParserManager のロジックに合わせて、実際に .wasm ファイルが配置されているパスを指定する必要がある
// 例: プロジェクトルート/grammars/wasm/tree-sitter-javascript.wasm のように配置する場合
// process.env.MATOMERU_GRAMMAR_DIR = path.resolve(__dirname, '../../grammars/wasm');
// もし ParserManager が ctx.extensionPath を基準に grammars/ ディレクトリを探すなら、
// MATOMERU_GRAMMAR_DIR の設定は不要かもしれない。
// 今回はParserManagerが ctx.extensionPath + 'out/grammars' or 'dist/grammars' を見るので、
// MATOMERU_GRAMMAR_DIR は使われないパスとしておくか、削除してもよい。
// もし`matomeru.grammars.source` が `customPath` の場合にこの環境変数が参照される。
// デフォルトは 'extension' なので、ひとまずこの設定は影響しない。
// process.env.MATOMERU_GRAMMAR_DIR = `${__dirname}/../../node_modules/@vscode/tree-sitter-wasm/wasm`;

// Tree-sitter の WASM 初期化はモックしない (実際のテストファイルで初期化)
// jest.mock('web-tree-sitter', () => ({}), { virtual: true }); 

beforeAll(async () => {
  console.log('Integration test setup: ParserManager IS NOW MOCKED. web-tree-sitter is NOT mocked globally.');
});

// Add the following function to export a mock ExtensionContext
export const getExtensionContext = (): vscode.ExtensionContext => {
  // getExtensionContext内では通常のimportを使えるはずだが、念のため確認
  // もしここでもエラーが出るなら、この関数内でも require('path') する
  const path = require('path'); // 安全策としてここでも require する
  const projectRoot = path.resolve(__dirname, '../..'); 
  const mockedVSCode = vscode; 

  return {
    extensionPath: projectRoot,
    extensionUri: mockedVSCode.Uri.file(projectRoot),
    storageUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'workspaceStorage')),
    globalStorageUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'globalStorage')),
    logUri: mockedVSCode.Uri.file(path.join(projectRoot, '.vscode-test-storage', 'logs')),
    secrets: {
      get: jest.fn(),
      store: jest.fn(),
      delete: jest.fn(),
      onDidChange: jest.fn(() => ({ dispose: jest.fn() }))
    } as any, // Cast to any because jest.fn() doesn't fully match SecretStorage
    globalState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => [])
    } as any, // vscode.Memento
    workspaceState: {
      get: jest.fn(),
      update: jest.fn(),
      keys: jest.fn(() => [])
    } as any, // vscode.Memento
    subscriptions: [],
    environmentVariableCollection: {
      persistent: false,
      replace: jest.fn(),
      append: jest.fn(),
      prepend: jest.fn(),
      get: jest.fn(),
      forEach: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      [Symbol.iterator]: jest.fn(() => ({ next: () => ({ done: true, value: undefined }) }))
    } as any, // vscode.EnvironmentVariableCollection,
    extensionMode: mockedVSCode.ExtensionMode.Test, // Use from mocked vscode
    asAbsolutePath: (relativePath: string) => path.join(projectRoot, relativePath),
    // Add other properties if your extension uses them
    languageModelAccessInformation: {ostęp: jest.fn() } as any, // Assuming 'ostęp' is a typo for 'get' or similar
     extension: {
        id: 'matomeru.test-instance',
        extensionPath: projectRoot,
        isActive: true,
        packageJSON: { name: 'matomeru-test', version: '0.0.0' },
        extensionKind: mockedVSCode.ExtensionKind.Workspace, // Use from mocked vscode
        exports: {},
        activate: jest.fn().mockResolvedValue({}),
        extensionUri: mockedVSCode.Uri.file(projectRoot),
    } as vscode.Extension<any>,
    // For newer VS Code versions, these might be part of ExtensionContext directly
    // globalStoragePath: path.join(projectRoot, '.vscode-test-storage', 'globalStorage'), // deprecated
    // logPath: path.join(projectRoot, '.vscode-test-storage', 'logs'), // deprecated
    // storagePath: path.join(projectRoot, '.vscode-test-storage', 'workspaceStorage') // deprecated
  } as vscode.ExtensionContext;
};
