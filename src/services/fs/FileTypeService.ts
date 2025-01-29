import * as path from 'path';
import type { FileTypeConfig, FileTypesConfig } from '@/types';
import * as fileTypesConfig from '@/config/file-types.json';

export class FileTypeService {
    private static instance: FileTypeService;
    private textFileExtensions: Set<string>;
    private fileTypes: FileTypesConfig;

    private constructor() {
        this.textFileExtensions = new Set([
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
        this.fileTypes = fileTypesConfig.fileTypes;
    }

    static getInstance(): FileTypeService {
        if (!FileTypeService.instance) {
            FileTypeService.instance = new FileTypeService();
        }
        return FileTypeService.instance;
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