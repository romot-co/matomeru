import * as vscode from 'vscode';
import type { FileSystemEntity } from '@/types';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';

type FormatType = 'tree' | 'icon';

export interface IDirectoryStructureService {
    generateTreeStructure(entities: FileSystemEntity[]): string;
    generateDirectoryStructure(entities: FileSystemEntity[]): string;
}

/**
 * ディレクトリ構造の生成を管理するサービス
 */
export class DirectoryStructureService implements IDirectoryStructureService {
    constructor(
        private readonly errorHandler: IErrorHandler
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でDirectoryStructureServiceインスタンスを生成
     */
    public static createDefault(errorHandler: IErrorHandler): DirectoryStructureService {
        return new DirectoryStructureService(errorHandler);
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
            this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'DirectoryStructureService.generateStructure',
                timestamp: new Date(),
                details: {
                    format,
                    entitiesCount: entities?.length
                }
            });
            return '';
        }
    }

    /**
     * エンティティを指定されたフォーマットで整形します
     */
    private formatEntity(entity: FileSystemEntity, depth: number, format: FormatType): string {
        const indent = '    '.repeat(depth);
        const name = this.getEntityName(entity.path);
        const prefix = format === 'tree' ? (depth > 0 ? '└── ' : '') : '';
        const icon = format === 'icon' ? (entity.type === 'directory' ? '📁 ' : '📄 ') : '';

        let result = `${indent}${prefix}${icon}${name}`;

        if (entity.type === 'directory' && entity.children) {
            const childrenContent = entity.children
                .map(child => this.formatEntity(child, depth + 1, format))
                .join('\n');
            if (childrenContent) {
                result += '\n' + childrenContent;
            }
        }

        return result;
    }

    /**
     * パスからエンティティ名を抽出します
     */
    private getEntityName(path: string): string {
        const parts = path.split('/');
        return parts[parts.length - 1];
    }
} 