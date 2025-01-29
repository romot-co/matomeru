import type { LocaleMessages } from '@/i18n/types';
import { LoggingService } from '@/services/logging/LoggingService';

export class MessageValidator {
    private readonly logger: LoggingService;

    constructor() {
        this.logger = LoggingService.getInstance();
    }

    validate(messages: Partial<LocaleMessages>): boolean {
        const template: Partial<LocaleMessages> = {
            'test.message': '',
            'test.with.params': '',
            'chatgpt.integration.error': '',
            'ui.messages.selectDirectory': '',
            'ui.messages.scanError': '',
            'ui.messages.sentToChatGPT': '',
            'ui.messages.chatGPTNotInstalled': '',
            'ui.progress.processing': '',
            'success.directory.processed': '',
            'error.directory.processing': '',
            'error.platform.unsupported': '',
            'error.config.invalid': '',
            'config.updated': '',
            'errors.directoryNotInWorkspace': '',
            'errors.chatGptIntegrationNotSupported': ''
        };

        const missingKeys = Object.keys(template).filter(key => {
            return !messages[key as keyof LocaleMessages];
        });

        if (missingKeys.length > 0) {
            this.logger.warn('Missing message keys', {
                source: 'MessageValidator.validate',
                details: { missingKeys }
            });
            return false;
        }

        return true;
    }
} 
