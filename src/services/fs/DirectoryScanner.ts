import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationService } from '../../services/config/ConfigurationService';
import { LoggingService } from '../../services/logging/LoggingService';
import { ErrorService } from '../../errors/services/ErrorService';
import { BaseError } from '../../errors/base/BaseError';
import type { ErrorContext } from '../../types';
import { WorkspaceService } from '../../services/workspace/WorkspaceService';
import { FileSystemAdapter } from './FileSystemAdapter';

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

export class DirectoryScanner {
    private readonly config: ConfigurationService;
    private readonly logger: LoggingService;
    private readonly errorService: ErrorService;
    private readonly workspaceService: WorkspaceService;
    private readonly fsAdapter: FileSystemAdapter;

    constructor(
        config?: ConfigurationService,
        logger?: LoggingService,
        errorService?: ErrorService,
        workspaceService?: WorkspaceService,
        fsAdapter?: FileSystemAdapter
    ) {
        this.config = config ?? ConfigurationService.getInstance();
        this.logger = logger ?? LoggingService.getInstance();
        this.errorService = errorService ?? ErrorService.getInstance();
        this.workspaceService = workspaceService ?? WorkspaceService.getInstance();
        this.fsAdapter = fsAdapter ?? new FileSystemAdapter();
    }

    /**
     * ディレクトリをスキャンし、ファイル情報を収集
     */
    async scan(directoryPath: string, options?: { 
        batchSize?: number; 
        maxFileSize?: number;
        excludePatterns?: string[];
    }): Promise<ScanResult> {
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
            const result = await this.processFiles(files, workspaceFolder, options);

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
            const context: ErrorContext = {
                source: 'DirectoryScanner.scan',
                details: { directoryPath },
                timestamp: new Date()
            };

            this.logger.error('Directory scan failed', {
                source: 'DirectoryScanner.scan',
                details: {
                    directoryPath,
                    error: error instanceof Error ? error.message : String(error)
                }
            });

            await this.errorService.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            throw error;
        }
    }

    /**
     * ワークスペースの検証
     */
    private async validateWorkspace(directoryPath: string): Promise<vscode.WorkspaceFolder | undefined> {
        return this.workspaceService.getWorkspaceFolder(directoryPath);
    }

    /**
     * ファイルの収集
     */
    private async collectFiles(
        directoryPath: string, 
        workspaceFolder: vscode.WorkspaceFolder,
        excludePatterns?: string[]
    ): Promise<vscode.Uri[]> {
        const pattern = new vscode.RelativePattern(directoryPath, '**/*');
        const excludePattern = this.getExcludePattern(excludePatterns);
        
        return vscode.workspace.findFiles(pattern, excludePattern);
    }

    /**
     * ファイルの処理
     */
    private async processFiles(
        files: vscode.Uri[],
        workspaceFolder: vscode.WorkspaceFolder,
        options?: { batchSize?: number; maxFileSize?: number }
    ): Promise<ScanResult> {
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
            result.totalSize += validFiles.reduce((sum, file) => sum + file.size, 0);
        }
        
        return result;
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
            const config = this.config.getConfiguration();
            const fileSizeLimit = maxFileSize ?? config.maxFileSize;
            
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

            return {
                path: file.fsPath,
                relativePath,
                size: stat.size,
                content,
                language: this.getFileLanguage(file.fsPath)
            };
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
     * 除外パターンの取得
     */
    private getExcludePattern(excludePatterns?: string[]): vscode.GlobPattern {
        const config = this.config.getConfiguration();
        const patterns = excludePatterns ?? config.excludePatterns;
        return `{${patterns.join(',')}}`;
    }

    /**
     * ファイルの言語IDの取得
     */
    private getFileLanguage(filePath: string): string | undefined {
        const extension = path.extname(filePath).toLowerCase();
        switch (extension) {
            case '.ts':
            case '.tsx':
                return 'typescript';
            case '.js':
            case '.jsx':
                return 'javascript';
            case '.json':
                return 'json';
            case '.md':
                return 'markdown';
            case '.py':
                return 'python';
            case '.java':
                return 'java';
            case '.c':
                return 'c';
            case '.cpp':
                return 'cpp';
            case '.cs':
                return 'csharp';
            case '.go':
                return 'go';
            case '.rs':
                return 'rust';
            case '.rb':
                return 'ruby';
            case '.php':
                return 'php';
            case '.html':
                return 'html';
            case '.css':
                return 'css';
            case '.scss':
                return 'scss';
            case '.less':
                return 'less';
            case '.xml':
                return 'xml';
            case '.yaml':
            case '.yml':
                return 'yaml';
            default:
                return 'plaintext';
        }
    }
} 