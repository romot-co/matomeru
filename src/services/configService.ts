import * as vscode from 'vscode';
import { MatomeruConfig, defaultConfig } from '../types/configTypes';

export class ConfigService {
    private static instance: ConfigService | null = null;
    private config: MatomeruConfig;

    private constructor() {
        this.config = this.loadConfig();
    }

    static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    static resetInstance(): void {
        ConfigService.instance = null;
    }

    getConfig(): MatomeruConfig {
        return {
            ...this.config,
            excludePatterns: [...this.config.excludePatterns],
            directoryStructure: { ...this.config.directoryStructure }
        };
    }

    reload(): void {
        this.config = this.loadConfig();
    }

    private loadConfig(): MatomeruConfig {
        try {
            const config = vscode.workspace.getConfiguration('matomeru');
            if (!config) {
                return this.deepCopyDefaultConfig();
            }

            return {
                maxFileSize: this.validateMaxFileSize(this.safeGet(config, 'maxFileSize')),
                excludePatterns: this.validateExcludePatterns(this.safeGet(config, 'excludePatterns')),
                chatGptIntegration: this.validateBoolean(this.safeGet(config, 'chatGptIntegration'), defaultConfig.chatGptIntegration),
                directoryStructure: {
                    directoryIcon: this.validateString(this.safeGet(config, 'directoryStructure.directoryIcon'), defaultConfig.directoryStructure.directoryIcon),
                    fileIcon: this.validateString(this.safeGet(config, 'directoryStructure.fileIcon'), defaultConfig.directoryStructure.fileIcon),
                    indentSize: this.validateIndentSize(this.safeGet(config, 'directoryStructure.indentSize')),
                    showFileExtensions: this.validateBoolean(this.safeGet(config, 'directoryStructure.showFileExtensions'), defaultConfig.directoryStructure.showFileExtensions),
                    useEmoji: this.validateBoolean(this.safeGet(config, 'directoryStructure.useEmoji'), defaultConfig.directoryStructure.useEmoji)
                },
                useGitignore: this.validateBoolean(this.safeGet(config, 'useGitignore'), defaultConfig.useGitignore),
                useVscodeignore: this.validateBoolean(this.safeGet(config, 'useVscodeignore'), defaultConfig.useVscodeignore),
                prefixText: this.validateString(this.safeGet(config, 'prefixText'), defaultConfig.prefixText)
            };
        } catch (error) {
            // エラーが発生した場合はデフォルト設定を返す
            return this.deepCopyDefaultConfig();
        }
    }

    private safeGet<T>(config: vscode.WorkspaceConfiguration, key: string): T | undefined {
        try {
            return config.get<T>(key);
        } catch (error) {
            // 個別の設定取得でエラーが発生した場合はundefinedを返す
            return undefined;
        }
    }

    private deepCopyDefaultConfig(): MatomeruConfig {
        return {
            ...defaultConfig,
            excludePatterns: [...defaultConfig.excludePatterns],
            directoryStructure: { ...defaultConfig.directoryStructure }
        };
    }

    private validateMaxFileSize(value: unknown): number {
        if (typeof value === 'number' && value > 0 && Number.isInteger(value) && Number.isSafeInteger(value)) {
            return value;
        }
        return defaultConfig.maxFileSize;
    }

    private validateExcludePatterns(value: unknown): string[] {
        if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
            return [...value];
        }
        return [...defaultConfig.excludePatterns];
    }

    private validateBoolean(value: unknown, defaultValue: boolean): boolean {
        if (typeof value === 'boolean') {
            return value;
        }
        return defaultValue;
    }

    private validateString(value: unknown, defaultValue: string): string {
        if (typeof value === 'string') {
            return value;
        }
        return defaultValue;
    }

    private validateIndentSize(value: unknown): number {
        if (typeof value === 'number' && value > 0 && value <= 8 && Number.isInteger(value)) {
            return value;
        }
        return defaultConfig.directoryStructure.indentSize;
    }
} 