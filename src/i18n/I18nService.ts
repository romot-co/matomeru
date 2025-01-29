import * as vscode from 'vscode';
import type { LocaleMessages, I18nOptions } from '@/i18n/types';
import { MessageValidator } from '@/i18n/validator';
import { LoggingService } from '@/services/logging/LoggingService';
import { enMessages } from './messages/en';
import { jaMessages } from './messages/ja';

/**
 * 国際化（i18n）を管理するサービス
 * シングルトンパターンで実装され、アプリケーション全体で一貫した翻訳を提供します
 */
export class I18nService {
    private static instance: I18nService;
    private messages: Record<string, Partial<LocaleMessages>>;
    private validator: MessageValidator;
    private currentLocale: string;
    private readonly fallbackLocale: string = 'en';
    private readonly logger: LoggingService;

    private constructor() {
        this.messages = {
            'en': enMessages,
            'ja': jaMessages
        };
        this.validator = new MessageValidator();
        this.currentLocale = this.fallbackLocale;
        this.logger = LoggingService.getInstance();
    }

    public static getInstance(): I18nService {
        if (!I18nService.instance) {
            I18nService.instance = new I18nService();
        }
        return I18nService.instance;
    }

    /**
     * テスト用にインスタンスをリセットします
     */
    static resetInstance(): void {
        I18nService.instance = null as any;
    }

    private detectLocale(): string {
        const vscodeLang = vscode.env.language;
        return vscodeLang.startsWith('ja') ? 'ja' : 'en';
    }

    t(key: string, params?: Record<string, any>): string {
        const message = this.findMessage(key);

        if (message === undefined) {
            this.logger.warn('Translation not found', {
                source: 'I18nService.t',
                details: { key, currentLocale: this.currentLocale }
            });
            return key;
        }

        if (params) {
            return this.formatWithParams(message, params);
        }

        return message;
    }

    private findMessage(key: string): string | undefined {
        // 現在のロケールでメッセージを探す
        const currentMessages = this.messages[this.currentLocale];
        if (currentMessages && key in currentMessages) {
            return currentMessages[key as keyof LocaleMessages] as string;
        }

        // フォールバックロケールでメッセージを探す
        if (this.currentLocale !== this.fallbackLocale) {
            const fallbackMessages = this.messages[this.fallbackLocale];
            if (fallbackMessages && key in fallbackMessages) {
                this.logger.warn(`Message not found in ${this.currentLocale}, falling back to ${this.fallbackLocale}`, {
                    source: 'I18nService.findMessage',
                    details: { key, currentLocale: this.currentLocale }
                });
                return fallbackMessages[key as keyof LocaleMessages] as string;
            }
        }

        return undefined;
    }

    private formatWithParams(message: string, params: Record<string, any>): string {
        return Object.entries(params).reduce(
            (str, [key, value]) => str.replace(new RegExp(`{{${key}}}`, 'g'), String(value)),
            message
        );
    }

    getCurrentLocale(): string {
        return this.currentLocale;
    }

    public setLocale(locale: string): void {
        // 部分ロケールのフォールバック処理
        const shortLocale = locale.split('-')[0];
        
        if (this.messages[locale]) {
            this.currentLocale = locale;
        } else if (this.messages[shortLocale]) {
            this.currentLocale = shortLocale;
            this.logger.info(`Falling back from ${locale} to ${shortLocale}`, {
                source: 'I18nService.setLocale',
                details: { originalLocale: locale, fallbackLocale: shortLocale }
            });
        } else {
            this.logger.warn(`Locale ${locale} not found, falling back to ${this.fallbackLocale}`, {
                source: 'I18nService.setLocale',
                details: { requestedLocale: locale, fallbackLocale: this.fallbackLocale }
            });
            this.currentLocale = this.fallbackLocale;
        }
    }
} 