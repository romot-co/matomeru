import * as assert from 'assert';
import { I18nService, II18nService } from '@/i18n/I18nService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { MessageValidator } from '@/i18n/validator';

describe('I18nService', () => {
    let i18n: II18nService;
    let loggerStub: ILogger;

    beforeEach(() => {
        // LoggerServiceのスタブ化
        loggerStub = {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            show: () => {},
            dispose: () => {}
        };

        // MessageValidatorの初期化
        const validator = new MessageValidator(loggerStub);

        // I18nServiceの初期化
        i18n = I18nService.createDefault(loggerStub);
    });

    it('基本的なメッセージ取得', () => {
        i18n.setLocale('ja');
        const message = i18n.t('test.message');
        assert.strictEqual(message, 'テストメッセージ', 'メッセージが正しく取得できていません');
    });

    it('引数を含むメッセージのフォーマット', () => {
        i18n.setLocale('ja');
        const message = i18n.t('test.with.params', { name: 'テスト' });
        assert.strictEqual(message, 'こんにちは、テストさん', 'パラメータ付きメッセージが正しくフォーマットされていません');
    });

    it('存在しないメッセージパスの処理', () => {
        i18n.setLocale('ja');
        const message = i18n.t('non.existent.path');
        assert.strictEqual(message, 'non.existent.path', '存在しないメッセージパスの処理が正しくありません');
    });

    it('ロケールの切り替え', () => {
        i18n.setLocale('en');
        let message = i18n.t('test.message');
        assert.strictEqual(message, 'Test message', '英語メッセージが正しく取得できていません');

        i18n.setLocale('ja');
        message = i18n.t('test.message');
        assert.strictEqual(message, 'テストメッセージ', '日本語メッセージが正しく取得できていません');
    });

    it('フォールバックメカニズムの確認', () => {
        i18n.setLocale('fr'); // 未サポートのロケール
        const message = i18n.t('test.message');
        assert.strictEqual(message, 'Test message', 'フォールバックが正しく機能していません');
    });

    it('部分的なロケールコードの処理', () => {
        i18n.setLocale('ja-JP');
        assert.strictEqual(i18n.getCurrentLocale(), 'ja', 'ロケールが正しく変換されていません');
        const message = i18n.t('test.message');
        assert.strictEqual(message, 'テストメッセージ', '部分的なロケールコードの処理が正しくありません');
    });

    it('ChatGPT関連メッセージの確認', () => {
        i18n.setLocale('ja');
        const message = i18n.t('chatgpt.integration.error');
        assert.strictEqual(message, 'ChatGPT統合機能でエラーが発生しました', 'ChatGPT関連メッセージが正しく取得できていません');
    });
}); 
