import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { FileInfo, DirectoryInfo, ScanOptions } from './types/fileTypes';
import { minimatch } from 'minimatch';
import { DirectoryNotFoundError, FileSizeLimitError, ScanError } from './errors/errors';
import { Logger } from './utils/logger';
import { extractErrorMessage, logError } from './utils/errorUtils';
import { isBinaryFile } from './utils/fileUtils';

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
                const fileInfo: FileInfo = {
                    uri: vscode.Uri.file(absolutePath),
                    relativePath,
                    content,
                    language: this.detectLanguage(path.basename(absolutePath)),
                    size: stats.size
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
                const entryPath = path.join(absolutePath, entry.name);
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
                        directories.set(entry.name, subDirInfo);
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
                        files.push({
                            uri: vscode.Uri.file(entryPath),
                            relativePath: entryRelativePath,
                            content,
                            language: this.detectLanguage(entry.name),
                            size: stats.size
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
        if (relativePath === currentSelectedRelativePath) {
            return false;
        }

        // 否定パターンのチェック - .gitignore
        if (options.useGitignore && this.gitignoreNegatedPatterns.length > 0) {
            for (const pattern of this.gitignoreNegatedPatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    // 否定パターンにマッチした場合は強制的に除外しない
                    this.logger.info(`否定パターン一致(gitignore): ${relativePath} -> ${pattern}`);
                    return false;
                }
            }
        }

        // 否定パターンのチェック - .vscodeignore
        if (options.useVscodeignore && this.vscodeignoreNegatedPatterns.length > 0) {
            for (const pattern of this.vscodeignoreNegatedPatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    // 否定パターンにマッチした場合は強制的に除外しない
                    this.logger.info(`否定パターン一致(vscodeignore): ${relativePath} -> ${pattern}`);
                    return false;
                }
            }
        }

        // 通常パターンのチェック - .gitignore
        if (options.useGitignore && this.gitignorePatterns.length > 0) {
            for (const pattern of this.gitignorePatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    this.logger.info(`通常パターン一致(gitignore): ${relativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        // 通常パターンのチェック - .vscodeignore
        if (options.useVscodeignore && this.vscodeignorePatterns.length > 0) {
            for (const pattern of this.vscodeignorePatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    this.logger.info(`通常パターン一致(vscodeignore): ${relativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        // 設定された除外パターンを考慮
        if (options.excludePatterns.length > 0) {
            for (const pattern of options.excludePatterns) {
                if (this.matchPattern(relativePath, pattern)) {
                    this.logger.info(`除外パターン一致: ${relativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        // パターンが "excluded-dir/**" のようなディレクトリ指定の場合
        if (pattern.endsWith('/**')) {
            const basePattern = pattern.slice(0, -3);
            // もし対象のパスのベースネームがパターンと一致すれば除外
            if (path.basename(filePath) === basePattern) {
                return true;
            }
        } else {
            // その他は minimatch を利用（matchBase:true によりベースネームのみも評価）
            const options = {
                dot: true,
                matchBase: true,
                nocase: process.platform === 'win32'
            };
            if (minimatch(filePath, pattern, options)) {
                return true;
            }
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
            '.proto': 'protobuf'
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
        try {
            // .gitignoreパターンを読み込む（初回のみ）
            if (options.useGitignore && !this.gitignoreLoaded) {
                await this.loadGitignorePatterns();
            }

            // .vscodeignoreパターンを読み込む（初回のみ）
            if (options.useVscodeignore && !this.vscodeignoreLoaded) {
                await this.loadVscodeignorePatterns();
            }

            // ファイルをディレクトリごとにグループ化
            const filesByDir = new Map<string, vscode.Uri[]>();
            for (const uri of fileUris) {
                const dirPath = path.dirname(uri.fsPath);
                if (!filesByDir.has(dirPath)) {
                    filesByDir.set(dirPath, []);
                }
                filesByDir.get(dirPath)?.push(uri);
            }

            // 各ディレクトリごとにDirectoryInfoを作成
            const result: DirectoryInfo[] = [];
            for (const [dirPath, uris] of filesByDir.entries()) {
                const dirUri = vscode.Uri.file(dirPath);
                const relativeDirPath = path.relative(this.workspaceRoot, dirPath);
                
                const files: FileInfo[] = [];
                
                for (const uri of uris) {
                    const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
                    
                    // 対象のパスが除外されるかチェック
                    if (await this.shouldExclude(relativePath, options)) {
                        this.logger.info(`除外: ${relativePath}`);
                        continue;
                    }

                    try {
                        const stats = await fs.stat(uri.fsPath);
                        
                        // サイズ制限のチェック
                        if (stats.size > options.maxFileSize) {
                            this.logger.info(`サイズ制限超過のためスキップ: ${relativePath} (${stats.size} > ${options.maxFileSize})`);
                            continue;
                        }

                        // バイナリファイルのチェック
                        const buffer = await fs.readFile(uri.fsPath);
                        if (isBinaryFile(buffer)) {
                            this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                            continue;
                        }

                        const content = buffer.toString('utf-8');
                        files.push({
                            uri,
                            relativePath,
                            content,
                            language: this.detectLanguage(path.basename(uri.fsPath)),
                            size: stats.size
                        });
                    } catch (error) {
                        logError(this.logger, error, true);
                    }
                }

                if (files.length > 0) {
                    result.push({
                        uri: dirUri,
                        relativePath: relativeDirPath,
                        files,
                        directories: new Map()
                    });
                }
            }

            return result;
        } catch (error) {
            if (error instanceof DirectoryNotFoundError || error instanceof FileSizeLimitError) {
                throw error;
            }
            throw new ScanError(extractErrorMessage(error));
        }
    }
} 