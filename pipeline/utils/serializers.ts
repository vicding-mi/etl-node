import { Parser as XMLParser, Builder as XMLBuilder } from 'xml2js';

class DataSerializer {
    private xmlParser: XMLParser;
    private xmlBuilder: XMLBuilder;

    constructor() {
        this.xmlParser = new XMLParser({
            explicitArray: false,
            mergeAttrs: true
        });
        this.xmlBuilder = new XMLBuilder({
            rootName: 'root',
            headless: true
        });
    }

    async toJSON(data: any, format: string): Promise<any> {
        try {
            switch (format.toLowerCase()) {
                case 'json':
                    return typeof data === 'string' ? JSON.parse(data) : data;
                case 'xml':
                    return typeof data === 'string' ?
                        await this.xmlParser.parseStringPromise(data) : data;
                case 'csv':
                    return typeof data === 'string' ?
                        this.parseCSV(data) : data;
                default:
                    throw new Error(`Unsupported input format: ${format}`);
            }
        } catch (error) {
            throw new Error(`Serialization error: ${error.message}`);
        }
    }

    async fromJSON(data: any, format: string): Promise<string> {
        try {
            switch (format.toLowerCase()) {
                case 'json':
                    return JSON.stringify(data, null, 2);
                case 'xml':
                    return this.xmlBuilder.buildObject(data);
                case 'csv':
                    return this.toCSV(data);
                default:
                    throw new Error(`Unsupported output format: ${format}`);
            }
        } catch (error) {
            throw new Error(`Deserialization error: ${error.message}`);
        }
    }

    private parseCSV(data: string): any[] {
        const lines = data.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            return headers.reduce((obj: any, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });
    }

    private toCSV(data: any[]): string {
        if (!Array.isArray(data) || data.length === 0) {
            return '';
        }

        const headers = Object.keys(data[0]);
        const headerRow = headers.join(',');
        const rows = data.map(item =>
            headers.map(header => item[header] || '').join(',')
        );

        return [headerRow, ...rows].join('\n');
    }
}

export { DataSerializer };
