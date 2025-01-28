import { FileSystemEntity } from '../../types';
import { ErrorService } from '../error/ErrorService';

type FormatType = 'tree' | 'icon';

/**
 * ディレクトリ構造の生成を管理するサービス
 */
export class DirectoryStructureService {
    private static instance: DirectoryStructureService;
    private errorService: ErrorService;
    
    private constructor() {
        this.errorService = ErrorService.getInstance();
    }
    
    static getInstance(): DirectoryStructureService {
        if (!DirectoryStructureService.instance) {
            DirectoryStructureService.instance = new DirectoryStructureService();
        }
        return DirectoryStructureService.instance;
    }

    /**
     * ツリー形式の構造を生成します
     */
    generateTreeStructure(entities: FileSystemEntity[]): string {
        return this.generateStructure(entities, 'tree');
    }

    /**
     * アイコン形式の構造を生成します
     */
    generateDirectoryStructure(entities: FileSystemEntity[]): string {
        return this.generateStructure(entities, 'icon');
    }

    /**
     * 構造を生成する共通ロジック
     */
    private generateStructure(entities: FileSystemEntity[], format: FormatType): string {
        try {
            if (!Array.isArray(entities)) {
                throw new Error('Invalid entities provided');
            }
            return entities.map(entity => this.formatEntity(entity, 0, format)).join('\n');
        } catch (error) {
            this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'DirectoryStructureService.generateStructure',
                timestamp: new Date(),
                details: { format }
            });
            return '';
        }
    }

    /**
     * エンティティをフォーマットする
     */
    private formatEntity(entity: FileSystemEntity, depth: number, format: FormatType): string {
        const indent = format === 'tree' 
            ? '    '.repeat(depth)
            : '  '.repeat(depth);

        const prefix = format === 'tree'
            ? depth === 0 ? '' : '└── '
            : '';

        const icon = format === 'icon'
            ? entity.type === 'directory' ? '📁 ' : '📄 '
            : '';

        const name = this.getEntityName(entity.path);
        const line = `${indent}${prefix}${icon}${name}`;

        if (entity.type === 'directory' && entity.children) {
            const childrenStr = entity.children
                .map(child => this.formatEntity(child, depth + 1, format))
                .join('\n');
            return entity.children.length > 0 ? `${line}\n${childrenStr}` : `${line}`;
        }

        return line;
    }

    /**
     * エンティティ名を取得
     */
    private getEntityName(path: string): string {
        return path.split('/').pop() || path;
    }
} 