import type { LocaleMessages } from '../types';

export const enMessages: Partial<LocaleMessages> = {
    'test.message': 'Test message',
    'test.with.params': 'Hello, {{name}}',
    'chatgpt.integration.error': 'An error occurred in ChatGPT integration',

    // 既存のメッセージ
    'ui.messages.selectDirectory': 'Please select a directory',
    'ui.messages.scanError': 'An error occurred while scanning the directory',
    'ui.messages.sentToChatGPT': 'File contents sent to ChatGPT',
    'ui.messages.chatGPTNotInstalled': 'ChatGPT is not installed',
    'ui.progress.processing': 'Processing files...',

    'success.directory.processed': 'Directory processing completed',
    'error.directory.processing': 'An error occurred while processing the directory',
    'error.platform.unsupported': 'This platform is not supported',
    'error.config.invalid': 'Invalid configuration',
    'config.updated': 'Configuration updated',
    'errors.directoryNotInWorkspace': 'Directory is not in workspace',
    'errors.chatGptIntegrationNotSupported': 'ChatGPT integration is not supported on this platform'
}; 
