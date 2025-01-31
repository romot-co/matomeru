import * as sinon from 'sinon';
import { expect } from 'chai';
import * as vscode from 'vscode';
import { CrossPlatformImplementation } from '../CrossPlatformImplementation';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';

describe('CrossPlatformImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: CrossPlatformImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        errorHandlerStub = {
            handleError: sandbox.stub()
        } as any;

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
        it.skip('クリップボードにコピーできる', async () => {
            // TODO: vscode.envのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('エラーを適切に処理する', async () => {
            // TODO: vscode.envのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });
    });

    describe('checkAccessibilityPermission', () => {
        it('常にtrueを返す', async () => {
            const result = await implementation.checkAccessibilityPermission();
            expect(result).to.be.true;
        });
    });

    describe('launchApplication', () => {
        it('プラットフォーム固有の機能が利用できない場合のエラーを処理する', async () => {
            try {
                await implementation.launchApplication('com.test.app');
                expect.fail('エラーが発生するはずです');
            } catch (error) {
                expect(error).to.be.instanceOf(MatomeruError);
                const matomeruError = error as MatomeruError;
                expect(matomeruError.code).to.equal(ErrorCode.PLATFORM_ERROR);
                expect(matomeruError.context.source).to.equal('CrossPlatformImplementation.launchApplication');
            }
        });
    });

    describe('openInChatGPT', () => {
        it.skip('ChatGPTをブラウザで開ける', async () => {
            // TODO: vscode.envのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('エラーを適切に処理する', async () => {
            // TODO: vscode.envのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });
    });
});
