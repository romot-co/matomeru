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

type QueryMatch = { captures: { name: string; node: WebTreeSitterSyntaxNode }[] };
const queryCache = new WeakMap<Language, Map<string, ReturnType<Language['query']>>>();

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
    let workspaceRoot: string | undefined;
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
        if (filePath.startsWith(folder.uri.fsPath)) {
            workspaceRoot = folder.uri.fsPath;
            break;
        }
    }
    if (!workspaceRoot && folders.length > 0) {
        workspaceRoot = folders[0].uri.fsPath;
    }
    
    if (!workspaceRoot) {
        logger.warn('Workspace root not found, resolving paths relative to each file.');
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
            '(import_statement name: (dotted_name) @module)',
            '(import_statement name: (aliased_import original_name:(dotted_name) @module))',
            '(import_from_statement module_name: (dotted_name) @module)',
            '(import_from_statement module_name: (relative_import (import_prefix)+) @dots)',
            '(import_from_statement module_name: (relative_import (import_prefix)+ (dotted_name) @module) @dots)',
            '(import_from_statement module_name: (relative_import (import_prefix)+ (identifier) @module) @dots)',
            '(import_from_statement module_name: (relative_import (import_prefix)+) @dots (import_list (aliased_import (identifier) @item_name)))'
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
        const query = getOrCreateQuery(currentLanguage, importNodesQueryString);
        const matches = query.matches(ast.rootNode);

        for (const match of matches) {
            if (language === 'python') {
                if (handlePythonImportMatch(match as QueryMatch, baseDir, workspaceRoot, dependencies)) {
                    continue;
                }
            }

            const pathNodeCapture = match.captures.find(c => c.name === 'path');
            if (pathNodeCapture) {
                const node: WebTreeSitterSyntaxNode = pathNodeCapture.node;
                let importPath: string = node.text;
                
                if (/^['"`]/.test(importPath) && /['"`]$/.test(importPath)) {
                    importPath = importPath.slice(1, -1);
                }

                if (importPath && importPath.trim() !== '') {
                    if (importPath.startsWith('.')) {
                        const resolvedPath = resolveImportPath(importPath, baseDir);
                        const relativeImport = formatRelativeImport(resolvedPath, workspaceRoot, baseDir);
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

function getOrCreateQuery(language: Language, source: string) {
    let perLanguageCache = queryCache.get(language);
    if (!perLanguageCache) {
        perLanguageCache = new Map();
        queryCache.set(language, perLanguageCache);
    }
    let query = perLanguageCache.get(source);
    if (!query) {
        query = language.query(source);
        perLanguageCache.set(source, query);
    }
    return query;
}

function formatRelativeImport(targetPath: string, workspaceRoot: string | undefined, baseDir: string): string {
    const base = workspaceRoot ?? baseDir;
    const relative = path.relative(base, targetPath) || '.';
    return relative.replace(/\\/g, '/');
}

function handlePythonImportMatch(
    match: QueryMatch,
    baseDir: string,
    workspaceRoot: string | undefined,
    dependencies: Set<string>
): boolean {
    const dotsCapture = match.captures.find(c => c.name === 'dots');
    const moduleCapture = match.captures.find(c => c.name === 'module');
    const itemCapture = match.captures.find(c => c.name === 'item_name');

    if (dotsCapture) {
        const dotCount = dotsCapture.node.text.length;
        const tail = moduleCapture?.node.text ?? itemCapture?.node.text ?? '';
        const segments = Array(dotCount).fill('..');
        if (tail) {
            segments.push(tail);
        }
        const resolvedPath = path.resolve(baseDir, ...segments);
        dependencies.add(formatRelativeImport(resolvedPath, workspaceRoot, baseDir));
        return true;
    }

    if (moduleCapture) {
        const moduleName = moduleCapture.node.text;
        if (!moduleName) {
            return true;
        }
        if (moduleName.startsWith('.')) {
            const resolvedPath = resolveImportPath(moduleName, baseDir);
            dependencies.add(formatRelativeImport(resolvedPath, workspaceRoot, baseDir));
            return true;
        }
        const topLevel = moduleName.split('.')[0];
        dependencies.add(`external:${topLevel}`);
        return true;
    }

    if (itemCapture) {
        const name = itemCapture.node.text;
        if (name) {
            dependencies.add(`external:${name.split('.')[0]}`);
            return true;
        }
    }

    return false;
}
