import { BaseError } from '../../shared/errors/base/BaseError';

export class UnsupportedPlatformError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'UnsupportedPlatformError', details);
    }
}

export class AccessibilityPermissionError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'AccessibilityPermissionError', details);
    }
}

export class ChatGPTAppNotFoundError extends BaseError {
    constructor(message: string) {
        super(message, 'ChatGPTAppNotFoundError');
    }
}

export class ChatGPTIntegrationError extends BaseError {
    constructor(message: string) {
        super(message, 'ChatGPTIntegrationError');
    }
}

export class ChatGPTTimeoutError extends BaseError {
    constructor(message: string) {
        super(message, 'ChatGPTTimeoutError');
    }
}

export class ChatGPTPermissionError extends BaseError {
    constructor(message: string) {
        super(message, 'ChatGPTPermissionError');
    }
}

export class ChatGPTUIError extends BaseError {
    constructor(message: string) {
        super(message, 'ChatGPTUIError');
    }
} 