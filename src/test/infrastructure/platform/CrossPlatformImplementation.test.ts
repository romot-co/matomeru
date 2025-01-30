import { CrossPlatformImplementation } from '../../../infrastructure/platform/CrossPlatformImplementation';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { UnsupportedPlatformError } from '../../../shared/errors/ChatGPTErrors';
import { BaseError } from '../../../shared/errors/base/BaseError';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { IClipboardService } from '../../../infrastructure/platform/ClipboardService';

describe('CrossPlatformImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: CrossPlatformImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let clipboardStub: sinon.SinonStubbedInstance<IClipboardService>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        errorHandlerStub = {
            handleError: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([]),
            clearErrorLogs: sandbox.stub()
        } as any;

        clipboardStub = {
            writeText: sandbox.stub().resolves(),
            readText: sandbox.stub().resolves('test')
        } as any;

        // vscode.env.clipboardをスタブに置き換え
        sandbox.stub(vscode.env, 'clipboard').value(clipboardStub);

        implementation = new CrossPlatformImplementation(errorHandlerStub);
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
            await implementation.copyToClipboard(text);
            expect(clipboardStub.writeText.calledOnce).to.be.true;
            expect(clipboardStub.writeText.firstCall.args[0]).to.equal(text);
        });

        it('エラーを適切に処理する', async () => {
            const error = new BaseError('クリップボードエラー', 'ClipboardError');
            clipboardStub.writeText.rejects(error);

            try {
                await implementation.copyToClipboard('test');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                if (err instanceof BaseError) {
                    expect(err.message).to.equal('クリップボードエラー');
                } else {
                    expect.fail('BaseErrorのインスタンスであるべきです');
                }
            }
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('常にtrueを返す', async () => {
            const result = await implementation.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('UnsupportedPlatformError を投げる', async () => {
            try {
                await implementation.launchApplication('test.app');
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                if (err instanceof UnsupportedPlatformError) {
                    expect(err.message).to.equal('この機能はプラットフォーム固有の実装でのみ利用可能です');
                } else {
                    expect.fail('UnsupportedPlatformErrorのインスタンスであるべきです');
                }
            }
        });
    });
});
