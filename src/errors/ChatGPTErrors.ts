export class UnsupportedPlatformError extends Error {
    constructor() {
        super('This feature is only supported on macOS');
        this.name = 'UnsupportedPlatformError';
    }
}

export class AccessibilityPermissionError extends Error {
    constructor() {
        super('Accessibility permission is required');
        this.name = 'AccessibilityPermissionError';
    }
}

export class ChatGPTAppNotFoundError extends Error {
    constructor() {
        super('ChatGPT app is not installed');
        this.name = 'ChatGPTAppNotFoundError';
    }
}

export class ChatGPTIntegrationError extends Error {
    constructor(message: string) {
        super(`[CHATGPT_INTEGRATION_ERROR] ${message}`);
        this.name = 'ChatGPTIntegrationError';
    }
}

export class ChatGPTTimeoutError extends ChatGPTIntegrationError {
    constructor(message: string) {
        super(`[TIMEOUT] ${message}`);
        this.name = 'ChatGPTTimeoutError';
    }
}

export class ChatGPTPermissionError extends ChatGPTIntegrationError {
    constructor(message: string) {
        super(`[PERMISSION] ${message}`);
        this.name = 'ChatGPTPermissionError';
    }
}

export class ChatGPTUIError extends ChatGPTIntegrationError {
    constructor(message: string) {
        super(`[UI_ERROR] ${message}`);
        this.name = 'ChatGPTUIError';
    }
} 