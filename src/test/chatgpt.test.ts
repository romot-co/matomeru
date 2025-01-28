import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { PlatformManager } from '../services/PlatformManager';
import { ApplicationCoordinator } from '../extension';
import {
    UnsupportedPlatformError,
    AccessibilityPermissionError,
    ChatGPTAppNotFoundError,
    ChatGPTIntegrationError,
    ChatGPTTimeoutError,
    ChatGPTPermissionError,
    ChatGPTUIError
} from '../errors/ChatGPTErrors';
import { MockFSAdapter } from '../extension';
import { ChatGPTService } from '../services/ChatGPTService';
import { ProductionFSAdapter } from '../services/ProductionFSAdapter';
import { DirectoryScanner } from '../services/DirectoryScanner';
import { MarkdownGenerator } from '../services/MarkdownGenerator';
import { UIController } from '../services/UIController';
import { I18n } from '../services/I18n';
import { ConfigurationManager } from '../services/ConfigurationManager';

suite('ChatGPT Integration Tests', () => {
    let coordinator: ApplicationCoordinator;
    let chatGPTService: ChatGPTService;
    let sandbox: sinon.SinonSandbox;
    const mockContext = {
        subscriptions: [],
        globalState: {
            get: () => ({}),
            update: () => Promise.resolve()
        }
    } as unknown as vscode.ExtensionContext;

    setup(() => {
        const fsAdapter = new ProductionFSAdapter();
        const scanner = new DirectoryScanner(fsAdapter);
        const generator = new MarkdownGenerator();
        const ui = new UIController(mockContext);
        const i18n = I18n.getInstance();
        const config = ConfigurationManager.getInstance();

        coordinator = new ApplicationCoordinator(
            mockContext,
            scanner,
            generator,
            ui,
            i18n,
            config
        );
        chatGPTService = new ChatGPTService();
        sandbox = sinon.createSandbox();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('プラットフォームチェックが正しく機能する', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        
        await assert.rejects(
            () => coordinator.processDirectoryToChatGPT('/test/path'),
            UnsupportedPlatformError
        );
        
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('アクセシビリティ権限チェックが正しく機能する', async () => {
        const stub = sinon.stub(PlatformManager, 'checkAccessibilityPermissions');
        stub.resolves(false);
        
        await assert.rejects(
            () => coordinator.processDirectoryToChatGPT('/test/path'),
            AccessibilityPermissionError
        );
        
        stub.restore();
    });

    test('ChatGPTアプリの存在チェックが正しく機能する', async () => {
        const permissionStub = sinon.stub(PlatformManager, 'checkAccessibilityPermissions');
        permissionStub.resolves(true);
        
        const appStub = sinon.stub(PlatformManager, 'checkChatGPTApp');
        appStub.resolves(false);
        
        await assert.rejects(
            () => coordinator.processDirectoryToChatGPT('/test/path'),
            ChatGPTAppNotFoundError
        );
        
        permissionStub.restore();
        appStub.restore();
    });

    test('統合エラーが正しく処理される', async () => {
        const permissionStub = sinon.stub(PlatformManager, 'checkAccessibilityPermissions');
        permissionStub.resolves(true);
        
        const appStub = sinon.stub(PlatformManager, 'checkChatGPTApp');
        appStub.resolves(true);
        
        const execStub = sinon.stub(require('child_process'), 'exec');
        execStub.callsArgWith(1, new Error('Command failed'));
        
        await assert.rejects(
            () => coordinator.processDirectoryToChatGPT('/test/path'),
            ChatGPTIntegrationError
        );
        
        permissionStub.restore();
        appStub.restore();
        execStub.restore();
    });

    test('正常なフローが正しく機能する', async () => {
        const mockFiles = {
            '/test/path/file1.txt': 'test content 1',
            '/test/path/file2.txt': 'test content 2'
        };
        
        const fsAdapter = new MockFSAdapter(mockFiles);
        coordinator = new ApplicationCoordinator(mockContext);
        
        const permissionStub = sinon.stub(PlatformManager, 'checkAccessibilityPermissions');
        permissionStub.resolves(true);
        
        const appStub = sinon.stub(PlatformManager, 'checkChatGPTApp');
        appStub.resolves(true);
        
        const execStub = sinon.stub(require('child_process'), 'exec');
        execStub.callsArgWith(1, null);
        
        await assert.doesNotReject(
            () => coordinator.processDirectoryToChatGPT('/test/path')
        );
        
        permissionStub.restore();
        appStub.restore();
        execStub.restore();
    });

    test('アクセシビリティ権限の確認', async () => {
        const verifyAccessibilityStub = sandbox.stub(PlatformManager, 'verifyAccessibility');
        verifyAccessibilityStub.rejects(new Error('Permission denied'));

        await assert.rejects(
            () => chatGPTService.sendMessage('test message'),
            (error: any) => {
                assert.ok(error instanceof ChatGPTPermissionError);
                assert.ok(error.message.includes('accessibility'));
                return true;
            }
        );
    });

    test('ウィンドウアクティベーションのエラー処理', async () => {
        const executeAppleScriptStub = sandbox.stub(PlatformManager, 'executeAppleScript');
        executeAppleScriptStub.rejects(new Error('Window activation failed'));

        await assert.rejects(
            () => chatGPTService.sendMessage('test message'),
            (error: any) => {
                assert.ok(error instanceof ChatGPTUIError);
                assert.ok(error.message.includes('window'));
                return true;
            }
        );
    });

    test('送信ボタンが見つからない場合', async () => {
        const executeAppleScriptStub = sandbox.stub(PlatformManager, 'executeAppleScript');
        executeAppleScriptStub.onFirstCall().resolves(false);
        executeAppleScriptStub.onSecondCall().rejects(new Error('Send button not found'));

        await assert.rejects(
            () => chatGPTService.sendMessage('test message'),
            (error: any) => {
                assert.ok(error instanceof ChatGPTUIError);
                assert.ok(error.message.includes('button'));
                return true;
            }
        );
    });

    test('応答待機のタイムアウト', async () => {
        const executeAppleScriptStub = sandbox.stub(PlatformManager, 'executeAppleScript');
        executeAppleScriptStub.resolves(false);

        await assert.rejects(
            () => chatGPTService.sendMessage('test message'),
            (error: any) => {
                assert.ok(error instanceof ChatGPTTimeoutError);
                assert.ok(error.message.includes('timeout'));
                return true;
            }
        );
    });

    test('正常系の送信処理', async () => {
        const executeAppleScriptStub = sandbox.stub(PlatformManager, 'executeAppleScript');
        executeAppleScriptStub.onFirstCall().resolves(true);  // アクセシビリティ権限
        executeAppleScriptStub.onSecondCall().resolves(true); // ウィンドウアクティベーション
        executeAppleScriptStub.onThirdCall().resolves(true);  // 送信ボタン
        executeAppleScriptStub.onCall(3).resolves(true);      // 応答確認

        const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
        showInformationMessageStub.resolves(undefined);

        await chatGPTService.sendMessage('test message');

        assert.strictEqual(showInformationMessageStub.callCount, 1);
        assert.ok(showInformationMessageStub.firstCall.args[0].includes('success'));
    });
}); 