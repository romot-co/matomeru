import * as vscode from 'vscode';
import { MatomeruConfig, defaultConfig } from '../types/configTypes';

export class ConfigService {
    private static instance: ConfigService;
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

    getConfig(): MatomeruConfig {
        return this.config;
    }

    reload(): void {
        this.config = this.loadConfig();
    }

    private loadConfig(): MatomeruConfig {
        const config = vscode.workspace.getConfiguration('matomeru');
        return {
            maxFileSize: config.get<number>('maxFileSize', defaultConfig.maxFileSize),
            excludePatterns: config.get<string[]>('excludePatterns', defaultConfig.excludePatterns),
            chatGptIntegration: config.get<boolean>('chatGptIntegration', defaultConfig.chatGptIntegration),
            directoryStructure: {
                directoryIcon: config.get<string>('directoryStructure.directoryIcon', defaultConfig.directoryStructure.directoryIcon),
                fileIcon: config.get<string>('directoryStructure.fileIcon', defaultConfig.directoryStructure.fileIcon),
                indentSize: config.get<number>('directoryStructure.indentSize', defaultConfig.directoryStructure.indentSize),
                showFileExtensions: config.get<boolean>('directoryStructure.showFileExtensions', defaultConfig.directoryStructure.showFileExtensions),
                useEmoji: config.get<boolean>('directoryStructure.useEmoji', defaultConfig.directoryStructure.useEmoji)
            }
        };
    }
} 