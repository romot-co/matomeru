import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import { FileInfo, DirectoryInfo, ScanOptions } from './types/fileTypes';
import { minimatch } from 'minimatch';
import { DirectoryNotFoundError, FileSizeLimitError, ScanError } from './errors/errors';
import { Logger } from './utils/logger';
import { extractErrorMessage, logError } from './utils/errorUtils';
import { isBinaryFile } from './utils/fileUtils';
import { scanDependencies } from './parsers/dependencyScanner';

interface IgnoreRule {
    pattern: string;
    negate: boolean;
}

export class FileOperations {
    private readonly logger: Logger;
    private readonly workspaceRoot: string;
    private currentSelectedPath: string | undefined;
    private gitignoreRules: Map<string, IgnoreRule[]> = new Map();
    private gitignoreLoaded: Map<string, boolean> = new Map();
    private gitignoreWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private vscodeignoreRules: Map<string, IgnoreRule[]> = new Map();
    private vscodeignoreLoaded: Map<string, boolean> = new Map();
    private vscodeignoreWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private preloadCompleted: boolean = false;
    private workspaceFolderWatcher: vscode.Disposable | undefined;
    private preloadTimer: ReturnType<typeof setTimeout> | undefined;
    private isDisposed: boolean = false;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = Logger.getInstance('FileOperations');
        // 全ワークスペースフォルダーの設定ファイル監視をセットアップ
        this.setupAllWorkspaceWatchers();

        this.workspaceFolderWatcher = vscode.workspace.onDidChangeWorkspaceFolders(event => {
            event.added.forEach(folder => {
                this.setupGitignoreWatcher(folder.uri.fsPath);
                this.setupVscodeignoreWatcher(folder.uri.fsPath);
            });
            event.removed.forEach(folder => {
                this.teardownGitignoreWatcher(folder.uri.fsPath);
                this.teardownVscodeignoreWatcher(folder.uri.fsPath);
            });
        });
        
        // バックグラウンドで事前読み込みをスケジュール
        this.preloadTimer = setTimeout(() => {
            this.preloadTimer = undefined;
            if (this.isDisposed) {
                return;
            }
            this.preloadConfigFiles().catch(error => {
                this.logger.error(`Preload failed: ${error}`);
            });
        }, 1000);
        if (this.preloadTimer && typeof (this.preloadTimer as NodeJS.Timeout).unref === 'function') {
            (this.preloadTimer as NodeJS.Timeout).unref();
        }
    }

    /**
     * ファイルパスから適切なワークスペースフォルダーを特定する
     */
    public getWorkspaceRootForPath(filePath: string): string {
        if (!vscode.workspace.workspaceFolders) {
            return this.workspaceRoot;
        }

        // ファイルパスを正規化
        const normalizedFilePath = path.normalize(filePath);

        // ファイルパスを含むワークスペースフォルダーを検索
        for (const folder of vscode.workspace.workspaceFolders) {
            const normalizedWorkspacePath = path.normalize(folder.uri.fsPath);
            const relativePath = path.relative(normalizedWorkspacePath, normalizedFilePath);
            
            // 相対パスが上位ディレクトリを指していない（../が含まれない）場合
            // 空文字列の場合は完全一致を意味する
            if (!relativePath.startsWith('..')) {
                return folder.uri.fsPath;
            }
        }

        // フォールバック: 最初のワークスペースフォルダー
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    /**
     * ファイルURIのリストをワークスペース別にグループ化する
     */
    public groupFilesByWorkspace(uris: vscode.Uri[]): Map<string, vscode.Uri[]> {
        const groups = new Map<string, vscode.Uri[]>();
        
        for (const uri of uris) {
            const workspaceRoot = this.getWorkspaceRootForPath(uri.fsPath);
            if (!groups.has(workspaceRoot)) {
                groups.set(workspaceRoot, []);
            }
            groups.get(workspaceRoot)!.push(uri);
        }
        
        return groups;
    }

    /**
     * 全ワークスペースフォルダーの設定ファイル監視をセットアップ
     */
    private setupAllWorkspaceWatchers(): void {
        if (!vscode.workspace.workspaceFolders) {
            // 単一フォルダーワークスペースの場合
            this.setupGitignoreWatcher(this.workspaceRoot);
            this.setupVscodeignoreWatcher(this.workspaceRoot);
            return;
        }

        // マルチルートワークスペースの場合
        for (const folder of vscode.workspace.workspaceFolders) {
            this.setupGitignoreWatcher(folder.uri.fsPath);
            this.setupVscodeignoreWatcher(folder.uri.fsPath);
        }
    }

    /**
     * .gitignoreファイルの変更を監視するwatcherをセットアップ
     */
    private setupGitignoreWatcher(workspaceRoot: string): void {
        try {
            // 既存のwatcherがあれば無視（重複防止）
            if (this.gitignoreWatchers.has(workspaceRoot)) {
                return;
            }

            // .gitignoreファイルを監視するFileSystemWatcherを作成
            const gitignorePath = new vscode.RelativePattern(workspaceRoot, '.gitignore');
            const watcher = vscode.workspace.createFileSystemWatcher(gitignorePath);

            // 変更イベントに対応するリスナーを追加
            watcher.onDidChange(() => {
                this.resetGitignoreState(workspaceRoot);
                this.logger.info(`.gitignoreファイルが変更されました (${workspaceRoot})。パターンは次回のスキャン時に再読み込みされます。`);
            });

            // 作成イベントに対応するリスナーを追加
            watcher.onDidCreate(() => {
                this.resetGitignoreState(workspaceRoot);
                this.logger.info(`.gitignoreファイルが作成されました (${workspaceRoot})。パターンは次回のスキャン時に読み込まれます。`);
            });

            // 削除イベントに対応するリスナーを追加
            watcher.onDidDelete(() => {
                this.resetGitignoreState(workspaceRoot);
                this.logger.info(`.gitignoreファイルが削除されました (${workspaceRoot})。以前のパターンは無効になります。`);
            });

            this.gitignoreWatchers.set(workspaceRoot, watcher);
        } catch (error) {
            this.logger.error(`.gitignoreのウォッチャー設定中にエラーが発生しました (${workspaceRoot}): ${extractErrorMessage(error)}`);
        }
    }

    private teardownGitignoreWatcher(workspaceRoot: string): void {
        const watcher = this.gitignoreWatchers.get(workspaceRoot);
        if (watcher) {
            watcher.dispose();
            this.gitignoreWatchers.delete(workspaceRoot);
        }
        this.resetGitignoreState(workspaceRoot);
    }

    /**
     * gitignoreの状態をリセットし、次回スキャン時に再読み込みさせる
     */
    private resetGitignoreState(workspaceRoot?: string): void {
        if (workspaceRoot) {
            this.gitignoreLoaded.set(workspaceRoot, false);
            this.gitignoreRules.delete(workspaceRoot);
        } else {
            this.gitignoreLoaded.clear();
            this.gitignoreRules.clear();
        }
    }

    /**
     * .vscodeignoreファイルの変更を監視するwatcherをセットアップ
     */
    private setupVscodeignoreWatcher(workspaceRoot: string): void {
        try {
            // 既存のwatcherがあれば無視（重複防止）
            if (this.vscodeignoreWatchers.has(workspaceRoot)) {
                return;
            }

            // .vscodeignoreファイルを監視するFileSystemWatcherを作成
            const vscodeignorePath = new vscode.RelativePattern(workspaceRoot, '.vscodeignore');
            const watcher = vscode.workspace.createFileSystemWatcher(vscodeignorePath);

            // 変更イベントに対応するリスナーを追加
            watcher.onDidChange(() => {
                this.resetVscodeignoreState(workspaceRoot);
                this.logger.info(`.vscodeignoreファイルが変更されました (${workspaceRoot})。パターンは次回のスキャン時に再読み込みされます。`);
            });

            // 作成イベントに対応するリスナーを追加
            watcher.onDidCreate(() => {
                this.resetVscodeignoreState(workspaceRoot);
                this.logger.info(`.vscodeignoreファイルが作成されました (${workspaceRoot})。パターンは次回のスキャン時に読み込まれます。`);
            });

            // 削除イベントに対応するリスナーを追加
            watcher.onDidDelete(() => {
                this.resetVscodeignoreState(workspaceRoot);
                this.logger.info(`.vscodeignoreファイルが削除されました (${workspaceRoot})。以前のパターンは無効になります。`);
            });

            this.vscodeignoreWatchers.set(workspaceRoot, watcher);
        } catch (error) {
            this.logger.error(`.vscodeignoreのウォッチャー設定中にエラーが発生しました (${workspaceRoot}): ${extractErrorMessage(error)}`);
        }
    }

    private teardownVscodeignoreWatcher(workspaceRoot: string): void {
        const watcher = this.vscodeignoreWatchers.get(workspaceRoot);
        if (watcher) {
            watcher.dispose();
            this.vscodeignoreWatchers.delete(workspaceRoot);
        }
        this.resetVscodeignoreState(workspaceRoot);
    }

    /**
     * vscodeignoreの状態をリセットし、次回スキャン時に再読み込みさせる
     */
    private resetVscodeignoreState(workspaceRoot?: string): void {
        if (workspaceRoot) {
            this.vscodeignoreLoaded.set(workspaceRoot, false);
            this.vscodeignoreRules.delete(workspaceRoot);
        } else {
            this.vscodeignoreLoaded.clear();
            this.vscodeignoreRules.clear();
        }
    }

    /**
     * FileOperationsインスタンスのリソースを解放する
     */
    dispose(): void {
        this.isDisposed = true;
        if (this.preloadTimer) {
            clearTimeout(this.preloadTimer);
            this.preloadTimer = undefined;
        }

        // 全てのgitignoreWatcherを解放
        for (const watcher of this.gitignoreWatchers.values()) {
            watcher.dispose();
        }
        this.gitignoreWatchers.clear();

        // 全てのvscodeignoreWatcherを解放
        for (const watcher of this.vscodeignoreWatchers.values()) {
            watcher.dispose();
        }
        this.vscodeignoreWatchers.clear();

        if (this.workspaceFolderWatcher) {
            this.workspaceFolderWatcher.dispose();
            this.workspaceFolderWatcher = undefined;
        }
    }

    setCurrentSelectedPath(path: string | undefined): void {
        this.currentSelectedPath = path;
    }

    private async readFileContentStream(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            let data = '';
            const stream = createReadStream(filePath, { encoding: 'utf-8' });
            stream.on('data', chunk => { data += chunk; });
            stream.on('end', () => resolve(data));
            stream.on('error', err => reject(err));
        });
    }

    async scanDirectory(targetPath: string, options: ScanOptions, workspaceRoot?: string): Promise<DirectoryInfo> {
        const targetWorkspaceRoot = workspaceRoot || this.getWorkspaceRootForPath(targetPath);
        
        try {
            if (options.useGitignore && !this.gitignoreLoaded.get(targetWorkspaceRoot)) {
                await this.loadGitignorePatterns(targetWorkspaceRoot);
            }

            if (options.useVscodeignore && !this.vscodeignoreLoaded.get(targetWorkspaceRoot)) {
                await this.loadVscodeignorePatterns(targetWorkspaceRoot);
            }

            const absolutePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(targetWorkspaceRoot, targetPath);
            const relativePath = path.relative(targetWorkspaceRoot, absolutePath);

            const stats = await fs.stat(absolutePath);
            this.logger.info(`スキャン対象: ${absolutePath} (${stats.isFile() ? 'ファイル' : 'ディレクトリ'})`);

            // ファイルの場合は、単一のファイルを含むディレクトリ情報として扱う
            if (stats.isFile()) {
                if (await this.shouldExclude(relativePath, options, targetWorkspaceRoot)) {
                    this.logger.info(`除外: ${relativePath}`);
                    return this.createEmptyDirectoryInfo(targetWorkspaceRoot, absolutePath);
                }

                if (stats.size > options.maxFileSize) {
                    throw new FileSizeLimitError(relativePath, stats.size, options.maxFileSize);
                }

                // バイナリファイルのチェック
                const content = await this.readFileContentStream(absolutePath);
                if (isBinaryFile(content)) {
                    this.logger.info(`バイナリファイルをスキップ: ${relativePath}`);
                    return {
                        uri: vscode.Uri.file(path.dirname(absolutePath)),
                        relativePath: path.dirname(relativePath),
                        files: [],
                        directories: new Map()
                    };
                }

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
                const entryRelativePath = path.relative(targetWorkspaceRoot, entryPath);

                const shouldBeExcluded = entryPath !== this.currentSelectedPath && await this.shouldExclude(entryRelativePath, options, targetWorkspaceRoot);
                
                if (shouldBeExcluded) {
                    this.logger.info(`除外: ${entryRelativePath}`);
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const subDirInfo = await this.scanDirectory(entryPath, options, targetWorkspaceRoot);
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
                        const content = await this.readFileContentStream(entryPath);
                        if (isBinaryFile(content)) {
                            this.logger.info(`バイナリファイルをスキップ: ${entryRelativePath}`);
                            continue;
                        }

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

    private async shouldExclude(relativePath: string, options: ScanOptions, workspaceRoot?: string): Promise<boolean> {
        const targetWorkspaceRoot = workspaceRoot || this.workspaceRoot;
        
        // ルートの選択ディレクトリ自体は除外しない
        const currentSelectedRelativePath = this.currentSelectedPath
            ? path.relative(targetWorkspaceRoot, this.currentSelectedPath)
            : '';
        const posixRelativePath = relativePath.replace(/\\/g, '/');

        if (posixRelativePath === currentSelectedRelativePath.replace(/\\/g, '/')) {
            return false;
        }

        if (options.useGitignore) {
            const gitignoreMatch = this.findLastMatchingRule(posixRelativePath, this.gitignoreRules.get(targetWorkspaceRoot) || []);
            if (gitignoreMatch) {
                this.logger.info(
                    `${gitignoreMatch.negate ? '否定' : '通常'}パターン一致(gitignore): ${posixRelativePath} -> ${gitignoreMatch.negate ? '!' : ''}${gitignoreMatch.pattern}`
                );
                if (!gitignoreMatch.negate) {
                    return true;
                }
            }
        }

        if (options.useVscodeignore) {
            const vscodeignoreMatch = this.findLastMatchingRule(posixRelativePath, this.vscodeignoreRules.get(targetWorkspaceRoot) || []);
            if (vscodeignoreMatch) {
                this.logger.info(
                    `${vscodeignoreMatch.negate ? '否定' : '通常'}パターン一致(vscodeignore): ${posixRelativePath} -> ${vscodeignoreMatch.negate ? '!' : ''}${vscodeignoreMatch.pattern}`
                );
                if (!vscodeignoreMatch.negate) {
                    return true;
                }
            }
        }

        // 設定された除外パターンを考慮
        if (options.excludePatterns.length > 0) {
            for (const pattern of options.excludePatterns) {
                if (this.matchPattern(posixRelativePath, pattern.replace(/\\/g, '/'))) {
                    this.logger.info(`除外パターン一致: ${posixRelativePath} -> ${pattern}`);
                    return true;
                }
            }
        }

        return false;
    }

    private matchPattern(filePath: string, pattern: string): boolean {
        const posixFilePath = filePath.replace(/\\/g, '/');
        let posixPattern = pattern.replace(/\\/g, '/').trim();
        if (!posixPattern) {
            return false;
        }

        const anchoredToRoot = posixPattern.startsWith('/');
        if (anchoredToRoot) {
            posixPattern = posixPattern.slice(1);
        }

        const isRecursiveDirPattern = posixPattern.endsWith('/**');
        const isDirectoryPattern = isRecursiveDirPattern || posixPattern.endsWith('/');
        let corePattern = posixPattern;

        if (isRecursiveDirPattern) {
            corePattern = corePattern.slice(0, -3);
        }
        if (corePattern.endsWith('/')) {
            corePattern = corePattern.slice(0, -1);
        }
        if (!corePattern) {
            return false;
        }

        const hasSlash = corePattern.includes('/');
        const hasGlob = /[*?[\]{}]/.test(corePattern);
        const segments = posixFilePath.split('/').filter(Boolean);
        const basename = segments[segments.length - 1] ?? posixFilePath;
        const options = {
            dot: true,
            nocase: true,
            matchBase: false
        };

        if (!hasSlash) {
            if (!hasGlob) {
                return segments.includes(corePattern);
            }

            if (isDirectoryPattern) {
                return segments.some(segment => minimatch(segment, corePattern, options));
            }

            return minimatch(basename, corePattern, options);
        }

        if (!hasGlob && (posixFilePath === corePattern || posixFilePath.startsWith(corePattern + '/'))) {
            return true;
        }

        return minimatch(posixFilePath, corePattern, options);
    }

    private findLastMatchingRule(filePath: string, rules: IgnoreRule[]): IgnoreRule | undefined {
        let matchedRule: IgnoreRule | undefined;

        for (const rule of rules) {
            if (this.matchPattern(filePath, rule.pattern)) {
                matchedRule = rule;
            }
        }

        return matchedRule;
    }

    private parseIgnoreRules(content: string): IgnoreRule[] {
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => ({
                negate: line.startsWith('!'),
                pattern: line.startsWith('!') ? line.substring(1) : line
            }))
            .filter(rule => rule.pattern.length > 0);
    }

    private createEmptyDirectoryInfo(workspaceRoot: string, absolutePath: string): DirectoryInfo {
        const parentPath = path.dirname(absolutePath);
        const parentRelative = path.relative(workspaceRoot, parentPath) || '.';
        return {
            uri: vscode.Uri.file(parentPath),
            relativePath: parentRelative === '' ? '.' : parentRelative,
            files: [],
            directories: new Map()
        };
    }

    /**
     * 事前読み込み処理
     */
    public async preloadConfigFiles(): Promise<void> {
        if (this.preloadCompleted) return;
        
        try {
            
            await Promise.all([
                this.loadGitignorePatterns(),
                this.loadVscodeignorePatterns()
            ]);
            
            this.preloadCompleted = true;
        } catch (error) {
            this.logger.error(`Config files preload failed: ${error}`);
        }
    }

    public isPreloadCompleted(): boolean {
        return this.preloadCompleted;
    }

    public async loadGitignorePatterns(workspaceRoot?: string): Promise<void> {
        const targetWorkspaceRoot = workspaceRoot || this.workspaceRoot;
        
        try {
            const gitignorePath = path.join(targetWorkspaceRoot, '.gitignore');
            try {
                const content = await fs.readFile(gitignorePath, 'utf-8');
                const rules = this.parseIgnoreRules(content);
                const negatedCount = rules.filter(rule => rule.negate).length;
                const normalCount = rules.length - negatedCount;

                this.gitignoreRules.set(targetWorkspaceRoot, rules);
                this.logger.info(`${normalCount}件の.gitignoreパターンと${negatedCount}件の否定パターンを読み込みました (${targetWorkspaceRoot})`);
            } catch (error) {
                this.logger.info(`.gitignoreファイルが見つかりません (${targetWorkspaceRoot})`);
                this.gitignoreRules.set(targetWorkspaceRoot, []);
            }
        } finally {
            this.gitignoreLoaded.set(targetWorkspaceRoot, true);
        }
    }

    public async loadVscodeignorePatterns(workspaceRoot?: string): Promise<void> {
        const targetWorkspaceRoot = workspaceRoot || this.workspaceRoot;
        
        try {
            const vscodeignorePath = path.join(targetWorkspaceRoot, '.vscodeignore');
            try {
                const content = await fs.readFile(vscodeignorePath, 'utf-8');
                const rules = this.parseIgnoreRules(content);
                const negatedCount = rules.filter(rule => rule.negate).length;
                const normalCount = rules.length - negatedCount;

                this.vscodeignoreRules.set(targetWorkspaceRoot, rules);
                this.vscodeignoreLoaded.set(targetWorkspaceRoot, true);
                this.logger.info(`.vscodeignoreから${normalCount}個のパターンと${negatedCount}個の否定パターンを読み込みました (${targetWorkspaceRoot})`);
            } catch (error) {
                this.vscodeignoreRules.set(targetWorkspaceRoot, []);
                this.vscodeignoreLoaded.set(targetWorkspaceRoot, true);
                this.logger.info(`.vscodeignoreファイルが見つかりませんでした (${targetWorkspaceRoot})`);
            }
        } catch (error) {
            this.logger.error(`.vscodeignoreの読み込み中にエラーが発生しました (${targetWorkspaceRoot}): ${extractErrorMessage(error)}`);
            this.vscodeignoreRules.set(targetWorkspaceRoot, []);
            this.vscodeignoreLoaded.set(targetWorkspaceRoot, true);
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
            '.tsx': 'tsx',
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
    async estimateDirectorySize(targetPath: string, options: ScanOptions, workspaceRoot?: string): Promise<{ totalFiles: number, totalSize: number }> {
        try {
            const baseRoot = workspaceRoot ?? this.workspaceRoot;
            const absolutePath = path.isAbsolute(targetPath)
                ? targetPath
                : path.join(baseRoot, targetPath);
            const targetWorkspaceRoot = workspaceRoot || this.getWorkspaceRootForPath(absolutePath);

            if (options.useGitignore && !this.gitignoreLoaded.get(targetWorkspaceRoot)) {
                await this.loadGitignorePatterns(targetWorkspaceRoot);
            }

            if (options.useVscodeignore && !this.vscodeignoreLoaded.get(targetWorkspaceRoot)) {
                await this.loadVscodeignorePatterns(targetWorkspaceRoot);
            }
            const relativePath = path.relative(targetWorkspaceRoot, absolutePath);

            const stats = await fs.stat(absolutePath);
            this.logger.info(`見積り対象: ${absolutePath} (${stats.isFile() ? 'ファイル' : 'ディレクトリ'})`);

            let totalFiles = 0;
            let totalSize = 0;

            // ファイルの場合は、サイズをチェックして直接カウント
            if (stats.isFile()) {
                // 対象のパスが除外されるかチェック
                if (await this.shouldExclude(relativePath, options, targetWorkspaceRoot)) {
                    return { totalFiles: 0, totalSize: 0 };
                }

                // サイズ制限のチェック
                if (stats.size > options.maxFileSize) {
                    this.logger.info(`サイズ制限超過のためスキップ: ${relativePath} (${stats.size} > ${options.maxFileSize})`);
                    return { totalFiles: 0, totalSize: 0 };
                }

                // バイナリファイルのチェック
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
                const entryRelativePath = path.relative(targetWorkspaceRoot, entryPath);

                if (entryPath !== this.currentSelectedPath && await this.shouldExclude(entryRelativePath, options, targetWorkspaceRoot)) {
                    this.logger.info(`除外: ${entryRelativePath}`);
                    continue;
                }

                if (entry.isDirectory()) {
                    try {
                        const { totalFiles: subDirFiles, totalSize: subDirSize } = 
                            await this.estimateDirectorySize(entryPath, options, targetWorkspaceRoot);
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
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.heic',
            '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.flv', '.webm',
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
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
        const directoryMap = new Map<string, DirectoryInfo>();

        const getDirectoryInfo = (workspaceRoot: string, dirPath: string): DirectoryInfo => {
            const key = `${workspaceRoot}::${dirPath || '.'}`;
            let dirInfo = directoryMap.get(key);
            if (!dirInfo) {
                const absoluteDirPath = dirPath ? path.join(workspaceRoot, dirPath) : workspaceRoot;
                dirInfo = {
                    uri: vscode.Uri.file(absoluteDirPath),
                    relativePath: dirPath,
                    files: [],
                    directories: new Map()
                };
                directoryMap.set(key, dirInfo);
                results.push(dirInfo);
            }
            return dirInfo;
        };

        for (const uri of fileUris) {
            const absolutePath = uri.fsPath;
            const workspaceRootForPath = this.getWorkspaceRootForPath(absolutePath);
            const relativePath = path.relative(workspaceRootForPath, absolutePath);

            if (options.useGitignore && !this.gitignoreLoaded.get(workspaceRootForPath)) {
                await this.loadGitignorePatterns(workspaceRootForPath);
            }
            if (options.useVscodeignore && !this.vscodeignoreLoaded.get(workspaceRootForPath)) {
                await this.loadVscodeignorePatterns(workspaceRootForPath);
            }

            if (await this.shouldExclude(relativePath, options, workspaceRootForPath)) {
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
                const dirInfo = getDirectoryInfo(workspaceRootForPath, dirPath);
                dirInfo.files.push(fileInfo);
            } catch (error) {
                logError(this.logger, error, true);
            }
        }

        return results;
    }
}
