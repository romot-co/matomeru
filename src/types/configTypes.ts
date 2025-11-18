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
    enableMinifyIdentifiers: boolean;
    enableStripTypes: boolean;
    useGitignore: boolean;    // .gitignoreファイルのパターンを使用するかどうか
    useVscodeignore: boolean; // .vscodeignoreファイルのパターンを使用するかどうか
    prefixText: string;
    outputFormat: 'markdown' | 'yaml';  // 出力フォーマット
    includeDependencies: boolean;  // 依存関係を含めるかどうか
    mermaid: {
        maxNodes: number;  // Mermaidグラフの最大ノード数
    };
    yaml: {
        includeContent: boolean;  // YAMLにファイル内容を含めるかどうか
    };
    gitDiff: {
        range: string;  // Gitの差分範囲
    };
    diff: {
        mode: 'file' | 'function';
        localContextLines: number;
    };
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
        "*password*.*", "*token*.*", "*.env*", "**/.env*", "credential*",
        "**/secrets/**", "**/*.secret*", "**/credentials/**", "**/api_key*",
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
    enableMinifyIdentifiers: true,
    enableStripTypes: true,
    useGitignore: false,
    useVscodeignore: false,
    outputFormat: 'markdown',
    includeDependencies: false,
    mermaid: {
        maxNodes: 300
    },
    yaml: {
        includeContent: false
    },
    gitDiff: {
        range: ''
    },
    diff: {
        mode: 'function',
        localContextLines: 3
    }
}; 
