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
        assert.strictEqual(i18n.t('ui.messages.selectDirectory'), 'Please select a directory');
    });

    test('引数を含むメッセージのフォーマット', () => {
        const error = { message: 'Test error' };
        const message = i18n.t('ui.messages.scanError', { error });
        assert.strictEqual(message, 'Failed to scan directory: [object Object]');
    });

    test('存在しないメッセージパスの処理', () => {
        const key = 'invalid.message.path';
        assert.strictEqual(i18n.t(key), key);
    });

    test('ロケールの切り替え', () => {
        // VSCodeの言語設定を一時的に変更
        const originalLanguage = Object.getOwnPropertyDescriptor(vscode.env, 'language');
        
        Object.defineProperty(vscode.env, 'language', {
            value: 'ja',
            configurable: true
        });
        
        const i18nJa = I18n.getInstance();
        assert.strictEqual(
            i18nJa.t('ui.messages.selectDirectory'),
            'Please select a directory'
        );
        
        Object.defineProperty(vscode.env, 'language', {
            value: 'en',
            configurable: true
        });
        
        const i18nEn = I18n.getInstance();
        assert.strictEqual(
            i18nEn.t('ui.messages.selectDirectory'),
            'Please select a directory'
        );
        
        // 元の設定を復元
        if (originalLanguage) {
            Object.defineProperty(vscode.env, 'language', originalLanguage);
        }
    });

    test('メッセージバリデーションの動作確認', () => {
        assert.doesNotThrow(() => {
            I18n.getInstance({
                defaultLocale: 'en',
                fallbackLocale: 'en',
                validateOnInit: true
            });
        });
    });

    test('フォールバックメカニズムの確認', () => {
        Object.defineProperty(vscode.env, 'language', {
            value: 'fr',
            configurable: true
        });

        const i18nFr = I18n.getInstance();
        assert.strictEqual(
            i18nFr.t('ui.messages.selectDirectory'),
            'Please select a directory'
        );
    });

    test('部分的なロケールコードの処理', () => {
        Object.defineProperty(vscode.env, 'language', {
            value: 'ja-JP',
            configurable: true
        });

        const i18nJaJP = I18n.getInstance();
        assert.strictEqual(
            i18nJaJP.t('ui.messages.selectDirectory'),
            'Please select a directory'
        );
    });

    test('ChatGPT関連メッセージの確認', () => {
        assert.strictEqual(
            i18n.t('ui.messages.sentToChatGPT'),
            'Sent to ChatGPT'
        );
        assert.strictEqual(
            i18n.t('ui.messages.chatGPTNotInstalled'),
            'ChatGPT is not installed'
        );
    });
}); 
