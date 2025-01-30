import * as vscode from 'vscode';
import type { LocaleMessages } from './types';
import { MessageValidator } from './validator';
import { ILogger } from '../infrastructure/logging/LoggingService';
import { enMessages } from './messages/en';
import { jaMessages } from './messages/ja';

export interface II18nService {
    t(key: string, params?: Record<string, unknown>): string;
    setLocale(locale: string): void;
    getCurrentLocale(): string;
}

/**
 * 国際化（i18n）を管理するサービス
 * アプリケーション全体で一貫した翻訳を提供します
 */
export class I18nService implements II18nService {
    private messages: Record<string, Partial<LocaleMessages>>;
    private validator: MessageValidator;
    private currentLocale: string;
    private readonly fallbackLocale: string = 'en';

    constructor(
        private readonly logger: ILogger
    ) {
        this.messages = {
            'en': enMessages,
            'ja': jaMessages
        };
        this.validator = new MessageValidator(logger);
        this.currentLocale = this.detectLocale();
    }

    /**
     * ファクトリメソッド - デフォルトの設定でI18nServiceインスタンスを生成
     */
    public static createDefault(logger: ILogger): I18nService {
        return new I18nService(logger);
    }

    private detectLocale(): string {
        const vscodeLang = vscode.env.language;
        return this.normalizeLocale(vscodeLang);
    }

    t(key: string, params?: Record<string, unknown>): string {
        const message = this.findMessage(key);

        if (message === undefined) {
            this.logger.warn('Message not found', {
                source: 'I18nService.t',
                details: { key, locale: this.currentLocale }
            });
            return key;
        }

        if (params) {
            return this.formatMessage(message, params);
        }

        return message;
    }

    setLocale(locale: string): void {
        const normalizedLocale = this.normalizeLocale(locale);
        if (this.messages[normalizedLocale]) {
            this.currentLocale = normalizedLocale;
        } else {
            this.logger.warn('Locale not supported, using fallback', {
                source: 'I18nService.setLocale',
                details: { locale, fallback: this.fallbackLocale }
            });
            this.currentLocale = this.fallbackLocale;
        }
    }

    getCurrentLocale(): string {
        return this.currentLocale;
    }

    private findMessage(key: string): string | undefined {
        const message = this.findMessageInLocale(key, this.currentLocale);
        if (message === undefined && this.currentLocale !== this.fallbackLocale) {
            return this.findMessageInLocale(key, this.fallbackLocale);
        }
        return message;
    }

    private findMessageInLocale(key: string, locale: string): string | undefined {
        const messages = this.messages[locale];
        if (!messages) {
            return undefined;
        }

        const message = messages[key as keyof LocaleMessages];
        if (typeof message === 'string') {
            return message;
        }

        const parts = key.split('.');
        let current: any = messages;

        for (const part of parts) {
            if (current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[part];
        }

        return typeof current === 'string' ? current : undefined;
    }

    private formatMessage(message: string, params: Record<string, unknown>): string {
        return message.replace(/\{(\w+)\}/g, (match, key) => {
            const value = params[key];
            return value !== undefined ? String(value) : match;
        });
    }

    private normalizeLocale(locale: string): string {
        const [lang] = locale.toLowerCase().split(/[-_]/);
        return this.messages[lang] ? lang : this.fallbackLocale;
    }
} 