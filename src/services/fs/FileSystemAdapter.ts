import * as vscode from 'vscode';
import { ErrorService } from '@/errors/services/ErrorService';
import { BaseError } from '@/errors/base/BaseError';

export interface FileStats {
    size: number;
    mtime: number;
}

export interface DirectoryEntry {
    name: string;
    type: vscode.FileType;
}

export class FileSystemAdapter {
    private errorService: ErrorService;

    constructor() {
        this.errorService = ErrorService.getInstance();
    }

    async readFile(filePath: string): Promise<string> {
        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            return Buffer.from(content).toString('utf-8');
        } catch (error) {
            await this.handleError('readFile', error, filePath);
            throw error;
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const buffer = Buffer.from(content, 'utf-8');
            await vscode.workspace.fs.writeFile(uri, buffer);
        } catch (error) {
            await this.handleError('writeFile', error, filePath);
            throw error;
        }
    }

    async readDirectory(directoryPath: string): Promise<DirectoryEntry[]> {
        try {
            const uri = vscode.Uri.file(directoryPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries.map(([name, type]) => ({ name, type }));
        } catch (error) {
            await this.handleError('readDirectory', error, directoryPath);
            throw error;
        }
    }

    async stat(filePath: string): Promise<FileStats> {
        try {
            const uri = vscode.Uri.file(filePath);
            const stat = await vscode.workspace.fs.stat(uri);
            return {
                size: stat.size,
                mtime: stat.mtime
            };
        } catch (error) {
            await this.handleError('stat', error, filePath);
            throw error;
        }
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    async createDirectory(directoryPath: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(directoryPath);
            await vscode.workspace.fs.createDirectory(uri);
        } catch (error) {
            await this.handleError('createDirectory', error, directoryPath);
            throw error;
        }
    }

    async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
        try {
            const uri = vscode.Uri.file(path);
            await vscode.workspace.fs.delete(uri, options);
        } catch (error) {
            await this.handleError('delete', error, path);
            throw error;
        }
    }

    async copy(source: string, target: string, options?: { overwrite?: boolean }): Promise<void> {
        try {
            const sourceUri = vscode.Uri.file(source);
            const targetUri = vscode.Uri.file(target);
            await vscode.workspace.fs.copy(sourceUri, targetUri, options);
        } catch (error) {
            await this.handleError('copy', error, `${source} -> ${target}`);
            throw error;
        }
    }

    private async handleError(operation: string, error: unknown, path: string): Promise<void> {
        const details = {
            operation,
            path,
            error: error instanceof Error ? error.message : String(error)
        };

        await this.errorService.handleError(
            new BaseError(
                `File system error during ${operation}`,
                'FileSystemError',
                details
            ),
            { 
                source: 'FileSystemAdapter',
                timestamp: new Date()
            }
        );
    }
} 