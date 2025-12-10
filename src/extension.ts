import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { CommandRegistrar } from './commands';
import { Logger } from './utils/logger';
import { ParserManager } from './services/parserManager';
import { ConfigService } from './services/configService';

const logger = Logger.getInstance('Extension');
let commandRegistrar: CommandRegistrar | undefined;
let extensionContext: vscode.ExtensionContext;

// グローバルにコンテキストを取得するための関数
export function getExtensionContext(): vscode.ExtensionContext {
  return extensionContext;
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    logger.info(vscode.l10n.t('Extension activated'));
    
    vscode.commands.executeCommand('setContext', 'isOSX', process.platform === 'darwin');

    if (hasWorkspaceFolder()) {
        initializeExtension(context);
    } else {
        logger.info('No workspace folders detected. Waiting for a folder to open before initializing Matomeru.');
        const disposable = vscode.workspace.onDidChangeWorkspaceFolders(() => {
            if (hasWorkspaceFolder()) {
                initializeExtension(context);
                disposable.dispose();
            }
        });
        context.subscriptions.push(disposable);
    }
}

function hasWorkspaceFolder(): boolean {
    return Array.isArray(vscode.workspace.workspaceFolders) && vscode.workspace.workspaceFolders.length > 0;
}

function initializeExtension(context: vscode.ExtensionContext): void {
    if (commandRegistrar) {
        return;
    }

    try {
        commandRegistrar = new CommandRegistrar();
    } catch (error) {
        logger.error(`Failed to initialize Matomeru: ${error instanceof Error ? error.message : String(error)}`);
        vscode.window.showErrorMessage(vscode.l10n.t('No workspace is open'));
        return;
    }

    setTimeout(() => {
        runBackgroundInitialization(context).catch(error => {
            logger.error(`Background initialization failed: ${error}`);
        });
    }, 2000);

    const config = vscode.workspace.getConfiguration('matomeru');
    vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', config.get('chatGptIntegration'));

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru')) {
                ConfigService.getInstance().reload();
                logger.info('Matomeru configuration reloaded');
            }
            if (e.affectsConfiguration('matomeru.chatGptIntegration')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', newConfig.get('chatGptIntegration'));
                logger.info(`Configuration changed: matomeru.chatGptIntegration = ${newConfig.get('chatGptIntegration')}`);
            }
            if (e.affectsConfiguration('matomeru.includeDependencies')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.includeDependencies = ${newConfig.get('includeDependencies')}`);
            }
            if (e.affectsConfiguration('matomeru.mermaid.maxNodes')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.mermaid.maxNodes = ${newConfig.get('mermaid.maxNodes')}`);
            }
            if (e.affectsConfiguration('matomeru.outputFormat')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.outputFormat = ${newConfig.get('outputFormat')}`);
            }
        })
    );

    const registerCommand = (commandId: string, handler: (uri?: vscode.Uri, uris?: vscode.Uri[]) => Promise<void>) => {
        return vscode.commands.registerCommand(commandId, async (arg1: unknown, arg2: unknown) => {
            logger.info(vscode.l10n.t('Command executed: {0}, args: {1}', commandId, JSON.stringify({
                arg1: arg1 instanceof vscode.Uri ? arg1.fsPath : Array.isArray(arg1) ? arg1.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg1,
                arg2: arg2 instanceof vscode.Uri ? arg2.fsPath : Array.isArray(arg2) ? arg2.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg2
            })));
            
            const uriSet = new Set<string>();
            const selectedUris: vscode.Uri[] = [];

            if (arg1 instanceof vscode.Uri && !uriSet.has(arg1.fsPath)) {
                uriSet.add(arg1.fsPath);
                selectedUris.push(arg1);
            } else if (Array.isArray(arg1)) {
                arg1.forEach(uri => {
                    if (uri instanceof vscode.Uri && !uriSet.has(uri.fsPath)) {
                        uriSet.add(uri.fsPath);
                        selectedUris.push(uri);
                    }
                });
            }

            if (arg2 instanceof vscode.Uri && !uriSet.has(arg2.fsPath)) {
                uriSet.add(arg2.fsPath);
                selectedUris.push(arg2);
            } else if (Array.isArray(arg2)) {
                arg2.forEach(uri => {
                    if (uri instanceof vscode.Uri && !uriSet.has(uri.fsPath)) {
                        uriSet.add(uri.fsPath);
                        selectedUris.push(uri);
                    }
                });
            }
            
            logger.info(vscode.l10n.t('Target URIs ({0} items):', selectedUris.length));
            await Promise.all(selectedUris.map(async (uri, index) => {
                try {
                    const stats = await fs.stat(uri.fsPath);
                    logger.info(vscode.l10n.t('  {0}. {1} ({2})', index + 1, uri.fsPath, stats.isDirectory() ? 'directory' : 'file'));
                } catch (error) {
                    logger.info(vscode.l10n.t('  {0}. {1} ({2})', index + 1, uri.fsPath, 'unknown'));
                }
            }));

            await handler(undefined, selectedUris.length > 0 ? selectedUris : undefined);
        });
    };

    context.subscriptions.push(
        registerCommand('matomeru.quickProcessToEditor', commandRegistrar!.processToEditor.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboard', commandRegistrar!.processToClipboard.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboardCompressed', commandRegistrar!.processToClipboardCompressed.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToChatGPT', commandRegistrar!.processToChatGPT.bind(commandRegistrar)),
        registerCommand('matomeru.estimateSize', commandRegistrar!.estimateSize.bind(commandRegistrar)),
        registerCommand('matomeru.copyGitDiff', commandRegistrar!.diffToClipboard.bind(commandRegistrar))
    );
}

export function deactivate() {
    logger.info(vscode.l10n.t('Extension deactivated'));
    
    // CommandRegistrarインスタンスを通じてFileOperationsを破棄
    if (commandRegistrar) {
        commandRegistrar.dispose();
        commandRegistrar = undefined;
    }
    
    // ParserManagerのリソースを解放
    try {
      const ctx = getExtensionContext();
      const parserManager = ParserManager.getInstance(ctx);
      parserManager.dispose();
    } catch (error) {
      logger.error(`ParserManager disposal error: ${error}`);
    }
    
    logger.dispose();
}

// バックグラウンド初期化関数群
async function runBackgroundInitialization(context: vscode.ExtensionContext): Promise<void> {
    logger.info('Starting background initialization...');
    
    try {
        // ステップ1: Tree-sitter初期化
        await initializeTreeSitter(context);
        
        // ステップ2: 設定ファイル事前読み込み
        await scheduleIdleTask(() => preloadConfigFiles());
        
        // ステップ3: よく使われる言語のパーサーを事前読み込み
        await scheduleIdleTask(() => preloadCommonParsers(context));
        
        logger.info('Background initialization completed');
    } catch (error) {
        logger.error(`Background initialization error: ${error}`);
    }
}

async function initializeTreeSitter(context: vscode.ExtensionContext): Promise<void> {
    try {
        const parserManager = ParserManager.getInstance(context);
        await (parserManager as any).ensureInit();
        logger.info('Tree-sitter initialized');
    } catch (error) {
        logger.error(`Tree-sitter initialization failed: ${error}`);
    }
}

async function preloadConfigFiles(): Promise<void> {
    if (!commandRegistrar) return;
    
    try {
        const fileOps = (commandRegistrar as any).fileOps;
        if (fileOps && typeof fileOps.preloadConfigFiles === 'function') {
            await fileOps.preloadConfigFiles();
            logger.info('Config files preloaded');
        }
    } catch (error) {
        logger.error(`Config files preload failed: ${error}`);
    }
}

async function preloadCommonParsers(context: vscode.ExtensionContext): Promise<void> {
    const commonLanguages = ['javascript', 'typescript', 'python', 'go'];
    const parserManager = ParserManager.getInstance(context);
    
    for (const lang of commonLanguages) {
        try {
            await parserManager.getParser(lang);
            logger.info(`Parser for ${lang} preloaded`);
            // 各パーサー読み込み間に少し間隔を空ける
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
        logger.error(`Failed to preload parser for ${lang}: ${error}`);
        }
    }
}

async function scheduleIdleTask(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve) => {
        setImmediate(async () => {
            try {
                await task();
            } catch (error) {
                logger.error(`Idle task failed: ${error}`);
            }
            resolve();
        });
    });
}
