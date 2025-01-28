export default {
    commands: {
        combineDirectory: 'Combine Directory Contents'
    },
    ui: {
        outputDestination: {
            placeholder: 'Select Output Destination',
            editor: {
                label: 'Open in Editor',
                description: 'Open the combined content in a new editor'
            },
            clipboard: {
                label: 'Copy to Clipboard',
                description: 'Copy the combined content to clipboard'
            }
        },
        progress: {
            scanning: 'Scanning directory...',
            collecting: 'Collecting file contents...',
            processing: 'Processing files...'
        },
        messages: {
            selectDirectory: 'Please select a directory',
            openedInEditor: 'Combined content opened in editor',
            copiedToClipboard: 'Combined content copied to clipboard',
            error: 'An error occurred: {0}',
            showDetails: 'Show Details',
            noStackTrace: 'No stack trace available',
            sentToChatGPT: 'Content sent to ChatGPT',
            macOSOnly: 'This feature is only available on macOS',
            accessibilityRequired: 'Accessibility permission required',
            openSettings: 'Open Settings',
            chatGPTNotInstalled: 'ChatGPT desktop app is not installed',
            activated: 'Matomeru activated',
            sendFailed: 'Failed to send to ChatGPT: {0}',
            sendSuccess: 'Successfully sent to ChatGPT',
            waitingForResponse: 'Waiting for ChatGPT response...',
            scanError: 'Failed to scan directory: {0}'
        }
    },
    errors: {
        accessibilityPermission: 'Accessibility permission is required to interact with ChatGPT',
        windowActivation: 'Failed to activate ChatGPT window',
        pasteFailed: 'Failed to paste content to ChatGPT',
        sendButtonNotFound: 'Send button not found in ChatGPT window',
        responseTimeout: 'Timeout waiting for ChatGPT response',
        fileSystem: 'A file system error occurred',
        outOfMemory: 'Out of memory error occurred',
        invalidPath: 'Invalid file path',
        symlink: 'Failed to process symbolic link',
        parallel: 'Error occurred during parallel processing'
    }
}; 