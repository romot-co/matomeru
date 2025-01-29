import * as sinon from 'sinon';
import { expect } from 'chai';
import { MacOSImplementation } from '@/infrastructure/platform/MacOSImplementation';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';
import { II18nService } from '@/i18n/I18nService';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { BaseError } from '@/shared/errors/base/BaseError';
import * as cp from 'child_process';

describe('MacOSImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: MacOSImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let execCommandStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // スタブの作成
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
                    disableNativeFeatures: false
                }
            })
        } as any;

        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub()
        } as any;

        // MacOSImplementationのインスタンスを作成
        implementation = new MacOSImplementation(
            errorHandlerStub,
            i18nStub,
            configStub,
            loggerStub
        );
        
        // runExecCommandをスタブ化
        execCommandStub = sandbox.stub(implementation as any, 'runExecCommand');
        execCommandStub.resolves('');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('isAvailable', () => {
        it('should return true on macOS', () => {
            expect(implementation.isAvailable()).to.be.true;
        });
    });

    describe('copyToClipboard', () => {
        it('should copy text to clipboard', async () => {
            const text = 'test text';
            execCommandStub.withArgs(`echo "${text}" | pbcopy`).resolves('');

            await implementation.copyToClipboard(text);
            
            expect(execCommandStub.calledOnce).to.be.true;
            expect(execCommandStub.firstCall.args[0]).to.equal(`echo "${text}" | pbcopy`);
        });

        it('should handle errors', async () => {
            const error = new Error('Command failed');
            execCommandStub.rejects(error);

            try {
                await implementation.copyToClipboard('test');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(Error);
            }
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('should check accessibility permission', async () => {
            const result = await implementation.checkAccessibilityPermission();
            expect(result).to.be.true;
        });

        it('should handle permission errors', async () => {
            execCommandStub.rejects(new Error('Permission denied'));

            const result = await implementation.checkAccessibilityPermission();
            expect(result).to.be.false;
            expect(errorHandlerStub.handleError.calledOnce).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('should launch application', async () => {
            await implementation.launchApplication('com.test.app');
        });

        it('should handle launch errors', async () => {
            execCommandStub.rejects(new Error('Launch failed'));

            try {
                await implementation.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const error = err as Error;
                expect(error.message).to.equal('Launch failed');
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });
}); 
