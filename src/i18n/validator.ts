import { ILogger } from '@/infrastructure/logging/LoggingService';
import type { LocaleMessages } from '@/i18n/types';

type MessageValue = string | { [key: string]: MessageValue };

export class MessageValidator {
    constructor(
        private readonly logger: ILogger
    ) {}

    /**
     * メッセージの整合性を検証します
     */
    validate(messages: LocaleMessages): boolean {
        try {
            this.validateStructure(messages);
            this.validateValues(messages);
            return true;
        } catch (error) {
            this.logger.error('Message validation failed', {
                source: 'MessageValidator.validate',
                details: { error: error instanceof Error ? error.message : String(error) }
            });
            return false;
        }
    }

    /**
     * メッセージの構造を検証します
     */
    private validateStructure(messages: LocaleMessages): void {
        if (!messages || typeof messages !== 'object') {
            throw new Error('Messages must be an object');
        }

        // 必須セクションの存在を確認
        const requiredSections = ['commands', 'ui', 'errors'] as const;
        for (const section of requiredSections) {
            if (!messages[section] || typeof messages[section] !== 'object') {
                throw new Error(`Missing or invalid section: ${section}`);
            }
        }
    }

    /**
     * メッセージの値を検証します
     */
    private validateValues(messages: LocaleMessages): void {
        this.validateSection(messages as unknown as { [key: string]: MessageValue });
    }

    /**
     * メッセージセクションを再帰的に検証します
     */
    private validateSection(obj: { [key: string]: MessageValue }): void {
        for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') {
                this.validateSection(value as { [key: string]: MessageValue });
            } else if (typeof value !== 'string') {
                throw new Error(`Invalid message value at ${key}`);
            }
        }
    }
} 
