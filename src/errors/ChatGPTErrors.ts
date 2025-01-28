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

export class ChatGPTAppNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatGPTAppNotFoundError';
    }
}

export class ChatGPTIntegrationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatGPTIntegrationError';
    }
}

export class ChatGPTTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatGPTTimeoutError';
    }
}

export class ChatGPTPermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatGPTPermissionError';
    }
}

export class ChatGPTUIError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ChatGPTUIError';
    }
} 