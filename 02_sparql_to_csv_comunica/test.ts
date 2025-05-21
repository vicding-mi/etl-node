import {readFileSync} from 'fs';
import {join} from 'path';
import {QueryEngine} from '@comunica/query-sparql';

const myEngine = new QueryEngine();
const queryFilePath = join('sample_data', 'query.sparql');
const sparqlQuery = readFileSync(queryFilePath, 'utf-8');

const result = await myEngine.query(sparqlQuery, {
    sources: ['http://localhost:8080/locations.ttl'],
});

if (result.resultType === 'bindings') {
    const bindingsStream = await result.execute();

    bindingsStream.on('data', (binding) => {
        console.log(binding.toString());
    });
} else {
    const {data} = await myEngine.resultToString(result, 'application/n-triples');
    data.pipe(process.stdout); // Print to standard output
}
