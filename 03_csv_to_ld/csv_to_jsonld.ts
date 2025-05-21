import * as fs from 'fs';
import { join } from 'path';
import csv from 'csv-parser';

const BASE_URI = "http://example.globalise.nl/temp";
const csvFile = join('sample_data', 'locations.csv');
const jsonldFile = join('locations.jsonld');

// Get the @type from the command-line arguments
const typeArg = process.argv[2];
if (!typeArg) {
    console.error('Error: Please provide a @type as a command-line argument.');
    process.exit(1);
}

// Function to read the CSV file and convert it to JSON-LD
async function convertCsvToJsonLd(): Promise<void> {
    const data: Record<string, any>[] = [];

    // Read the CSV file
    await new Promise<void>((resolve, reject) => {
        fs.createReadStream(csvFile)
            .pipe(csv())
            .on('data', (row) => {
                data.push(row);
            })
            .on('end', resolve)
            .on('error', reject);
    });

    // Process the data
    const processedData = data.map((item, index) => {
        const filteredItem: Record<string, any> = {};
        Object.entries(item).forEach(([key, value]) => {
            if (value !== '') {
                filteredItem[key] = value;
            }
        });
        filteredItem['@id'] = `${BASE_URI}/places_csv/row_${index + 1}`;
        filteredItem['@type'] = `${BASE_URI}/${typeArg}`;
        return filteredItem;
    });

    // Define the JSON-LD context
    const context: Record<string, string> = {};
    if (data.length > 0) {
        Object.keys(data[0]).forEach((key) => {
            context[key] = `${BASE_URI}/${key}`;
        });
    }

    // Create the JSON-LD structure
    const jsonldData = {
        "@context": context,
        "@graph": processedData,
    };

    // Save the JSON-LD to a file
    fs.writeFileSync(jsonldFile, JSON.stringify(jsonldData, null, 2));
    console.log(`JSON-LD data has been saved to ${jsonldFile}`);
}

// Run the conversion
convertCsvToJsonLd().catch((error) => {
    console.error('Error converting CSV to JSON-LD:', error);
});