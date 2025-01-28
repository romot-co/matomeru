import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ApplicationCoordinator } from '../services/ApplicationCoordinator';
import { DirectoryScanner } from '../services/directory-scanner';
import { MarkdownGenerator } from '../services/markdown-generator';
import { UIController } from '../services/ui-controller';
import { I18n } from '../services/i18n';
import { ConfigurationManager } from '../services/configuration-manager';
import { ErrorService } from '../services/error/ErrorService';
import { PlatformService } from '../services/platform/PlatformService';
import { MockFSAdapter } from '../services/fs-adapter';

suite('ApplicationCoordinator Tests', () => {
    let coordinator: ApplicationCoordinator;
    let context: vscode.ExtensionContext;
    let scanner: DirectoryScanner;
    let generator: MarkdownGenerator;
    let ui: UIController;
    let i18n: I18n;
    let config: ConfigurationManager;
    let errorService: ErrorService;
    let platformService: PlatformService;
    let fsAdapter: MockFSAdapter;
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        // モックの作成
        context = {
            subscriptions: [],
            extensionPath: '',
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: () => []
            } as any,
            workspaceState: {} as any,
            extensionUri: vscode.Uri.file(''),
            environmentVariableCollection: {} as any,
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            extensionMode: vscode.ExtensionMode.Test,
            extension: {} as any,
            secrets: {} as any,
            asAbsolutePath: (path: string) => path,
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            languageModelAccessInformation: {} as any
        } as vscode.ExtensionContext;

        fsAdapter = new MockFSAdapter();
        scanner = new DirectoryScanner(fsAdapter);
        generator = new MarkdownGenerator();
        ui = new UIController(context);
        i18n = I18n.getInstance();
        config = ConfigurationManager.getInstance();
        errorService = ErrorService.getInstance();
        platformService = PlatformService.getInstance();

        // I18nのスタブ設定
        const mockI18n = {
            t: sandbox.stub().callsFake((key: string) => {
                const messages: { [key: string]: string } = {
                    'errors.macOSOnly': 'This feature is only available on macOS',
                    'errors.accessibilityPermission': 'Accessibility permission required',
                    'errors.chatGPTNotInstalled': 'ChatGPT is not installed'
                };
                return messages[key] || key;
            }),
            translations: {},
            loadTranslations: sandbox.stub().resolves(),
            setLocale: sandbox.stub()
        };
        Object.assign(i18n, mockI18n);

        coordinator = new ApplicationCoordinator(
            context,
            scanner,
            generator,
            ui,
            i18n,
            config
        );

        // スタブの設定
        sandbox.stub(scanner, 'scan').resolves([
            { path: 'test.ts', content: 'test content', extension: '.ts' }
        ]);
        sandbox.stub(generator, 'generateMarkdown').resolves('# Test\n```typescript\ntest content\n```');
        sandbox.stub(ui, 'showInformationMessage').resolves();
        sandbox.stub(ui, 'openTextDocument').resolves();
        sandbox.stub(ui, 'copyToClipboard').resolves();
        sandbox.stub(platformService, 'getFeatures').returns({
            canUseChatGPT: true,
            canUseNativeFeatures: true
        });
        sandbox.stub(platformService, 'openInChatGPT').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('エディタでディレクトリを処理', async function() {
        this.timeout(10000);
        await coordinator.processDirectoryToEditor('/test/path');

        assert.ok((scanner.scan as sinon.SinonStub).calledWith('/test/path'));
        assert.ok((generator.generateMarkdown as sinon.SinonStub).called);
        assert.ok((ui.openTextDocument as sinon.SinonStub).called);
        assert.ok((context.globalState.update as sinon.SinonStub).called);
        assert.ok((ui.showInformationMessage as sinon.SinonStub).called);
    });

    test('クリップボードにディレクトリを処理', async function() {
        this.timeout(10000);
        await coordinator.processDirectoryToClipboard('/test/path');

        assert.ok((scanner.scan as sinon.SinonStub).calledWith('/test/path'));
        assert.ok((generator.generateMarkdown as sinon.SinonStub).called);
        assert.ok((ui.copyToClipboard as sinon.SinonStub).called);
        assert.ok((context.globalState.update as sinon.SinonStub).called);
        assert.ok((ui.showInformationMessage as sinon.SinonStub).called);
    });

    test('ChatGPTにディレクトリを処理', async function() {
        this.timeout(10000);
        await coordinator.processDirectoryToChatGPT('/test/path');

        assert.ok((scanner.scan as sinon.SinonStub).calledWith('/test/path'));
        assert.ok((generator.generateMarkdown as sinon.SinonStub).called);
        assert.ok((platformService.openInChatGPT as sinon.SinonStub).called);
        assert.ok((context.globalState.update as sinon.SinonStub).called);
        assert.ok((ui.showInformationMessage as sinon.SinonStub).called);
    });

    test('ChatGPTが利用できない場合のエラー処理', async function() {
        this.timeout(10000);
        
        // プラットフォームの機能をモック
        (platformService.getFeatures as sinon.SinonStub).returns({
            canUseChatGPT: false,
            canUseNativeFeatures: false
        });

        // エラーメッセージの表示をモック
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        // エラーハンドリングのスパイを設定
        const handleErrorSpy = sandbox.spy(errorService, 'handleError');

        await coordinator.processDirectoryToChatGPT('/test/path');

        // エラーハンドリングが呼び出されたことを確認
        assert.ok(handleErrorSpy.called);
        const error = handleErrorSpy.firstCall.args[0];
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, i18n.t('errors.macOSOnly'));
        assert.strictEqual(handleErrorSpy.firstCall.args[1].source, 'ApplicationCoordinator.processDirectoryToChatGPT');
    });

    test('ディレクトリスキャン中のエラー処理', async function() {
        this.timeout(10000);
        const error = new Error('スキャンエラー');
        (scanner.scan as sinon.SinonStub).rejects(error);
        const handleErrorStub = sandbox.stub(errorService, 'handleError').resolves();

        await coordinator.processDirectoryToEditor('/test/path');

        assert.ok(handleErrorStub.called);
        assert.deepStrictEqual(handleErrorStub.firstCall.args[1].source, 'ApplicationCoordinator.processDirectoryToEditor');
    });

    test('マークダウン生成中のエラー処理', async function() {
        this.timeout(10000);
        const error = new Error('マークダウン生成エラー');
        (generator.generateMarkdown as sinon.SinonStub).rejects(error);
        const handleErrorStub = sandbox.stub(errorService, 'handleError').resolves();

        await coordinator.processDirectoryToEditor('/test/path');

        assert.ok(handleErrorStub.called);
        assert.deepStrictEqual(handleErrorStub.firstCall.args[1].source, 'ApplicationCoordinator.processDirectoryToEditor');
    });
}); 
