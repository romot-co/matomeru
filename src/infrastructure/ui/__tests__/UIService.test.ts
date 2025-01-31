import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { UIService } from '../../../infrastructure/ui/UIService';
import { IClipboardService } from '../../../infrastructure/platform/ClipboardService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { IConfigurationService } from '../../../infrastructure/config/ConfigurationService';
import { II18nService } from '../../../i18n/I18nService';

describe('UIService Tests', () => {
    let ui: UIService;
    let context: vscode.ExtensionContext;
    let clipboardServiceStub: sinon.SinonStubbedInstance<IClipboardService>;
    let sandbox: sinon.SinonSandbox;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
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

        // ConfigurationServiceのスタブ化
        configStub = sandbox.createStubInstance<IConfigurationService>(class implements IConfigurationService {
            getConfiguration() { return {} as any; }
            addChangeListener() {}
            removeChangeListener() {}
        });
        configStub.getConfiguration.returns({
            excludePatterns: [],
            maxFileSize: 1024 * 1024,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            batchSize: 100,
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        });

        // LoggingServiceのスタブ化
        loggerStub = sandbox.createStubInstance<ILogger>(class implements ILogger {
            info() {}
            warn() {}
            error() {}
            debug() {}
            show() {}
            dispose() {}
        });

        // I18nServiceのスタブ化
        i18nStub = sandbox.createStubInstance<II18nService>(class implements II18nService {
            t(key: string) { return key; }
            setLocale() {}
            getCurrentLocale() { return 'en'; }
        });

        // ClipboardServiceのスタブ化
        clipboardServiceStub = sandbox.createStubInstance<IClipboardService>(class implements IClipboardService {
            async writeText() {}
            async readText() { return ''; }
        });

        // UIServiceのインスタンス作成
        ui = UIService.createDefault(
            context,
            i18nStub,
            loggerStub,
            clipboardServiceStub
        );

        // スタブの設定
        sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();
        sandbox.stub(vscode.window, 'showWarningMessage').resolves();
        sandbox.stub(vscode.window, 'withProgress').resolves();
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
        sandbox.stub(vscode.window, 'showTextDocument').resolves();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('メッセージ表示', () => {
        it('情報メッセージを表示', async () => {
            await ui.showInformationMessage('テストメッセージ');
            expect((vscode.window.showInformationMessage as sinon.SinonStub).calledWith('テストメッセージ')).to.be.true;
            expect(loggerStub.info.called).to.be.true;
        });

        it('エラーメッセージを表示', async () => {
            await ui.showErrorMessage('エラーメッセージ');
            expect((vscode.window.showErrorMessage as sinon.SinonStub).calledWith('エラーメッセージ')).to.be.true;
            expect(loggerStub.error.called).to.be.true;
        });
    });

    describe('ドキュメント操作', () => {
        it('テキストドキュメントを開く', async () => {
            await ui.openTextDocument('テストコンテンツ');
            expect((vscode.workspace.openTextDocument as sinon.SinonStub).called).to.be.true;
            expect((vscode.window.showTextDocument as sinon.SinonStub).called).to.be.true;
            expect(loggerStub.debug.called).to.be.true;
        });

        it('クリップボードにコピー', async () => {
            await ui.copyToClipboard('テストコンテンツ');
            expect(clipboardServiceStub.writeText.calledWith('テストコンテンツ')).to.be.true;
            expect(loggerStub.debug.called).to.be.true;
        });
    });

    describe('Factory Methods', () => {
        it('createDefaultメソッドで正しくインスタンスを生成できる', () => {
            const instance = UIService.createDefault(
                context,
                i18nStub,
                loggerStub,
                clipboardServiceStub
            );
            
            expect(instance).to.be.instanceOf(UIService);
        });
    });
});