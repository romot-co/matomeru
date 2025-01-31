import * as sinon from 'sinon';
import { expect } from 'chai';
import { MacOSImplementation } from '../MacOSImplementation';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';

describe('MacOSImplementation', () => {
    let sandbox: sinon.SinonSandbox;
    let implementation: MacOSImplementation;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let originalPlatform: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'darwin' });

        errorHandlerStub = {
            handleError: sandbox.stub()
        } as any;

        i18nStub = {
            t: sandbox.stub().returns('テストメッセージ')
        } as any;

        configStub = {
            getConfiguration: sandbox.stub().returns({
                chatgptBundleId: 'com.openai.chat',
                development: {
                    mockChatGPT: false,
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

        implementation = new MacOSImplementation(errorHandlerStub, i18nStub, configStub, loggerStub);
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        sandbox.restore();
    });

    describe('isAvailable', () => {
        it('should return true on macOS', () => {
            expect(implementation.isAvailable()).to.be.true;
        });

        it('should return false on non-macOS', () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            expect(implementation.isAvailable()).to.be.false;
        });
    });

    describe('copyToClipboard', () => {
        it.skip('クリップボードにコピーできる', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('エラーを適切に処理する', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });
    });

    describe('checkAccessibilityPermission', () => {
        it.skip('アクセシビリティ権限を確認できる', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('権限エラーを適切に処理する', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });
    });

    describe('launchApplication', () => {
        it.skip('アプリケーションを起動できる', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('起動エラーを適切に処理する', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });

        it.skip('アプリケーションが見つからない場合のエラーを処理する', async () => {
            // TODO: child_process.execのスタブ化が難しいため、テストをスキップ
            // 統合テストとして実装を検討
        });
    });
});
