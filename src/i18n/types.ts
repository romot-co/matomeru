export interface I18nOptions {
    defaultLocale?: string;
    fallbackLocale?: string;
}

export interface LocaleMessages {
    commands: {
        combineDirectory: string;
    };
    'test.message': string;
    'test.with.params': string;
    'chatgpt.integration.error': string;
    'ui.messages.selectDirectory': string;
    'ui.messages.scanError': string;
    'ui.messages.sentToChatGPT': string;
    'ui.messages.chatGPTNotInstalled': string;
    'ui.progress.processing': string;
    'success.directory.processed': string;
    'error.directory.processing': string;
    'error.platform.unsupported': string;
    'error.config.invalid': string;
    'config.updated': string;
    'errors.directoryNotInWorkspace': string;
    'errors.chatGptIntegrationNotSupported': string;
    ui: {
        outputDestination: {
            placeholder: string;
            editor: {
                label: string;
                description: string;
            };
            clipboard: {
                label: string;
                description: string;
            };
        };
        progress: {
            scanning: string;
            collecting: string;
            processing: string;
        };
        messages: {
            selectDirectory: string;
            selectWorkspace: string;
            openedInEditor: string;
            copiedToClipboard: string;
            error: string;
            showDetails: string;
            noStackTrace: string;
            sentToChatGPT: string;
            macOSOnly: string;
            accessibilityRequired: string;
            openSettings: string;
            chatGPTNotInstalled: string;
            activated: string;
            sendFailed: string;
            sendSuccess: string;
            waitingForResponse: string;
            scanError: string;
        };
    };
    errors: {
        accessibilityPermission: string;
        windowActivation: string;
        pasteFailed: string;
        sendButtonNotFound: string;
        responseTimeout: string;
        fileSystem: string;
        outOfMemory: string;
        checkErrorLog: string;
        macOSOnly: string;
        noWorkspace: string;
        noWorkspaceSelected: string;
        outsideWorkspace: string;
        configurationUpdateFailed: string;
    };
}

export type LocaleKey = keyof LocaleMessages;
export type MessagePath = string;

export interface I18nValidator {
    validateMessages(messages: Partial<LocaleMessages>): string[];
    validateMessagePath(path: MessagePath): boolean;
} 