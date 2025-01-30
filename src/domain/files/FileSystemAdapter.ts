import * as vscode from 'vscode';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { BaseError } from '../../shared/errors/base/BaseError';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import * as path from 'path';

export interface FileStats {
    size: number;
    mtime: number;
}

export interface DirectoryEntry {
    name: string;
    type: vscode.FileType;
}

export interface IFileSystem {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    readDirectory(directoryPath: string): Promise<DirectoryEntry[]>;
    stat(filePath: string): Promise<FileStats>;
    exists(filePath: string): Promise<boolean>;
    createDirectory(directoryPath: string): Promise<void>;
    delete(path: string, options?: { recursive?: boolean }): Promise<void>;
    copy(source: string, target: string, options?: { overwrite?: boolean }): Promise<void>;
}

/**
 * ファイルシステムアダプター
 * VS Code のファイルシステムAPIをラップし、エラーハンドリングを提供します
 */
export class FileSystemAdapter implements IFileSystem {
    constructor(
        private readonly errorHandler: IErrorHandler,
        private readonly logger: ILogger
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でFileSystemAdapterインスタンスを生成
     */
    public static createDefault(
        errorHandler: IErrorHandler,
        logger: ILogger
    ): FileSystemAdapter {
        return new FileSystemAdapter(errorHandler, logger);
    }

    async readFile(filePath: string): Promise<string> {
        try {
            // パスの正規化と絶対パスへの変換
            const normalizedPath = path.normalize(filePath);
            const absolutePath = path.isAbsolute(normalizedPath) 
                ? normalizedPath 
                : path.resolve(process.cwd(), normalizedPath);
            
            this.logger.debug('ファイル読み込み開始', {
                source: 'FileSystemAdapter.readFile',
                details: {
                    originalPath: filePath,
                    normalizedPath,
                    absolutePath
                }
            });

            // ファイルの存在確認
            if (!await this.exists(absolutePath)) {
                const error = new BaseError(
                    'ファイルが存在しません',
                    'FileSystemError',
                    { 
                        path: absolutePath,
                        originalPath: filePath,
                        operation: 'readFile',
                        code: 'ENOENT'
                    }
                );
                await this.handleError('readFile', error, absolutePath);
                throw error;
            }

            // ファイルの統計情報を取得
            const stats = await this.stat(absolutePath);
            if (stats.size === 0) {
                const error = new BaseError(
                    'ファイルが空です',
                    'FileSystemError',
                    { 
                        path: absolutePath,
                        originalPath: filePath,
                        operation: 'readFile',
                        code: 'EMPTY_FILE'
                    }
                );
                await this.handleError('readFile', error, absolutePath);
                throw error;
            }

            const uri = vscode.Uri.file(absolutePath);
            let content: Uint8Array;
            try {
                content = await vscode.workspace.fs.readFile(uri);
                this.logger.debug('ファイル読み込み成功', {
                    source: 'FileSystemAdapter.readFile',
                    details: {
                        path: absolutePath,
                        size: content.length
                    }
                });
            } catch (readError) {
                const error = new BaseError(
                    'ファイルの読み込みに失敗しました',
                    'FileSystemError',
                    { 
                        path: absolutePath,
                        originalPath: filePath,
                        operation: 'readFile',
                        originalError: readError instanceof Error ? readError.message : String(readError),
                        code: readError instanceof Error && 'code' in readError ? (readError as any).code : 'EREAD'
                    }
                );
                await this.handleError('readFile', error, absolutePath);
                throw error;
            }

            if (!content || content.length === 0) {
                const error = new BaseError(
                    'ファイルの内容が空です',
                    'FileSystemError',
                    { 
                        path: absolutePath,
                        originalPath: filePath,
                        operation: 'readFile',
                        code: 'EMPTY_CONTENT'
                    }
                );
                await this.handleError('readFile', error, absolutePath);
                throw error;
            }

            return Buffer.from(content).toString('utf-8');
        } catch (error) {
            if (error instanceof BaseError) {
                throw error;
            }

            // 予期しないエラーの場合
            const baseError = new BaseError(
                'ファイルシステムエラーが発生しました',
                'FileSystemError',
                {
                    path: filePath,
                    normalizedPath: path.normalize(filePath),
                    operation: 'readFile',
                    error: error instanceof Error ? error.message : String(error),
                    code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
                    stack: error instanceof Error ? error.stack : undefined
                }
            );
            await this.handleError('readFile', baseError, filePath);
            throw baseError;
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(filePath);
            const buffer = Buffer.from(content, 'utf-8');
            await vscode.workspace.fs.writeFile(uri, buffer);
        } catch (error) {
            const details = {
                operation: 'writeFile',
                path: filePath,
                error: error instanceof Error ? error.message : String(error)
            };
            
            this.logger.error('ファイル書き込みエラー', {
                source: 'FileSystemAdapter.writeFile',
                details
            });

            await this.handleError('writeFile', error, filePath);
            throw new BaseError(
                'ファイルの書き込みに失敗しました',
                'FileSystemError',
                details
            );
        }
    }

    async readDirectory(directoryPath: string): Promise<DirectoryEntry[]> {
        try {
            const uri = vscode.Uri.file(directoryPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries.map(([name, type]) => ({ name, type }));
        } catch (error) {
            const details = {
                operation: 'readDirectory',
                path: directoryPath,
                error: error instanceof Error ? error.message : String(error)
            };
            
            this.logger.error('ディレクトリ読み込みエラー', {
                source: 'FileSystemAdapter.readDirectory',
                details
            });

            await this.handleError('readDirectory', error, directoryPath);
            throw new BaseError(
                'ディレクトリの読み込みに失敗しました',
                'FileSystemError',
                details
            );
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
        try {
            const details = {
                operation,
                path,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                code: error instanceof Error && 'code' in error ? (error as any).code : undefined,
                timestamp: new Date().toISOString()
            };

            // エラーログを詳細に記録
            this.logger.error(`ファイルシステム操作エラー: ${operation}`, {
                source: 'FileSystemAdapter',
                details: {
                    ...details,
                    originalError: error
                }
            });

            // エラーハンドラーに渡す前にエラーオブジェクトを適切に変換
            const baseError = error instanceof BaseError 
                ? error 
                : new BaseError(
                    `ファイルシステムエラー: ${operation}`,
                    'FileSystemError',
                    details
                );

            await this.errorHandler.handleError(baseError, {
                source: 'FileSystemAdapter',
                timestamp: new Date()
            });
        } catch (handlingError) {
            // エラーハンドリング自体が失敗した場合のフォールバック
            this.logger.error('エラー処理に失敗しました', {
                source: 'FileSystemAdapter.handleError',
                details: {
                    originalError: error,
                    handlingError,
                    operation,
                    path
                }
            });
        }
    }
} 