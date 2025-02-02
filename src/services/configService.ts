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
        const config = vscode.workspace.getConfiguration('matomeru');
        const excludePatterns = config.get<string[]>('excludePatterns');
        const directoryStructure = {
            directoryIcon: config.get<string>('directoryStructure.directoryIcon'),
            fileIcon: config.get<string>('directoryStructure.fileIcon'),
            indentSize: config.get<number>('directoryStructure.indentSize'),
            showFileExtensions: config.get<boolean>('directoryStructure.showFileExtensions'),
            useEmoji: config.get<boolean>('directoryStructure.useEmoji')
        };

        return {
            maxFileSize: config.get<number>('maxFileSize') ?? defaultConfig.maxFileSize,
            excludePatterns: excludePatterns ? [...excludePatterns] : [...defaultConfig.excludePatterns],
            chatGptIntegration: config.get<boolean>('chatGptIntegration') ?? defaultConfig.chatGptIntegration,
            directoryStructure: {
                directoryIcon: directoryStructure.directoryIcon ?? defaultConfig.directoryStructure.directoryIcon,
                fileIcon: directoryStructure.fileIcon ?? defaultConfig.directoryStructure.fileIcon,
                indentSize: directoryStructure.indentSize ?? defaultConfig.directoryStructure.indentSize,
                showFileExtensions: directoryStructure.showFileExtensions ?? defaultConfig.directoryStructure.showFileExtensions,
                useEmoji: directoryStructure.useEmoji ?? defaultConfig.directoryStructure.useEmoji
            }
        };
    }
} 