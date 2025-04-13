import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';
import { activate } from '../extension';

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
        processToChatGPT: jest.fn(),
        estimateSize: jest.fn()
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
    let mockShowOpenDialog: jest.Mock;
    let mockStat: jest.Mock;
    let mockShowTextDocument: jest.Mock;
    let mockCreateTextDocument: jest.Mock;
    let mockEnv: jest.Mock;

    // 保存する各モック対象の元の関数
    let originalShowOpenDialog: typeof vscode.window.showOpenDialog;
    let originalShowTextDocument: typeof vscode.window.showTextDocument;
    let originalFsStat: typeof vscode.workspace.fs.stat;
    let originalOpenTextDocument: typeof vscode.workspace.openTextDocument;
    let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;
    let originalClipboardWriteText: typeof vscode.env.clipboard.writeText;
    let originalOpenExternal: typeof vscode.env.openExternal;

    beforeEach(() => {
        originalPlatform = process.platform;
        jest.clearAllMocks();

        mockExecuteCommand.mockResolvedValue(undefined);
        mockGetConfiguration.mockReturnValue({
            get: jest.fn().mockReturnValue(false)
        });

        // モック関数の準備
        mockShowOpenDialog = jest.fn();
        mockStat = jest.fn();
        mockShowTextDocument = jest.fn();
        mockCreateTextDocument = jest.fn();
        mockEnv = jest.fn();

        // 個々の元のプロパティを保存する
        originalShowOpenDialog = vscode.window.showOpenDialog;
        originalShowTextDocument = vscode.window.showTextDocument;
        originalFsStat = vscode.workspace.fs.stat;
        originalOpenTextDocument = vscode.workspace.openTextDocument;
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        originalClipboardWriteText = vscode.env.clipboard.writeText;
        originalOpenExternal = vscode.env.openExternal;

        // VSCode APIのモックを直接代入
        (vscode as any).window.showOpenDialog = mockShowOpenDialog;
        (vscode as any).window.showTextDocument = mockShowTextDocument;
        (vscode as any).workspace.fs.stat = mockStat;
        (vscode as any).workspace.openTextDocument = mockCreateTextDocument;
        (vscode as any).workspace.workspaceFolders = [{
            uri: vscode.Uri.file('/test/workspace'),
            name: 'test',
            index: 0
        }];
        (vscode as any).env.clipboard.writeText = mockEnv;
        (vscode as any).env.openExternal = jest.fn();

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
        // 個々のプロパティのみ元に戻す
        (vscode as any).window.showOpenDialog = originalShowOpenDialog;
        (vscode as any).window.showTextDocument = originalShowTextDocument;
        (vscode as any).workspace.fs.stat = originalFsStat;
        (vscode as any).workspace.openTextDocument = originalOpenTextDocument;
        (vscode as any).workspace.workspaceFolders = originalWorkspaceFolders;
        (vscode as any).env.clipboard.writeText = originalClipboardWriteText;
        (vscode as any).env.openExternal = originalOpenExternal;
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
            expect(mockRegisterCommand).toHaveBeenCalledWith('matomeru.estimateSize', expect.any(Function));
        });
    });
});
