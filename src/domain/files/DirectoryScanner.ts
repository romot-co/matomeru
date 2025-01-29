import * as vscode from 'vscode';
import * as path from 'path';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';
import { BaseError } from '@/shared/errors/base/BaseError';
import type { ErrorContext } from '../../types';
import { IWorkspaceService } from '@/domain/workspace/WorkspaceService';
import { IFileSystem } from './FileSystemAdapter';
import { IFileTypeService } from './FileTypeService';

export interface FileInfo {
    path: string;
    relativePath: string;
    size: number;
    content: string;
    language?: string;
}

export interface ScanResult {
    files: FileInfo[];
    totalSize: number;
}

export interface ScanOptions {
    batchSize?: number;
    maxFileSize?: number;
    excludePatterns?: string[];
}

export interface IDirectoryScanner {
    scan(directoryPath: string, options?: ScanOptions): Promise<ScanResult>;
    validateWorkspace(directoryPath: string): Promise<vscode.WorkspaceFolder | undefined>;
    collectFiles(directoryPath: string, workspaceFolder: vscode.WorkspaceFolder, excludePatterns?: string[]): Promise<vscode.Uri[]>;
}

/**
 * ディレクトリスキャナー
 * 指定されたディレクトリ内のファイルを収集し、その内容と情報を提供します
 */
export class DirectoryScanner implements IDirectoryScanner {
    constructor(
        private readonly config: IConfigurationService,
        private readonly logger: ILogger,
        private readonly errorHandler: IErrorHandler,
        private readonly workspaceService: IWorkspaceService,
        private readonly fileTypeService: IFileTypeService,
        private readonly fsAdapter: IFileSystem
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でDirectoryScannerインスタンスを生成
     */
    public static createDefault(
        config: IConfigurationService,
        logger: ILogger,
        errorHandler: IErrorHandler,
        workspaceService: IWorkspaceService,
        fileTypeService: IFileTypeService,
        fsAdapter: IFileSystem
    ): DirectoryScanner {
        return new DirectoryScanner(
            config,
            logger,
            errorHandler,
            workspaceService,
            fileTypeService,
            fsAdapter
        );
    }

    /**
     * ディレクトリをスキャンし、ファイル情報を収集
     */
    async scan(directoryPath: string, options?: ScanOptions): Promise<ScanResult> {
        try {
            const workspaceFolder = await this.validateWorkspace(directoryPath);
            if (!workspaceFolder) {
                throw new BaseError(
                    'Directory is not in workspace',
                    'InvalidDirectoryError',
                    { directoryPath }
                );
            }

            const files = await this.collectFiles(directoryPath, workspaceFolder, options?.excludePatterns);
            const result = await this.processFiles(files, workspaceFolder, {
                batchSize: options?.batchSize,
                maxFileSize: options?.maxFileSize
            });

            this.logger.info('Directory scan completed', {
                source: 'DirectoryScanner.scan',
                details: {
                    directoryPath,
                    fileCount: result.files.length,
                    totalSize: result.totalSize
                }
            });

            return result;
        } catch (error) {
            await this.handleError(error, 'scan', { directoryPath });
            throw error;
        }
    }

    /**
     * ワークスペースの検証
     */
    async validateWorkspace(directoryPath: string): Promise<vscode.WorkspaceFolder | undefined> {
        try {
            return await this.workspaceService.getWorkspaceFolder(directoryPath);
        } catch (error) {
            await this.handleError(error, 'validateWorkspace', { directoryPath });
            throw error;
        }
    }

    /**
     * ファイルの収集
     */
    async collectFiles(
        directoryPath: string, 
        workspaceFolder: vscode.WorkspaceFolder,
        excludePatterns?: string[]
    ): Promise<vscode.Uri[]> {
        try {
            const pattern = new vscode.RelativePattern(directoryPath, '**/*');
            const excludePattern = this.getExcludePattern(excludePatterns);
            
            return vscode.workspace.findFiles(pattern, excludePattern);
        } catch (error) {
            await this.handleError(error, 'collectFiles', { directoryPath, excludePatterns });
            throw error;
        }
    }

    /**
     * 除外パターンの取得
     */
    private getExcludePattern(excludePatterns?: string[]): vscode.GlobPattern {
        const defaultPatterns = this.config.getConfiguration().excludePatterns;
        const patterns = [...defaultPatterns, ...(excludePatterns ?? [])];
        return `{${patterns.join(',')}}`;
    }

    /**
     * ファイルの処理
     */
    private async processFiles(
        files: vscode.Uri[],
        workspaceFolder: vscode.WorkspaceFolder,
        options?: { batchSize?: number; maxFileSize?: number }
    ): Promise<ScanResult> {
        try {
            const config = this.config.getConfiguration();
            const result: ScanResult = { files: [], totalSize: 0 };
            const batchSize = options?.batchSize ?? config.batchSize;
            const maxFileSize = options?.maxFileSize ?? config.maxFileSize;
            
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                const processedFiles = await Promise.all(
                    batch.map(file => this.processFile(file, workspaceFolder, maxFileSize))
                );
                
                const validFiles = processedFiles.filter((file): file is FileInfo => file !== null);
                result.files.push(...validFiles);
                result.totalSize = validFiles.reduce((sum, file) => sum + file.size, result.totalSize);

                this.logger.debug('Processed batch', {
                    source: 'DirectoryScanner.processFiles',
                    details: {
                        batchSize,
                        validFilesCount: validFiles.length,
                        currentTotalSize: result.totalSize
                    }
                });
            }
            
            return result;
        } catch (error) {
            await this.handleError(error, 'processFiles', { filesCount: files.length });
            throw error;
        }
    }

    /**
     * 単一ファイルの処理
     */
    private async processFile(
        file: vscode.Uri,
        workspaceFolder: vscode.WorkspaceFolder,
        maxFileSize?: number
    ): Promise<FileInfo | null> {
        try {
            const stat = await this.fsAdapter.stat(file.fsPath);
            const fileSizeLimit = maxFileSize ?? this.config.getConfiguration().maxFileSize;
            
            if (stat.size > fileSizeLimit) {
                this.logger.warn('File size exceeds limit', {
                    source: 'DirectoryScanner.processFile',
                    details: {
                        file: file.fsPath,
                        size: stat.size,
                        limit: fileSizeLimit
                    }
                });
                return null;
            }

            const content = await this.fsAdapter.readFile(file.fsPath);
            const relativePath = path.relative(workspaceFolder.uri.fsPath, file.fsPath);
            const fileType = this.fileTypeService.getFileType(file.fsPath);

            const fileInfo: FileInfo = {
                path: file.fsPath,
                relativePath,
                size: stat.size,
                content,
                language: fileType.languageId
            };

            this.logger.debug('Processed file', {
                source: 'DirectoryScanner.processFile',
                details: {
                    file: fileInfo.relativePath,
                    size: fileInfo.size,
                    type: fileType.typeName
                }
            });

            return fileInfo;
        } catch (error) {
            this.logger.error('Failed to process file', {
                source: 'DirectoryScanner.processFile',
                details: {
                    file: file.fsPath,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
            return null;
        }
    }

    /**
     * エラー処理の共通化
     */
    private async handleError(error: unknown, operation: string, details: Record<string, unknown>): Promise<void> {
        const context: ErrorContext = {
            source: `DirectoryScanner.${operation}`,
            details,
            timestamp: new Date()
        };

        this.logger.error(`Error in ${operation}`, {
            source: `DirectoryScanner.${operation}`,
            details: {
                ...details,
                error: error instanceof Error ? error.message : String(error)
            }
        });

        await this.errorHandler.handleError(
            error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
            context
        );
    }
} 