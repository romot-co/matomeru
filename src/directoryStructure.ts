import { DirectoryInfo } from './types/fileTypes';
import { DirectoryStructureConfig } from './types/configTypes';
import { ConfigService } from './services/configService';

export class DirectoryStructure {
    private config: DirectoryStructureConfig;

    constructor() {
        this.config = ConfigService.getInstance().getConfig().directoryStructure;
    }

    private mergeDirectoryInfos(dirs: DirectoryInfo[]): DirectoryInfo {
        // 統合結果の初期ルート
        const root: DirectoryInfo = {
            uri: dirs[0].uri,
            relativePath: '.',
            files: [],
            directories: new Map<string, DirectoryInfo>()
        };

        for (const dir of dirs) {
            // もし dir.relativePath が空または '.' ならファイルを root に追加
            if (!dir.relativePath || dir.relativePath === '.') {
                root.files.push(...dir.files);
                // ルート直下のサブディレクトリもマージ
                for (const [name, subDir] of dir.directories) {
                    if (root.directories.has(name)) {
                        root.directories.set(name, this.mergeTwoDirectoryInfos(root.directories.get(name)!, subDir));
                    } else {
                        root.directories.set(name, subDir);
                    }
                }
            } else {
                // dir.relativePath をパス分割
                const parts = dir.relativePath.split('/');
                let current = root;
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!current.directories.has(part)) {
                        // 存在しなければ新規作成
                        current.directories.set(part, {
                            uri: dir.uri,
                            relativePath: parts.slice(0, i + 1).join('/'),
                            files: [],
                            directories: new Map()
                        });
                    }
                    current = current.directories.get(part)!;
                }
                // 最終ディレクトリにファイルとサブディレクトリをマージ
                current.files.push(...dir.files);
                for (const [name, subDir] of dir.directories) {
                    if (current.directories.has(name)) {
                        current.directories.set(name, this.mergeTwoDirectoryInfos(current.directories.get(name)!, subDir));
                    } else {
                        current.directories.set(name, subDir);
                    }
                }
            }
        }
        return root;
    }

    private mergeTwoDirectoryInfos(dir1: DirectoryInfo, dir2: DirectoryInfo): DirectoryInfo {
        const merged: DirectoryInfo = {
            uri: dir1.uri,
            relativePath: dir1.relativePath,
            files: [...dir1.files],
            directories: new Map(dir1.directories)
        };

        // ファイルは重複しなければ単純に結合
        for (const file of dir2.files) {
            if (!merged.files.find(f => f.relativePath === file.relativePath)) {
                merged.files.push(file);
            }
        }

        // サブディレクトリを再帰的にマージ
        for (const [name, subDir] of dir2.directories) {
            if (merged.directories.has(name)) {
                merged.directories.set(name, this.mergeTwoDirectoryInfos(merged.directories.get(name)!, subDir));
            } else {
                merged.directories.set(name, subDir);
            }
        }
        return merged;
    }

    generate(directories: DirectoryInfo[]): string {
        if (!directories.length) {
            return '';
        }

        // すべての DirectoryInfo を統合
        const mergedRoot = this.mergeDirectoryInfos(directories);

        const lines: string[] = ['# Directory Structure\n'];
        lines.push(this.generateDirectoryTree(mergedRoot));

        return lines.join('\n');
    }

    private generateDirectoryTree(dir: DirectoryInfo, prefix: string = ''): string {
        const lines: string[] = [];
        const isRoot = !prefix;
        const dirName = isRoot ? '.' : dir.relativePath.split('/').pop() || '';

        // ディレクトリ名を追加（アイコンを含む）
        const icon = this.config.useEmoji ? this.config.directoryIcon : '';
        lines.push(`${prefix}${icon} ${dirName}`);

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
            const fileName = this.formatFileName(file.relativePath.split('/').pop() || '');
            const fileIcon = this.config.useEmoji ? this.config.fileIcon : '';
            lines.push(`${nextPrefix}${fileIcon} ${fileName}`);
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