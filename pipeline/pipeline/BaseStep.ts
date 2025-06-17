import { StepConfig } from '../types/StepConfig';

abstract class BaseStep {
    protected config: StepConfig;
    protected context: Record<string, any>;

    constructor(config: StepConfig, context: Record<string, any> = {}) {
        this.config = config;
        this.context = context;
    }

    abstract execute(input: any): Promise<any>;

    getConfig(): StepConfig {
        return this.config;
    }

    protected resolvePathVariables(path: string): string {
        return path.replace(/\{(\$[^}]+)\}/g, (_, key) => {
            const contextKey = key.substring(1);
            return this.context[contextKey]?.toString() || '';
        });
    }

    protected validateConfig(requiredFields: string[]): void {
        for (const field of requiredFields) {
            if (!(field in this.config)) {
                throw new Error(`Missing required configuration field: ${field}`);
            }
        }
    }

    setContext(key: string, value: any): void {
        this.context[key] = value;
    }

    getContext(): Record<string, any> {
        return this.context;
    }

    protected async handleError(error: Error, stepName: string): Promise<never> {
        console.error(`Error in ${stepName}:`, error);
        throw new Error(`${stepName} execution failed: ${error.message}`);
    }
}

export { BaseStep };
