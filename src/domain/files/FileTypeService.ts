import * as path from 'path';
import type { FileTypesConfig } from '../../types';
import * as fileTypesConfig from '../../config/file-types.json';

export interface IFileTypeService {
    isTextFile(filePath: string): boolean;
    getFileType(filePath: string): { languageId: string; typeName: string };
    isKnownType(filePath: string): boolean;
    getSupportedExtensions(): string[];
    addTextFileExtension(extension: string): void;
    removeTextFileExtension(extension: string): void;
    getTextFileExtensions(): string[];
}

export interface IFileTypeConfig {
    textFileExtensions?: string[];
    fileTypes?: FileTypesConfig;
}

/**
 * ファイルタイプ判定サービス
 * ファイルの種類を判定し、適切な言語IDやタイプ名を提供します
 */
export class FileTypeService implements IFileTypeService {
    private textFileExtensions: Set<string>;
    private fileTypes: FileTypesConfig;

    constructor(config: IFileTypeConfig = {}) {
        this.textFileExtensions = new Set(config.textFileExtensions ?? [
            '.txt', '.md', '.markdown',
            '.js', '.jsx', '.ts', '.tsx',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.json', '.yaml', '.yml',
            '.xml', '.svg',
            '.sh', '.bash', '.zsh',
            '.py', '.rb', '.php',
            '.java', '.kt', '.scala',
            '.c', '.cpp', '.h', '.hpp',
            '.cs', '.fs', '.fsx',
            '.go', '.rs', '.swift',
            '.sql',
            '.gitignore', '.env'
        ]);
        this.fileTypes = config.fileTypes ?? fileTypesConfig.fileTypes;
    }

    /**
     * ファクトリメソッド - デフォルトの設定でFileTypeServiceインスタンスを生成
     */
    public static createDefault(): FileTypeService {
        return new FileTypeService();
    }

    isTextFile(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '') {
            const basename = path.basename(filePath);
            return this.textFileExtensions.has(basename);
        }
        return this.textFileExtensions.has(ext);
    }

    getFileType(filePath: string): { languageId: string; typeName: string } {
        const ext = path.extname(filePath).toLowerCase();
        const fileType = this.fileTypes[ext];
        
        if (!fileType) {
            return {
                languageId: 'plaintext',
                typeName: 'Unknown Type'
            };
        }

        return {
            languageId: fileType.languageId,
            typeName: fileType.typeName
        };
    }

    isKnownType(filePath: string): boolean {
        const ext = path.extname(filePath).toLowerCase();
        return ext in this.fileTypes;
    }

    getSupportedExtensions(): string[] {
        return Object.keys(this.fileTypes);
    }

    addTextFileExtension(extension: string): void {
        if (!extension.startsWith('.')) {
            extension = `.${extension}`;
        }
        this.textFileExtensions.add(extension.toLowerCase());
    }

    removeTextFileExtension(extension: string): void {
        if (!extension.startsWith('.')) {
            extension = `.${extension}`;
        }
        this.textFileExtensions.delete(extension.toLowerCase());
    }

    getTextFileExtensions(): string[] {
        return Array.from(this.textFileExtensions);
    }
} 