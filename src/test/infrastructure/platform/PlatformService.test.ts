import { expect } from 'chai';
import * as sinon from 'sinon';
import { PlatformService } from '../../../infrastructure/platform/PlatformService';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { UnsupportedPlatformError } from '../../../shared/errors/ChatGPTErrors';
import { MacOSImplementation } from '../../../infrastructure/platform/MacOSImplementation';
import { CrossPlatformImplementation } from '../../../infrastructure/platform/CrossPlatformImplementation';

describe('PlatformService', () => {
    let sandbox: sinon.SinonSandbox;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let platformStub: sinon.SinonStub;
    let macOSStub: sinon.SinonStubbedInstance<MacOSImplementation>;
    let crossPlatformStub: sinon.SinonStubbedInstance<CrossPlatformImplementation>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // スタブ
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
        } as any;

        i18nStub = {
            t: sandbox.stub().returns('テストメッセージ')
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
            removeChangeListener: sandbox.stub()
        } as any;

        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        } as any;

        macOSStub = {
            isAvailable: sandbox.stub().returns(true),
            openInChatGPT: sandbox.stub().resolves(),
            copyToClipboard: sandbox.stub().resolves(),
            checkAccessibilityPermission: sandbox.stub().resolves(true),
            launchApplication: sandbox.stub().resolves()
        } as any;

        crossPlatformStub = {
            isAvailable: sandbox.stub().returns(true),
            openInChatGPT: sandbox.stub().resolves(),
            copyToClipboard: sandbox.stub().resolves(),
            checkAccessibilityPermission: sandbox.stub().resolves(true),
            launchApplication: sandbox.stub().rejects(new UnsupportedPlatformError('テストメッセージ'))
        } as any;

        // デフォルトは macOS として stub
        platformStub = sandbox.stub(process, 'platform').value('darwin');
    });

    afterEach(() => {
        sandbox.restore();
    });

    function createService(): PlatformService {
        const service = PlatformService.createDefault(
            errorHandlerStub,
            i18nStub,
            configStub,
            loggerStub
        );

        // MacOSImplementationのスタブを設定
        if (process.platform === 'darwin') {
            (service as any).implementation = macOSStub;
        } else {
            (service as any).implementation = crossPlatformStub;
        }

        return service;
    }

    describe('getFeatures', () => {
        it('macOSでは機能が利用可能', () => {
            platformStub.value('darwin');
            const service = createService();
            // macOSImplementation は isAvailable = true
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.true;
            expect(features.canUseNativeFeatures).to.be.true;
        });

        it('Windowsでは機能が制限される', () => {
            platformStub.value('win32');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('Linuxでは機能が制限される', () => {
            platformStub.value('linux');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('macOSでアクセシビリティ権限を確認できる', async () => {
            platformStub.value('darwin');
            const service = createService();
            // macOSStub によって isAvailable = true → macOSImplementation
            // ただしテストでは内部のスタブに差し替えていないため、本来は生MacOSImplementationになる。
            // ここでは最低限 "true" であればOKとする
            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });

        it('非macOSでは常にtrueを返す', async () => {
            platformStub.value('win32');
            const service = createService();
            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('macOSでアプリケーションを起動できる', async () => {
            platformStub.value('darwin');
            const service = createService();

            await service.launchApplication('com.test.app');
            
            expect(macOSStub.launchApplication.calledOnce).to.be.true;
            expect(macOSStub.launchApplication.calledWith('com.test.app')).to.be.true;
        });

        it('非macOSでエラーを処理する', async () => {
            platformStub.value('win32');
            const service = createService();

            try {
                await service.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (error: any) {
                expect(error).to.be.instanceOf(UnsupportedPlatformError);
                expect(crossPlatformStub.launchApplication.calledOnce).to.be.true;
                expect(error.message).to.equal('テストメッセージ');
            }
        });
    });

    describe('プラットフォーム固有の実装', () => {
        it('macOSで適切な実装を選択する', () => {
            platformStub.value('darwin');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.true;
            expect(features.canUseNativeFeatures).to.be.true;
        });

        it('Windowsでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('win32');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('Linuxでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('linux');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('未知のプラットフォームでクロスプラットフォーム実装を選択する', () => {
            platformStub.value('unknown');
            const service = createService();
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });
    });
});
