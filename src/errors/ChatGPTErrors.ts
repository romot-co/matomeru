import { BaseError } from '@/errors/base/BaseError';

export class UnsupportedPlatformError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsupportedPlatformError';
    }
}

export class AccessibilityPermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AccessibilityPermissionError';
    }
}

export class ChatGPTAppNotFoundError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ChatGPTAppNotFoundError', details);
    }
}

export class ChatGPTIntegrationError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ChatGPTIntegrationError', details);
    }
}

export class ChatGPTTimeoutError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ChatGPTTimeoutError', details);
    }
}

export class ChatGPTPermissionError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ChatGPTPermissionError', details);
    }
}

export class ChatGPTUIError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ChatGPTUIError', details);
    }
} 