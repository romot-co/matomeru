import * as vscode from 'vscode';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import * as path from 'path';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';
import { FileStats, DirectoryEntry } from '../FileSystemAdapter';

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
        // パスの正規化と絶対パスへの変換
        const normalizedPath = path.normalize(filePath);
        const absolutePath = path.isAbsolute(normalizedPath) 
            ? normalizedPath 
            : path.resolve(process.cwd(), normalizedPath);

        try {
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
                throw new MatomeruError(
                    'ファイルの読み込みに失敗しました',
                    ErrorCode.FILE_READ_ERROR,
                    {
                        source: 'FileSystemAdapter.readFile',
                        details: {
                            path: absolutePath,            // 絶対パスをセット
                            originalPath: filePath,        // もともとの呼び出しパス
                            operation: 'readFile',
                            error: 'File not found',
                            code: 'ENOENT'
                        },
                        timestamp: new Date()
                    }
                );
            }

            // ファイルの統計情報を取得
            const stats = await this.stat(absolutePath);
            if (stats.size === 0) {
                throw new MatomeruError(
                    'ファイルの読み込みに失敗しました',
                    ErrorCode.FILE_READ_ERROR,
                    {
                        source: 'FileSystemAdapter.readFile',
                        details: {
                            path: absolutePath,
                            originalPath: filePath,
                            operation: 'readFile',
                            error: 'File is empty',
                            code: 'EMPTY_FILE'
                        },
                        timestamp: new Date()
                    }
                );
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
                throw new MatomeruError(
                    'ファイルの読み込みに失敗しました',
                    ErrorCode.FILE_READ_ERROR,
                    {
                        source: 'FileSystemAdapter.readFile',
                        details: {
                            path: absolutePath,
                            originalPath: filePath,
                            operation: 'readFile',
                            error: readError instanceof Error ? readError.message : String(readError),
                            code: readError instanceof Error && 'code' in readError ? (readError as any).code : 'EREAD'
                        },
                        timestamp: new Date()
                    }
                );
            }

            if (!content || content.length === 0) {
                throw new MatomeruError(
                    'ファイルの読み込みに失敗しました',
                    ErrorCode.FILE_READ_ERROR,
                    {
                        source: 'FileSystemAdapter.readFile',
                        details: {
                            path: absolutePath,
                            originalPath: filePath,
                            operation: 'readFile',
                            error: 'File content is empty',
                            code: 'EMPTY_CONTENT'
                        },
                        timestamp: new Date()
                    }
                );
            }

            return Buffer.from(content).toString('utf-8');
        } catch (error) {
            if (error instanceof MatomeruError) {
                await this.errorHandler.handleError(error);
                throw error;
            }

            // 予期しないエラーの場合
            const matomeruError = new MatomeruError(
                'ファイルシステムエラーが発生しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.readFile',
                    details: {
                        path: absolutePath,
                        originalPath: filePath,
                        normalizedPath,
                        operation: 'readFile',
                        error: error instanceof Error ? error.message : String(error),
                        code: error instanceof Error && 'code' in error ? (error as any).code : 'UNKNOWN',
                        stack: error instanceof Error ? error.stack : undefined
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const uri = vscode.Uri.file(filePath);
        try {
            const buffer = Buffer.from(content, 'utf-8');
            await vscode.workspace.fs.writeFile(uri, buffer);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ファイルの書き込みに失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.writeFile',
                    details: {
                        operation: 'writeFile',
                        path: filePath,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async readDirectory(directoryPath: string): Promise<DirectoryEntry[]> {
        const uri = vscode.Uri.file(directoryPath);
        try {
            const entries = await vscode.workspace.fs.readDirectory(uri);
            return entries.map(([name, type]) => ({ name, type }));
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ディレクトリの読み込みに失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.readDirectory',
                    details: {
                        operation: 'readDirectory',
                        path: directoryPath,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async stat(filePath: string): Promise<FileStats> {
        const uri = vscode.Uri.file(filePath);
        try {
            const stat = await vscode.workspace.fs.stat(uri);
            return {
                size: stat.size,
                mtime: stat.mtime
            };
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ファイル情報の取得に失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.stat',
                    details: {
                        operation: 'stat',
                        path: filePath,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async exists(filePath: string): Promise<boolean> {
        const uri = vscode.Uri.file(filePath);
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    async createDirectory(directoryPath: string): Promise<void> {
        const uri = vscode.Uri.file(directoryPath);
        try {
            await vscode.workspace.fs.createDirectory(uri);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ディレクトリの作成に失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.createDirectory',
                    details: {
                        operation: 'createDirectory',
                        path: directoryPath,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
        const uri = vscode.Uri.file(path);
        try {
            await vscode.workspace.fs.delete(uri, options);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ファイルの削除に失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.delete',
                    details: {
                        operation: 'delete',
                        path,
                        options,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async copy(source: string, target: string, options?: { overwrite?: boolean }): Promise<void> {
        try {
            const sourceUri = vscode.Uri.file(source);
            const targetUri = vscode.Uri.file(target);
            await vscode.workspace.fs.copy(sourceUri, targetUri, options);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'ファイルのコピーに失敗しました',
                ErrorCode.FILE_SYSTEM,
                {
                    source: 'FileSystemAdapter.copy',
                    details: {
                        operation: 'copy',
                        sourcePath: source,
                        targetPath: target,
                        options,
                        error: error instanceof Error ? error.message : String(error)
                    },
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }
}
