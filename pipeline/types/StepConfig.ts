export interface BaseStepConfig {
    step: string;
    name?: string;
    description?: string;
    outputTrace?: string;
    outputStore?: string;
}

export interface DjangoReadConfig extends BaseStepConfig {
    step: 'django-read';
    path: string;
    format: 'json' | 'csv' | 'xml';
    encoding?: string;
}

export interface SparqlSelectConfig extends BaseStepConfig {
    step: 'sparql-select';
    endpoint: string;
    query: string;
    format?: 'json' | 'xml';
}

export interface CSVMapConfig extends BaseStepConfig {
    step: 'csv-map';
    inputColumn: string;
    outputColumn: string;
    subSteps: StepConfig[];
}

export interface XSLTConfig extends BaseStepConfig {
    step: 'xslt';
    stylesheet: string;
    parameters?: Record<string, string>;
}

export interface CSVtoRDFConfig extends BaseStepConfig {
    step: 'csv-to-rdf';
    template: string;
    baseURI: string;
    mappings: Record<string, string>;
}

export interface SparqlConstructConfig extends BaseStepConfig {
    step: 'sparql-construct';
    query: string;
    graphURI?: string;
}

export type StepConfig =
    | DjangoReadConfig
    | SparqlSelectConfig
    | CSVMapConfig
    | XSLTConfig
    | CSVtoRDFConfig
    | SparqlConstructConfig;
