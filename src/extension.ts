import * as vscode from 'vscode';
import { I18n } from './i18n';
import { DirectoryScanner } from './services/directory-scanner';
import { ProductionFSAdapter } from './services/fs-adapter';
import { ChatGPTService } from './services/ChatGPTService';
import { PlatformManager } from './services/PlatformManager';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const i18n = I18n.getInstance();
    console.log(i18n.t('ui.messages.activated'));

    const fsAdapter = new ProductionFSAdapter();
    const scanner = new DirectoryScanner(fsAdapter);
    const chatGPTService = new ChatGPTService();

    // エディタで開くコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'matomeru.combineDirectoryToEditor',
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                    return;
                }

                try {
                    const results = await scanner.scan(uri.fsPath);
                    const document = await vscode.workspace.openTextDocument({
                        content: formatResults(results),
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(document);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        i18n.t('ui.messages.scanError', error instanceof Error ? error.message : String(error))
                    );
                }
            }
        )
    );

    // クリップボードにコピーするコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'matomeru.combineDirectoryToClipboard',
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                    return;
                }

                try {
                    const results = await scanner.scan(uri.fsPath);
                    await vscode.env.clipboard.writeText(formatResults(results));
                    vscode.window.showInformationMessage(i18n.t('ui.messages.copiedToClipboard'));
                } catch (error) {
                    vscode.window.showErrorMessage(
                        i18n.t('ui.messages.scanError', error instanceof Error ? error.message : String(error))
                    );
                }
            }
        )
    );

    // ChatGPTで開くコマンド
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'matomeru.combineDirectoryToChatGPT',
            async (uri: vscode.Uri) => {
                if (!uri) {
                    vscode.window.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                    return;
                }

                if (!PlatformManager.isSupportedPlatform()) {
                    vscode.window.showErrorMessage(i18n.t('ui.messages.macOSOnly'));
                    return;
                }

                // ChatGPTアプリの存在確認
                const isChatGPTInstalled = await PlatformManager.checkChatGPTApp();
                if (!isChatGPTInstalled) {
                    vscode.window.showErrorMessage(i18n.t('ui.messages.chatGPTNotInstalled'));
                    return;
                }

                // アクセシビリティ権限の確認
                const hasAccessibilityPermissions = await PlatformManager.checkAccessibilityPermissions();
                if (!hasAccessibilityPermissions) {
                    const result = await vscode.window.showErrorMessage(
                        i18n.t('ui.messages.accessibilityRequired'),
                        i18n.t('ui.messages.openSettings')
                    );
                    
                    if (result === i18n.t('ui.messages.openSettings')) {
                        await PlatformManager.openSystemPreferences();
                    }
                    return;
                }

                try {
                    const results = await scanner.scan(uri.fsPath);
                    await chatGPTService.sendMessage(formatResults(results));
                    vscode.window.showInformationMessage(i18n.t('ui.messages.sentToChatGPT'));
                } catch (error) {
                    vscode.window.showErrorMessage(
                        i18n.t('ui.messages.scanError', error instanceof Error ? error.message : String(error))
                    );
                }
            }
        )
    );
}

function formatResults(results: { path: string; content: string; extension: string }[]): string {
    // ディレクトリ構造を生成（アイコン付き）
    const rootDir = path.dirname(results[0]?.path || '');
    const dirStructureWithIcons = generateDirectoryStructure(results.map(r => r.path), rootDir);
    
    // ディレクトリ構造を生成（ツリー形式）
    const dirStructureTree = generateTreeStructure(results.map(r => r.path), rootDir);
    
    // ファイル内容を整形
    const formattedFiles = results.map(result => {
        const relativePath = vscode.workspace.asRelativePath(result.path);
        const stats = getFileStats(result.content);
        return formatFileContent(relativePath, result.content, result.extension, stats);
    }).join('\n\n');

    return `# ディレクトリ構造（ツリー形式）

\`\`\`
${dirStructureTree}
\`\`\`

# ディレクトリ構造（アイコン形式）

\`\`\`
${dirStructureWithIcons}
\`\`\`

# ファイル内容

${formattedFiles}`;
}

function generateTreeStructure(filePaths: string[], rootDir: string): string {
    const tree: { [key: string]: boolean } = {};
    
    filePaths.forEach(filePath => {
        const relativePath = path.relative(rootDir, filePath);
        const parts = relativePath.split(path.sep);
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath = currentPath ? path.join(currentPath, part) : part;
            tree[currentPath] = index === parts.length - 1;
        });
    });

    const lines: string[] = [];
    const entries = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));
    
    entries.forEach(([filePath, isFile], index) => {
        const depth = filePath.split(path.sep).length - 1;
        const isLast = index === entries.length - 1 || 
            entries[index + 1][0].split(path.sep).length <= depth;
        
        let prefix = '';
        for (let i = 0; i < depth; i++) {
            const parentPath = filePath.split(path.sep).slice(0, i + 1).join(path.sep);
            const isLastInParent = !entries.some(([p, _], j) => 
                j > index && p.startsWith(parentPath + path.sep)
            );
            prefix += isLastInParent ? '    ' : '│   ';
        }
        
        const connector = isLast ? '└── ' : '├── ';
        lines.push(`${prefix}${connector}${path.basename(filePath)}`);
    });

    return lines.join('\n');
}

function generateDirectoryStructure(filePaths: string[], rootDir: string): string {
    const tree: { [key: string]: boolean } = {};
    
    filePaths.forEach(filePath => {
        const relativePath = path.relative(rootDir, filePath);
        const parts = relativePath.split(path.sep);
        let currentPath = '';
        
        parts.forEach((part, index) => {
            currentPath = currentPath ? path.join(currentPath, part) : part;
            tree[currentPath] = index === parts.length - 1;
        });
    });

    const lines: string[] = [];
    const entries = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));
    
    entries.forEach(([filePath, isFile]) => {
        const depth = filePath.split(path.sep).length - 1;
        const prefix = '  '.repeat(depth);
        const icon = isFile ? '📄' : '📁';
        lines.push(`${prefix}${icon} ${path.basename(filePath)}`);
    });

    return lines.join('\n');
}

function getFileStats(content: string): { lines: number; size: number } {
    return {
        lines: content.split('\n').length,
        size: Buffer.from(content).length
    };
}

function formatFileContent(
    relativePath: string,
    content: string,
    extension: string,
    stats: { lines: number; size: number }
): string {
    const formattedSize = formatSize(stats.size);
    const fileName = path.basename(relativePath);
    
    return `# ${fileName} (${relativePath}) [${extension || 'なし'}, ${formattedSize}, ${stats.lines}行]

\`\`\`${extension}
${content}
\`\`\``;
}

function formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function deactivate() {}
