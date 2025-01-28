import { LocaleMessages } from './types';

export const en: Partial<LocaleMessages> = {
	commands: {
		combineDirectory: 'Combine Directory'
	},
	ui: {
		outputDestination: {
			placeholder: 'Select Output Destination',
			editor: {
				label: 'Editor',
				description: 'Open in New Editor'
			},
			clipboard: {
				label: 'Clipboard',
				description: 'Copy to Clipboard'
			}
		},
		progress: {
			scanning: 'Scanning...',
			collecting: 'Collecting Files...',
			processing: 'Processing...'
		},
		messages: {
			selectDirectory: 'Please select a directory',
			openedInEditor: 'Opened in Editor',
			copiedToClipboard: 'Copied to Clipboard',
			error: 'An error occurred',
			showDetails: 'Show Details',
			noStackTrace: 'No stack trace available',
			sentToChatGPT: 'Sent to ChatGPT',
			macOSOnly: 'This feature is only available on macOS',
			accessibilityRequired: 'Accessibility permissions required',
			openSettings: 'Open Settings',
			chatGPTNotInstalled: 'ChatGPT is not installed',
			activated: 'Extension activated',
			sendFailed: 'Send failed: {0}',
			sendSuccess: 'Send successful',
			waitingForResponse: 'Waiting for ChatGPT response...',
			scanError: 'Failed to scan directory: {0}'
		}
	},
	errors: {
		accessibilityPermission: 'Accessibility permissions required',
		windowActivation: 'Failed to activate ChatGPT window',
		pasteFailed: 'Failed to paste from clipboard',
		sendButtonNotFound: 'Send button not found',
		responseTimeout: 'Response timeout'
	}
}; 