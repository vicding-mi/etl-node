import { promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { StepConfig } from '../types/StepConfig';

interface PipelineConfig {
    steps: StepConfig[];
}

async function readYamlConfig(filePath: string): Promise<PipelineConfig> {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const config = yaml.load(fileContent) as PipelineConfig;
        validateConfig(config);
        return config;
    } catch (error) {
        throw new Error(`Failed to read YAML config: ${error.message}`);
    }
}

function validateConfig(config: any): asserts config is PipelineConfig {
    if (!config || !Array.isArray(config.steps)) {
        throw new Error('Invalid pipeline configuration: missing or invalid steps array');
    }
}

async function writeFile(filePath: string, data: any): Promise<void> {
    try {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        if (typeof data === 'string') {
            await fs.writeFile(filePath, data, 'utf8');
        } else {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        }
    } catch (error) {
        throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
}

async function readFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
}

export { readYamlConfig, writeFile, readFile, ensureDirectoryExists };
