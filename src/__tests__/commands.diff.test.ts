import * as vscode from 'vscode';
import { CommandRegistrar } from '../commands';
import { FileOperations } from '../fileOperations';
import { collectChangedFiles, GitNotRepositoryError } from '../utils/gitUtils';
import { copyToClipboard, showInEditor, openInChatGPT } from '../ui';
import { MarkdownGenerator } from '../generators/MarkdownGenerator';
import { YamlGenerator } from '../generators/YamlGenerator';

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
        get: jest.fn((_key: string, defaultValue?: any) => defaultValue)
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
  let mockFileOps: jest.Mocked<FileOperations>;
  
  // MarkdownGenerator と YamlGenerator の generate メソッドをスパイするための準備
  let markdownGenerateSpy: jest.SpyInstance;
  let yamlGenerateSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn().mockImplementation((key: string) => {
        // デフォルトでは markdown を返すようにしておく (各テストケースで上書き可能)
        if (key === 'gitDiff.range') return '';
        if (key === 'outputFormat') return 'markdown';
        return undefined; 
      })
    });

    mockFileOps = {
      processFileList: jest.fn().mockResolvedValue([{
        uri: { fsPath: 'dir1' } as vscode.Uri,
        relativePath: 'dir1',
        files: [{
          uri: { fsPath: 'file1.ts' } as vscode.Uri,
          relativePath: 'file1.ts',
          content: 'test content',
          language: 'typescript',
          size: 100
        }],
        directories: new Map()
      }]),
      scanDirectory: jest.fn(),
      estimateDirectorySize: jest.fn(),
      setCurrentSelectedPath: jest.fn(),
      dispose: jest.fn()
    } as any;
    
    // getGenerator のスパイは削除
    // const mockGenerator = {
    //   generate: jest.fn().mockResolvedValue(mockMarkdown)
    // };
    // jest.spyOn(CommandRegistrar.prototype as any, 'getGenerator').mockResolvedValue(mockGenerator);

    // Generator のプロトタイプメソッドをスパイ
    markdownGenerateSpy = jest.spyOn(MarkdownGenerator.prototype, 'generate').mockResolvedValue(mockMarkdown);
    yamlGenerateSpy = jest.spyOn(YamlGenerator.prototype, 'generate'); // YAMLテスト側で mockResolvedValue を設定

    commandRegistrar = new CommandRegistrar();
    (commandRegistrar as any).fileOps = mockFileOps;
    (commandRegistrar as any).workspaceRoot = mockWorkspaceRoot;
  });

  afterEach(() => {
    // スパイをリストア
    markdownGenerateSpy.mockRestore();
    yamlGenerateSpy.mockRestore();
  });
  
  describe('diffToClipboard', () => {
    test('変更があればクリップボードにコピーする', async () => {
      // outputFormat を markdown に設定 (beforeEach のデフォルト)
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      await commandRegistrar.diffToClipboard();
      
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(markdownGenerateSpy).toHaveBeenCalled();
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

    test('変更があればクリップボードにYAML形式でコピーする', async () => {
      // outputFormat を yaml に設定
      (vscode.workspace.getConfiguration() as any).get = jest.fn().mockImplementation((key: string) => {
        if (key === 'gitDiff.range') return '';
        if (key === 'outputFormat') return 'yaml';
        return undefined;
      });

      const mockYamlContent = 'project_overview: Test YAML\nfiles:\n  - path: file1.ts\n    content: test content';
      yamlGenerateSpy.mockResolvedValue(mockYamlContent);

      const mockFiles = [{ fsPath: 'file1.ts' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);

      await commandRegistrar.diffToClipboard();

      expect(collectChangedFiles).toHaveBeenCalled();
      expect(yamlGenerateSpy).toHaveBeenCalled();
      expect(copyToClipboard).toHaveBeenCalledWith(mockYamlContent);
    });
  });
  
  describe('diffToEditor', () => {
    test('変更があればエディタに表示する', async () => {
      // outputFormat を markdown に設定 (beforeEach のデフォルト)
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      await commandRegistrar.diffToEditor();
      
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(markdownGenerateSpy).toHaveBeenCalled();
      expect(showInEditor).toHaveBeenCalledWith(mockMarkdown, 'markdown');
    });

    test('変更があればエディタにYAML形式で表示する', async () => {
      // outputFormat を yaml に設定
      (vscode.workspace.getConfiguration() as any).get = jest.fn().mockImplementation((key: string) => {
        if (key === 'gitDiff.range') return '';
        if (key === 'outputFormat') return 'yaml';
        return undefined;
      });

      const mockYamlContent = 'project_overview: Test YAML\nfiles:\n  - path: file1.ts\n    content: test content';
      yamlGenerateSpy.mockResolvedValue(mockYamlContent);

      const mockFiles = [{ fsPath: 'file1.ts' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);

      await commandRegistrar.diffToEditor();

      expect(collectChangedFiles).toHaveBeenCalled();
      expect(yamlGenerateSpy).toHaveBeenCalled();
      expect(showInEditor).toHaveBeenCalledWith(mockYamlContent, 'yaml');
    });
  });
  
  describe('diffToChatGPT', () => {
    test('変更があればChatGPTに送信する', async () => {
      // outputFormat を markdown に設定 (beforeEach のデフォルト)
      const mockFiles = [{ fsPath: 'file1.ts' }, { fsPath: 'file2.js' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);
      
      await commandRegistrar.diffToChatGPT();
      
      expect(collectChangedFiles).toHaveBeenCalled();
      expect(markdownGenerateSpy).toHaveBeenCalled();
      expect(openInChatGPT).toHaveBeenCalledWith(mockMarkdown);
    });

    test('変更があればChatGPTにYAML形式で送信する', async () => {
      // outputFormat を yaml に設定
      (vscode.workspace.getConfiguration() as any).get = jest.fn().mockImplementation((key: string) => {
        if (key === 'gitDiff.range') return '';
        if (key === 'outputFormat') return 'yaml';
        return undefined;
      });

      const mockYamlContent = 'project_overview: Test YAML\nfiles:\n  - path: file1.ts\n    content: test content';
      yamlGenerateSpy.mockResolvedValue(mockYamlContent);

      const mockFiles = [{ fsPath: 'file1.ts' }];
      (collectChangedFiles as jest.Mock).mockResolvedValue(mockFiles);

      await commandRegistrar.diffToChatGPT();

      expect(collectChangedFiles).toHaveBeenCalled();
      expect(yamlGenerateSpy).toHaveBeenCalled();
      expect(openInChatGPT).toHaveBeenCalledWith(mockYamlContent);
    });
  });
}); 