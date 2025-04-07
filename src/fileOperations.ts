import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileInfo, DirectoryInfo, ScanOptions } from './types/fileTypes';
import { minimatch } from 'minimatch';
import { DirectoryNotFoundError, FileSizeLimitError, ScanError } from './errors/errors';
import { Logger } from './utils/logger';
import { extractErrorMessage, logError } from './utils/errorUtils';
import { isBinaryFile } from './utils/fileUtils';

export class FileOperations {
    private readonly logger: Logger;
    private readonly workspaceRoot: string;
    private currentSelectedPath: string | undefined;
    private gitignorePatterns: string[] = [];
    private gitignoreLoaded: boolean = false;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = Logger.getInstance('FileOperations');
    }

    setCurrentSelectedPath(path: string | undefined): void {
        this.currentSelectedPath = path;
    }

    async scanDirectory(targetPath: string, options: ScanOptions): Promise<DirectoryInfo> {
        try {
            // .gitignoreパターンを読み込む（初回のみ）
            if (options.useGitignore && !this.gitignoreLoaded) {
                await this.loadGitignorePatterns();
            }

            const absolutePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(this.workspaceRoot, targetPath);
            const relativePath = path.relative(this.workspaceRoot, absolutePath);

            const stats = await fs.stat(absolutePath);
            this.logger.info(`スキャン対象: ${absolutePath} (${stats.isFile() ? 'ファイル' : 'ディレクトリ'})`);

            // ファイルの場合は、単一のファイルを含むディレクトリ情報として扱う
            if (stats.isFile()) {
                if (stats.size > options.maxFileSize) {
                    throw new FileSizeLimitError(relativePath, stats.size, options.maxFileSize);
                }

                // バイナリファイルのチェック
                const buffer = await fs.readFile(absolutePath);
                if (isBinaryFile(buffer)) {
                    this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                    return {
                        uri: vscode.Uri.file(path.dirname(absolutePath)),
                        relativePath: path.dirname(relativePath),
                        files: [],
                        directories: new Map()
                    };
                }

                const content = buffer.toString('utf-8');
                const fileInfo: FileInfo = {
                    uri: vscode.Uri.file(absolutePath),
                    relativePath,
                    content,
                    language: this.detectLanguage(path.basename(absolutePath)),
                    size: stats.size
                };

                return {
                    uri: vscode.Uri.file(path.dirname(absolutePath)),
                    relativePath: path.dirname(relativePath),
                    files: [fileInfo],
                    directories: new Map()
                };
            }

            // ディレクトリの場合は、通常通り処理
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });
            const files: FileInfo[] = [];
            const directories = new Map<string, DirectoryInfo>();

            for (const entry of entries) {
                const entryPath = path.join(absolutePath, entry.name);
                const entryRelativePath = path.relative(this.workspaceRoot, entryPath);

                // 選択されたディレクトリ自体は除外しない
                if (entryPath !== this.currentSelectedPath && await this.shouldExclude(entryRelativePath, options)) {
                    this.logger.info(vscode.l10n.t('msg.excluded', entryRelativePath));
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const subDirInfo = await this.scanDirectory(entryPath, options);
                        directories.set(entry.name, subDirInfo);
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.stat(entryPath);
                        if (stats.size > options.maxFileSize) {
                            const error = new FileSizeLimitError(entryRelativePath, stats.size, options.maxFileSize);
                            logError(this.logger, error, true);
                            continue;
                        }

                        // バイナリファイルのチェック
                        const buffer = await fs.readFile(entryPath);
                        if (isBinaryFile(buffer)) {
                            this.logger.info(`バイナリファイルをスキップ: ${entryRelativePath}`);
                            continue;
                        }

                        const content = buffer.toString('utf-8');
                        files.push({
                            uri: vscode.Uri.file(entryPath),
                            relativePath: entryRelativePath,
                            content,
                            language: this.detectLanguage(entry.name),
                            size: stats.size
                        });
                    } catch (error) {
                        logError(this.logger, error, true);
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
            if (error instanceof DirectoryNotFoundError || error instanceof FileSizeLimitError) {
                throw error;
            }
            throw new ScanError(extractErrorMessage(error));
        }
    }

    private async shouldExclude(relativePath: string, options: ScanOptions): Promise<boolean> {
        // ルートの選択ディレクトリ自体は除外しない
        const currentSelectedRelativePath = this.currentSelectedPath
            ? path.relative(this.workspaceRoot, this.currentSelectedPath)
            : '';
        if (relativePath === currentSelectedRelativePath) {
            return false;
        }

        // .gitignoreパターンを考慮
        if (options.useGitignore && this.gitignorePatterns.length > 0) {
            for (const pattern of this.gitignorePatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    return true;
                }
            }
        }

        // 設定された除外パターン
        for (const pattern of options.excludePatterns) {
            if (this.matchPattern(relativePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        // パターンが "excluded-dir/**" のようなディレクトリ指定の場合
        if (pattern.endsWith('/**')) {
            const basePattern = pattern.slice(0, -3);
            // もし対象のパスのベースネームがパターンと一致すれば除外
            if (path.basename(filePath) === basePattern) {
                return true;
            }
        } else {
            // その他は minimatch を利用（matchBase:true によりベースネームのみも評価）
            const options = {
                dot: true,
                matchBase: true,
                nocase: process.platform === 'win32'
            };
            if (minimatch(filePath, pattern, options)) {
                return true;
            }
        }
        return false;
    }

    private async loadGitignorePatterns(): Promise<void> {
        try {
            const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
            try {
                const content = await fs.readFile(gitignorePath, 'utf-8');
                this.gitignorePatterns = content
                    .split('\n')
                    .map(line => line.trim())
                    // コメント行や空行を除外
                    .filter(line => line && !line.startsWith('#'))
                    // 否定パターン(!で始まるパターン)は現在サポート外
                    .filter(line => !line.startsWith('!'));
                
                this.logger.info(`${this.gitignorePatterns.length}件の.gitignoreパターンを読み込みました`);
            } catch (error) {
                // .gitignoreファイルが存在しなくてもエラーにはしない
                this.logger.info(`.gitignoreファイルが見つかりません: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            this.gitignoreLoaded = true;
        }
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