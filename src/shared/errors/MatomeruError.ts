export enum ErrorCode {
    UNKNOWN = 'UNKNOWN',
    FILE_SYSTEM = 'FILE_SYSTEM',
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_READ_ERROR = 'FILE_READ_ERROR',
    FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
    FILE_PERMISSION_ERROR = 'FILE_PERMISSION_ERROR',
    FILE_EMPTY = 'FILE_EMPTY',
    WORKSPACE_ERROR = 'WORKSPACE_ERROR',
    INVALID_DIRECTORY = 'INVALID_DIRECTORY',
    INVALID_INPUT = 'INVALID_INPUT',
    PLATFORM_ERROR = 'PLATFORM_ERROR',
    PERMISSION_ERROR = 'PERMISSION_ERROR',
    CLIPBOARD_ERROR = 'CLIPBOARD_ERROR',
    WINDOW_ACTIVATION = 'WINDOW_ACTIVATION',
    CHATGPT_NOT_INSTALLED = 'CHATGPT_NOT_INSTALLED',
    WORKSPACE = 'WORKSPACE'
}

export interface ErrorContext {
    source: string;
    timestamp: Date;
    details?: Record<string, unknown>;
    originalError?: unknown;
}

export class MatomeruError extends Error {
    constructor(
        message: string,
        public readonly code: ErrorCode,
        public readonly context: ErrorContext
    ) {
        super(message);
        this.name = 'MatomeruError';
        Error.captureStackTrace(this, MatomeruError);
    }
} 