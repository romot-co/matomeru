import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import * as vscode from 'vscode';
import { CommandRegistrar } from '../commands';
import { FileOperations } from '../fileOperations';
import { MarkdownGenerator } from '../markdownGenerator';
import { Logger } from '../utils/logger';
import * as ui from '../ui';
import { DirectoryInfo } from '../types/fileTypes';
import { DirectoryNotFoundError, FileSizeLimitError } from '../errors/errors';

// モックの設定
jest.mock('../fileOperations');
jest.mock('../markdownGenerator');
jest.mock('../utils/logger');
jest.mock('../ui');

describe('CommandRegistrar', () => {
  let commandRegistrar: CommandRegistrar;
  let mockContext: vscode.ExtensionContext;
  let mockFileOps: jest.Mocked<FileOperations>;
  let mockMarkdownGen: jest.Mocked<MarkdownGenerator>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // モックの設定
    mockContext = {
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;

    mockFileOps = new FileOperations('') as jest.Mocked<FileOperations>;
    mockMarkdownGen = new MarkdownGenerator() as jest.Mocked<MarkdownGenerator>;
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
    (FileOperations as jest.Mock).mockImplementation(() => mockFileOps);
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

  describe('register', () => {
    test('コマンドが正しく登録されること', () => {
      commandRegistrar.register(mockContext);
      
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(4);
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'matomeru.process',
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'matomeru.quickProcessToEditor',
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'matomeru.quickProcessToClipboard',
        expect.any(Function)
      );
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'matomeru.quickProcessToChatGPT',
        expect.any(Function)
      );
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
      mockMarkdownGen.generate.mockReturnValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve([mockUri]));
      (ui.showInEditor as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    test('URIが指定された場合、正しく処理されること', async () => {
      await commandRegistrar.processToEditor(mockUri);

      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockMarkdown);
    });

    test('URIが指定されない場合、ダイアログから選択できること', async () => {
      await commandRegistrar.processToEditor();

      expect(vscode.window.showOpenDialog).toHaveBeenCalled();
      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.showInEditor).toHaveBeenCalledWith(mockMarkdown);
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve(undefined));

      await commandRegistrar.processToEditor();

      expect(mockFileOps.scanDirectory).not.toHaveBeenCalled();
      expect(mockMarkdownGen.generate).not.toHaveBeenCalled();
      expect(ui.showInEditor).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合、エラーが記録されること', async () => {
      const error = new DirectoryNotFoundError('/test/path');
      mockFileOps.scanDirectory.mockRejectedValue(error);

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
    });

    test('ファイルサイズ制限を超えた場合、エラーが記録されること', async () => {
      const error = new FileSizeLimitError('/test/path', 2000000, 1048576);
      mockFileOps.scanDirectory.mockRejectedValue(error);

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
    });

    test('エディタでの表示に失敗した場合、エラーが記録されること', async () => {
      const error = new Error('Editor error');
      (ui.showInEditor as jest.Mock).mockImplementation(() => Promise.reject(error));

      await commandRegistrar.processToEditor(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
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
      mockMarkdownGen.generate.mockReturnValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve([mockUri]));
      (ui.copyToClipboard as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    test('URIが指定された場合、クリップボードにコピーされること', async () => {
      await commandRegistrar.processToClipboard(mockUri);

      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.copyToClipboard).toHaveBeenCalledWith(mockMarkdown);
    });

    test('クリップボードへのコピーに失敗した場合、エラーが記録されること', async () => {
      const error = new Error('Clipboard error');
      (ui.copyToClipboard as jest.Mock).mockImplementation(() => Promise.reject(error));

      await commandRegistrar.processToClipboard(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve(undefined));

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
      mockMarkdownGen.generate.mockReturnValue(mockMarkdown);
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve([mockUri]));
      (ui.openInChatGPT as jest.Mock).mockImplementation(() => Promise.resolve());
    });

    test('URIが指定された場合、ChatGPTに送信されること', async () => {
      await commandRegistrar.processToChatGPT(mockUri);

      expect(mockFileOps.scanDirectory).toHaveBeenCalled();
      expect(mockMarkdownGen.generate).toHaveBeenCalled();
      expect(ui.openInChatGPT).toHaveBeenCalledWith(mockMarkdown);
    });

    test('ChatGPTへの送信に失敗した場合、エラーが記録されること', async () => {
      const error = new Error('ChatGPT error');
      (ui.openInChatGPT as jest.Mock).mockImplementation(() => Promise.reject(error));

      await commandRegistrar.processToChatGPT(mockUri);

      expect(mockLogger.error).toHaveBeenCalledWith(error.message);
    });

    test('ダイアログでキャンセルされた場合、処理が中断されること', async () => {
      (vscode.window.showOpenDialog as jest.Mock).mockImplementation(() => Promise.resolve(undefined));

      await commandRegistrar.processToChatGPT();

      expect(mockFileOps.scanDirectory).not.toHaveBeenCalled();
      expect(mockMarkdownGen.generate).not.toHaveBeenCalled();
      expect(ui.openInChatGPT).not.toHaveBeenCalled();
    });
  });
}); 