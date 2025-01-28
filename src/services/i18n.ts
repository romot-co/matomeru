import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class I18n {
    private static instance: I18n;
    private translations: { [key: string]: { [key: string]: string } } = {};
    private currentLocale: string = 'en';

    constructor() {
        this.loadTranslations();
    }

    static getInstance(): I18n {
        if (!I18n.instance) {
            I18n.instance = new I18n();
        }
        return I18n.instance;
    }

    private loadTranslations(): void {
        // デフォルトの英語翻訳を設定
        this.translations['en'] = {
            'errors.unsupportedPlatform': 'This feature is only supported on macOS',
            'errors.accessibilityPermission': 'Accessibility permission is required',
            'errors.chatGPTNotFound': 'ChatGPT app is not installed',
            'errors.timeout': 'Operation timed out',
            'errors.permission': 'Permission error occurred',
            'errors.uiError': 'UI interaction error occurred',
            'ui.messages.selectDirectory': 'Please select a directory.',
            'ui.messages.activated': 'Matomeru extension is now active.',
            'ui.messages.success': 'Operation completed successfully.',
            'ui.messages.error': 'An error occurred: {0}',
            'ui.messages.invalidPath': 'Invalid file path: {0}'
        };

        // 日本語翻訳を設定
        this.translations['ja'] = {
            'errors.unsupportedPlatform': 'この機能はmacOSでのみサポートされています',
            'errors.accessibilityPermission': 'アクセシビリティの権限が必要です',
            'errors.chatGPTNotFound': 'ChatGPTアプリがインストールされていません',
            'errors.timeout': '操作がタイムアウトしました',
            'errors.permission': '権限エラーが発生しました',
            'errors.uiError': 'UI操作エラーが発生しました',
            'ui.messages.selectDirectory': 'ディレクトリを選択してください。',
            'ui.messages.activated': 'Matomeruエクステンションが有効になりました。',
            'ui.messages.success': '操作が正常に完了しました。',
            'ui.messages.error': 'エラーが発生しました: {0}',
            'ui.messages.invalidPath': '無効なファイルパス: {0}'
        };

        // 外部の翻訳ファイルを読み込む
        const localesPath = path.join(__dirname, '..', 'i18n');
        if (fs.existsSync(localesPath)) {
            fs.readdirSync(localesPath).forEach(file => {
                if (file.endsWith('.json')) {
                    const locale = file.replace('.json', '');
                    const content = fs.readFileSync(path.join(localesPath, file), 'utf8');
                    this.translations[locale] = {
                        ...this.translations[locale],
                        ...JSON.parse(content)
                    };
                }
            });
        }
    }

    setLocale(locale: string): void {
        if (this.translations[locale]) {
            this.currentLocale = locale;
        } else if (locale.includes('-')) {
            // 部分的なロケールコードの処理（例：ja-JP -> ja）
            const baseLocale = locale.split('-')[0];
            if (this.translations[baseLocale]) {
                this.currentLocale = baseLocale;
            }
        }
    }

    t(key: string, ...args: any[]): string {
        let translation = this.translations[this.currentLocale]?.[key] || 
                         this.translations['en']?.[key] || 
                         key;

        if (args.length > 0) {
            args.forEach((arg, index) => {
                translation = translation.replace(`{${index}}`, String(arg));
            });
        }

        return translation;
    }
} 
