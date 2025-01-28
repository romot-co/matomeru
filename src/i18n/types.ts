export interface LocaleMessages {
    commands: {
        combineDirectory: string;
    };
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
    };
}

export type LocaleKey = keyof LocaleMessages;
export type MessagePath = string;

export interface I18nValidator {
    validateMessages(messages: Partial<LocaleMessages>): string[];
    validateMessagePath(path: MessagePath): boolean;
}

export interface I18nOptions {
    defaultLocale?: string;
    fallbackLocale?: string;
    validateOnInit?: boolean;
} 
