import path from 'path';
import * as fs from 'fs';
import type { Parser as WebTreeSitterParser, Language, Tree as WebTreeSitterTree } from 'web-tree-sitter'; 
type WebTreeSitterSyntaxNode = WebTreeSitterTree['rootNode'];

import * as vscode from 'vscode'; // vscode API を使用するためインポート
import { ParserManager } from '../services/parserManager'; // ParserManager をインポート
import { getExtensionContext } from '../extension'; // getExtensionContext をインポート


const logger = {
    warn: (message: string, ...optionalParams: any[]) => console.warn(`[DependencyScanner] ${message}`, ...optionalParams),
    error: (message: string, ...optionalParams: any[]) => console.error(`[DependencyScanner] ${message}`, ...optionalParams),
};

export async function scanDependencies(
    filePath: string, 
    content: string, 
    language: string
): Promise<string[]> {
    const dependencies = new Set<string>();
    const baseDir = path.dirname(filePath);

    const ctx = getExtensionContext();
    const parser: WebTreeSitterParser | null = await ParserManager.getInstance(ctx).getParser(language);

    if (!parser) {
        logger.warn(`Failed to get parser for language: ${language} in ${filePath}`);
        return [];
    }

    // ファイルのワークスペースルートを動的に検出
    let workspaceRoot = '';
    if (vscode.workspace.workspaceFolders) {
        for (const folder of vscode.workspace.workspaceFolders) {
            if (filePath.startsWith(folder.uri.fsPath)) {
                workspaceRoot = folder.uri.fsPath;
                break;
            }
        }
        if (!workspaceRoot && vscode.workspace.workspaceFolders.length > 0) {
            workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
    }
    
    if (!workspaceRoot) {
        logger.warn('Workspace root not found, cannot resolve relative paths accurately.');
    }

    let ast: WebTreeSitterTree | null;
    try {
        ast = parser.parse(content);
        if (!ast) {
            return [];
        }
    } catch (error) {
        logger.error(`Error parsing ${language} file ${filePath}:`, error);
        return [];
    }

    let importNodesQueryString = '';
    if (language === 'typescript' || language === 'javascript' || language === 'tsx' || language === 'jsx') {
        const tsJsPatterns = [
            '(import_statement source: (string) @path)',
            '(dynamic_import_expression argument: (string) @path)',
            '(call_expression function: (identifier) @func (#eq? @func "require") arguments: (arguments (string) @path))',
            '(export_statement source: (string) @path)'
        ];
        importNodesQueryString = '[\n' + tsJsPatterns.join('\n') + '\n]';
    } else if (language === 'python') {
        const pythonPatterns = [
            '(import_statement name: (dotted_name (identifier) @path) @import_stmt)', 
            '(import_statement name: (aliased_import original_name:(dotted_name (identifier) @path)) @import_stmt)',
            '(import_from_statement module_name: (dotted_name (identifier) @path) @import_from_stmt)',
            '(import_from_statement module_name: (relative_import (import_prefix)* (identifier)? @path) @import_from_stmt)', 
            '(import_from_statement module_name: (relative_import (import_prefix)+ @dots) (import_list (aliased_import (identifier) @item_name)))@import_from_relative_item'
        ];
        importNodesQueryString = '[\n' + pythonPatterns.join('\n') + '\n]';
    } else if (language === 'go') {
        importNodesQueryString = '[(import_declaration path: (interpreted_string_literal) @path)]';
    }

    if (!importNodesQueryString) {
        logger.warn(`No query string defined for language: ${language}`);
        return [];
    }

    try {
        const currentLanguage: Language | null = parser.language;
        if (!currentLanguage) {
            logger.error(`Parser for ${language} does not have a language properly set.`);
            return [];
        }
        const query = currentLanguage.query(importNodesQueryString);
        const matches = query.matches(ast.rootNode);

        for (const match of matches) {
            const pathNodeCapture = match.captures.find(c => c.name === 'path' || c.name === 'dots' || c.name ==='item_name');
            if (pathNodeCapture) {
                const node: WebTreeSitterSyntaxNode = pathNodeCapture.node;
                let importPath: string = node.text;
                
                if (/^['"`]/.test(importPath) && /['"`]$/.test(importPath)) {
                    importPath = importPath.slice(1, -1);
                }

                if (language === 'python') {
                    const captureName = pathNodeCapture.name;
                    if (captureName === 'dots') {
                        const dotCount = node.text.length;
                        const itemNameCapture = match.captures.find(c => c.name === 'item_name');
                        const rest = itemNameCapture ? itemNameCapture.node.text : '';
                        const resolvedPath = path.resolve(baseDir, '../'.repeat(dotCount), rest);
                        const relativeImport = path.relative(workspaceRoot, resolvedPath);
                        dependencies.add(relativeImport.replace(/\\/g, '/'));
                        continue;
                    } else if (node.parent && node.parent.type === 'relative_import') {
                        const parent = node.parent;
                        let dotCount = 0;
                        for (const child of parent.children) {
                            if (child && (child as any).type === 'import_prefix') dotCount++;
                        }
                        const resolvedPath = path.resolve(baseDir, '../'.repeat(dotCount), importPath);
                        const relativeImport = path.relative(workspaceRoot, resolvedPath);
                        dependencies.add(relativeImport.replace(/\\/g, '/'));
                        continue;
                    } else if (importPath.includes('.') && !importPath.startsWith('.')) {
                        dependencies.add(`external:${importPath.split('.')[0]}`);
                        continue;
                    } else {
                        dependencies.add(`external:${importPath}`);
                        continue;
                    }
                }

                if (importPath && importPath.trim() !== '') {
                    if (importPath.startsWith('.')) {
                        const resolvedPath = resolveImportPath(importPath, baseDir);
                        let relativeImport = path.relative(workspaceRoot, resolvedPath);
                        relativeImport = relativeImport.replace(/\\/g, '/');
                        dependencies.add(relativeImport);
                    } else {
                        dependencies.add(`external:${importPath}`);
                    }
                }
            }
        }
    } catch (error) {
        logger.error(`Error executing Tree-sitter query for ${language} in ${filePath}: Query=\n${importNodesQueryString}`, error);
    }
    return Array.from(dependencies);
}

function resolveImportPath(importPath: string, baseDir: string): string {
    if (path.extname(importPath)) {
        return path.resolve(baseDir, importPath);
    }

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go'];
    for (const ext of extensions) {
        const candidate = path.resolve(baseDir, importPath + ext);
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return path.resolve(baseDir, importPath);
}
