export interface DirectoryStructureConfig {
    directoryIcon: string;    // ディレクトリを表すアイコン
    fileIcon: string;         // ファイルを表すアイコン
    indentSize: number;       // インデントのサイズ
    showFileExtensions: boolean;  // ファイル拡張子を表示するかどうか
    useEmoji: boolean;        // 絵文字を使用するかどうか
}

export interface MatomeruConfig {
    maxFileSize: number;
    excludePatterns: string[];
    chatGptIntegration: boolean;
    directoryStructure: DirectoryStructureConfig;
}

export const defaultConfig: MatomeruConfig = {
    maxFileSize: 1048576,
    excludePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**'
    ],
    chatGptIntegration: false,
    directoryStructure: {
        directoryIcon: '📁',
        fileIcon: '📄',
        indentSize: 2,
        showFileExtensions: true,
        useEmoji: true
    }
}; 