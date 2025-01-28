import { ScanResult } from '../types';
import { FileTypeManager } from './FileTypeManager';

export interface FileEntity {
    type: 'file';
    path: string;
    content: string;
}

export interface DirectoryEntity {
    type: 'directory';
    path: string;
    children: (FileEntity | DirectoryEntity)[];
}

export class MarkdownGenerator {
    private fileTypeManager: FileTypeManager;

    constructor() {
        this.fileTypeManager = FileTypeManager.getInstance();
    }

    async generateMarkdown(files: ScanResult[]): Promise<string> {
        let markdown = '# コードベース概要\n\n';

        for (const file of files) {
            markdown += `## ${file.path}\n\n`;
            const fileType = this.fileTypeManager.getFileType(file.path);
            markdown += '```' + fileType.languageId + '\n';
            markdown += file.content + '\n';
            markdown += '```\n\n';
        }

        return markdown;
    }

    generate(entities: (FileEntity | DirectoryEntity)[]): string {
        return entities.map(entity => this.generateEntity(entity, 2)).join('\n\n');
    }

    private generateEntity(entity: FileEntity | DirectoryEntity, level: number): string {
        const header = '#'.repeat(level);
        const name = this.getEntityName(entity.path);

        if (entity.type === 'file') {
            const fileType = this.fileTypeManager.getFileType(entity.path);
            return `${header} 📄 ${name}\n\`\`\`${fileType.languageId}\n${entity.content}\n\`\`\``;
        } else {
            const content = entity.children.length > 0
                ? '\n\n' + entity.children.map(child => this.generateEntity(child, level + 1)).join('\n\n')
                : ' (空のディレクトリ)';
            return `${header} 📁 ${name}${content}`;
        }
    }

    private getEntityName(path: string): string {
        return path.split('/').pop() || path;
    }
}