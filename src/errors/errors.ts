import * as vscode from 'vscode';

export class MatomeruError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly params?: any[]
    ) {
        super(String(message || ''));
        this.name = 'MatomeruError';
    }

    /**
     * ローカライズされたエラーメッセージを取得
     */
    getLocalizedMessage(): string {
        return vscode.l10n.t(this.code, ...(this.params || []));
    }

    /**
     * ログ出力用のメッセージを取得
     */
    getLogMessage(): string {
        return `${this.name}: ${this.message} (${this.code})`;
    }
}

export class FileOperationError extends MatomeruError {
    constructor(code: string, params?: any[]) {
        super(code, vscode.l10n.t(code, ...(params || [])), params);
        this.name = 'FileOperationError';
    }
}

export class DirectoryNotFoundError extends FileOperationError {
    constructor(path: string) {
        super('Directory not found: {0}', [path]);
    }
}

export class FileNotFoundError extends FileOperationError {
    constructor(path: string) {
        super('File not found: {0}', [path]);
    }
}

export class FileSizeLimitError extends FileOperationError {
    constructor(path: string, size: number, limit: number) {
        super('File size exceeds limit: {0} ({1} > {2} bytes)', [path, size, limit]);
    }
}

export class ScanError extends FileOperationError {
    constructor(message: string) {
        super('Scan error: {0}', [message]);
    }
}

export class WorkspaceNotFoundError extends FileOperationError {
    constructor() {
        super('No workspace is open', []);
    }
}

export class FileReadError extends FileOperationError {
    constructor(path: string, message: string) {
        super('File read error: {0} - {1}', [path, message]);
    }
}

export class DirectoryScanError extends FileOperationError {
    constructor(path: string, message: string) {
        super('Directory scan error: {0} - {1}', [path, message]);
    }
}

export class ChatGPTError extends MatomeruError {
    constructor(message: string) {
        super('ChatGPT error: {0}', message, [message]);
        this.name = 'ChatGPTError';
    }
}

export class ClipboardError extends MatomeruError {
    constructor(message: string) {
        super('Clipboard error: {0}', message, [message]);
        this.name = 'ClipboardError';
    }
}

export class EditorError extends MatomeruError {
    constructor(message: string) {
        super('Editor error: {0}', message, [message]);
        this.name = 'EditorError';
    }
}
