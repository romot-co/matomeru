import * as sinon from 'sinon';
import { expect } from 'chai';
import { MacOSImplementation } from '../../../infrastructure/platform/MacOSImplementation';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { BaseError } from '../../../shared/errors/base/BaseError';
import { ChatGPTUIError } from '../../../shared/errors/ChatGPTErrors';

describe('MacOSImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: MacOSImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let runExecCommandStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
        } as any;

        i18nStub = {
            t: sandbox.stub().callsFake((key: string) => {
                if (key === 'errors.windowActivation') {
                    return 'ウィンドウのアクティブ化に失敗しました';
                }
                if (key === 'errors.chatGPTNotInstalled') {
                    return 'ChatGPTがインストールされていません';
                }
                return 'テストメッセージ';
            })
        } as any;

        configStub = {
            getConfiguration: sandbox.stub().returns({
                chatgptBundleId: 'com.openai.chat',
                development: {
                    disableNativeFeatures: false
                }
            })
        } as any;

        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        } as any;

        implementation = new MacOSImplementation(
            errorHandlerStub,
            i18nStub,
            configStub,
            loggerStub
        );

        // runExecCommand を stub 化
        runExecCommandStub = sandbox.stub(implementation as any, 'runExecCommand');
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
            const text = 'テストテキスト';
            runExecCommandStub.resolves('');

            await implementation.copyToClipboard(text);

            expect(runExecCommandStub.calledOnce).to.be.true;
            const cmd = runExecCommandStub.firstCall.args[0];
            expect(cmd).to.include(`echo "${text}" | pbcopy`);
        });

        it('should handle errors', async () => {
            const error = new Error('pbcopy失敗');
            runExecCommandStub.rejects(error);

            try {
                await implementation.copyToClipboard('テストテキスト');
                expect.fail('クリップボードエラーが発生するはずです');
            } catch (err) {
                expect(err).to.be.instanceOf(BaseError);
                expect((err as BaseError).code).to.equal('ClipboardError');
            }
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('アクセシビリティ権限を確認できる', async () => {
            runExecCommandStub.resolves({ stdout: 'true\n', stderr: '' });

            const result = await implementation.checkAccessibilityPermission();

            expect(result).to.be.true;
            expect(runExecCommandStub.called).to.be.true;
            expect(errorHandlerStub.handleError.called).to.be.false;
            expect(runExecCommandStub.firstCall.args[0]).to.include('osascript');
        });

        it('権限エラーを適切に処理する', async () => {
            const error = new Error('Permission denied');
            runExecCommandStub.rejects(error);

            const result = await implementation.checkAccessibilityPermission();

            expect(result).to.be.false;
            expect(errorHandlerStub.handleError.called).to.be.true;
            sinon.assert.calledWith(errorHandlerStub.handleError, sinon.match.instanceOf(Error), sinon.match({
                source: 'MacOSImplementation.checkAccessibilityPermission',
                details: {
                    platform: process.platform,
                    osVersion: process.version
                },
                timestamp: sinon.match.date
            }));
        });
    });

    describe('launchApplication', () => {
        beforeEach(() => {
            runExecCommandStub.reset();
            errorHandlerStub.handleError.reset();
        });

        it('アプリケーションを起動できる', async () => {
            // mdfindコマンドの結果として、アプリケーションのパスを返す
            runExecCommandStub.onFirstCall().resolves({ stdout: '/Applications/ChatGPT.app\n', stderr: '' });
            // osascriptコマンドの結果として、アプリケーションの参照を返す
            runExecCommandStub.onSecondCall().resolves({ stdout: 'application "ChatGPT"\n', stderr: '' });

            await implementation.launchApplication('com.openai.chat');

            expect(runExecCommandStub.callCount).to.equal(2);
            expect(runExecCommandStub.firstCall.args[0]).to.include('mdfind');
            expect(runExecCommandStub.secondCall.args[0]).to.include('osascript');
            expect(errorHandlerStub.handleError.called).to.be.false;
        });

        it('起動エラーを適切に処理する', async () => {
            runExecCommandStub.onFirstCall().resolves({ stdout: '/Applications/ChatGPT.app\n', stderr: '' });
            runExecCommandStub.onSecondCall().rejects(new Error('osascript失敗'));

            try {
                await implementation.launchApplication('com.openai.chat');
                expect.fail('エラーが発生するはず');
            } catch (err) {
                expect(err).to.be.instanceOf(ChatGPTUIError);
                expect((err as ChatGPTUIError).message).to.equal('ウィンドウのアクティブ化に失敗しました');
                expect(runExecCommandStub.callCount).to.equal(2);
                expect(errorHandlerStub.handleError.called).to.be.true;
            }
        });

        it('アプリケーションが見つからない場合のエラーを処理する', async () => {
            runExecCommandStub.onFirstCall().resolves({ stdout: '', stderr: '' });

            try {
                await implementation.launchApplication('com.test.app');
                expect.fail('エラーが発生するはず');
            } catch (err) {
                expect(err).to.be.instanceOf(ChatGPTUIError);
                expect((err as ChatGPTUIError).message).to.equal('ChatGPTがインストールされていません');
                expect(runExecCommandStub.callCount).to.equal(1);
                expect(errorHandlerStub.handleError.called).to.be.true;
            }
        });
    });
});
