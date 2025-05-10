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
        super('msg.directoryNotFound', [path]);
    }
}

export class FileNotFoundError extends FileOperationError {
    constructor(path: string) {
        super('msg.fileNotFound', [path]);
    }
}

export class FileSizeLimitError extends FileOperationError {
    constructor(path: string, size: number, limit: number) {
        super('msg.fileSizeLimit', [path, size, limit]);
    }
}

export class ScanError extends FileOperationError {
    constructor(message: string) {
        super('msg.scanError', [message]);
    }
}

export class WorkspaceNotFoundError extends FileOperationError {
    constructor() {
        super('msg.workspaceNotFound');
    }
}

export class FileReadError extends FileOperationError {
    constructor(path: string, message: string) {
        super('msg.fileReadError', [path, message]);
    }
}

export class DirectoryScanError extends FileOperationError {
    constructor(path: string, message: string) {
        super('msg.directoryScanError', [path, message]);
    }
}

export class ChatGPTError extends MatomeruError {
    constructor(message: string) {
        super('msg.chatGPTError', message, [message]);
        this.name = 'ChatGPTError';
    }
}

export class ClipboardError extends MatomeruError {
    constructor(message: string) {
        super('msg.clipboardError', message, [message]);
        this.name = 'ClipboardError';
    }
}

export class EditorError extends MatomeruError {
    constructor(message: string) {
        super('msg.editorError', message, [message]);
        this.name = 'EditorError';
    }
} 