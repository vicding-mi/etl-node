interface PipelineContext {
    row?: number;
    timestamp?: string;
    currentStep?: string;
    inputPath?: string;
    outputPath?: string;
    variables: Map<string, any>;
}

class PipelineContextManager {
    private context: PipelineContext;

    constructor(initialContext: Partial<PipelineContext> = {}) {
        this.context = {
            variables: new Map(),
            ...initialContext,
            timestamp: new Date().toISOString()
        };
    }

    set(key: keyof PipelineContext | string, value: any): void {
        if (key in this.context) {
            (this.context as any)[key] = value;
        } else {
            this.context.variables.set(key, value);
        }
    }

    get<T>(key: keyof PipelineContext | string): T | undefined {
        if (key in this.context) {
            return (this.context as any)[key];
        }
        return this.context.variables.get(key);
    }

    getAll(): PipelineContext {
        return {
            ...this.context,
            variables: new Map(this.context.variables)
        };
    }

    clear(): void {
        this.context.variables.clear();
        this.context = {
            variables: new Map(),
            timestamp: new Date().toISOString()
        };
    }

    resolveVariables(template: string): string {
        return template.replace(/\{(\$[^}]+)\}/g, (_, key) => {
            const varKey = key.substring(1);
            const value = this.get(varKey);
            return value?.toString() || '';
        });
    }
}

export { PipelineContext, PipelineContextManager };
