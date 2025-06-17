import { BaseStep } from './BaseStep';
import { StepConfig } from '../types/StepConfig';
import { writeFile } from '../utils/fileUtils';
import { DataSerializer } from '../utils/serializers';

class Pipeline {
    private steps: BaseStep[] = [];
    private context: Record<string, any> = {};

    constructor(context: Record<string, any> = {}) {
        this.context = context;
    }

    addStep(step: BaseStep): void {
        this.steps.push(step);
    }

    addSteps(steps: BaseStep[]): void {
        this.steps.push(...steps);
    }

    async execute(initialInput: any = null): Promise<any> {
        let result = initialInput;

        try {
            for (const step of this.steps) {
                // Execute the step
                result = await step.execute(result);
                console.log(`Executed step: ${step.constructor.name}`, result);

                // Handle output trace if configured
                if (step.getConfig().outputTrace) {
                    await this.saveTrace(
                        result,
                        step.getConfig().outputTrace,
                        step.constructor.name
                    );
                }

                // Handle output store if configured
                if (step.getConfig().outputStore) {
                    const path = this.resolvePathVariables(
                        step.getConfig().outputStore,
                        this.context
                    );
                    await this.saveOutput(result, path);
                }
            }

            console.log("ttl result: ", result);
            return result;
        } catch (error) {
            console.error('Pipeline execution failed:', error);
            throw error;
        }
    }

    private async saveTrace(
        data: any,
        format: string,
        stepName: string
    ): Promise<void> {
        try {
            const serializer = DataSerializer(format);
            const timestamp = new Date().toISOString();
            const tracePath = `./traces/${stepName}-${timestamp}.${format}`;
            await serializer.save(data, tracePath);
        } catch (error) {
            console.warn(`Failed to save trace for format ${format}:`, error);
        }
    }

    private async saveOutput(data: any, path: string): Promise<void> {
        try {
            await writeFile(path, data);
        } catch (error) {
            console.error(`Failed to save output to ${path}:`, error);
            throw error;
        }
    }

    private resolvePathVariables(
        path: string,
        context: Record<string, any>
    ): string {
        return path.replace(/\{(\$[^}]+)\}/g, (_, key) => {
            const contextKey = key.substring(1);
            return context[contextKey]?.toString() || '';
        });
    }

    getContext(): Record<string, any> {
        return this.context;
    }

    setContext(key: string, value: any): void {
        this.context[key] = value;
    }

    reset(): void {
        this.steps = [];
        this.context = {};
    }
}

export { Pipeline };
