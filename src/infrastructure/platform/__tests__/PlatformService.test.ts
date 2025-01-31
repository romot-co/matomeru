import { expect } from 'chai';
import * as sinon from 'sinon';
import { PlatformService } from '../PlatformService';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';
import { MacOSImplementation } from '../MacOSImplementation';
import { CrossPlatformImplementation } from '../CrossPlatformImplementation';

describe('PlatformService', () => {
    let sandbox: sinon.SinonSandbox;
    let errorHandlerStub: IErrorHandler;
    let i18nStub: II18nService;
    let configStub: IConfigurationService;
    let loggerStub: ILogger;
    let platformStub: sinon.SinonStub;
    let macOSStub: sinon.SinonStubbedInstance<MacOSImplementation>;
    let crossPlatformStub: sinon.SinonStubbedInstance<CrossPlatformImplementation>;
    let service: PlatformService;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            showErrorMessage: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([])
        };

        i18nStub = {
            t: sandbox.stub().returns('translated'),
            setLocale: sandbox.stub(),
            getCurrentLocale: sandbox.stub().returns('ja')
        };

        configStub = {
            getConfiguration: sandbox.stub().returns({
                development: {
                    disableNativeFeatures: false,
                    mockChatGPT: true,
                    debugLogging: false
                }
            }),
            addChangeListener: sandbox.stub(),
            removeChangeListener: sandbox.stub()
        };

        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        };

        macOSStub = sandbox.createStubInstance(MacOSImplementation);
        macOSStub.isAvailable.returns(true);
        macOSStub.openInChatGPT.resolves();
        macOSStub.copyToClipboard.resolves();
        macOSStub.checkAccessibilityPermission.resolves(true);
        macOSStub.launchApplication.resolves();

        crossPlatformStub = sandbox.createStubInstance(CrossPlatformImplementation);
        crossPlatformStub.isAvailable.returns(true);
        crossPlatformStub.openInChatGPT.rejects(new MatomeruError(
            'この機能はmacOSでのみ利用可能です',
            ErrorCode.PLATFORM_ERROR,
            {
                source: 'CrossPlatformImplementation.openInChatGPT',
                timestamp: new Date()
            }
        ));
        crossPlatformStub.copyToClipboard.resolves();
        crossPlatformStub.checkAccessibilityPermission.resolves(true);
        crossPlatformStub.launchApplication.rejects(new MatomeruError(
            'この機能はmacOSでのみ利用可能です',
            ErrorCode.PLATFORM_ERROR,
            {
                source: 'CrossPlatformImplementation.launchApplication',
                timestamp: new Date()
            }
        ));

        platformStub = sandbox.stub(process, 'platform').value('darwin');

        service = new PlatformService(
            errorHandlerStub,
            i18nStub,
            configStub,
            loggerStub
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getFeatures', () => {
        it('macOSでは機能が利用可能', () => {
            platformStub.value('darwin');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.true;
            expect(features.canUseNativeFeatures).to.be.true;
        });

        it('Windowsでは機能が制限される', () => {
            platformStub.value('win32');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });

        it('Linuxでは機能が制限される', () => {
            platformStub.value('linux');
            const features = service.getFeatures();
            expect(features.canUseChatGPT).to.be.false;
            expect(features.canUseNativeFeatures).to.be.false;
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('macOSでアクセシビリティ権限を確認できる', async () => {
            platformStub.value('darwin');
            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });

        it('非macOSでは常にtrueを返す', async () => {
            platformStub.value('win32');
            const result = await service.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('macOSでアプリケーションを起動できる', async () => {
            platformStub.value('darwin');
            const bundleId = 'com.test.app';
            
            // MacOSImplementationのモックを設定
            const macOSImpl = new MacOSImplementation(errorHandlerStub, i18nStub, configStub, loggerStub);
            sandbox.stub(macOSImpl, 'isAvailable').returns(true);
            const launchStub = sandbox.stub(macOSImpl, 'launchApplication').resolves();
            sandbox.stub(MacOSImplementation, 'createDefault').returns(macOSImpl);

            const service = new PlatformService(errorHandlerStub, i18nStub, configStub, loggerStub);
            await service.launchApplication(bundleId);

            sinon.assert.calledOnce(launchStub);
            sinon.assert.calledWith(launchStub, bundleId);
        });

        it('非macOSでエラーを処理する', async () => {
            platformStub.value('win32');
            
            // CrossPlatformImplementationのモックを設定
            const crossPlatformImpl = new CrossPlatformImplementation(errorHandlerStub);
            sandbox.stub(crossPlatformImpl, 'isAvailable').returns(true);
            sandbox.stub(crossPlatformImpl, 'launchApplication').rejects(new MatomeruError(
                'この機能はmacOSでのみ利用可能です',
                ErrorCode.PLATFORM_ERROR,
                {
                    source: 'CrossPlatformImplementation.launchApplication',
                    timestamp: new Date()
                }
            ));

            const service = new PlatformService(errorHandlerStub, i18nStub, configStub, loggerStub);
            try {
                await service.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                expect(error).to.be.instanceOf(MatomeruError);
                const matomeruError = error as MatomeruError;
                expect(matomeruError.code).to.equal(ErrorCode.PLATFORM_ERROR);
                expect(matomeruError.message).to.equal('この機能はmacOSでのみ利用可能です');
                expect(matomeruError.context.source).to.equal('CrossPlatformImplementation.launchApplication');
            }
        });
    });

    describe('openInChatGPT', () => {
        it.skip('macOSでChatGPTを開ける', async () => {
            platformStub.value('darwin');
            const content = 'test content';
            await service.openInChatGPT(content);
            expect(macOSStub.openInChatGPT.calledOnce).to.be.true;
            expect(macOSStub.openInChatGPT.calledWith(content)).to.be.true;
        });

        it.skip('非macOSでエラーを処理する', async () => {
            platformStub.value('win32');
            try {
                await service.openInChatGPT('test content');
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                expect(error).to.be.instanceOf(MatomeruError);
                const matomeruError = error as MatomeruError;
                expect(matomeruError.code).to.equal(ErrorCode.PLATFORM_ERROR);
                expect(matomeruError.message).to.equal('この機能はmacOSでのみ利用可能です');
                expect(matomeruError.context.source).to.equal('CrossPlatformImplementation.openInChatGPT');
            }
        });
    });
});
