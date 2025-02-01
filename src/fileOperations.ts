import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileInfo, DirectoryInfo, ScanOptions } from './types/fileTypes';
import { minimatch } from 'minimatch';
import { DirectoryNotFoundError, FileSizeLimitError, ScanError } from './errors/errors';
import { Logger } from './utils/logger';

export class FileOperations {
    private readonly logger: Logger;

    constructor(private readonly workspaceRoot: string) {
        this.logger = Logger.getInstance('FileOperations');
    }

    async scanDirectory(targetPath: string, options: ScanOptions): Promise<DirectoryInfo> {
        const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(this.workspaceRoot, targetPath);
        const relativePath = path.relative(this.workspaceRoot, absolutePath);

        try {
            const stats = await fs.stat(absolutePath);
            if (!stats.isDirectory()) {
                throw new DirectoryNotFoundError(targetPath);
            }

            const entries = await fs.readdir(absolutePath, { withFileTypes: true });
            const files: FileInfo[] = [];
            const directories = new Map<string, DirectoryInfo>();

            for (const entry of entries) {
                const entryPath = path.join(absolutePath, entry.name);
                const entryRelativePath = path.relative(this.workspaceRoot, entryPath);

                if (this.shouldExclude(entryRelativePath, options.excludePatterns)) {
                    this.logger.info(`除外: ${entryRelativePath}`);
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const subDirInfo = await this.scanDirectory(entryPath, options);
                        directories.set(entry.name, subDirInfo);
                    } catch (error) {
                        this.logger.warn(`サブディレクトリのスキャンに失敗: ${entryRelativePath} - ${error instanceof Error ? error.message : String(error)}`);
                    }
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.stat(entryPath);
                        if (stats.size > options.maxFileSize) {
                            throw new FileSizeLimitError(entryRelativePath, stats.size, options.maxFileSize);
                        }

                        const content = await fs.readFile(entryPath, 'utf-8');
                        files.push({
                            uri: vscode.Uri.file(entryPath),
                            relativePath: entryRelativePath,
                            content,
                            language: this.detectLanguage(entry.name),
                            size: stats.size
                        });
                    } catch (error) {
                        if (error instanceof FileSizeLimitError) {
                            this.logger.warn(error.message);
                        } else {
                            this.logger.warn(`ファイルの読み込みに失敗: ${entryRelativePath} - ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                }
            }

            return {
                uri: vscode.Uri.file(absolutePath),
                relativePath,
                files,
                directories
            };

        } catch (error) {
            if (error instanceof DirectoryNotFoundError) {
                throw error;
            }
            throw new ScanError(error instanceof Error ? error.message : String(error));
        }
    }

    private shouldExclude(relativePath: string, patterns: string[]): boolean {
        return patterns.some(pattern => {
            // minimatchオプションを設定
            const options = {
                dot: true,  // ドットファイルもマッチング対象に
                matchBase: true,  // ベース名のみのパターンを許可
                nocase: process.platform === 'win32'  // Windowsの場合は大文字小文字を区別しない
            };
            return minimatch(relativePath, pattern, options);
        });
    }

    private detectLanguage(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.java': 'java',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.vue': 'vue',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.c': 'c',
            '.cpp': 'cpp',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.sh': 'shell',
            '.bash': 'shell',
            '.zsh': 'shell',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.sql': 'sql',
            '.graphql': 'graphql',
            '.proto': 'protobuf'
        };

        return languageMap[ext] || 'plaintext';
    }
} 