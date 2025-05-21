import { readFileSync, writeFileSync } from 'fs';
import * as graphviz from 'node-graphviz';
import sharp from 'sharp';

interface Relations {
    incoming: string[];
    outgoing: string[];
}

interface JsonData {
    [key: string]: Relations;
}

const colors = [
    "red", "green", "blue", "orange", "purple", "cyan", "magenta", "yellow", "lime", "pink"
];

async function jsonToErGraph(jsonData: JsonData): Promise<void> {
    let dot = 'digraph EntityRelation {\nnode [shape=box];\nrankdir=BT;\nranksep=2.0;\n';
    const entityColors: { [key: string]: string } = {};
    let colorIndex = 0;

    for (const entity in jsonData) {
        const color = colors[colorIndex % colors.length];
        entityColors[entity] = color;
        dot += `"${entity}" [color=${color}];\n`;
        colorIndex++;
    }

    for (const entity in jsonData) {
        const relations = jsonData[entity];
        for (const relatedEntity of relations.incoming) {
            dot += `"${relatedEntity}" -> "${entity}" [color=${entityColors[entity]}, label="in"];\n`;
        }
        for (const relatedEntity of relations.outgoing) {
            dot += `"${entity}" -> "${relatedEntity}" [color=${entityColors[entity]}, label="out"];\n`;
        }
    }

    dot += '}';

    const svgResult = await graphviz.graphviz.layout(dot, 'svg');
    writeFileSync('graph.svg', svgResult);

    await sharp(Buffer.from(svgResult))
        .png()
        .toFile('graph.png');

    console.log('Graph saved as PNG successfully.');
}

const jsonData: JsonData = JSON.parse(readFileSync('distance4.json', 'utf-8'));
jsonToErGraph(jsonData).then(() => {
    console.log('Graph generated successfully.');
}).catch((error) => {
    console.error('Error generating graph:', error);
});
