import * as path from 'path';
import { IFileSystem } from '../files/FileSystemAdapter';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import { BaseError } from '../../shared/errors/base/BaseError';
import * as vscode from 'vscode';

export interface MarkdownOptions {
    includeFileName?: boolean;
    includeRelativePath?: boolean;
    includeLanguage?: boolean;
    rootPath?: string;
}

export interface IMarkdownGenerator {
    generateMarkdown(files: string[], options?: MarkdownOptions): Promise<string>;
}

export class MarkdownGenerator implements IMarkdownGenerator {
    constructor(
        private readonly fileSystem: IFileSystem,
        private readonly logger: ILogger
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でMarkdownGeneratorインスタンスを生成
     */
    public static createDefault(fileSystem: IFileSystem, logger: ILogger): MarkdownGenerator {
        return new MarkdownGenerator(fileSystem, logger);
    }

    async generateMarkdown(files: string[], options: MarkdownOptions = {}): Promise<string> {
        const {
            includeFileName = true,
            includeRelativePath = true,
            includeLanguage = true,
            rootPath = this.getWorkspaceRoot()
        } = options;

        this.logger.debug('マークダウン生成開始', {
            source: 'MarkdownGenerator.generateMarkdown',
            details: { 
                files,
                options,
                rootPath
            }
        });

        const markdownParts: string[] = [];
        const processedFiles: string[] = [];

        // ファイル内容の処理
        for (const filePath of files) {
            try {
                // パスの解決
                const absolutePath = path.isAbsolute(filePath)
                    ? filePath
                    : path.resolve(rootPath, filePath);

                // テストケースとの互換性のために、表示用のパスを調整
                const displayPath = options.rootPath 
                    ? path.relative(rootPath, absolutePath)  // rootPathが指定されている場合は相対パス
                    : absolutePath;  // 指定がない場合は絶対パス
                
                const fileName = path.basename(filePath);

                this.logger.debug('ファイル処理開始', {
                    source: 'MarkdownGenerator.generateMarkdown',
                    details: {
                        filePath,
                        absolutePath,
                        displayPath,
                        fileName
                    }
                });

                // ファイルの内容を読み込む
                const content = await this.fileSystem.readFile(absolutePath);
                const language = this.detectLanguage(filePath);

                // 処理成功したファイルを記録
                processedFiles.push(filePath);

                // ヘッダーの生成
                const header = this.generateHeader(
                    fileName,
                    displayPath,
                    includeFileName,
                    includeRelativePath
                );

                if (header) {
                    markdownParts.push(header);
                }

                // コードブロックの生成
                const codeBlock = this.generateCodeBlock(content, language, includeLanguage);
                markdownParts.push(codeBlock);
                markdownParts.push(''); // 可読性のための空行
            } catch (error) {
                this.logger.error('ファイル処理に失敗しました', {
                    source: 'MarkdownGenerator.generateMarkdown',
                    details: {
                        filePath,
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    }
                });
                // エラーが発生しても処理を継続
                continue;
            }
        }

        // 処理に成功したファイルが1つ以上ある場合のみディレクトリ構造を追加
        if (processedFiles.length > 0) {
            try {
                // ファイルパスから最も上位のディレクトリを特定
                const targetDirs = new Set<string>();
                for (const filePath of processedFiles) {
                    const absolutePath = path.isAbsolute(filePath)
                        ? filePath
                        : path.resolve(rootPath, filePath);
                    const relativePath = path.relative(rootPath, absolutePath);
                    const dirPath = path.dirname(relativePath);
                    if (dirPath !== '.') {
                        const parts = dirPath.split(path.sep);
                        let currentPath = '';
                        for (const part of parts) {
                            currentPath = currentPath ? path.join(currentPath, part) : part;
                            targetDirs.add(currentPath);
                        }
                    }
                }

                if (targetDirs.size > 0) {
                    const structure = await this.generateDirectoryStructure(rootPath, Array.from(targetDirs));
                    // 既存の内容を一時保存
                    const existingContent = markdownParts.slice();
                    // マークダウンパーツをクリア
                    markdownParts.length = 0;
                    // ディレクトリ構造を先頭に追加
                    markdownParts.push('# Directory Structure\n');
                    markdownParts.push('```');
                    markdownParts.push(structure);
                    markdownParts.push('```\n');
                    markdownParts.push('# Files\n');
                    // 既存の内容を追加
                    markdownParts.push(...existingContent);
                }
            } catch (error) {
                this.logger.error('ディレクトリ構造の生成に失敗しました', {
                    source: 'MarkdownGenerator.generateMarkdown',
                    details: {
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined
                    }
                });
                // ディレクトリ構造の生成に失敗しても、ファイル内容の処理は維持
            }
        }

        const result = markdownParts.join('\n');
        this.logger.debug('マークダウン生成完了', {
            source: 'MarkdownGenerator.generateMarkdown',
            details: {
                filesCount: files.length,
                processedFilesCount: processedFiles.length,
                resultLength: result.length
            }
        });

        return result;
    }

    private generateHeader(
        fileName: string,
        relativePath: string,
        includeFileName: boolean,
        includeRelativePath: boolean
    ): string {
        const parts: string[] = [];

        if (includeFileName) {
            parts.push(`File: ${fileName}`);
        }

        if (includeRelativePath) {
            parts.push(`Path: ${relativePath}`);
        }

        if (parts.length === 0) {
            return '';
        }

        return `${parts.join(' | ')}\n`;
    }

    private generateCodeBlock(content: string, language: string, includeLanguage: boolean): string {
        const lang = includeLanguage ? language : '';
        return '```' + lang + '\n' + content + '\n```';
    }

    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.rb': 'ruby',
            '.php': 'php',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.sql': 'sql',
            '.sh': 'shell',
            '.bash': 'bash',
            '.zsh': 'shell',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.txt': 'text'
        };

        return languageMap[ext] || '';
    }

    private getWorkspaceRoot(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new BaseError(
                'ワークスペースが開かれていません',
                'WorkspaceError',
                { code: 'NO_WORKSPACE' }
            );
        }
        return workspaceFolders[0].uri.fsPath;
    }

    private async generateDirectoryStructure(rootPath: string, targetDirs: string[]): Promise<string> {
        const structure: string[] = [];
        const rootName = path.basename(rootPath);
        structure.push(`📁 ${rootName}`);
        await this.buildDirectoryTree(rootPath, '   ', structure, new Set(targetDirs));
        return structure.join('\n');
    }

    private async buildDirectoryTree(
        currentPath: string,
        indent: string,
        result: string[],
        targetDirs: Set<string>
    ): Promise<void> {
        try {
            const entries = await this.fileSystem.readDirectory(currentPath);
            const sortedEntries = entries.sort((a, b) => {
                // ディレクトリを先に、その後でファイルをアルファベット順に
                if (a.type === b.type) {
                    return a.name.localeCompare(b.name);
                }
                return a.type === vscode.FileType.Directory ? -1 : 1;
            });

            const workspaceRoot = this.getWorkspaceRoot();
            for (const entry of sortedEntries) {
                const fullPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(workspaceRoot, fullPath);
                const isDirectory = entry.type === vscode.FileType.Directory;

                // ターゲットディレクトリに含まれるか、その親ディレクトリの場合のみ表示
                if (isDirectory) {
                    const shouldInclude = this.shouldIncludeDirectory(relativePath, targetDirs);
                    if (shouldInclude) {
                        const prefix = indent + '📁 ';
                        result.push(prefix + entry.name);

                        await this.buildDirectoryTree(
                            fullPath,
                            indent + '   ',
                            result,
                            targetDirs
                        );
                    }
                } else {
                    const shouldInclude = this.shouldIncludeFile(relativePath, targetDirs);
                    if (shouldInclude) {
                        const prefix = indent + '📄 ';
                        result.push(prefix + entry.name);
                    }
                }
            }
        } catch (error) {
            this.logger.error('ディレクトリツリーの生成に失敗しました', {
                source: 'MarkdownGenerator.buildDirectoryTree',
                details: {
                    path: currentPath,
                    error: error instanceof Error ? error.message : String(error)
                }
            });
            throw error;
        }
    }

    private shouldIncludeDirectory(dirPath: string, targetDirs: Set<string>): boolean {
        // ルートディレクトリは常に含める
        if (dirPath === '') {
            return true;
        }
        
        if (targetDirs.has(dirPath)) {
            return true;
        }
        
        // ターゲットディレクトリの親ディレクトリかどうかをチェック
        for (const targetDir of targetDirs) {
            if (targetDir.startsWith(dirPath + path.sep) || targetDir === dirPath) {
                return true;
            }
        }
        return false;
    }

    private shouldIncludeFile(filePath: string, targetDirs: Set<string>): boolean {
        const dirPath = path.dirname(filePath);
        return dirPath === '.' || targetDirs.has(dirPath);
    }
} 