import axios from 'axios';
import {convertJsonToTtl} from '../../utils/convertJsonLdToTtl'

export class DjangoReadStep {
    constructor(private config: any) {
    }

    async execute(): Promise<any> {
        try {
            // Replace placeholders in the endpoint URL with entity values
            const endpoint = this.replacePlaceholders(this.config.endpoint, this.config.entity);

            // Fetch data from the Django API
            const response = await axios.get(endpoint);

            // Handle output-trace (e.g., convert response to the desired format)
            if (this.config['output-trace'] === 'ttl') {
                // TODO: Implement conversion to TTL format if required
                console.log('Output trace format is TTL. Conversion logic goes here.');
                return convertJsonToTtl(response.data)
            } else {
                // Handle other output formats or default case
                console.log('Output trace format is not TTL. Returning raw data.');
            }

            return response.data;
        } catch (error) {
            console.error('Error executing DjangoReadStep:', error.message);
            throw error;
        }
    }

    getConfig(): any {
        return this.config;
    }

    private replacePlaceholders(url: string, entity: Record<string, string>): string {
        return url.replace(/{(\w+)}/g, (_, key) => {
            if (entity[key] === undefined) {
                throw new Error(`Missing value for placeholder: ${key}`);
            }
            return entity[key];
        });
    }
}

// Example usage:
// const step = new DjangoReadStep({
//     endpoint: 'http://localhost:8000/api/locations/{id}/',
//     entity: { id: '123' },
//     'output-trace': 'ttl'
// });
// step.execute().then(data => {
//     console.log('Fetched data:', data);
// }).catch(error => {
//     console.error('Error:', error);
// });
