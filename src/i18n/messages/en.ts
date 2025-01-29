import type { LocaleMessages } from '../types';

export const enMessages: Partial<LocaleMessages> = {
    commands: {
        combineDirectory: 'Combine Directory'
    },
    'test.message': 'Test message',
    'test.with.params': 'Hello, {name}',
    'chatgpt.integration.error': 'An error occurred in ChatGPT integration',
    'ui.messages.selectDirectory': 'Please select a directory',
    'ui.messages.scanError': 'An error occurred while scanning the directory',
    'ui.messages.sentToChatGPT': 'File contents sent to ChatGPT',
    'ui.messages.chatGPTNotInstalled': 'ChatGPT is not installed',
    'ui.progress.processing': 'Processing files...',
    'success.directory.processed': 'Directory processed successfully',
    'error.directory.processing': 'Error processing directory',
    'error.platform.unsupported': 'Platform not supported',
    'error.config.invalid': 'Invalid configuration',
    'config.updated': 'Configuration updated',
    'errors.directoryNotInWorkspace': 'Directory is not in workspace',
    'errors.chatGptIntegrationNotSupported': 'ChatGPT integration is not supported on this platform',
    ui: {
        outputDestination: {
            placeholder: 'Select output destination',
            editor: {
                label: 'Editor',
                description: 'Open in editor'
            },
            clipboard: {
                label: 'Clipboard',
                description: 'Copy to clipboard'
            }
        },
        progress: {
            scanning: 'Scanning...',
            collecting: 'Collecting information...',
            processing: 'Processing files...'
        },
        messages: {
            selectDirectory: 'Please select a directory',
            selectWorkspace: 'Please select a workspace',
            openedInEditor: 'Opened in editor',
            copiedToClipboard: 'Copied to clipboard',
            error: 'An error occurred',
            showDetails: 'Show details',
            noStackTrace: 'No stack trace available',
            sentToChatGPT: 'File contents sent to ChatGPT',
            macOSOnly: 'This feature is only available on macOS',
            accessibilityRequired: 'Accessibility permission required',
            openSettings: 'Open settings',
            chatGPTNotInstalled: 'ChatGPT is not installed',
            activated: 'Activated',
            sendFailed: 'Send failed',
            sendSuccess: 'Send successful',
            waitingForResponse: 'Waiting for response',
            scanError: 'An error occurred while scanning the directory'
        }
    },
    errors: {
        accessibilityPermission: 'Accessibility permission not granted',
        windowActivation: 'Failed to activate window',
        pasteFailed: 'Failed to paste',
        sendButtonNotFound: 'Send button not found',
        responseTimeout: 'Response timeout',
        fileSystem: 'File system error',
        outOfMemory: 'Out of memory',
        checkErrorLog: 'Please check error log',
        macOSOnly: 'This feature is only available on macOS',
        noWorkspace: 'No workspace found',
        noWorkspaceSelected: 'No workspace selected',
        outsideWorkspace: 'Directory is outside workspace',
        configurationUpdateFailed: 'Failed to update configuration'
    }
}; 
