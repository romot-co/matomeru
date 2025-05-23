import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParserManager } from '../services/parserManager';

// VSCode APIのモック
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn()
}));

// web-tree-sitterのモック
jest.mock('web-tree-sitter', () => ({
  Parser: {
    init: jest.fn().mockResolvedValue(undefined)
  },
  Language: {
    load: jest.fn()
  }
}));

// fsのモック
jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

const mockedFs = jest.mocked(fs);

describe('ParserManager', () => {
  let mockContext: vscode.ExtensionContext;
  let parserManager: ParserManager;

  beforeEach(() => {
    mockContext = {
      extensionPath: '/test/extension/path'
    } as vscode.ExtensionContext;

    // シングルトンインスタンスをリセット
    (ParserManager as any).instance = undefined;
    parserManager = ParserManager.getInstance(mockContext);
  });

  afterEach(() => {
    parserManager.dispose();
  });

  describe('シングルトンパターン', () => {
    it('同じインスタンスを返すこと', () => {
      const instance1 = ParserManager.getInstance(mockContext);
      const instance2 = ParserManager.getInstance(mockContext);
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('初期化状態の管理', () => {
    it('初期状態では初期化されていないこと', () => {
      expect(parserManager.isInitialized()).toBe(false);
    });

    it('初期状態ではキャッシュされたパーサーが0個であること', () => {
      expect(parserManager.getCachedParserCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('disposeを呼ぶと初期化状態がリセットされること', async () => {
      // 初期化する
      await parserManager.ensureInit();
      expect(parserManager.isInitialized()).toBe(true);

      // dispose呼び出し
      parserManager.dispose();
      
      expect(parserManager.isInitialized()).toBe(false);
      expect(parserManager.getCachedParserCount()).toBe(0);
    });
  });

  describe('ensureInit', () => {
    it('初期化を実行すること', async () => {
      await parserManager.ensureInit();
      
      expect(parserManager.isInitialized()).toBe(true);
    });

    it('複数回呼び出しても問題ないこと', async () => {
      await parserManager.ensureInit();
      await parserManager.ensureInit();
      
      expect(parserManager.isInitialized()).toBe(true);
    });
  });

  describe('getParser', () => {
    beforeEach(() => {
      mockedFs.existsSync.mockReturnValue(true);
    });

    it('対応していない言語の場合はnullを返すこと', async () => {
      const parser = await parserManager.getParser('unknown-language');
      
      expect(parser).toBeNull();
    });

    it('ファイルが存在しない言語の場合はnullを返すこと', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      
      const parser = await parserManager.getParser('javascript');
      
      expect(parser).toBeNull();
    });
  });
}); 