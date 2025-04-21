import * as vscode from 'vscode';
import { CommandRegistrar } from '../commands';
import { collectChangedFiles, GitNotRepositoryError } from '../utils/gitUtils';
import { copyToClipboard, showInEditor, openInChatGPT } from '../ui';

// モック
jest.mock('../utils/gitUtils', () => ({
  collectChangedFiles: jest.fn(),
  GitNotRepositoryError: jest.requireActual('../utils/gitUtils').GitNotRepositoryError,
  GitCliNotFoundError: jest.requireActual('../utils/gitUtils').GitCliNotFoundError
}));

jest.mock('../ui', () => ({
  copyToClipboard: jest.fn(),
  showInEditor: jest.fn(),
  openInChatGPT: jest.fn()
}));

jest.mock('vscode', () => {
  const original = jest.requireActual('vscode');
  return {
    ...original,
    window: {
      ...original.window,
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn()
    },
    workspace: {
      ...original.workspace,
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation((key, defaultValue) => {
          if (key === 'gitDiff.range') return '';
          return defaultValue;
        })
      }),
      workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }]
    },
    Uri: {
      file: jest.fn(path => ({ fsPath: path }))
    }
  };
});

describe('CommandRegistrar - Git Diff Commands', () => {
  let commandRegistrar: CommandRegistrar;
  const mockWorkspaceRoot = '/test/workspace';
  const mockMarkdown = '# Test Markdown\nFile content here';
  
  // テスト前の準備
  beforeEach(() => {
    jest.clearAllMocks();
    
    // FileOperationsのprocessFileListモック
    const mockFileOps = {
      processFileList: jest.fn().mockResolvedValue([{
        uri: { fsPath: 'dir1' },
        relativePath: 'dir1',
        files: [{
          uri: { fsPath: 'file1.ts' },
          relativePath: 'file1.ts',
          content: 'test content',
          language: 'typescript',
          size: 100
        }],
        directories: new Map()
      }]),
      setCurrentSelectedPath: jest.fn(),
      dispose: jest.fn()
    };
    
    // MarkdownGeneratorのgenerateモック
    const mockMarkdownGen = {
      generate: jest.fn().mockResolvedValue(mockMarkdown)
    };
    
    // リフレクションを使ってprivateフィールドをモック
    commandRegistrar = new CommandRegistrar();
    (commandRegistrar as any).fileOps = mockFileOps;
    (commandRegistrar as any).markdownGen = mockMarkdownGen;
    (commandRegistrar as any).workspaceRoot = mockWorkspaceRoot;
  });
  
  describe('diffToClipboard', () => {
    test('変更があればクリップボードにコピーする', async () => {
      // collectChangedFiles モックの設定
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      // 実行
      await commandRegistrar.diffToClipboard();
      
      // 検証
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(copyToClipboard).toHaveBeenCalledWith(mockMarkdown);
    });
    
    test('変更がない場合はメッセージを表示する', async () => {
      // 変更なしのケース
      (collectChangedFiles as jest.Mock).mockResolvedValue([]);
      
      // 実行
      await commandRegistrar.diffToClipboard();
      
      // 検証
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(copyToClipboard).not.toHaveBeenCalled();
    });
    
    test('エラー発生時はエラーメッセージを表示する', async () => {
      // エラーケース
      (collectChangedFiles as jest.Mock).mockRejectedValue(new GitNotRepositoryError());
      
      // 実行
      await commandRegistrar.diffToClipboard();
      
      // 検証
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(copyToClipboard).not.toHaveBeenCalled();
    });
  });
  
  describe('diffToEditor', () => {
    test('変更があればエディタに表示する', async () => {
      // collectChangedFiles モックの設定
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      // 実行
      await commandRegistrar.diffToEditor();
      
      // 検証
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(showInEditor).toHaveBeenCalledWith(mockMarkdown);
    });
  });
  
  describe('diffToChatGPT', () => {
    test('変更があればChatGPTに送信する', async () => {
      // collectChangedFiles モックの設定
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      // 実行
      await commandRegistrar.diffToChatGPT();
      
      // 検証
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(openInChatGPT).toHaveBeenCalledWith(mockMarkdown);
    });
  });
}); 