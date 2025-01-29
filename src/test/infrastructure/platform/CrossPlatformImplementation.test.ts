import { CrossPlatformImplementation } from '@/infrastructure/platform/CrossPlatformImplementation';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';
import { II18nService } from '@/i18n/I18nService';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { UnsupportedPlatformError } from '@/shared/errors/ChatGPTErrors';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('CrossPlatformImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: CrossPlatformImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let clipboardStub: sinon.SinonStubbedInstance<typeof vscode.env.clipboard>;

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
                    disableNativeFeatures: false
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

        clipboardStub = {
            writeText: sandbox.stub().resolves(),
            readText: sandbox.stub().resolves('test text'),
        } as any;

        // CrossPlatformImplementationのインスタンスを作成
        implementation = new CrossPlatformImplementation(errorHandlerStub);
        (implementation as any).clipboardService = clipboardStub;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('isAvailable', () => {
        it('常に利用可能', () => {
            expect(implementation.isAvailable()).to.be.true;
        });
    });

    describe('copyToClipboard', () => {
        it('クリップボードにコピーできる', async () => {
            const text = 'test text';
            clipboardStub.writeText.withArgs(text).resolves();

            await implementation.copyToClipboard(text);
            
            expect(clipboardStub.writeText.calledOnce).to.be.true;
            expect(clipboardStub.writeText.firstCall.args[0]).to.equal(text);
        });

        it('エラーを適切に処理する', async () => {
            const error = new Error('クリップボードエラー');
            clipboardStub.writeText.rejects(error);

            try {
                await implementation.copyToClipboard('test text');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(Error);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('should always return true', async () => {
            const result = await implementation.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('should throw UnsupportedPlatformError', async () => {
            try {
                await implementation.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const error = err as UnsupportedPlatformError;
                expect(error).to.be.instanceOf(UnsupportedPlatformError);
                expect(error.message).to.equal('テストメッセージ');
            }
        });
    });
}); 
