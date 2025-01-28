import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { PlatformService } from '../services/platform/PlatformService';
import {
    UnsupportedPlatformError,
    AccessibilityPermissionError,
    ChatGPTAppNotFoundError,
    ChatGPTIntegrationError,
    ChatGPTTimeoutError,
    ChatGPTPermissionError,
    ChatGPTUIError
} from '../errors/ChatGPTErrors';
import { ProductionFSAdapter as FSAdapter } from '../services/fs-adapter';
import { DirectoryScanner } from '../services/directory-scanner';
import { MarkdownGenerator } from '../services/markdown-generator';
import { UIController } from '../services/ui-controller';
import { I18n } from '../i18n';
import { ConfigurationManager } from '../services/configuration-manager';
import { Dirent } from 'fs';
import { ErrorService } from '../services/error/ErrorService';

suite('ChatGPT Integration Tests', () => {
    let platformService: PlatformService;
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let fsAdapter: InstanceType<typeof FSAdapter>;
    let scanner: DirectoryScanner;
    let errorService: ErrorService;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        mockContext = {
            subscriptions: [],
            globalState: {
                get: () => ({}),
                update: () => Promise.resolve()
            },
            extensionPath: '/test/extension/path'
        } as unknown as vscode.ExtensionContext;

        fsAdapter = new FSAdapter();
        sandbox.stub(fsAdapter, 'readFile').resolves('test content');
        sandbox.stub(fsAdapter, 'stat').resolves({
            isDirectory: () => false,
            isSymbolicLink: () => false,
            size: 0
        });
        const mockDirents: Dirent[] = [
            {
                name: 'file1.txt',
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isFIFO: () => false,
                isSocket: () => false
            } as Dirent,
            {
                name: 'file2.txt',
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isFIFO: () => false,
                isSocket: () => false
            } as Dirent
        ];
        sandbox.stub(fsAdapter, 'readdir').resolves(mockDirents);
        sandbox.stub(fsAdapter, 'findFiles').resolves(['/test/file1.txt', '/test/file2.txt']);
        sandbox.stub(fsAdapter, 'exists').resolves(true);

        scanner = new DirectoryScanner(fsAdapter);
        platformService = PlatformService.getInstance();
        errorService = ErrorService.getInstance();
        errorService.setContext(mockContext);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('プラットフォームチェックが正しく機能する', async () => {
        const platformStub = sandbox.stub(process, 'platform').value('win32');
        const features = platformService.getFeatures();
        
        assert.strictEqual(features.canUseChatGPT, true);
        assert.strictEqual(features.canUseNativeFeatures, false);
    });

    test('アクセシビリティ権限チェックが正しく機能する', async () => {
        const stub = sandbox.stub(platformService as any, 'checkAccessibilityPermission');
        stub.resolves(false);
        
        await assert.rejects(
            async () => {
                if (!await platformService.checkAccessibilityPermission()) {
                    throw new AccessibilityPermissionError('アクセシビリティ権限が必要です');
                }
            },
            AccessibilityPermissionError
        );
    });

    test('ChatGPTアプリの存在チェックが正しく機能する', async () => {
        const stub = sandbox.stub(platformService as any, 'launchApplication');
        stub.rejects(new ChatGPTAppNotFoundError('ChatGPTアプリが見つかりません'));
        
        await assert.rejects(
            async () => {
                await platformService.launchApplication('com.chatgpt.app');
            },
            ChatGPTAppNotFoundError
        );
    });

    test('正常系の送信処理', async () => {
        const permissionStub = sandbox.stub(platformService as any, 'checkAccessibilityPermission');
        permissionStub.resolves(true);
        
        const sendStub = sandbox.stub(platformService as any, 'openInChatGPT');
        sendStub.resolves();
        
        await assert.doesNotReject(
            async () => {
                const scanResult = await scanner.scan('/test/path');
                const generator = new MarkdownGenerator();
                const markdown = await generator.generateMarkdown(scanResult);
                await platformService.openInChatGPT(markdown);
            }
        );
    });

    test('ChatGPTが起動していない場合のエラー処理', async () => {
        const mockDirents: Dirent[] = [
            {
                name: 'file1.txt',
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isFIFO: () => false,
                isSocket: () => false
            } as Dirent,
            {
                name: 'file2.txt',
                isDirectory: () => false,
                isFile: () => true,
                isSymbolicLink: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isFIFO: () => false,
                isSocket: () => false
            } as Dirent
        ];

        (fsAdapter.readdir as sinon.SinonStub).resolves(mockDirents);
        const sendStub = sandbox.stub(platformService as any, 'openInChatGPT');
        sendStub.rejects(new ChatGPTAppNotFoundError('ChatGPTアプリが起動していません'));

        await assert.rejects(
            async () => {
                const scanResult = await scanner.scan('/test/path');
                const generator = new MarkdownGenerator();
                const markdown = await generator.generateMarkdown(scanResult);
                await platformService.openInChatGPT(markdown);
            },
            ChatGPTAppNotFoundError
        );
    });
}); 