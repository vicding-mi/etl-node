import fs from 'fs';
import jsonld from 'jsonld';
import {Writer, Parser} from 'n3';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {config} from './config';
import {createLogger, format, transports} from 'winston';

// Set the log level based on an environment variable or default to 'info'
const logLevel = process.env.LOG_LEVEL || config.logLevel || 'info';

const logger = createLogger({
    level: logLevel,
    format: format.combine(
        format.timestamp(),
        format.printf(({timestamp, level, message}) => {
            return `${timestamp} [${level}]: ${message}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({filename: 'app.log'})
    ]
});

interface JsonLdContext {
    "@vocab": string;
    id: string;
    type: string;
    [key: string]: string;
}

interface JsonLdGraph {
    "@id": string;
    "@type": string;

    [key: string]: any;
}

interface JsonLd {
    "@context": JsonLdContext;
    "@graph": JsonLdGraph[];
}

const apiBaseUrl: string = config.api.baseURL;

// convert JSON-LD to Turtle
async function convertJsonLdToTtl(jsonLd: any): Promise<string> {
    // Expand the JSON-LD
    const expanded = await jsonld.expand(jsonLd);

    // Convert expanded JSON-LD to N-Quads
    const nQuads = await jsonld.toRDF(expanded, {format: 'application/n-quads'});

    // Parse N-Quads and write as Turtle
    const writer = new Writer({format: 'text/turtle'});
    const parser = new Parser({format: 'application/n-quads'});
    const quads = parser.parse(nQuads);
    writer.addQuads(quads);

    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('tableName', {
        alias: 't',
        type: 'string',
        description: 'Name of the table',
        demandOption: true
    })
    .option('recordId', {
        alias: 'r',
        type: 'string',
        description: 'ID of the record',
        demandOption: false
    })
    .argv;

const tableName = argv.tableName;
const recordId = argv.recordId;

export function joinUrl(baseUrl: string, ...paths: string[]): string {
    return [baseUrl, ...paths]
        .map((part, index) => {
            if (index === 0) {
                return part.replace(/\/+$/, '');
            } else {
                return part.replace(/^\/+|\/+$/g, '');
            }
        })
        .filter(part => part.length > 0)
        .join('/');
}

// export async function fetchRecordById(tableName: string, id: string): Promise<any> {
//     const url = joinUrl(apiBaseUrl, tableName.toLowerCase(), id);
//     const response = await fetch(url);
//
//     if (!response.ok) {
//         throw new Error(`Error fetching data: ${response.statusText}`);
//     }
//
//     return response.json();
// }

export async function fetchTableInBatch(tableName: string, page?: number, pageSize?: number): Promise<any> {
    const url = joinUrl(apiBaseUrl, tableName.toLowerCase());
    const params = new URLSearchParams();

    if (page !== undefined) {
        params.append('page', page.toString());
    }

    if (pageSize !== undefined) {
        params.append('page_size', pageSize.toString());
    }

    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
    }

    return response.json();
}

export async function fetchTableRows(tableName: string): Promise<any> {
    let data = [];
    let result;
    let nextURL: string = joinUrl(apiBaseUrl, tableName.toLowerCase());
    while (nextURL !== null) {
        logger.debug("Fetching data from: ", nextURL);
        const response = await fetch(nextURL);
        if (!response.ok) {
            throw new Error(`Error fetching data: ${response.statusText}`);
        }

        result = await response.json();
        data = data.concat(result.results);
        nextURL = result.links.next;
    }

    return data;
}

export async function fetchTableMetadata(tableName: string) {
    const response = await fetchTableInBatch(tableName, 1, 1);
    return response.metadata;
}

export async function fetchTable(tableName: string) {
    const metadata = await fetchTableMetadata(tableName);
    const data = await fetchTableRows(tableName);
    return {
        metadata, data,
        linkedTable: []
    };
}

function initJsonLd() {
    return {
        "@context": {
            "@vocab": config.context.baseURI,
            "id": "@id",
            "type": "@type"
        },
        "@graph": []
    } as JsonLd;
}

function addTableFieldsToContext(jsonLd: JsonLd, tableName: string, fields: any, tablePrefix: string = "django-") {
    const context = jsonLd["@context"];
    const tableNameWithPrefix = tablePrefix === null || tablePrefix === "" ? tableName : tablePrefix + tableName;

    context[tableName] = joinUrl(config.context.baseURI, tableNameWithPrefix);
    for (const k in fields) {
        if (!config.context.uniqueField.includes(k)) {
            context[tableName + "-" + k] = joinUrl(config.context.baseURI, tableNameWithPrefix, k);
        }
    }
    jsonLd["@context"] = context;
    return jsonLd;
}

function addRecordToGraph(jsonLd: JsonLd, tableName: string, metadata: any, record: any, tablePrefix: string = "django-") {
    const graph = jsonLd["@graph"];
    const tableNameWithPrefix = tablePrefix === null || tablePrefix === "" ? tableName : tablePrefix + tableName;
    const recordId = record.id;
    const recordData = {
        "@id": joinUrl(config.context.baseURI, tableNameWithPrefix, recordId),
        "@type": tableName
    };
    Object.keys(record).forEach(k => {
        if (!config.context.uniqueField.includes(k) && record[k] != null) {
            recordData[tableNameWithPrefix + "-" + k] = k in metadata.foreign_keys
                ? {"@id": joinUrl(config.context.baseURI, k, record[k])}
                : record[k];
        }
    });

    graph.push(recordData);
    jsonLd["@graph"] = graph;
    return jsonLd;
}

function validateJsonLd(jsonLd: JsonLd): boolean {
    return true;
    const timespanIds = new Set<string>();

    // Collect all timespan IDs
    for (const item of jsonLd["@graph"]) {
        if (item["@type"] === "timespan") {
            timespanIds.add(item["@id"]);
        }
    }

    // Check if polity-timespan links to a valid timespan ID
    for (const item of jsonLd["@graph"]) {
        if (item["@type"] === "polity" && item["polity-timespan"]) {
            if (!timespanIds.has(item["polity-timespan"])) {
                return false;
            }
        }
    }

    return true;
}

function saveJsonLdToFile(jsonLd: JsonLd, filePath: string): void {
    const jsonString = JSON.stringify(jsonLd, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');
}

function validTtl(ttl: string): boolean {
    const parser = new Parser();
    try {
        parser.parse(ttl);
        return true;
    } catch (error) {
        console.error('Invalid TTL data:', error);
        return false;
    }
}

async function main(): Promise<void> {
    const tablePrefix = "";
    const table = await fetchTable(tableName);

    logger.debug(`Table metadata: ${JSON.stringify(table.metadata, null, 2)}`);
    logger.debug(`Sample data: ${Array.isArray(table.data) ? table.data : []}`);
    // Creating empty JSON LD
    let jsonLd = initJsonLd();
    // adding context
    jsonLd = addTableFieldsToContext(jsonLd, tableName, table.metadata.fields, tablePrefix);
    // adding records
    for (const record of table.data) {
        jsonLd = addRecordToGraph(jsonLd, tableName, table.metadata, record, tablePrefix);
    }
    // finding linked table
    for (const t in table.metadata.foreign_keys) {
        table.linkedTable.push(t);
        let linkedTable = await fetchTable(t);
        jsonLd = addTableFieldsToContext(jsonLd, t, linkedTable.metadata.fields, tablePrefix);
        for (const record of linkedTable.data) {
            jsonLd = addRecordToGraph(jsonLd, t, linkedTable.metadata, record, tablePrefix);
        }
    }
    logger.debug(`Linked table: ${table.linkedTable}`);

    logger.info(`JSON LD context: ${JSON.stringify(jsonLd["@context"], null, 2)}`);
    logger.info(`JSON LD graph: ${JSON.stringify(jsonLd["@graph"].slice(0, 5), null, 2)}`);
    logger.info(`Is JSON-LD valid? ${validateJsonLd(jsonLd)}`);

    // save to json-ld file
    saveJsonLdToFile(jsonLd, `output/${tableName}.jsonld`);

    // convert to turtle
    const turtle = await convertJsonLdToTtl(jsonLd);

    // save to ttl file
    if (validTtl(turtle)) {
        fs.writeFileSync(`output/${tableName}.ttl`, turtle, 'utf8');
    } else {
        logger.error("TTL is not valid");
        process.exit(1);
    }
}

main().catch(error => {
    logger.error("Error:", error);
});
