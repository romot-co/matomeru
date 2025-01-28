import { LocaleMessages } from './types';

export class MessageValidator {
    private requiredPaths: Set<string>;

    constructor() {
        this.requiredPaths = new Set<string>();
        this.initializeRequiredPaths();
    }

    private initializeRequiredPaths() {
        const template: LocaleMessages = {
            commands: {
                combineDirectory: ''
            },
            ui: {
                outputDestination: {
                    placeholder: '',
                    editor: {
                        label: '',
                        description: ''
                    },
                    clipboard: {
                        label: '',
                        description: ''
                    }
                },
                progress: {
                    scanning: '',
                    collecting: '',
                    processing: ''
                },
                messages: {
                    selectDirectory: '',
                    openedInEditor: '',
                    copiedToClipboard: '',
                    error: '',
                    showDetails: '',
                    noStackTrace: '',
                    sentToChatGPT: '',
                    macOSOnly: '',
                    accessibilityRequired: '',
                    openSettings: '',
                    chatGPTNotInstalled: '',
                    activated: '',
                    sendFailed: '',
                    sendSuccess: '',
                    waitingForResponse: '',
                    scanError: ''
                }
            },
            errors: {
                accessibilityPermission: '',
                windowActivation: '',
                pasteFailed: '',
                sendButtonNotFound: '',
                responseTimeout: '',
                fileSystem: '',
                outOfMemory: '',
                checkErrorLog: '',
                macOSOnly: ''
            }
        };

        this.collectPaths('', template);
    }

    private collectPaths(prefix: string, obj: any) {
        for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'string') {
                this.requiredPaths.add(path);
            } else if (typeof value === 'object' && value !== null) {
                this.collectPaths(path, value);
            }
        }
    }

    validate(messages: any, locale: string): string[] {
        const errors: string[] = [];
        const paths = new Set<string>();

        this.collectPaths('', messages);

        for (const path of paths) {
            if (!this.requiredPaths.has(path)) {
                errors.push(`Unexpected message path in ${locale}: ${path}`);
            }
        }

        for (const path of this.requiredPaths) {
            if (!paths.has(path)) {
                errors.push(`Missing message path in ${locale}: ${path}`);
            }
        }

        return errors;
    }

    validateMessagePath(path: string): boolean {
        return this.requiredPaths.has(path);
    }

    validateMessages(messages: Partial<LocaleMessages>): string[] {
        return this.validate(messages, 'unknown');
    }
} 