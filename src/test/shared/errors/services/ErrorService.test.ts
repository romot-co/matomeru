import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ErrorService, ErrorType, IErrorServiceConfig, IErrorHandler } from '@/shared/errors/services/ErrorService';
import { BaseError } from '@/shared/errors/base/BaseError';
import { II18nService } from '@/i18n/I18nService';
import { ILogger } from '@/infrastructure/logging/LoggingService';

describe('ErrorService Tests', () => {
    let service: ErrorService;
    let sandbox: sinon.SinonSandbox;
    let outputChannelStub: vscode.LogOutputChannel;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let showErrorMessageStub: sinon.SinonStub;
    let config: IErrorServiceConfig;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // OutputChannelのスタブを作成
        outputChannelStub = {
            appendLine: sandbox.stub(),
            append: sandbox.stub(),
            clear: sandbox.stub(),
            dispose: sandbox.stub(),
            show: sandbox.stub(),
            hide: sandbox.stub(),
            replace: sandbox.stub(),
            name: 'Matomeru Test',
            preserveFocus: sandbox.stub(),
            isClosed: false,
            // LogOutputChannelのプロパティとメソッド
            logLevel: vscode.LogLevel.Info,
            onDidChangeLogLevel: sandbox.stub(),
            trace: sandbox.stub(),
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub()
        } as unknown as vscode.LogOutputChannel;

        // I18nServiceのスタブを作成
        i18nStub = sandbox.createStubInstance<II18nService>(class implements II18nService {
            t(key: string) { return key; }
            setLocale() {}
            getCurrentLocale() { return 'en'; }
        });
        i18nStub.t.returns('translated message');

        // LoggerServiceのスタブを作成
        loggerStub = sandbox.createStubInstance<ILogger>(class implements ILogger {
            info() {}
            warn() {}
            error() {}
            debug() {}
            show() {}
            dispose() {}
        });

        // VSCode APIのスタブを作成
        showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        // 設定を初期化
        config = {
            outputChannelName: 'Matomeru Test'
        };

        // ErrorServiceのインスタンスを作成
        service = new ErrorService(i18nStub, loggerStub, config);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('エラー処理', () => {
        it('通常のエラーを適切に処理できる', async () => {
            const error = new Error('test error');
            const context = { source: 'test', timestamp: new Date() };
            await service.handleError(error, context);

            expect(i18nStub.t.callCount).to.equal(1);
            expect(loggerStub.error.callCount).to.equal(1);
            expect(showErrorMessageStub.callCount).to.equal(1);
        });

        it('BaseErrorを適切に処理できる', async () => {
            const error = new BaseError('test error', 'AccessibilityPermissionError');
            const context = { source: 'test', timestamp: new Date() };
            await service.handleError(error, context);

            expect(i18nStub.t.callCount).to.equal(1);
            expect(loggerStub.error.callCount).to.equal(1);
            expect(showErrorMessageStub.callCount).to.equal(1);
        });

        it('アクセス権限エラーを適切に処理できる', async () => {
            const error = new BaseError('permission error', 'AccessibilityPermissionError');
            const context = { source: 'test', timestamp: new Date() };
            await service.handleError(error, context);

            expect(i18nStub.t.callCount).to.equal(1);
            expect(loggerStub.error.callCount).to.equal(1);
            expect(showErrorMessageStub.callCount).to.equal(1);
        });

        it('プラットフォームエラーを適切に処理できる', async () => {
            const error = new BaseError('platform error', 'UnsupportedPlatformError');
            const context = { source: 'test', timestamp: new Date() };
            await service.handleError(error, context);

            expect(i18nStub.t.callCount).to.equal(1);
            expect(loggerStub.error.callCount).to.equal(1);
            expect(showErrorMessageStub.callCount).to.equal(1);
        });
    });

    describe('エラーログ管理', () => {
        it('エラーログをクリアできる', () => {
            service.clearErrorLogs();
            const logs = service.getErrorLogs();
            expect(logs).to.be.an('array').that.is.empty;
        });

        it('エラーログの配列は不変である', () => {
            const originalLogs = service.getErrorLogs();
            const modifiedLogs = service.getErrorLogs();
            const testError = new BaseError('test', 'UnknownError');
            modifiedLogs.push({
                id: 'test-id',
                timestamp: new Date().toISOString(),
                type: 'UnknownError',
                message: 'test',
                context: { source: 'test', timestamp: new Date() }
            });
            expect(service.getErrorLogs()).to.deep.equal(originalLogs);
        });
    });

    describe('Factory Methods', () => {
        it('デフォルト設定でインスタンスを生成できる', () => {
            const defaultService = ErrorService.createDefault(i18nStub, loggerStub);
            expect(defaultService).to.be.instanceOf(ErrorService);
        });

        it('カスタム設定でインスタンスを生成できる', () => {
            const customConfig: IErrorServiceConfig = {
                outputChannelName: 'Custom Channel'
            };

            const customService = new ErrorService(i18nStub, loggerStub, customConfig);
            expect(customService).to.be.instanceOf(ErrorService);
        });
    });
}); 
