import { expect } from 'chai';
import * as sinon from 'sinon';
import { PlatformService } from '@/infrastructure/platform/PlatformService';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';
import { II18nService } from '@/i18n/I18nService';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { UnsupportedPlatformError } from '@/shared/errors/ChatGPTErrors';
import { MacOSImplementation } from '@/infrastructure/platform/MacOSImplementation';
import { CrossPlatformImplementation } from '@/infrastructure/platform/CrossPlatformImplementation';

describe('PlatformService', () => {
    let sandbox: sinon.SinonSandbox;
    let service: PlatformService;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let platformStub: sinon.SinonStub;
    let macOSStub: sinon.SinonStubbedInstance<MacOSImplementation>;
    let crossPlatformStub: sinon.SinonStubbedInstance<CrossPlatformImplementation>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // スタブの作成
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub(),
        } as any;

        i18nStub = {
            t: sandbox.stub().returns('テストメッセージ'),
        } as any;

        configStub = {
            getConfiguration: sandbox.stub().returns({
                development: {
                    disableNativeFeatures: false,
                    mockChatGPT: false,
                    debugLogging: false
                }
            }),
            addChangeListener: sandbox.stub(),
            removeChangeListener: sandbox.stub(),
        } as any;

        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub(),
        } as any;

        // プラットフォーム実装のスタブ
        macOSStub = {
            isAvailable: sandbox.stub().returns(true),
            openInChatGPT: sandbox.stub().resolves(),
            copyToClipboard: sandbox.stub().resolves(),
            checkAccessibilityPermission: sandbox.stub().resolves(true),
            launchApplication: sandbox.stub().resolves(),
        } as any;

        crossPlatformStub = {
            isAvailable: sandbox.stub().returns(true),
            openInChatGPT: sandbox.stub().resolves(),
            copyToClipboard: sandbox.stub().resolves(),
            checkAccessibilityPermission: sandbox.stub().resolves(true),
            launchApplication: sandbox.stub().rejects(new UnsupportedPlatformError('テストメッセージ')),
        } as any;

        // process.platform のスタブ
        platformStub = sandbox.stub(process, 'platform').value('darwin');

        // サービスの作成とスタブの注入
        service = PlatformService.createDefault(
            errorHandlerStub,
            i18nStub,
            configStub,
            loggerStub
        );

        // 内部実装の置き換え
        (service as any).macOSImplementation = macOSStub;
        (service as any).crossPlatformImplementation = crossPlatformStub;
        (service as any).isMac = true; // macOS環境を明示的に設定
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getFeatures', () => {
        it.skip('macOSでは機能が利用可能', () => {
            platformStub.value('darwin');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.true;
            expect(features.canUseNativeFeatures).to.be.true;
        });

        it.skip('Windowsでは機能が制限される', () => {
            platformStub.value('win32');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it.skip('Linuxでは機能が制限される', () => {
            platformStub.value('linux');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });
    });

    describe('copyToClipboard', () => {
        it('クリップボードにコピーできる', async () => {
            macOSStub.copyToClipboard.resolves();

            await service.copyToClipboard('テストテキスト');
            
            expect(macOSStub.copyToClipboard.calledOnce).to.be.true;
            expect(macOSStub.copyToClipboard.firstCall.args[0]).to.equal('テストテキスト');
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('クリップボードエラー');
            macOSStub.copyToClipboard.rejects(error);

            try {
                await service.copyToClipboard('テストテキスト');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const error = err as Error;
                expect(error).to.be.instanceOf(Error);
                expect(error.message).to.equal('クリップボードエラー');
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('macOSでアクセシビリティ権限を確認できる', async () => {
            platformStub.value('darwin');
            // サービスを再作成
            service = PlatformService.createDefault(
                errorHandlerStub,
                i18nStub,
                configStub,
                loggerStub
            );

            macOSStub.checkAccessibilityPermission.resolves(true);
            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });

        it('非macOSでは常にtrueを返す', async () => {
            platformStub.value('win32');
            // サービスを再作成
            service = PlatformService.createDefault(
                errorHandlerStub,
                i18nStub,
                configStub,
                loggerStub
            );

            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('macOSでアプリケーションを起動できる', async () => {
            platformStub.value('darwin');
            // サービスを再作成
            service = PlatformService.createDefault(
                errorHandlerStub,
                i18nStub,
                configStub,
                loggerStub
            );

            macOSStub.launchApplication.resolves();
            await service.launchApplication('com.test.app');
            expect(macOSStub.launchApplication.calledOnce).to.be.true;
            expect(macOSStub.launchApplication.firstCall.args[0]).to.equal('com.test.app');
        });

        it('非macOSでエラーを処理する', async () => {
            platformStub.value('win32');
            // サービスを再作成
            service = PlatformService.createDefault(
                errorHandlerStub,
                i18nStub,
                configStub,
                loggerStub
            );

            try {
                await service.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const error = err as Error;
                expect(error.message).to.equal('この機能はプラットフォーム固有の実装でのみ利用可能です');
            }
        });
    });

    describe('プラットフォーム固有の実装', () => {
        it('macOSで適切な実装を選択する', () => {
            platformStub.value('darwin');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.true;
            expect(features.canUseNativeFeatures).to.be.true;
        });

        it('Windowsでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('win32');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('Linuxでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('linux');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('未知のプラットフォームでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('unknown');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });
    });
}); 
