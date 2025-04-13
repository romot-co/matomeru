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
    useGitignore: boolean;    // .gitignoreファイルのパターンを使用するかどうか
    useVscodeignore: boolean; // .vscodeignoreファイルのパターンを使用するかどうか
    prefixText: string;
}

export const defaultConfig: MatomeruConfig = {
    maxFileSize: 1048576,
    excludePatterns: [
        "node_modules/**",
        ".git/**",
        "dist/**",
        "build/**",
        "coverage/**",
        ".DS_Store",
        "Thumbs.db",
        "*.key", "*.pem", "*.crt", "id_rsa", "id_dsa", 
        "*.p12", "*.pfx", "*.jks", "*secret*.*", 
        "*password*.*", "*token*.*", "*.env*", "credential*",
        "config.*secret*.json", "private.*",
        "pnpm-lock.yaml", "yarn.lock", "package-lock.json",
        ".yarn/**", ".pnp.*", ".npm/**", "*.lock",
        "temp/", "tmp/", "*.tmp", ".idea/**", ".vscode/**",
        ".history/**", "*.pyc", "__pycache__/", ".pytest_cache/",
        ".mypy_cache/", ".ruff_cache/", ".next/**", ".nuxt/**",
        ".svelte-kit/**", "out/**", "vendor/**", "Pods/**"
    ],
    chatGptIntegration: false,
    directoryStructure: {
        directoryIcon: "📁",
        fileIcon: "📄",
        indentSize: 2,
        showFileExtensions: true,
        useEmoji: true
    },
    prefixText: "",
    useGitignore: false,
    useVscodeignore: false
}; 