import * as vscode from 'vscode';
import * as path from 'path';
import { config } from '@vscode/l10n';

export async function initializeL10n(context: vscode.ExtensionContext): Promise<void> {
  const extensionPath = context.extensionPath;
  const l10nPath = path.join(extensionPath, 'i18n');

  try {
    await config({
      fsPath: l10nPath
    });
  } catch (error) {
    console.error('Failed to load l10n bundle:', error);
  }
} 