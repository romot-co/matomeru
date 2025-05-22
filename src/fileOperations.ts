import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileInfo, DirectoryInfo, ScanOptions } from './types/fileTypes';
import { minimatch } from 'minimatch';
import { DirectoryNotFoundError, FileSizeLimitError, ScanError } from './errors/errors';
import { Logger } from './utils/logger';
import { extractErrorMessage, logError } from './utils/errorUtils';
import { isBinaryFile } from './utils/fileUtils';
import { scanDependencies } from './parsers/dependencyScanner';

export class FileOperations {
    private readonly logger: Logger;
    private readonly workspaceRoot: string;
    private currentSelectedPath: string | undefined;
    private gitignorePatterns: string[] = [];
    private gitignoreNegatedPatterns: string[] = [];
    private gitignoreLoaded: boolean = false;
    private gitignoreWatcher: vscode.FileSystemWatcher | undefined;
    private vscodeignorePatterns: string[] = [];
    private vscodeignoreNegatedPatterns: string[] = [];
    private vscodeignoreLoaded: boolean = false;
    private vscodeignoreWatcher: vscode.FileSystemWatcher | undefined;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = Logger.getInstance('FileOperations');
        // .gitignoreファイルの変更を監視するwatcherを作成
        this.setupGitignoreWatcher();
        // .vscodeignoreファイルの変更を監視するwatcherを作成
        this.setupVscodeignoreWatcher();
    }

    /**
     * .gitignoreファイルの変更を監視するwatcherをセットアップ
     */
    private setupGitignoreWatcher(): void {
        try {
            // .gitignoreファイルを監視するFileSystemWatcherを作成
            const gitignorePath = new vscode.RelativePattern(this.workspaceRoot, '.gitignore');
            this.gitignoreWatcher = vscode.workspace.createFileSystemWatcher(gitignorePath);

            // 変更イベントに対応するリスナーを追加
            this.gitignoreWatcher.onDidChange(() => {
                this.resetGitignoreState();
                this.logger.info('.gitignoreファイルが変更されました。パターンは次回のスキャン時に再読み込みされます。');
            });

            // 作成イベントに対応するリスナーを追加
            this.gitignoreWatcher.onDidCreate(() => {
                this.resetGitignoreState();
                this.logger.info('.gitignoreファイルが作成されました。パターンは次回のスキャン時に読み込まれます。');
            });

            // 削除イベントに対応するリスナーを追加
            this.gitignoreWatcher.onDidDelete(() => {
                this.resetGitignoreState();
                this.logger.info('.gitignoreファイルが削除されました。以前のパターンは無効になります。');
            });
        } catch (error) {
            this.logger.error(`.gitignoreのウォッチャー設定中にエラーが発生しました: ${extractErrorMessage(error)}`);
        }
    }

    /**
     * gitignoreの状態をリセットし、次回スキャン時に再読み込みさせる
     */
    private resetGitignoreState(): void {
        this.gitignoreLoaded = false;
        this.gitignorePatterns = [];
        this.gitignoreNegatedPatterns = [];
    }

    /**
     * .vscodeignoreファイルの変更を監視するwatcherをセットアップ
     */
    private setupVscodeignoreWatcher(): void {
        try {
            // .vscodeignoreファイルを監視するFileSystemWatcherを作成
            const vscodeignorePath = new vscode.RelativePattern(this.workspaceRoot, '.vscodeignore');
            this.vscodeignoreWatcher = vscode.workspace.createFileSystemWatcher(vscodeignorePath);

            // 変更イベントに対応するリスナーを追加
            this.vscodeignoreWatcher.onDidChange(() => {
                this.resetVscodeignoreState();
                this.logger.info('.vscodeignoreファイルが変更されました。パターンは次回のスキャン時に再読み込みされます。');
            });

            // 作成イベントに対応するリスナーを追加
            this.vscodeignoreWatcher.onDidCreate(() => {
                this.resetVscodeignoreState();
                this.logger.info('.vscodeignoreファイルが作成されました。パターンは次回のスキャン時に読み込まれます。');
            });

            // 削除イベントに対応するリスナーを追加
            this.vscodeignoreWatcher.onDidDelete(() => {
                this.resetVscodeignoreState();
                this.logger.info('.vscodeignoreファイルが削除されました。以前のパターンは無効になります。');
            });
        } catch (error) {
            this.logger.error(`.vscodeignoreのウォッチャー設定中にエラーが発生しました: ${extractErrorMessage(error)}`);
        }
    }

    /**
     * vscodeignoreの状態をリセットし、次回スキャン時に再読み込みさせる
     */
    private resetVscodeignoreState(): void {
        this.vscodeignoreLoaded = false;
        this.vscodeignorePatterns = [];
        this.vscodeignoreNegatedPatterns = [];
    }

    /**
     * FileOperationsインスタンスのリソースを解放する
     */
    dispose(): void {
        if (this.gitignoreWatcher) {
            this.gitignoreWatcher.dispose();
            this.gitignoreWatcher = undefined;
        }
        if (this.vscodeignoreWatcher) {
            this.vscodeignoreWatcher.dispose();
            this.vscodeignoreWatcher = undefined;
        }
    }

    setCurrentSelectedPath(path: string | undefined): void {
        this.currentSelectedPath = path;
    }

    async scanDirectory(targetPath: string, options: ScanOptions): Promise<DirectoryInfo> {
        try {
            // .gitignoreパターンを読み込む（初回のみ）
            if (options.useGitignore && !this.gitignoreLoaded) {
                await this.loadGitignorePatterns();
            }

            // .vscodeignoreパターンを読み込む（初回のみ）
            if (options.useVscodeignore && !this.vscodeignoreLoaded) {
                await this.loadVscodeignorePatterns();
            }

            const absolutePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(this.workspaceRoot, targetPath);
            const relativePath = path.relative(this.workspaceRoot, absolutePath);

            const stats = await fs.stat(absolutePath);
            this.logger.info(`スキャン対象: ${absolutePath} (${stats.isFile() ? 'ファイル' : 'ディレクトリ'})`);

            // ファイルの場合は、単一のファイルを含むディレクトリ情報として扱う
            if (stats.isFile()) {
                if (stats.size > options.maxFileSize) {
                    throw new FileSizeLimitError(relativePath, stats.size, options.maxFileSize);
                }

                // バイナリファイルのチェック
                const buffer = await fs.readFile(absolutePath);
                if (isBinaryFile(buffer)) {
                    this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                    return {
                        uri: vscode.Uri.file(path.dirname(absolutePath)),
                        relativePath: path.dirname(relativePath),
                        files: [],
                        directories: new Map()
                    };
                }

                const content = buffer.toString('utf-8');
                const language = this.detectLanguage(path.basename(absolutePath));
                let imports: string[] | undefined;
                if (options.includeDependencies) {
                    try {
                        imports = await scanDependencies(absolutePath, content, language);
                    } catch (scanError) {
                        this.logger.error(`Failed to scan dependencies for ${relativePath}: ${extractErrorMessage(scanError)}`);
                        imports = []; // エラー時は空配列として処理を継続
                    }
                }

                const fileInfo: FileInfo = {
                    uri: vscode.Uri.file(absolutePath),
                    relativePath,
                    content,
                    language,
                    size: stats.size,
                    imports
                };

                return {
                    uri: vscode.Uri.file(path.dirname(absolutePath)),
                    relativePath: path.dirname(relativePath),
                    files: [fileInfo],
                    directories: new Map()
                };
            }

            // ディレクトリの場合は、通常通り処理
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });
            const files: FileInfo[] = [];
            const directories = new Map<string, DirectoryInfo>();

            for (const entry of entries) {
                const entryNameString = entry.name.toString();
                const entryPath = path.join(absolutePath, entryNameString);
                const entryRelativePath = path.relative(this.workspaceRoot, entryPath);

                // 選択されたディレクトリ自体は除外しないが、それ以外は除外判定を行う
                const shouldBeExcluded = entryPath !== this.currentSelectedPath && await this.shouldExclude(entryRelativePath, options);
                
                if (shouldBeExcluded) {
                    this.logger.info(`除外: ${entryRelativePath}`);
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const subDirInfo = await this.scanDirectory(entryPath, options);
                        directories.set(entryNameString, subDirInfo);
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.stat(entryPath);
                        if (stats.size > options.maxFileSize) {
                            const error = new FileSizeLimitError(entryRelativePath, stats.size, options.maxFileSize);
                            logError(this.logger, error, true);
                            continue;
                        }

                        // バイナリファイルのチェック
                        const buffer = await fs.readFile(entryPath);
                        if (isBinaryFile(buffer)) {
                            this.logger.info(`バイナリファイルをスキップ: ${entryRelativePath}`);
                            continue;
                        }

                        const content = buffer.toString('utf-8');
                        const language = this.detectLanguage(entryNameString);
                        let imports: string[] | undefined;
                        if (options.includeDependencies) {
                            try {
                                imports = await scanDependencies(entryPath, content, language);
                            } catch (scanError) {
                                this.logger.error(`Failed to scan dependencies for ${entryRelativePath}: ${extractErrorMessage(scanError)}`);
                                imports = []; // エラー時は空配列として処理を継続
                            }
                        }
                        files.push({
                            uri: vscode.Uri.file(entryPath),
                            relativePath: entryRelativePath,
                            content,
                            language,
                            size: stats.size,
                            imports
                        });
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                }
            }

            return {
                uri: vscode.Uri.file(absolutePath),
                relativePath,
                files,
                directories
            };

        } catch (error) {
            if (error instanceof DirectoryNotFoundError || error instanceof FileSizeLimitError) {
                throw error;
            }
            throw new ScanError(extractErrorMessage(error));
        }
    }

    private async shouldExclude(relativePath: string, options: ScanOptions): Promise<boolean> {
        // ルートの選択ディレクトリ自体は除外しない
        const currentSelectedRelativePath = this.currentSelectedPath
            ? path.relative(this.workspaceRoot, this.currentSelectedPath)
            : '';
        // パスを POSIX 形式に正規化
        const posixRelativePath = relativePath.replace(/\\/g, '/');

        if (posixRelativePath === currentSelectedRelativePath.replace(/\\/g, '/')) {
            return false;
        }

        // 否定パターンのチェック - .gitignore
        if (options.useGitignore && this.gitignoreNegatedPatterns.length > 0) {
            for (const pattern of this.gitignoreNegatedPatterns) {
                if (this.matchPattern(posixRelativePath, pattern)) {
                    // 否定パターンにマッチした場合は強制的に除外しない
                    this.logger.info(`否定パターン一致(gitignore): ${posixRelativePath} -> !${pattern}`);
                    return false;
                }
            }
        }

        // 否定パターンのチェック - .vscodeignore
        if (options.useVscodeignore && this.vscodeignoreNegatedPatterns.length > 0) {
            for (const pattern of this.vscodeignoreNegatedPatterns) {
                if (this.matchPattern(posixRelativePath, pattern)) {
                    // 否定パターンにマッチした場合は強制的に除外しない
                    this.logger.info(`否定パターン一致(vscodeignore): ${posixRelativePath} -> !${pattern}`);
                    return false;
                }
            }
        }

        // 通常パターンのチェック - .gitignore
        if (options.useGitignore && this.gitignorePatterns.length > 0) {
            for (const pattern of this.gitignorePatterns) {
                if (this.matchPattern(posixRelativePath, pattern)) {
                    this.logger.info(`通常パターン一致(gitignore): ${posixRelativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        // 通常パターンのチェック - .vscodeignore
        if (options.useVscodeignore && this.vscodeignorePatterns.length > 0) {
            for (const pattern of this.vscodeignorePatterns) {
                if (this.matchPattern(posixRelativePath, pattern)) {
                    this.logger.info(`通常パターン一致(vscodeignore): ${posixRelativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        // 設定された除外パターンを考慮
        if (options.excludePatterns.length > 0) {
            for (const pattern of options.excludePatterns) {
                // excludePatterns も POSIX 形式を期待する
                if (this.matchPattern(posixRelativePath, pattern.replace(/\\/g, '/'))) {
                    this.logger.info(`除外パターン一致: ${posixRelativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        // minimatch に渡す前にパターンも POSIX 形式に正規化 (特に Windows で dir\** のようなパターンが渡された場合)
        const posixPattern = pattern.replace(/\\/g, '/');
        // filePath は既に POSIX 形式になっている想定

        // パターンが "excluded-dir/**" のようなディレクトリ指定の場合、末尾のスラッシュも考慮
        // .gitignore の仕様に合わせ、ディレクトリ指定は末尾に / をつけることが多い
        if (posixPattern.endsWith('/')) {
            const dirPattern = posixPattern.slice(0, -1); // 末尾のスラッシュを除去
            // ディレクトリ自体、またはその配下のパスにマッチするかどうか
            if (filePath === dirPattern || filePath.startsWith(dirPattern + '/')) {
                 return true;
            }
        } else if (posixPattern.endsWith('/**')) {
            // "/**" パターンは minimatch がうまく扱えない場合があるため、別途処理するケースを考慮
            // 例: "abc/**" は "abc/" または "abc/def" などにマッチ
            const basePattern = posixPattern.slice(0, -3);
            if (filePath === basePattern || filePath.startsWith(basePattern + '/')) {
                 return true;
            }
            // Note: minimatch での再現も試みる
        }
        
        // minimatch を利用（matchBaseは意図しないマッチを防ぐためfalseに）
        const options = {
            dot: true,       // ドットファイルにマッチさせる
            nocase: true,    // 大文字小文字を区別しない (Windows との互換性のため)
            matchBase: false // パス全体でマッチさせる (Git の挙動に近づける)
        };
        
        // minimatch は POSIX スタイルのパスを期待する
        if (minimatch(filePath, posixPattern, options)) {
            return true;
        }
        
        return false;
    }

    private async loadGitignorePatterns(): Promise<void> {
        try {
            const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
            try {
                const content = await fs.readFile(gitignorePath, 'utf-8');
                const lines = content
                    .split('\n')
                    .map(line => line.trim())
                    // コメント行や空行を除外
                    .filter(line => line && !line.startsWith('#'));
                
                // 通常パターンと否定パターンに分ける
                this.gitignorePatterns = lines.filter(line => !line.startsWith('!'));
                this.gitignoreNegatedPatterns = lines
                    .filter(line => line.startsWith('!'))
                    .map(line => line.substring(1)); // 先頭の「!」を除去
                
                this.logger.info(`${this.gitignorePatterns.length}件の.gitignoreパターンと${this.gitignoreNegatedPatterns.length}件の否定パターンを読み込みました`);
            } catch (error) {
                // .gitignoreファイルが存在しなくてもエラーにはしない
                this.logger.info(`.gitignoreファイルが見つかりません: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            this.gitignoreLoaded = true;
        }
    }

    private async loadVscodeignorePatterns(): Promise<void> {
        try {
            const vscodeignorePath = path.join(this.workspaceRoot, '.vscodeignore');
            try {
                const content = await fs.readFile(vscodeignorePath, 'utf-8');
                const lines = content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                // 通常パターンと否定パターンに分ける
                this.vscodeignorePatterns = lines.filter(line => !line.startsWith('!'));
                this.vscodeignoreNegatedPatterns = lines
                    .filter(line => line.startsWith('!'))
                    .map(line => line.substring(1)); // 先頭の「!」を除去
                
                this.vscodeignoreLoaded = true;
                this.logger.info(`.vscodeignoreから${this.vscodeignorePatterns.length}個のパターンと${this.vscodeignoreNegatedPatterns.length}個の否定パターンを読み込みました`);
            } catch (error) {
                // ファイルが存在しない場合は空の配列を設定
                this.vscodeignorePatterns = [];
                this.vscodeignoreNegatedPatterns = [];
                this.vscodeignoreLoaded = true;
                this.logger.info('.vscodeignoreファイルが見つかりませんでした');
            }
        } catch (error) {
            this.logger.error(`.vscodeignoreの読み込み中にエラーが発生しました: ${extractErrorMessage(error)}`);
            // エラーが発生した場合でも、次回の処理で再試行できるようにフラグをリセットしない
            this.vscodeignorePatterns = [];
            this.vscodeignoreNegatedPatterns = [];
            this.vscodeignoreLoaded = true;
        }
    }

    private detectLanguage(fileName: string): string {
        // まず特定のファイル名で判定
        const baseName = path.basename(fileName);
        if (baseName === 'Dockerfile') {
            return 'dockerfile';
        }
        if (baseName === 'Makefile') {
            return 'makefile';
        }
        
        // 次に拡張子で判定
        const ext = path.extname(fileName).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.json': 'json',
            '.md': 'markdown',
            '.py': 'python',
            '.java': 'java',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.vue': 'vue',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.c': 'c',
            '.cpp': 'cpp',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.sh': 'shell',
            '.bash': 'shell',
            '.zsh': 'shell',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.xml': 'xml',
            '.sql': 'sql',
            '.graphql': 'graphql',
            '.proto': 'protobuf',
            '.env': 'dotenv',
            '.lua': 'lua',
            '.pl': 'perl',
            '.r': 'r',
            '.dart': 'dart'
        };

        return languageMap[ext] || 'plaintext';
    }

    /**
     * ディレクトリ内のファイルサイズを見積もる（ファイル内容は読み込まない）
     * @param targetPath 対象のパス
     * @param options スキャンオプション
     * @returns {Promise<{ totalFiles: number, totalSize: number }>} ファイル数とサイズの合計
     */
    async estimateDirectorySize(targetPath: string, options: ScanOptions): Promise<{ totalFiles: number, totalSize: number }> {
        try {
            // .gitignoreパターンを読み込む（初回のみ）
            if (options.useGitignore && !this.gitignoreLoaded) {
                await this.loadGitignorePatterns();
            }

            // .vscodeignoreパターンを読み込む（初回のみ）
            if (options.useVscodeignore && !this.vscodeignoreLoaded) {
                await this.loadVscodeignorePatterns();
            }

            const absolutePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(this.workspaceRoot, targetPath);
            const relativePath = path.relative(this.workspaceRoot, absolutePath);

            const stats = await fs.stat(absolutePath);
            this.logger.info(`見積り対象: ${absolutePath} (${stats.isFile() ? 'ファイル' : 'ディレクトリ'})`);

            let totalFiles = 0;
            let totalSize = 0;

            // ファイルの場合は、サイズをチェックして直接カウント
            if (stats.isFile()) {
                // 対象のパスが除外されるかチェック
                if (await this.shouldExclude(relativePath, options)) {
                    return { totalFiles: 0, totalSize: 0 };
                }

                // サイズ制限のチェック
                if (stats.size > options.maxFileSize) {
                    this.logger.info(`サイズ制限超過のためスキップ: ${relativePath} (${stats.size} > ${options.maxFileSize})`);
                    return { totalFiles: 0, totalSize: 0 };
                }

                // バイナリファイルのチェック
                // Note: 実際の内容は読み込まないため、ここではファイル拡張子からバイナリかどうかを推測
                if (this.isProbablyBinaryByExtension(relativePath)) {
                    this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                    return { totalFiles: 0, totalSize: 0 };
                }

                return { totalFiles: 1, totalSize: stats.size };
            }

            // ディレクトリの場合は、中身を再帰的に処理
            const entries = await fs.readdir(absolutePath, { withFileTypes: true });

            for (const entry of entries) {
                const entryPath = path.join(absolutePath, entry.name);
                const entryRelativePath = path.relative(this.workspaceRoot, entryPath);

                // 選択されたディレクトリ自体は除外しない
                if (entryPath !== this.currentSelectedPath && await this.shouldExclude(entryRelativePath, options)) {
                    this.logger.info(`除外: ${entryRelativePath}`);
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const { totalFiles: subDirFiles, totalSize: subDirSize } = 
                            await this.estimateDirectorySize(entryPath, options);
                        totalFiles += subDirFiles;
                        totalSize += subDirSize;
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                } else if (entry.isFile()) {
                    try {
                        const stats = await fs.stat(entryPath);
                        if (stats.size > options.maxFileSize) {
                            this.logger.info(`サイズ制限超過のためスキップ: ${entryRelativePath} (${stats.size} > ${options.maxFileSize})`);
                            continue;
                        }

                        // バイナリファイルのチェック（ファイル拡張子からの推測）
                        if (this.isProbablyBinaryByExtension(entryRelativePath)) {
                            this.logger.info(`バイナリファイルをスキップ: ${entryRelativePath}`);
                            continue;
                        }

                        totalFiles++;
                        totalSize += stats.size;
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                }
            }

            return { totalFiles, totalSize };
        } catch (error) {
            if (error instanceof DirectoryNotFoundError || error instanceof FileSizeLimitError) {
                throw error;
            }
            throw new ScanError(extractErrorMessage(error));
        }
    }

    /**
     * ファイル拡張子に基づいてバイナリファイルの可能性を判定
     * @param filePath ファイルパス
     * @returns バイナリファイルの可能性があればtrue
     */
    private isProbablyBinaryByExtension(filePath: string): boolean {
        const binaryExtensions = [
            // 画像ファイル
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.heic',
            // 音声・動画ファイル
            '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.flv', '.webm',
            // 圧縮ファイル
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
            // ドキュメント
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            // その他
            '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.o', '.a', '.lib',
            '.bin', '.dat', '.db', '.sqlite', '.sqlite3', '.wasm'
        ];

        const ext = path.extname(filePath).toLowerCase();
        return binaryExtensions.includes(ext);
    }

    /**
     * 指定されたファイルのリストを処理する
     * @param fileUris 処理対象のファイルURIリスト
     * @param options スキャンオプション
     * @returns {Promise<DirectoryInfo[]>} ディレクトリ情報の配列
     */
    async processFileList(fileUris: vscode.Uri[], options: ScanOptions): Promise<DirectoryInfo[]> {
        const results: DirectoryInfo[] = [];
        const rootScanPath = this.currentSelectedPath || this.workspaceRoot;

        // .gitignoreパターンを読み込む（初回のみ）
        if (options.useGitignore && !this.gitignoreLoaded) {
            await this.loadGitignorePatterns();
        }
        // .vscodeignoreパターンを読み込む（初回のみ）
        if (options.useVscodeignore && !this.vscodeignoreLoaded) {
            await this.loadVscodeignorePatterns();
        }

        for (const uri of fileUris) {
            const absolutePath = uri.fsPath;
            const relativePath = path.relative(this.workspaceRoot, absolutePath);

            if (await this.shouldExclude(relativePath, options)) {
                this.logger.info(`ファイルリストから除外: ${relativePath}`);
                continue;
            }

            try {
                const stats = await fs.stat(absolutePath);
                if (stats.size > options.maxFileSize) {
                    const error = new FileSizeLimitError(relativePath, stats.size, options.maxFileSize);
                    logError(this.logger, error, true);
                    continue;
                }

                // バイナリファイルのチェック
                const buffer = await fs.readFile(absolutePath);
                if (isBinaryFile(buffer)) {
                    this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                    continue;
                }

                const content = buffer.toString('utf-8');
                const language = this.detectLanguage(path.basename(absolutePath));
                let imports: string[] | undefined;

                if (options.includeDependencies) {
                    try {
                        imports = await scanDependencies(absolutePath, content, language);
                    } catch (scanError) {
                        this.logger.warn(`Failed to scan dependencies for ${relativePath}: ${extractErrorMessage(scanError)}`);
                        imports = []; // エラー時は空配列として処理を継続
                    }
                }

                const fileInfo: FileInfo = {
                    uri,
                    relativePath,
                    content,
                    language,
                    size: stats.size,
                    imports
                };

                const dirPath = path.dirname(relativePath);
                if (!results.some(dir => dir.relativePath === dirPath)) {
                    results.push({
                        uri: vscode.Uri.file(path.join(rootScanPath, dirPath)),
                        relativePath: dirPath,
                        files: [],
                        directories: new Map()
                    });
                }

                const dirInfo = results.find(dir => dir.relativePath === dirPath);
                if (dirInfo) {
                    dirInfo.files.push(fileInfo);
                }
            } catch (error) {
                logError(this.logger, error, true);
            }
        }

        return results;
    }
} 