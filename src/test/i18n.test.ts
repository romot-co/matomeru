import * as assert from 'assert';
import * as vscode from 'vscode';
import { I18n } from '../i18n';
import { MessageValidator } from '../i18n/validator';
import { LocaleMessages } from '../i18n/types';

suite('国際化機能のテスト', () => {
    let i18n: I18n;

    setup(() => {
        // 各テストの前にI18nインスタンスを初期化
        i18n = I18n.getInstance({
            defaultLocale: 'en',
            fallbackLocale: 'en',
            validateOnInit: true
        });
    });

    test('基本的なメッセージ取得', () => {
        const message = i18n.t('ui.messages.selectDirectory');
        assert.strictEqual(typeof message, 'string');
        assert.notStrictEqual(message, 'ui.messages.selectDirectory');
    });

    test('引数を含むメッセージのフォーマット', () => {
        const errorMessage = 'Test Error';
        const message = i18n.t('ui.messages.error', errorMessage);
        assert.strictEqual(message.includes(errorMessage), true);
    });

    test('存在しないメッセージパスの処理', () => {
        const invalidPath = 'invalid.message.path';
        const message = i18n.t(invalidPath);
        assert.strictEqual(message, invalidPath);
    });

    test('ロケールの切り替え', () => {
        // VSCodeの言語設定を一時的に変更
        const originalLanguage = Object.getOwnPropertyDescriptor(vscode.env, 'language');
        
        Object.defineProperty(vscode.env, 'language', {
            value: 'ja',
            configurable: true
        });
        
        const i18nJa = I18n.getInstance();
        const jaMessage = i18nJa.t('ui.messages.selectDirectory');
        
        Object.defineProperty(vscode.env, 'language', {
            value: 'en',
            configurable: true
        });
        
        const i18nEn = I18n.getInstance();
        const enMessage = i18nEn.t('ui.messages.selectDirectory');
        
        assert.notStrictEqual(jaMessage, enMessage);
        
        // 元の設定を復元
        if (originalLanguage) {
            Object.defineProperty(vscode.env, 'language', originalLanguage);
        }
    });

    test('メッセージバリデーションの動作確認', () => {
        const validator = new MessageValidator();
        const testMessages: Partial<LocaleMessages> = {
            commands: {
                combineDirectory: 'Test Command'
            },
            ui: {
                outputDestination: {
                    placeholder: 'Test Placeholder',
                    editor: {
                        label: 'Test Label',
                        description: 'Test Description'
                    },
                    clipboard: {
                        label: 'Test Label',
                        description: 'Test Description'
                    }
                },
                progress: {
                    scanning: 'Test Scanning',
                    collecting: 'Test Collecting',
                    processing: 'Test Processing'
                },
                messages: {
                    selectDirectory: 'Test Select Directory',
                    openedInEditor: 'Test Opened',
                    copiedToClipboard: 'Test Copied',
                    error: 'Test Error: {0}',
                    showDetails: 'Test Details',
                    noStackTrace: 'Test No Stack',
                    sentToChatGPT: 'Test Sent',
                    macOSOnly: 'Test macOS Only',
                    accessibilityRequired: 'Test Permission',
                    openSettings: 'Test Settings',
                    chatGPTNotInstalled: 'Test Not Installed',
                    activated: 'Test Activated',
                    sendFailed: 'Test Send Failed: {0}',
                    sendSuccess: 'Test Send Success',
                    waitingForResponse: 'Test Waiting'
                }
            },
            errors: {
                accessibilityPermission: 'Test Accessibility Permission',
                windowActivation: 'Test Window Activation',
                pasteFailed: 'Test Paste Failed',
                sendButtonNotFound: 'Test Send Button Not Found',
                responseTimeout: 'Test Response Timeout'
            }
        };
        
        const missingPaths = validator.validateMessages(testMessages);
        assert.strictEqual(missingPaths.length > 0, true);
    });

    test('フォールバックメカニズムの確認', () => {
        // 存在しない言語を設定
        Object.defineProperty(vscode.env, 'language', {
            value: 'xx',
            configurable: true
        });
        
        const i18nFallback = I18n.getInstance();
        const message = i18nFallback.t('ui.messages.selectDirectory');
        
        // デフォルトロケール（英語）のメッセージと一致することを確認
        assert.strictEqual(message, 'Please select a directory.');
    });

    test('部分的なロケールコードの処理', () => {
        // zh-TWのような部分的なロケールコードを設定
        Object.defineProperty(vscode.env, 'language', {
            value: 'ja-JP',
            configurable: true
        });
        
        const i18nPartial = I18n.getInstance();
        const message = i18nPartial.t('ui.messages.selectDirectory');
        
        // 基本言語（ja）のメッセージと一致することを確認
        assert.strictEqual(message, 'ディレクトリを選択してください。');
    });

    test('ChatGPT関連メッセージの確認', () => {
        const messages = [
            'ui.messages.sentToChatGPT',
            'ui.messages.macOSOnly',
            'ui.messages.accessibilityRequired',
            'ui.messages.chatGPTNotInstalled'
        ];
        
        for (const path of messages) {
            const message = i18n.t(path);
            assert.strictEqual(typeof message, 'string');
            assert.notStrictEqual(message, path);
        }
    });
}); 
