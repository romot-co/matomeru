import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { activate } from '../extension';
import { MarkdownGenerator } from '../markdownGenerator';
import { DirectoryInfo, FileInfo } from '../types/fileTypes';
import { CommandRegistrar } from '../commands';
import { Logger } from '../utils/logger';

// VSCodeモジュールからモック関数を取得
const mockExecuteCommand = vscode.commands.executeCommand as jest.Mock;
const mockRegisterCommand = vscode.commands.registerCommand as jest.Mock;
const mockOnDidChangeConfiguration = vscode.workspace.onDidChangeConfiguration as jest.Mock;
const mockGetConfiguration = vscode.workspace.getConfiguration as jest.Mock;

// CommandRegistrar のモック
jest.mock('../commands', () => ({
    CommandRegistrar: jest.fn().mockImplementation(() => ({
        processToEditor: jest.fn(),
        processToClipboard: jest.fn(),
        processToChatGPT: jest.fn()
    }))
}));

// Logger のモック
jest.mock('../utils/logger', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            dispose: jest.fn()
        })
    }
}));

describe('Extension Activation', () => {
    let originalPlatform: string;
    let mockContext: ExtensionContext;

    beforeEach(() => {
        originalPlatform = process.platform;
        jest.clearAllMocks();

        mockExecuteCommand.mockResolvedValue(undefined);
        mockGetConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue(false)
        });

        // ExtensionContext のモック
        mockContext = {
            subscriptions: [],
            workspaceState: { get: jest.fn(), update: jest.fn() },
            globalState: { get: jest.fn(), update: jest.fn(), setKeysForSync: jest.fn() },
            secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
            extensionUri: { fsPath: '/test/extension' },
            extensionPath: '/test/extension',
            asAbsolutePath: jest.fn(),
            storageUri: { fsPath: '/test/storage' },
            storagePath: '/test/storage',
            globalStorageUri: { fsPath: '/test/global-storage' },
            globalStoragePath: '/test/global-storage',
            logUri: { fsPath: '/test/log' },
            logPath: '/test/log',
            extensionMode: 1
        } as unknown as ExtensionContext;
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    describe('OS判定とコンテキスト設定', () => {
        test('macOSの場合、isOSXがtrueに設定されること', async () => {
            Object.defineProperty(process, 'platform', { value: 'darwin' });
            await activate(mockContext);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'isOSX', true);
        });

        test('macOS以外の場合、isOSXがfalseに設定されること', async () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            await activate(mockContext);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'isOSX', false);
        });

        test('Linux環境でもisOSXがfalseに設定されること', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            await activate(mockContext);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'isOSX', false);
        });
    });

    describe('ChatGPT連携の設定', () => {
        test('設定がfalseの場合、chatGptIntegrationがfalseに設定されること', async () => {
            mockGetConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(false)
            });
            await activate(mockContext);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'matomeru.chatGptIntegration', false);
        });

        test('設定がtrueの場合、chatGptIntegrationがtrueに設定されること', async () => {
            mockGetConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(true)
            });
            await activate(mockContext);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'matomeru.chatGptIntegration', true);
        });

        test('設定変更時にコンテキストが更新されること', async () => {
            await activate(mockContext);
            const configChangeCallback = mockOnDidChangeConfiguration.mock.calls[0][0];
            // getConfiguration を更新して chatGptIntegration が true になるようにする
            mockGetConfiguration.mockReturnValue({
                get: jest.fn().mockReturnValue(true)
            });
            const fakeEvent = { affectsConfiguration: () => true } as any;
            configChangeCallback(fakeEvent);
            expect(mockExecuteCommand).toHaveBeenCalledWith('setContext', 'matomeru.chatGptIntegration', true);
        });

        test('関係のない設定変更ではコンテキストが更新されないこと', async () => {
            await activate(mockContext);
            const configChangeCallback = mockOnDidChangeConfiguration.mock.calls[0][0];
            const initialCallCount = mockExecuteCommand.mock.calls.length;
            const fakeEvent = { affectsConfiguration: () => false } as any;
            configChangeCallback(fakeEvent);
            // 関係のない設定変更の場合、新たな executeCommand の呼び出しは行われないはず
            expect(mockExecuteCommand.mock.calls.length).toBe(initialCallCount);
        });
    });

    describe('コマンド登録', () => {
        test('必要なコマンドが全て登録されること', async () => {
            await activate(mockContext);
            expect(mockRegisterCommand).toHaveBeenCalledWith('matomeru.quickProcessToEditor', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('matomeru.quickProcessToClipboard', expect.any(Function));
            expect(mockRegisterCommand).toHaveBeenCalledWith('matomeru.quickProcessToChatGPT', expect.any(Function));
        });
    });
});

describe('MarkdownGenerator', () => {
    let markdownGenerator: MarkdownGenerator;

    beforeEach(() => {
        markdownGenerator = new MarkdownGenerator();
    });

    describe('generate', () => {
        test('空のディレクトリリストの場合、空文字列を返すこと', () => {
            const result = markdownGenerator.generate([]);
            expect(result).toBe('');
        });

        test('単一のファイルを含むディレクトリの場合、正しいMarkdownを生成すること', () => {
            const testFile: FileInfo = {
                uri: vscode.Uri.file('/test/src/test.ts'),
                relativePath: 'src/test.ts',
                content: 'console.log("test");',
                size: 1024,
                language: 'typescript'
            };

            const testDir: DirectoryInfo = {
                uri: vscode.Uri.file('/test/src'),
                relativePath: 'src',
                files: [testFile],
                directories: new Map()
            };

            const result = markdownGenerator.generate([testDir]);
            expect(result).toContain('# Directory Structure');
            expect(result).toContain('# File Contents');
            expect(result).toContain('## src/test.ts');
            expect(result).toContain('- Size: 1 KB');
            expect(result).toContain('- Language: typescript');
            expect(result).toContain('```typescript');
            expect(result).toContain('console.log("test");');
        });

        test('複数のファイルとサブディレクトリを含む場合、正しいMarkdownを生成すること', () => {
            const file1: FileInfo = {
                uri: vscode.Uri.file('/test/src/index.ts'),
                relativePath: 'src/index.ts',
                content: 'export const test = 1;',
                size: 512,
                language: 'typescript'
            };

            const file2: FileInfo = {
                uri: vscode.Uri.file('/test/src/utils/utils.ts'),
                relativePath: 'src/utils/utils.ts',
                content: 'export function helper() {}',
                size: 2048,
                language: 'typescript'
            };

            const utilsDir: DirectoryInfo = {
                uri: vscode.Uri.file('/test/src/utils'),
                relativePath: 'src/utils',
                files: [file2],
                directories: new Map()
            };

            const srcDir: DirectoryInfo = {
                uri: vscode.Uri.file('/test/src'),
                relativePath: 'src',
                files: [file1],
                directories: new Map([['utils', utilsDir]])
            };

            const result = markdownGenerator.generate([srcDir]);
            expect(result).toContain('src/index.ts');
            expect(result).toContain('src/utils/utils.ts');
            expect(result).toContain('- Size: 512 B');
            expect(result).toContain('- Size: 2 KB');
            expect(result).toContain('export const test = 1;');
            expect(result).toContain('export function helper() {}');
        });
    });
});

describe('CommandRegistrar', () => {
    let commandRegistrar: CommandRegistrar;
    let mockShowOpenDialog: jest.Mock;
    let mockStat: jest.Mock;
    let mockShowTextDocument: jest.Mock;
    let mockCreateTextDocument: jest.Mock;
    let mockEnv: jest.Mock;
    let mockLogger: any;
    let originalWindow: any;
    let originalWorkspace: any;
    let originalEnv: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // 元のVSCode APIを保存
        originalWindow = { ...vscode.window };
        originalWorkspace = { ...vscode.workspace };
        originalEnv = { ...vscode.env };

        // VSCode APIのモック
        mockShowOpenDialog = jest.fn();
        mockStat = jest.fn();
        mockShowTextDocument = jest.fn();
        mockCreateTextDocument = jest.fn();
        mockEnv = jest.fn();

        // VSCode APIのモックを設定
        Object.defineProperty(vscode.window, 'showOpenDialog', { value: mockShowOpenDialog });
        Object.defineProperty(vscode.window, 'showTextDocument', { value: mockShowTextDocument });
        Object.defineProperty(vscode.workspace, 'fs', { value: { stat: mockStat } });
        Object.defineProperty(vscode.workspace, 'openTextDocument', { value: mockCreateTextDocument });
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [{
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            }]
        });
        Object.defineProperty(vscode.env, 'clipboard', { value: { writeText: mockEnv } });
        Object.defineProperty(vscode.env, 'openExternal', { value: jest.fn() });

        // 設定のモック
        mockGetConfiguration.mockReturnValue({
            get: jest.fn().mockImplementation((key: string) => {
                switch (key) {
                    case 'maxFileSize':
                        return 1048576;
                    case 'excludePatterns':
                        return [];
                    default:
                        return undefined;
                }
            })
        });

        // Loggerのモック
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        jest.spyOn(Logger, 'getInstance').mockReturnValue(mockLogger);

        commandRegistrar = new CommandRegistrar();
    });

    afterEach(() => {
        // VSCode APIを元に戻す
        Object.defineProperty(vscode, 'window', { value: originalWindow });
        Object.defineProperty(vscode, 'workspace', { value: originalWorkspace });
        Object.defineProperty(vscode, 'env', { value: originalEnv });
    });

    describe('processToEditor', () => {
        test('URIが指定されていない場合、ファイル選択ダイアログを表示すること', async () => {
            mockShowOpenDialog.mockResolvedValue([
                vscode.Uri.file('/test/file1.ts')
            ]);
            mockStat.mockResolvedValue({ type: vscode.FileType.File });
            mockCreateTextDocument.mockResolvedValue({});
            mockShowTextDocument.mockResolvedValue(undefined);

            await commandRegistrar.processToEditor();

            expect(mockShowOpenDialog).toHaveBeenCalledWith({
                canSelectFiles: true,
                canSelectFolders: true,
                canSelectMany: true,
                openLabel: expect.any(String),
                defaultUri: expect.any(Object)
            });
        });

        test('URIが指定された場合、ファイル選択ダイアログを表示せずに処理すること', async () => {
            const testUri = vscode.Uri.file('/test/file1.ts');
            mockStat.mockResolvedValue({ type: vscode.FileType.File });
            mockCreateTextDocument.mockResolvedValue({});
            mockShowTextDocument.mockResolvedValue(undefined);

            await commandRegistrar.processToEditor(testUri);

            expect(mockShowOpenDialog).not.toHaveBeenCalled();
        });
    });

    describe('processToClipboard', () => {
        test('URIが指定された場合、クリップボードにコピーすること', async () => {
            const testUri = vscode.Uri.file('/test/file1.ts');
            mockStat.mockResolvedValue({ type: vscode.FileType.File });
            mockEnv.mockResolvedValue(undefined);

            await commandRegistrar.processToClipboard(testUri);

            expect(mockEnv).toHaveBeenCalled();
        });

        test('URIが指定されていない場合、エラーをログ出力すること', async () => {
            mockShowOpenDialog.mockResolvedValue(undefined);

            await commandRegistrar.processToClipboard();

            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('processToChatGPT', () => {
        test('URIが指定された場合、ChatGPTに送信すること', async () => {
            const testUri = vscode.Uri.file('/test/file1.ts');
            mockStat.mockResolvedValue({ type: vscode.FileType.File });

            await commandRegistrar.processToChatGPT(testUri);

            expect((vscode.env as any).openExternal).toHaveBeenCalled();
        });
    });
});
