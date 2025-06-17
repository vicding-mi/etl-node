import { Pipeline } from './pipeline/Pipeline';
import { PipelineContextManager } from './pipeline/PipelineContext';
import { DjangoReadStep } from './pipeline/steps/DjangoReadStep';
import { SparqlSelectStep } from './pipeline/steps/SparqlSelectStep';
import { CSVMapStep } from './pipeline/steps/CSVMapStep';
import { XSLTStep } from './pipeline/steps/XSLTStep';
import { CSVtoRDFStep } from './pipeline/steps/CSVtoRDFStep';
import { SparqlConstructStep } from './pipeline/steps/SparqlConstructStep';
import { StepConfig } from './types/StepConfig';
import { readYamlConfig } from './utils/fileUtils';

async function createPipeline(configPath: string): Promise<Pipeline> {
    const config = await readYamlConfig(configPath);
    const contextManager = new PipelineContextManager();
    const pipeline = new Pipeline();

    try {
        for (const stepConfig of config.steps) {
            switch (stepConfig.step) {
                case 'django.read':
                    pipeline.addStep(new DjangoReadStep(stepConfig, contextManager.getAll()));
                    break;
                case 'sparql.select':
                    pipeline.addStep(new SparqlSelectStep(stepConfig, contextManager.getAll()));
                    break;
                case 'csv.map':
                    const subSteps = createSubSteps(stepConfig.subSteps, contextManager);
                    pipeline.addStep(new CSVMapStep(stepConfig, contextManager.getAll(), subSteps));
                    break;
                default:
                    throw new Error(`Unknown step type: ${stepConfig.step}`);
            }
        }

        return pipeline;
    } catch (error) {
        console.error('Failed to create pipeline:', error);
        throw error;
    }
}

function createSubSteps(subStepConfigs: StepConfig[], contextManager: PipelineContextManager): any[] {
    return subStepConfigs.map(config => {
        switch (config.step) {
            case 'xslt':
                return new XSLTStep(config, contextManager.getAll());
            case 'csv-to-rdf':
                return new CSVtoRDFStep(config, contextManager.getAll());
            case 'sparql-construct':
                return new SparqlConstructStep(config, contextManager.getAll());
            default:
                throw new Error(`Unknown sub-step type: ${config.step}`);
        }
    });
}

async function main() {
    try {
        const pipeline = await createPipeline('pipe.yaml');
        const finealResult = await pipeline.execute();
        console.log('Pipeline execution result:', finealResult);
        console.log('Pipeline execution completed successfully');
    } catch (error) {
        console.error('Pipeline execution failed:', error);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { createPipeline, createSubSteps };
