import { DirectoryInfo } from './types/fileTypes';
import { DirectoryStructureConfig } from './types/configTypes';
import { ConfigService } from './services/configService';

export class DirectoryStructure {
    private config: DirectoryStructureConfig;

    constructor() {
        this.config = ConfigService.getInstance().getConfig().directoryStructure;
    }

    generate(directories: DirectoryInfo[]): string {
        if (!directories.length) {
            return '';
        }

        const lines: string[] = ['# Directory Structure\n'];

        // ディレクトリをアルファベット順にソート
        const sortedDirs = [...directories].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        for (const dir of sortedDirs) {
            lines.push(this.generateDirectoryTree(dir));
        }

        return lines.join('\n');
    }

    private generateDirectoryTree(dir: DirectoryInfo, prefix: string = ''): string {
        const lines: string[] = [];
        const isRoot = !prefix;
        const dirName = isRoot ? dir.relativePath || '.' : dir.relativePath.split('/').pop() || '';

        // ディレクトリ名を追加
        lines.push(`${prefix}${this.config.directoryIcon} ${dirName}`);

        // インデントを計算
        const nextPrefix = `${prefix}${' '.repeat(this.config.indentSize)}`;

        // ファイルを処理（アルファベット順）
        const sortedFiles = [...dir.files]
            .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

        // サブディレクトリを処理（アルファベット順）
        const sortedDirs = Array.from(dir.directories.entries())
            .sort(([a], [b]) => a.localeCompare(b));

        // まずファイルを追加
        for (const file of sortedFiles) {
            const fileName = this.formatFileName(file.relativePath);
            lines.push(`${nextPrefix}${this.config.fileIcon} ${fileName}`);
        }

        // 次にサブディレクトリを追加
        for (const [, subDir] of sortedDirs) {
            lines.push(this.generateDirectoryTree(subDir, nextPrefix));
        }

        return lines.join('\n');
    }

    private formatFileName(relativePath: string): string {
        const fileName = relativePath.split('/').pop() || '';
        if (this.config.showFileExtensions) {
            return fileName;
        }
        const dotIndex = fileName.lastIndexOf('.');
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }
} 