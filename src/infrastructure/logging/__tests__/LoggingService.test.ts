import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { LoggingService } from '../../../infrastructure/logging/LoggingService';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';

describe('LoggingService Tests', () => {
    let service: LoggingService;
    let sandbox: sinon.SinonSandbox;
    let outputChannelStub: vscode.LogOutputChannel;
    let consoleLogStub: sinon.SinonStub;
    let configServiceStub: sinon.SinonStubbedInstance<IConfigurationService>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        consoleLogStub = sandbox.stub(console, 'log');

        // LogOutputChannelのスタブを作成
        const outputChannelMethods = {
            info: sandbox.stub().callsFake((message: string) => {}),
            warn: sandbox.stub().callsFake((message: string) => {}),
            error: sandbox.stub().callsFake((message: string | Error) => {}),
            debug: sandbox.stub().callsFake((message: string) => {}),
            show: sandbox.stub().callsFake((preserveFocus?: boolean) => {}),
            dispose: sandbox.stub().callsFake(() => {}),
            name: 'Matomeru',
            append: sandbox.stub().callsFake((value: string) => {}),
            appendLine: sandbox.stub().callsFake((value: string) => {}),
            clear: sandbox.stub().callsFake(() => {}),
            hide: sandbox.stub().callsFake(() => {}),
            replace: sandbox.stub().callsFake((value: string) => {}),
            logLevel: vscode.LogLevel.Debug,
            onDidChangeLogLevel: sandbox.stub().callsFake(() => ({ dispose: () => {} }))
        };

        outputChannelStub = outputChannelMethods as unknown as vscode.LogOutputChannel;

        // ConfigurationServiceのスタブを作成
        configServiceStub = sandbox.createStubInstance<IConfigurationService>(class implements IConfigurationService {
            getConfiguration(): Configuration { return {} as Configuration; }
            addChangeListener(): void {}
            removeChangeListener(): void {}
        });

        configServiceStub.getConfiguration.returns({
            excludePatterns: [],
            maxFileSize: 1024 * 1024,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            batchSize: 100,
            chatgptBundleId: 'com.openai.chat',
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        });

        // LoggingServiceのインスタンスを作成
        service = new LoggingService(outputChannelStub, configServiceStub);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('INFOレベルのログを出力できる', () => {
        const message = 'テストメッセージ';
        service.info(message);

        expect((outputChannelStub.info as sinon.SinonStub).callCount).to.equal(1);
        expect(consoleLogStub.callCount).to.equal(0);
        
        const logEntry = JSON.parse((outputChannelStub.info as sinon.SinonStub).firstCall.args[0]);
        expect(logEntry.level).to.equal('INFO');
        expect(logEntry.message).to.equal(message);
    });

    it('WARNレベルのログを出力できる', () => {
        const message = 'テスト警告メッセージ';
        service.warn(message);

        expect((outputChannelStub.warn as sinon.SinonStub).callCount).to.equal(1);
        expect(consoleLogStub.callCount).to.equal(0);
        
        const logEntry = JSON.parse((outputChannelStub.warn as sinon.SinonStub).firstCall.args[0]);
        expect(logEntry.level).to.equal('WARN');
        expect(logEntry.message).to.equal(message);
    });

    it('ERRORレベルのログを出力できる', () => {
        const message = 'テストエラーメッセージ';
        service.error(message);

        expect((outputChannelStub.error as sinon.SinonStub).callCount).to.equal(1);
        expect(consoleLogStub.callCount).to.equal(0);
        
        const logEntry = JSON.parse((outputChannelStub.error as sinon.SinonStub).firstCall.args[0]);
        expect(logEntry.level).to.equal('ERROR');
        expect(logEntry.message).to.equal(message);
    });

    it('デバッグモードが無効の場合はDEBUGログを出力しない', () => {
        const message = 'テストデバッグメッセージ';
        service.debug(message);

        expect((outputChannelStub.debug as sinon.SinonStub).callCount).to.equal(0);
        expect(consoleLogStub.callCount).to.equal(0);
    });

    it('デバッグモードが有効の場合はDEBUGログを出力する', () => {
        // 先に設定を変更
        const debugConfig = {
            ...configServiceStub.getConfiguration(),
            development: {
                mockChatGPT: false,
                debugLogging: true,
                disableNativeFeatures: false
            }
        };
        configServiceStub.getConfiguration.returns(debugConfig);

        // 新しい設定で再作成
        service = new LoggingService(outputChannelStub, configServiceStub);

        const message = 'テストデバッグメッセージ';
        service.debug(message);

        // デバッグ出力の検証
        const debugStub = outputChannelStub.debug as sinon.SinonStub;
        expect(debugStub.callCount).to.equal(1);
        
        const logEntry = JSON.parse(debugStub.firstCall.args[0]);
        expect(logEntry.level).to.equal('DEBUG');
        expect(logEntry.message).to.equal(message);
    });

    it('出力チャンネルを表示できる', () => {
        service.show();
        expect((outputChannelStub.show as sinon.SinonStub).callCount).to.equal(1);
    });

    it('出力チャンネルを破棄できる', () => {
        service.dispose();
        expect((outputChannelStub.dispose as sinon.SinonStub).callCount).to.equal(1);
    });

    describe('Factory Methods', () => {
        it('createDefaultメソッドで正しくインスタンスを生成できる', () => {
            const outputChannelMock = {
                info: sandbox.stub(),
                warn: sandbox.stub(),
                error: sandbox.stub(),
                debug: sandbox.stub(),
                show: sandbox.stub(),
                dispose: sandbox.stub(),
                name: 'Matomeru',
                append: sandbox.stub(),
                appendLine: sandbox.stub(),
                clear: sandbox.stub(),
                hide: sandbox.stub(),
                replace: sandbox.stub(),
                logLevel: vscode.LogLevel.Debug,
                onDidChangeLogLevel: sandbox.stub()
            } as any;

            const createOutputChannelStub = sandbox.stub(vscode.window, 'createOutputChannel').returns(outputChannelMock);
            
            const defaultService = LoggingService.createDefault(configServiceStub);
            
            expect(defaultService).to.be.instanceOf(LoggingService);
            expect(createOutputChannelStub.firstCall.args).to.deep.equal(['Matomeru', { log: true }]);
            
            defaultService.debug('test');
            expect(outputChannelMock.debug.callCount).to.equal(0);
            
            defaultService.info('test');
            expect(outputChannelMock.info.callCount).to.equal(1);
        });
    });

    describe('Dependency Injection', () => {
        it('異なる出力チャンネルを注入できる', () => {
            const customChannel = {
                ...outputChannelStub,
                name: 'CustomChannel'
            };
            
            const service = new LoggingService(customChannel as any, configServiceStub);
            service.info('test');
            
            expect((customChannel.info as sinon.SinonStub).callCount).to.equal(1);
        });

        it('異なる設定を注入できる', () => {
            const debugConfigService = sandbox.createStubInstance<IConfigurationService>(class implements IConfigurationService {
                getConfiguration(): Configuration { return {} as Configuration; }
                addChangeListener(): void {}
                removeChangeListener(): void {}
            });

            // デバッグ設定を返すように設定
            const debugConfig = {
                ...configServiceStub.getConfiguration(),
                development: {
                    mockChatGPT: false,
                    debugLogging: true,
                    disableNativeFeatures: false
                }
            };
            debugConfigService.getConfiguration.returns(debugConfig);
            
            // 新しいインスタンスを作成
            const debugService = new LoggingService(outputChannelStub, debugConfigService);
            debugService.debug('test');
            
            // デバッグ出力の検証
            const debugStub = outputChannelStub.debug as sinon.SinonStub;
            expect(debugStub.callCount).to.equal(1);
            
            const logEntry = JSON.parse(debugStub.firstCall.args[0]);
            expect(logEntry.level).to.equal('DEBUG');
            expect(logEntry.message).to.equal('test');
        });
    });
}); 