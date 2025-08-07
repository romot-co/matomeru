import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { CommandRegistrar } from './commands';
import { Logger } from './utils/logger';
import { ParserManager } from './services/parserManager';

const logger = Logger.getInstance('Extension');
let commandRegistrar: CommandRegistrar | undefined;
let extensionContext: vscode.ExtensionContext;

// グローバルにコンテキストを取得するための関数
export function getExtensionContext(): vscode.ExtensionContext {
  return extensionContext;
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    logger.info(vscode.l10n.t('msg.extensionActivated'));
    
    // OSがmacOS（darwin）なら isOSX を true に設定する
    vscode.commands.executeCommand('setContext', 'isOSX', process.platform === 'darwin');
    
    commandRegistrar = new CommandRegistrar();
    
    // バックグラウンド初期化を開始（2秒後）
    setTimeout(() => {
        runBackgroundInitialization(context).catch(error => {
            logger.error(`Background initialization failed: ${error}`);
        });
    }, 2000);
    
    // 設定の初期状態を反映
    const config = vscode.workspace.getConfiguration('matomeru');
    vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', config.get('chatGptIntegration'));

    // 設定変更を監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru.chatGptIntegration')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', newConfig.get('chatGptIntegration'));
                logger.info(`Configuration changed: matomeru.chatGptIntegration = ${newConfig.get('chatGptIntegration')}`);
            }
            if (e.affectsConfiguration('matomeru.includeDependencies')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.includeDependencies = ${newConfig.get('includeDependencies')}`);
                // ジェネレータは都度生成されるため、キャッシュ無効化は不要
            }
            if (e.affectsConfiguration('matomeru.mermaid.maxNodes')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.mermaid.maxNodes = ${newConfig.get('mermaid.maxNodes')}`);
                // ジェネレータは都度生成されるため、キャッシュ無効化は不要
            }
            // outputFormat の変更もロギングしておくと良いでしょう
            if (e.affectsConfiguration('matomeru.outputFormat')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                logger.info(`Configuration changed: matomeru.outputFormat = ${newConfig.get('outputFormat')}`);
            }
        })
    );
    
    // コマンドの登録
    const registerCommand = (commandId: string, handler: (uri?: vscode.Uri, uris?: vscode.Uri[]) => Promise<void>) => {
        return vscode.commands.registerCommand(commandId, async (arg1: unknown, arg2: unknown) => {
            logger.info(vscode.l10n.t('msg.commandExecuted', commandId, JSON.stringify({
                arg1: arg1 instanceof vscode.Uri ? arg1.fsPath : Array.isArray(arg1) ? arg1.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg1,
                arg2: arg2 instanceof vscode.Uri ? arg2.fsPath : Array.isArray(arg2) ? arg2.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg2
            })));
            
            // 引数の解析とURIの一意化
            const uriSet = new Set<string>();
            const selectedUris: vscode.Uri[] = [];

            // arg1の処理
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

            // arg2の処理
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
            
            logger.info(vscode.l10n.t('msg.targetUris', selectedUris.length));
            await Promise.all(selectedUris.map(async (uri, index) => {
                try {
                    const stats = await fs.stat(uri.fsPath);
                    logger.info(vscode.l10n.t('msg.targetUriInfo', index + 1, uri.fsPath, stats.isDirectory() ? 'directory' : 'file'));
                } catch (error) {
                    logger.info(vscode.l10n.t('msg.targetUriInfo', index + 1, uri.fsPath, 'unknown'));
                }
            }));

            await handler(undefined, selectedUris.length > 0 ? selectedUris : undefined);
        });
    };

    // 各コマンドの登録
    context.subscriptions.push(
        registerCommand('matomeru.quickProcessToEditor', commandRegistrar.processToEditor.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboard', commandRegistrar.processToClipboard.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboardCompressed', commandRegistrar.processToClipboardCompressed.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToChatGPT', commandRegistrar.processToChatGPT.bind(commandRegistrar)),
        registerCommand('matomeru.estimateSize', commandRegistrar.estimateSize.bind(commandRegistrar)),
        // Git Diff関連コマンドの追加
        registerCommand('matomeru.copyGitDiff', commandRegistrar.diffToClipboard.bind(commandRegistrar))
    );
}

export function deactivate() {
    logger.info(vscode.l10n.t('msg.extensionDeactivated'));
    
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
