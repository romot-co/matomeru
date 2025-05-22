import * as vscode from 'vscode';

export class Logger {
    private static instance: Logger | undefined;
    private readonly outputChannel: vscode.OutputChannel;
    private readonly context: string;

    private constructor(context: string) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Matomeru');
    }

    static getInstance(context: string): Logger {
        if (Logger.instance === undefined) {
            Logger.instance = new Logger(context);
        }
        return Logger.instance;
    }

    debug(message: string): void {
        this.log('DEBUG', message);
    }

    info(message: string): void {
        this.log('INFO', message);
    }

    warn(message: string): void {
        this.log('WARN', message);
        vscode.window.showWarningMessage(message);
    }

    error(message: string | Error): void {
        const errorMessage = message instanceof Error ? message.message : message;
        this.log('ERROR', errorMessage);
        vscode.window.showErrorMessage(errorMessage);
    }

    private log(level: string, message: string): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] [${this.context}] ${message}`;
        
        // 出力チャンネルにログを書き込む
        this.outputChannel.appendLine(formattedMessage);

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
        this.outputChannel.show();
    }

    /**
     * 出力チャンネルをクリア
     */
    clear(): void {
        this.outputChannel.clear();
    }

    /**
     * 出力チャンネルを非表示
     */
    hide(): void {
        this.outputChannel.hide();
    }

    /**
     * 出力チャンネルを破棄
     */
    dispose(): void {
        this.outputChannel.dispose();
        Logger.instance = undefined;
    }
} 