import { DirectoryInfo, FileInfo } from '../types/fileTypes';
import { DirectoryStructure } from '../directoryStructure';
import * as vscode from 'vscode';
import { stripComments } from '../utils/compressUtils';
import { getExtensionContext } from '../extension';
import { Logger } from '../utils/logger';
import { IGenerator } from './IGenerator';
import { YamlGenerator } from './YamlGenerator';
import yaml from 'js-yaml';

const logger = Logger.getInstance('MarkdownGenerator');

const MERMAID_GRAPH_START_COMMENT = '<!-- matomeru:auto-graph:start -->';
const MERMAID_GRAPH_END_COMMENT = '<!-- matomeru:auto-graph:end -->';

export class MarkdownGenerator implements IGenerator {
    constructor(
        private readonly directoryStructure: DirectoryStructure = new DirectoryStructure(),
        private readonly yamlGenerator: YamlGenerator = new YamlGenerator()
    ) {}

    private escapeMermaidLabel(label: string): string {
        return label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    async generate(directories: DirectoryInfo[]): Promise<string> {
        if (!directories.length) {
            return '';
        }

        const config = vscode.workspace.getConfiguration('matomeru');
        logger.debug('--- MarkdownGenerator Config Check ---');
        logger.debug(`matomeru.markdown.prefixText: ${config.get<string>('markdown.prefixText')}`);
        logger.debug(`matomeru.includeDependencies: ${config.get<boolean>('includeDependencies')}`);
        logger.debug(`matomeru.mermaid.maxNodes: ${config.get<number>('mermaid.maxNodes')}`);

        let finalMarkdown = '';

        const prefixText = config.get<string>('prefixText', '');
        if (prefixText) {
            logger.debug('Applying prefixText: ' + prefixText.substring(0, 50) + (prefixText.length > 50 ? '...' : ''));
            finalMarkdown += prefixText + '\n';
        }

        if (config.get<boolean>('includeDependencies')) {
            logger.debug('Attempting to generate Mermaid graph...');
            try {
                const mermaidGraphString = await this.generateMermaidGraph(directories, config);
                logger.debug('Generated mermaidGraphString: ' + (mermaidGraphString ? mermaidGraphString.substring(0, 100) + '...' : 'EMPTY_GRAPH'));
                if (mermaidGraphString) {
                    finalMarkdown += MERMAID_GRAPH_START_COMMENT + '\n';
                    finalMarkdown += '```mermaid\n';
                    finalMarkdown += mermaidGraphString + '\n';
                    finalMarkdown += '```\n';
                    finalMarkdown += MERMAID_GRAPH_END_COMMENT + '\n';
                    finalMarkdown += '---\n'; 
                }
            } catch (error) {
                logger.error(`Failed to generate Mermaid graph: ${error instanceof Error ? error.message : String(error)}`);
                logger.error(`Error during generateMermaidGraph: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else {
            logger.debug('Skipping Mermaid graph generation (includeDependencies is false).');
        }
        
        const coreContentSections: string[] = [];
        coreContentSections.push(this.directoryStructure.generate(directories));
        coreContentSections.push('\n# File Contents\n');
        
        const allFiles = this.getAllFiles(directories);
        for (const file of allFiles) {
            coreContentSections.push(await this.generateFileSection(file));
        }
        let coreMarkdown = coreContentSections.join('\n');

        const oldGraphRegex = new RegExp(
            MERMAID_GRAPH_START_COMMENT +
            '[\\s\\S]*?' + 
            MERMAID_GRAPH_END_COMMENT +
            '(?:\\n---\\n)?', 
            'g'
        );
        coreMarkdown = coreMarkdown.replace(oldGraphRegex, '').trim();
        
        finalMarkdown += coreMarkdown;
        
        // eslint-disable-next-line no-console
        // logger.debug('Final markdown output (first 200 chars):\n' + finalMarkdown.substring(0,200));

        return finalMarkdown;
    }

    private getAllFiles(directories: DirectoryInfo[]): FileInfo[] {
        const result: FileInfo[] = [];
        for (const dir of directories) {
            this.collectFiles(dir, result);
        }
        return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    }

    private collectFiles(dir: DirectoryInfo, result: FileInfo[]): void {
        result.push(...dir.files);
        for (const subDir of dir.directories.values()) {
            this.collectFiles(subDir, result);
        }
    }

    private async generateFileSection(file: FileInfo): Promise<string> {
        const sections: string[] = [];

        sections.push(`## ${file.relativePath}\n`);

        sections.push(`- Size: ${this.formatFileSize(file.size)}`);
        sections.push(`- Language: ${file.language}\n`);

        const config = vscode.workspace.getConfiguration('matomeru');
        let content = file.content;
        
        if (config.get('enableCompression')) {
            try {
                const ctx = getExtensionContext();
                content = await stripComments(file.content, file.language, ctx);
                
                if (content !== file.content) {
                    logger.info(`Compressed content for ${file.relativePath}`);
                }
            } catch (error) {
                logger.error(`Failed to compress content: ${error}`);
            }
        }

        sections.push('```' + file.language);
        sections.push(content);
        sections.push('```\n');

        return sections.join('\n');
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        const formattedSize = size % 1 === 0 ? size.toFixed(0) : size.toFixed(1);
        return `${formattedSize} ${units[unitIndex]}`;
    }

    private async generateMermaidGraph(directories: DirectoryInfo[], config: vscode.WorkspaceConfiguration): Promise<string> {
        // eslint-disable-next-line no-console
        // logger.debug('generateMermaidGraph called with config for includeDependencies: ' + config.get('includeDependencies'));
        const yamlString = await this.yamlGenerator.generate(directories);
        // eslint-disable-next-line no-console
        // logger.debug('yamlGenerator.generate returned (first 100 chars): ' + (typeof yamlString === 'string' ? yamlString.substring(0,100) + '...' : yamlString));
        const parsedYaml: any = yaml.load(yamlString);
        // eslint-disable-next-line no-console
        // logger.debug('Parsed YAML dependencies (type): ' + typeof parsedYaml?.dependencies + ' Value: ' + (parsedYaml?.dependencies ? JSON.stringify(parsedYaml.dependencies).substring(0,100) + '...' : 'N/A'));


        if (!parsedYaml || typeof parsedYaml.dependencies !== 'object' || parsedYaml.dependencies === null) {
            // eslint-disable-next-line no-console
            // logger.debug('No valid dependencies found in parsed YAML, returning empty graph.');
            return '';
        }

        const dependencies: { [key: string]: string[] } = parsedYaml.dependencies;
        const maxNodes = config.get<number>('mermaid.maxNodes', 300);
        
        const graphLines: string[] = ['flowchart TD'];
        const nodes = new Set<string>();
        const edges: { from: string, to: string }[] = [];

        for (const sourceFile in dependencies) {
            const escapedSource = this.escapeMermaidLabel(sourceFile);
            nodes.add(escapedSource);
            for (const targetFile of dependencies[sourceFile]) {
                const escapedTarget = this.escapeMermaidLabel(targetFile);
                nodes.add(escapedTarget);
                edges.push({ from: escapedSource, to: escapedTarget });
            }
        }
        // eslint-disable-next-line no-console
        // logger.debug(`Mermaid: Calculated ${nodes.size} nodes, ${edges.length} edges. Max nodes: ${maxNodes}`);

        let truncated = false;
        if (nodes.size > maxNodes) {
            truncated = true;
        }

        if (truncated) {
            graphLines.push(`    subgraph Warning [Warning: Mermaid graph truncated.]\n    direction LR\n    truncated_message["The number of nodes (${nodes.size}) exceeds the configured limit (${maxNodes})."]
    end`);
        }
        
        for (const edge of edges) {
            if (graphLines.length -1 >= maxNodes && truncated && !graphLines.some(line => line.includes('more dependencies linked here...'))) {
                 graphLines.push(`    "..."["Truncated due to node limit (${maxNodes})...\n...more dependencies linked here..."]`);
                 break;
            }
            graphLines.push(`    "${edge.from}" --> "${edge.to}"`);
        }
        
        if (graphLines.length === 1 && Object.keys(dependencies).length === 0 && nodes.size === 0) {
            return '';
        }
        
        return graphLines.join('\n');
    }
} 