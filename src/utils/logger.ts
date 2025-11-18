import * as vscode from 'vscode';

export class Logger {
    private static instances: Map<string, Logger> = new Map();
    private static outputChannel: vscode.OutputChannel | undefined;
    private readonly context: string;

    private constructor(context: string) {
        this.context = context;
        Logger.ensureChannel();
    }

    static getInstance(context: string): Logger {
        if (!Logger.instances.has(context)) {
            Logger.instances.set(context, new Logger(context));
        }
        return Logger.instances.get(context)!;
    }

    debug(message: string): void {
        this.log('DEBUG', message);
    }

    info(message: string): void {
        this.log('INFO', message);
    }

    warn(message: string, options?: { silent?: boolean }): void {
        this.log('WARN', message);
        if (!options?.silent) {
            vscode.window.showWarningMessage(message);
        }
    }

    error(message: string | Error, options?: { silent?: boolean }): void {
        const errorMessage = message instanceof Error ? message.message : message;
        this.log('ERROR', errorMessage);
        if (!options?.silent) {
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    private log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;
        
        // 出力チャンネルにログを書き込む
        Logger.ensureChannel().appendLine(formattedMessage);

        // 開発時のデバッグ用にconsole.logを使用
        if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.log(formattedMessage);
        }
    }

    /**
     * 出力チャンネルを表示
     */
    show(): void {
        Logger.ensureChannel().show();
    }

    /**
     * 出力チャンネルをクリア
     */
    clear(): void {
        Logger.ensureChannel().clear();
    }

    /**
     * 出力チャンネルを非表示
     * 注意: VSCode API では hide() は利用できないため、何もしない
     */
    hide(): void {
        // VSCode API のOutputChannelにはhideメソッドが存在しないため、何もしない
        // ユーザーが手動でチャンネルを非表示にする必要がある
    }

    /**
     * 出力チャンネルを破棄
     */
    dispose(): void {
        if (Logger.outputChannel) {
            Logger.outputChannel.dispose();
            Logger.outputChannel = undefined;
        }
        Logger.instances.clear();
    }

    private static ensureChannel(): vscode.OutputChannel {
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel('Matomeru');
        }
        return Logger.outputChannel;
    }
}
