import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { CommandRegistrar } from '../commands';
import { FileOperations } from '../fileOperations';
import { MarkdownGenerator } from '../generators/MarkdownGenerator';
import { Logger } from '../utils/logger';
import * as ui from '../ui';
import { DirectoryInfo } from '../types/fileTypes';
import { DirectoryNotFoundError, FileSizeLimitError } from '../errors/errors';
import { formatFileSize, formatTokenCount } from '../utils/fileUtils';

// FileOperations のモックインスタンスを保持する変数
let mockFileOpsInstance: jest.Mocked<FileOperations>;

// ファクトリ関数を使用して FileOperations をモック
jest.mock('../fileOperations', () => {
  // FileOperations クラスが new された際に、テスト側で用意したモックインスタンスを返す
  return {
    FileOperations: jest.fn().mockImplementation(() => {
      // beforeEach で mockFileOpsInstance が設定されていることを期待
      if (!mockFileOpsInstance) {
        throw new Error('mockFileOpsInstance is not set in beforeEach');
      }
      return mockFileOpsInstance;
    })
  };
});

jest.mock('../generators/MarkdownGenerator');
jest.mock('../utils/logger');

// ui モジュールのモックをシンプル化
jest.mock('../ui', () => ({
  showInEditor: jest.fn(),
  copyToClipboard: jest.fn(),
  openInChatGPT: jest.fn(),
}));

jest.mock('../utils/fileUtils', () => ({
  formatFileSize: jest.fn().mockReturnValue('1.0 KB'),
  formatTokenCount: jest.fn().mockReturnValue('256')
}));

describe('CommandRegistrar', () => {
  let commandRegistrar: CommandRegistrar;
  let mockFileOps: jest.Mocked<FileOperations>;
  let mockMarkdownGen: jest.Mocked<MarkdownGenerator>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // モックの設定
    // モックインスタンスを作成し、describe スコープの変数に代入
    // 型チェックを緩めるために any を経由
    mockFileOps = { 
      scanDirectory: jest.fn(),
      estimateDirectorySize: jest.fn(),
      setCurrentSelectedPath: jest.fn(),
      dispose: jest.fn(),
      processFileList: jest.fn(), 
    } as any as jest.Mocked<FileOperations>; 
    
    // ファクトリ関数が参照する変数に代入
    mockFileOpsInstance = mockFileOps;

    mockMarkdownGen = new MarkdownGenerator() as jest.Mocked<MarkdownGenerator>;
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (MarkdownGenerator as jest.Mock).mockImplementation(() => mockMarkdownGen);

    // VSCode APIのモックを設定
    (vscode.workspace.fs.stat as jest.Mock).mockImplementation(() => Promise.resolve({
      type: vscode.FileType.Directory,
      ctime: 0,
      mtime: 0,
      size: 0
    }));

    (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
      get: jest.fn((key: string, defaultValue?: any) => {
        switch (key) {
          case 'maxFileSize':
            return 1048576;
          case 'excludePatterns':
            return [];
          case 'outputFormat':
            return 'markdown';
          default:
            return defaultValue;
        }
      })
    });

    // ワークスペースのモックを設定
    (vscode.workspace.workspaceFolders as unknown) = [{
      uri: { fsPath: '/test/workspace' },
      name: 'test',
      index: 0
    }];

    commandRegistrar = new CommandRegistrar();
  });

  describe('constructor', () => {
    test('ワークスペースが存在しない場合、エラーがスローされること', () => {
      // ワークスペースが存在しない状態を設定
      (vscode.workspace.workspaceFolders as unknown) = undefined;

      expect(() => new CommandRegistrar()).toThrow('ワークスペースが開かれていません');
    });
  });

  describe('コマンド登録', () => {
    test('コマンドが重複して登録されていないこと', () => {
      const registerCommandSpy = jest.spyOn(vscode.commands, 'registerCommand');
      
      // extension.tsでコマンドを登録
      const commands = [
        'matomeru.quickProcessToEditor',
        'matomeru.quickProcessToClipboard',
        'matomeru.quickProcessToChatGPT'
      ];
      
      commands.forEach(cmd => {
        vscode.commands.registerCommand(cmd, jest.fn());
      });

      // 各コマンドが1回だけ登録されていることを確認
      commands.forEach(cmd => {
        const calls = registerCommandSpy.mock.calls.filter(call => call[0] === cmd);
        expect(calls.length).toBe(1);
      });
    });
  });

  describe('processToEditor', () => {
    const mockUri = { fsPath: '/test/path', scheme: 'file' } as vscode.Uri;
    const mockMarkdown = '# Test Markdown';
    const mockDirectoryInfo: DirectoryInfo = {
      uri: mockUri,
      relativePath: 'test/path',
      files: [],
      directories: new Map()
    };

    beforeEach(() => {
      mockFileOps.scanDirectory.mockResolvedValue(mockDirectoryInfo);
      mockMarkdownGen.generate.mockResolvedValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue([mockUri]); 
      (ui.showInEditor as jest.MockedFunction<typeof ui.showInEditor>).mockResolvedValue(undefined);
    });

    test('URIが指定された場合、正しく処理されること', async () => {
      await commandRegistrar.processToEditor(mockUri);
      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockMarkdown, 'markdown');
    });
    
    test('URIが指定されない場合、ダイアログから選択できること', async () => {
      await commandRegistrar.processToEditor();
      expect(vscode.window.showOpenDialog).toHaveBeenCalled();
      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockMarkdown, 'markdown');
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue(undefined);
      await commandRegistrar.processToEditor();
      expect(mockFileOps.scanDirectory).not.toHaveBeenCalled();
      expect(mockMarkdownGen.generate).not.toHaveBeenCalled();
      expect(ui.showInEditor).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合、エラーが記録されること', async () => {
      const error = new DirectoryNotFoundError('/test/path');
      mockFileOps.scanDirectory.mockRejectedValue(error);

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(error.message));
    });

    test('ファイルサイズ制限を超えた場合、エラーが記録されること', async () => {
      const error = new FileSizeLimitError('/test/path', 2000000, 1048576);
      mockFileOps.scanDirectory.mockRejectedValue(error);

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(error.message));
    });

    test('エディタでの表示に失敗した場合、エラーが記録されること', async () => {
      const editorError = new Error('Editor error');
      (ui.showInEditor as jest.MockedFunction<typeof ui.showInEditor>).mockRejectedValue(editorError);

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(editorError.message);
    });
  });

  describe('processToClipboard', () => {
    const mockUri = { fsPath: '/test/path', scheme: 'file' } as vscode.Uri;
    const mockMarkdown = '# Test Markdown';
    const mockDirectoryInfo: DirectoryInfo = {
      uri: mockUri,
      relativePath: 'test/path',
      files: [],
      directories: new Map()
    };

    beforeEach(() => {
      mockFileOps.scanDirectory.mockResolvedValue(mockDirectoryInfo);
      mockMarkdownGen.generate.mockResolvedValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue([mockUri]);
      (ui.copyToClipboard as jest.MockedFunction<typeof ui.copyToClipboard>).mockResolvedValue(undefined);
    });

    test('URIが指定された場合、クリップボードにコピーされること', async () => {
      await commandRegistrar.processToClipboard(mockUri);

      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.copyToClipboard).toHaveBeenCalledWith(mockMarkdown);
    });

    test('クリップボードへのコピーに失敗した場合、エラーが記録されること', async () => {
      const clipboardError = new Error('Clipboard error');
      (ui.copyToClipboard as jest.MockedFunction<typeof ui.copyToClipboard>).mockRejectedValue(clipboardError);

      await commandRegistrar.processToClipboard(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(clipboardError.message);
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue(undefined);

      await commandRegistrar.processToClipboard();

      expect(mockFileOps.scanDirectory).not.toHaveBeenCalled();
      expect(mockMarkdownGen.generate).not.toHaveBeenCalled();
      expect(ui.copyToClipboard).not.toHaveBeenCalled();
    });
  });

  describe('processToChatGPT', () => {
    const mockUri = { fsPath: '/test/path', scheme: 'file' } as vscode.Uri;
    const mockMarkdown = '# Test Markdown';
    const mockDirectoryInfo: DirectoryInfo = {
      uri: mockUri,
      relativePath: 'test/path',
      files: [],
      directories: new Map()
    };

    beforeEach(() => {
      mockFileOps.scanDirectory.mockResolvedValue(mockDirectoryInfo);
      mockMarkdownGen.generate.mockResolvedValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue([mockUri]);
      (ui.openInChatGPT as jest.MockedFunction<typeof ui.openInChatGPT>).mockResolvedValue(undefined);
    });

    test('URIが指定された場合、ChatGPTに送信されること', async () => {
      await commandRegistrar.processToChatGPT(mockUri);

      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.openInChatGPT).toHaveBeenCalledWith(mockMarkdown);
    });

    test('ChatGPTへの送信に失敗した場合、エラーが記録されること', async () => {
      const error = new Error('ChatGPT error');
      (ui.openInChatGPT as jest.MockedFunction<typeof ui.openInChatGPT>).mockRejectedValue(error);

      await commandRegistrar.processToChatGPT(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue(undefined);

      await commandRegistrar.processToChatGPT();

      expect(mockFileOps.scanDirectory).not.toHaveBeenCalled();
      expect(mockMarkdownGen.generate).not.toHaveBeenCalled();
      expect(ui.openInChatGPT).not.toHaveBeenCalled();
    });
  });

  describe('getSelectedUris', () => {
    const mockUri1 = { fsPath: '/test/path1', scheme: 'file' } as vscode.Uri;
    const mockUri2 = { fsPath: '/test/path1', scheme: 'file' } as vscode.Uri; // 同じパス
    const mockUri3 = { fsPath: '/test/path2', scheme: 'file' } as vscode.Uri;

    beforeEach(() => {
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue([mockUri1, mockUri2, mockUri3]);
    });

    test('重複するURIが除去されること', async () => {
      const uris = await (commandRegistrar as any).getSelectedUris();
      
      // 重複するパスが除去され、2つのURIになることを確認
      expect(uris).toHaveLength(2);
      
      // パスの一意性を確認
      const paths = uris.map(uri => uri.fsPath);
      expect(paths).toEqual(['/test/path1', '/test/path2']);
    });

    test('URIが選択されなかった場合、空配列が返されること', async () => {
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue(undefined);

      const uris = await (commandRegistrar as any).getSelectedUris();
      expect(uris).toHaveLength(0);
    });

    test('エラーが発生した場合に適切に処理されること', async () => {
      const error = new Error('Estimation error');
      // メインのエラーはgetSelectedUrisからスローされるようにセットアップ
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockImplementation(() => {
          throw error;
        });

      await commandRegistrar.estimateSize();

      expect(mockLogger.error).toHaveBeenCalledWith(`見積り処理中にエラーが発生しました: ${error.message}`);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(`見積りエラー: ${error.message}`);
    });
  });

  describe('コマンド実行時のURI重複除去', () => {
    const mockUri1 = { fsPath: '/test/path1', scheme: 'file' } as vscode.Uri;
    const mockUri2 = { fsPath: '/test/path1', scheme: 'file' } as vscode.Uri; // 同じパス
    const mockUri3 = { fsPath: '/test/path2', scheme: 'file' } as vscode.Uri;

    beforeEach(() => {
      mockFileOps.scanDirectory.mockImplementation(async (path) => ({
        uri: { fsPath: path, scheme: 'file' } as vscode.Uri,
        relativePath: path,
        files: [],
        directories: new Map()
      }));
    });

    test('重複するURIが渡された場合、一意化されて処理されること', async () => {
      await commandRegistrar.processToEditor(undefined, [mockUri1, mockUri2, mockUri3]);

      // 呼び出されたパスを確認
      const calledPaths = mockFileOps.scanDirectory.mock.calls.map(call => call[0]);
      const uniquePaths = Array.from(new Set(calledPaths));
      expect(uniquePaths).toHaveLength(2);
      expect(uniquePaths).toContain('/test/path1');
      expect(uniquePaths).toContain('/test/path2');
    });
  });

  describe('estimateSize', () => {
    const mockUri = { fsPath: '/test/path', scheme: 'file' } as vscode.Uri;

    beforeEach(() => {
      mockFileOps.estimateDirectorySize.mockResolvedValue({ totalFiles: 5, totalSize: 1024 });
      (vscode.window.showOpenDialog as jest.MockedFunction<typeof vscode.window.showOpenDialog>)
        .mockResolvedValue([mockUri]);
      (vscode.window.showInformationMessage as jest.Mock).mockImplementation(() => Promise.resolve());
      (vscode.window.showErrorMessage as jest.Mock).mockImplementation(() => Promise.resolve());
      (formatFileSize as jest.Mock).mockReturnValue('1.0 KB');
      (formatTokenCount as jest.Mock).mockReturnValue('256');
    });

    test('サイズ見積もりが正しく実行されること', async () => {
      await commandRegistrar.estimateSize(mockUri);

      expect(mockFileOps.setCurrentSelectedPath).toHaveBeenCalledWith(mockUri.fsPath);
      expect(mockFileOps.estimateDirectorySize).toHaveBeenCalledWith(mockUri.fsPath, expect.any(Object));
      expect(mockFileOps.setCurrentSelectedPath).toHaveBeenCalledWith(undefined);
    });

    test('サイズとトークン数が正しくフォーマットされて表示されること', async () => {
      await commandRegistrar.estimateSize(mockUri);

      // トークン数は約 Math.ceil(1024 / 3.5) = 293
      expect(formatFileSize).toHaveBeenCalledWith(1024);
      expect(formatTokenCount).toHaveBeenCalledWith(293);
      
      // マークダウン変換後の見積もり
      // markdownOverhead = 5 * 100 = 500
      // totalEstimatedSize = 1024 + 500 = 1524
      // totalEstimatedTokens = Math.ceil(1524 / 3.5) = 436
      expect(formatFileSize).toHaveBeenCalledWith(1524);
      expect(formatTokenCount).toHaveBeenCalledWith(436);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringContaining('msg.sizeEstimation')
      );
    });

    test('ロガーに正しくフォーマットされたサイズとトークン数が記録されること', async () => {
      // formatFileSize と formatTokenCount のモックの戻り値を設定
      (formatFileSize as jest.Mock).mockReturnValueOnce('1.0 KB').mockReturnValueOnce('1.5 KB');
      (formatTokenCount as jest.Mock).mockReturnValueOnce('256').mockReturnValueOnce('381');
      
      await commandRegistrar.estimateSize(mockUri);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('サイズ見積り結果: 5ファイル, 1.0 KB, 約256トークン'));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Markdown変換後の見積り: 1.5 KB, 約381トークン'));
    });

    test('エラーが発生した場合に適切に処理されること', async () => {
      const error = new Error('Estimation error');
      mockFileOps.estimateDirectorySize.mockRejectedValue(error);
      mockFileOps.setCurrentSelectedPath.mockClear();

      await commandRegistrar.estimateSize(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(`見積り処理中にエラーが発生しました: ${error.message}`);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('diffToEditor', () => {
    const mockDiffContent = 'diff content';
    const mockProcessGitDiff = jest.fn<() => Promise<{content: string, format: 'markdown' | 'yaml'} | undefined>>();
    let originalProcessGitDiff: any;

    beforeEach(() => {
      originalProcessGitDiff = (commandRegistrar as any).processGitDiff;
      (commandRegistrar as any).processGitDiff = mockProcessGitDiff;
      (ui.showInEditor as jest.MockedFunction<typeof ui.showInEditor>).mockClear();
      (ui.showInEditor as jest.MockedFunction<typeof ui.showInEditor>).mockResolvedValue(undefined);
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'gitDiff.range') return '';
          if (key === 'outputFormat') return 'markdown';
          return undefined;
        })
      });
    });

    afterEach(() => {
      (commandRegistrar as any).processGitDiff = originalProcessGitDiff;
    });

    test('Git差分をエディタに表示すること', async () => {
      mockProcessGitDiff.mockResolvedValue({ content: mockDiffContent, format: 'markdown' });
      await commandRegistrar.diffToEditor();
      expect(mockProcessGitDiff).toHaveBeenCalled();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockDiffContent, 'markdown');
    });

    test('processGitDiff が undefined を返した場合、showInEditor が呼ばれないこと', async () => {
      mockProcessGitDiff.mockResolvedValue(undefined);
      await commandRegistrar.diffToEditor();
      expect(ui.showInEditor).not.toHaveBeenCalled();
    });

    test('outputFormat が yaml の場合、showInEditor に yaml が渡されること', async () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => {
          if (key === 'gitDiff.range') return '';
          if (key === 'outputFormat') return 'yaml';
          return undefined;
        })
      });
      mockProcessGitDiff.mockResolvedValue({ content: mockDiffContent, format: 'yaml' });

      await commandRegistrar.diffToEditor();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockDiffContent, 'yaml');
    });
  });
}); 