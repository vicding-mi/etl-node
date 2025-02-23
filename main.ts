import fs from 'fs';
import jsonld from 'jsonld';
import {Parser, Writer} from 'n3';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {config} from './config';
import {createLogger, exitOnError, format, transports} from 'winston';

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

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('tableName', {
        alias: 't',
        type: 'string',
        description: 'Name of the table',
        demandOption: false
    })
    .option('recordId', {
        alias: 'r',
        type: 'string',
        description: 'ID of the record',
        demandOption: false
    })
    .argv;

const cliTableName = argv.tableName;
const recordId = argv.recordId;

interface RelatedTables {
    [tableName: string]: {
        distance?: number;
        incoming?: string[];
        outgoing?: string[];
        records?: any[];
    };
}

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

async function getAllEndpoints(): Promise<any> {
    const response = await fetch(apiBaseUrl);
    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
    }
    const tables = await response.json();
    for (const stopTable of config.context.stopTables) {
        delete tables[stopTable];
    }
    return tables;
}

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

export async function fetchRecordById(tableName: string, id: string): Promise<any> {
    const url = joinUrl(apiBaseUrl, tableName.toLowerCase(), id);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Error fetching data: ${response.statusText}`);
    }

    return response.json();
}

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
        throw new Error(`Error fetching ${tableName}: ${response.statusText}, ${url}`);
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

    if (!config.context.middleTables.includes(tableName)) {
        context[tableName] = joinUrl(config.context.baseURI, tableNameWithPrefix);
        for (const k in fields) {
            if (!config.context.uniqueField.includes(k)) {
                context[tableName + "-" + k] = joinUrl(config.context.baseURI, tableNameWithPrefix, k);
            }
        }
    } else {
        const keyTuple = [];
        for (const k in fields) {
            if (!config.context.uniqueField.includes(k)) {
                keyTuple.push([`${k}-${tableName}`, joinUrl(config.context.baseURI, k, tableNameWithPrefix)]);
            }
        }
        context[keyTuple[0][0]] = keyTuple[1][1];
        context[keyTuple[1][0]] = keyTuple[0][1];
    }

    jsonLd["@context"] = context;
    return jsonLd;
}

function isValueInJson(value: string | number | boolean, json: any): boolean {
    if (json === null || typeof json !== 'object') {
        return false;
    }

    for (const key in json) {
        if (json.hasOwnProperty(key)) {
            if (json[key] === value) {
                return true;
            }
            if (typeof json[key] === 'object') {
                if (isValueInJson(value, json[key])) {
                    return true;
                }
            }
        }
    }

    return false;
}

function searchJsonForValue(json: any, value: any, path: string = ''): string {
    if (json === value) {
        return path;
    }

    if (typeof json === 'object' && json !== null) {
        for (const key in json) {
            if (json.hasOwnProperty(key)) {
                const result = searchJsonForValue(json[key], value, path ? `${path}.${key}` : key);
                if (result) {
                    return result;
                }
            }
        }
    }

    return '';
}

function getObjectFromPath(json: any, path: string): any {
    const keys = path.split('.');
    let value = json;

    for (const key of keys) {
        if (value && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }

    return value;
}

function addRecordToGraph(
    jsonLd: JsonLd,
    tableName: string,
    relatedTables: any,
    record: any,
    tablePrefix: string = "django-",
    checkLinkage: boolean = true): JsonLd {
    const graph = jsonLd["@graph"];
    const tableNameWithPrefix = tablePrefix === null || tablePrefix === "" ? tableName : tablePrefix + tableName;
    const recordId = record.id;
    const recordData = {
        "@id": joinUrl(config.context.baseURI, tableNameWithPrefix, recordId),
        "@type": tableName
    };

    if (!config.context.middleTables.includes(tableName)) {
        Object.keys(record).forEach(k => {
            if (!checkLinkage || isValueInJson(recordData["@id"], relatedTables)) {
                if (!config.context.uniqueField.includes(k) && record[k]) {
                    recordData[tableNameWithPrefix + "-" + k] = (relatedTables[tableName].outgoing.includes(k))
                        ? {"@id": joinUrl(config.context.baseURI, k, record[k])}
                        : record[k];
                }
            }
        });
        if (!relatedTables[tableName].records) {
            relatedTables[tableName].records = [];
        }
        relatedTables[tableName].records.push(recordData["@id"]);
        graph.push(recordData);
    } else {
        const keyTuple = [];
        for (const k in record) {
            if (!config.context.uniqueField.includes(k)) {
                keyTuple.push([`${k}-${tableName}`, joinUrl(config.context.baseURI, k, record[k])]);
            }
        }
        const key1: string = keyTuple[0][0];
        const key2: string = keyTuple[1][0];
        const value1 = keyTuple[0][1];
        const value2 = keyTuple[1][1];
        const path1: string = searchJsonForValue(jsonLd, value2);
        const path2: string = searchJsonForValue(jsonLd, value1);
        const obj1 = getObjectFromPath(jsonLd, path1.split(".").slice(0, 2).join("."));
        const obj2 = getObjectFromPath(jsonLd, path2.split(".").slice(0, 2).join("."));
        if (obj1 && obj2) {
            obj1[key1] = {"@id": value1};
            obj2[key2] = {"@id": value2};
        }
    }

    jsonLd["@graph"] = graph;
    return jsonLd;
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

async function getRelatedTables(tableName: string, tables: any): Promise<any> {
    const relatedTables: RelatedTables = {};
    relatedTables[tableName] = {incoming: [], outgoing: []};

    // Add outgoing foreign keys
    const outgoing: string[] = [];
    const tableMetadata = await fetchTableMetadata(tableName);
    for (const relatedTable in tableMetadata.foreign_keys) {
        outgoing.push(relatedTable);
    }
    // relatedTables.tableName.outgoing = outgoing;
    relatedTables[tableName].outgoing = outgoing;

    // Add incoming foreign keys
    const incoming: string[] = [];
    for (const table in tables) {
        const tableMetadata = await fetchTableMetadata(table);
        if (tableMetadata.foreign_keys[tableName]) {
            incoming.push(table);
        }
    }
    relatedTables[tableName].incoming = incoming;

    return relatedTables;
}

const tableNameMap: { [key: string]: string } = {
    "ccode": "countrycode"
    // Add more mappings as needed
};

function replaceTableName(tableName: string): string {


    if (tableName in tableNameMap) {
        logger.info(`Changing table name from ${tableName} to ${tableNameMap[tableName]}`);
        return tableNameMap[tableName];
    }

    return tableName;
}

async function getRelatedTablesWithDistance(tableName: string, tables: any, distance: number, relatedTables: RelatedTables = {}): Promise<RelatedTables> {
    tableName = replaceTableName(tableName);
    if (distance < 1) {
        return relatedTables;
    }

    const currentRelatedTables = await getRelatedTables(tableName, tables);
    logger.info("Current related tables: " + JSON.stringify(currentRelatedTables, null, 2));
    relatedTables[tableName] = currentRelatedTables[tableName];

    logger.info("Current outgoing: " + currentRelatedTables[tableName].outgoing);
    for (const relatedTable of [...currentRelatedTables[tableName].incoming, ...currentRelatedTables[tableName].outgoing]) {
        if (!relatedTables[relatedTable]) {
            await getRelatedTablesWithDistance(relatedTable, tables, distance - 1, relatedTables);
        }
    }

    return relatedTables;
}

async function getLastEntries(dict: any, sliceSize: number): Promise<{ [key: string]: any }> {
    const entries = Object.entries(dict);
    const slice = entries.slice(sliceSize);
    return Object.fromEntries(slice);
}

async function main(tableName: string, distance: number = 1): Promise<void> {
    const tablePrefix: string = "";
    const tables: any = await getAllEndpoints();
    const tableKeys: string[] = Object.keys(tables);
    const relatedTables: RelatedTables = await getRelatedTablesWithDistance(tableName, tables, distance);
    logger.info("Working on " + Object.keys(relatedTables).length + " related tables out of " + tableKeys.length + " related tables with distance " + distance);
    logger.debug(JSON.stringify(relatedTables, null, 2));
    logger.info("Adding to graph");

    // init JSON-LD with context
    let jsonLd = initJsonLd();

    // pre-fetch all the related tables
    const cacheRelatedTables = {};
    for (const relatedTableName of Object.keys(relatedTables)) {
        if (!cacheRelatedTables[relatedTableName]) {
            cacheRelatedTables[relatedTableName] = await fetchTable(relatedTableName);
        }
    }

    // adding records from main tables
    for (const relatedTableName of Object.keys(relatedTables)) {
        if (config.context.mainEntryTables.includes(relatedTableName)) {
            logger.info(`Processing main table: "${relatedTableName}"`);
            const table = cacheRelatedTables[relatedTableName];
            jsonLd = addTableFieldsToContext(jsonLd, relatedTableName, table.metadata.fields, tablePrefix);
            // Every entry in the starting table is a starting point
            for (const record of table.data) {
                jsonLd = addRecordToGraph(jsonLd, relatedTableName, relatedTables, record, tablePrefix, false);
            }
        }

    }

    // resource tables added after main tables, as they depend on the main tables
    for (const relatedTableName of Object.keys(relatedTables)) {
        if (!config.context.mainEntryTables.includes(relatedTableName) && !config.context.stopTables.includes(relatedTableName) && !config.context.middleTables.includes(relatedTableName)) {
            logger.info(`Processing resource table: "${relatedTableName}"`);
            const table = cacheRelatedTables[relatedTableName];
            jsonLd = addTableFieldsToContext(jsonLd, relatedTableName, table.metadata.fields, tablePrefix);
            for (const record of table.data) {
                // TODO: change flase to true after debugging
                jsonLd = addRecordToGraph(jsonLd, relatedTableName, relatedTables, record, tablePrefix, false);
            }
        }
    }

    // middle tables added last, as they depend on both resource tables and main tables
    for (const relatedTableName of Object.keys(relatedTables)) {
        if (config.context.middleTables.includes(relatedTableName)) {
            logger.info(`Processing middle table: "${relatedTableName}"`);
            const table = cacheRelatedTables[relatedTableName];
            jsonLd = addTableFieldsToContext(jsonLd, relatedTableName, table.metadata.fields, tablePrefix);
            for (const record of table.data) {
                // TODO: middle table follow different rules
                jsonLd = addRecordToGraph(jsonLd, relatedTableName, relatedTables, record, tablePrefix);
            }
        }
    }

    saveJsonLdToFile(jsonLd, "output/output.jsonld");
    const turtle = await convertJsonLdToTtl(jsonLd);
    if (validTtl(turtle)) {
        fs.writeFileSync("output/output.ttl", turtle, 'utf8');
    } else {
        logger.error("TTL is not valid");
        process.exit(1);
    }
}

main(cliTableName, 3)
    .then(r => logger.info("Done"));