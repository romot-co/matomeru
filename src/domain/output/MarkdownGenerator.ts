import * as path from 'path';
import { IFileSystem } from '@/domain/files/FileSystemAdapter';
import { ILogger } from '@/infrastructure/logging/LoggingService';

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
            rootPath
        } = options;

        const markdownParts: string[] = [];

        for (const filePath of files) {
            try {
                const content = await this.fileSystem.readFile(filePath);
                const fileName = path.basename(filePath);
                const relativePath = rootPath
                    ? path.relative(rootPath, filePath)
                    : filePath;
                const language = this.detectLanguage(filePath);

                const header = this.generateHeader(
                    fileName,
                    relativePath,
                    includeFileName,
                    includeRelativePath
                );

                if (header) {
                    markdownParts.push(header);
                }

                const codeBlock = this.generateCodeBlock(content, language, includeLanguage);
                markdownParts.push(codeBlock);
                markdownParts.push(''); // Add empty line for readability
            } catch (error) {
                this.logger.error('Failed to process file', {
                    source: 'MarkdownGenerator.generateMarkdown',
                    details: {
                        filePath,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
                continue;
            }
        }

        return markdownParts.join('\n');
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
} 