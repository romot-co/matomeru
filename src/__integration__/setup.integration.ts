/* eslint-disable */
// @ts-nocheck
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as vscode from 'vscode';
import { jest } from '@jest/globals';
import * as path from 'path';

// ❶ VSCode の簡易モック (必要最小限のみ)
jest.mock('vscode', () => ({
  Uri: { 
    file: (p: string) => ({ fsPath: p }),
    joinPath: (uri: any, ...pathSegments: string[]) => ({ 
      fsPath: [uri.fsPath, ...pathSegments].join('/') 
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
        return undefined;
      })
    })
  }
}), { virtual: true });

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

// ParserManagerのモック
jest.mock('../services/parserManager', () => {
  const mockParser = {
    parse: (code) => {
      // コメントを探して削除するシンプルなモック実装
      const commentRanges = [];
      
      // 行コメントを探す (// から行末まで)
      let linePos = 0;
      while ((linePos = code.indexOf('//', linePos)) !== -1) {
        const lineEnd = code.indexOf('\n', linePos);
        const end = lineEnd !== -1 ? lineEnd : code.length;
        commentRanges.push({ startIndex: linePos, endIndex: end });
        linePos = end + 1;
        if (linePos >= code.length) break;
      }
      
      // ブロックコメントを探す (/* から */ まで)
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

// 環境変数で文法ファイルの場所を設定
process.env.MATOMERU_GRAMMAR_DIR = `${__dirname}/../../node_modules/@vscode/tree-sitter-wasm/wasm`;

// ❷ Tree-sitter の WASM 初期化（実際には使用しない）
jest.mock('web-tree-sitter', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      parse: jest.fn(),
      setLanguage: jest.fn()
    }))
  };
});

// 初期化処理は特に何もしない
beforeAll(async () => {
  console.log('Integration test setup complete');
});