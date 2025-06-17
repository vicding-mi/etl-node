import { Writer } from 'n3';

// convert JSON-LD to Turtle
// export async function convertJsonLdToTtl(jsonLd: any): Promise<string> {
//     // Expand the JSON-LD
//     console.log("jsonLd: ", jsonLd);
//     const expanded = await jsonld.expand(jsonLd);
//     console.log("expanded: ", expanded);
//
//     // Convert expanded JSON-LD to N-Quads
//     const nQuads = await jsonld.toRDF(expanded, {format: 'application/n-quads'});
//
//     // Parse N-Quads and write as Turtle
//     const writer = new Writer({format: 'text/turtle'});
//     const parser = new Parser({format: 'application/n-quads'});
//     const quads = parser.parse(nQuads);
//     console.log("quads: ", quads);
//     writer.addQuads(quads);
//
//     return new Promise((resolve, reject) => {
//         writer.end((error, result) => {
//             if (error) {
//                 reject(error);
//             } else {
//                 resolve(result);
//             }
//         });
//     });
// }
//
// import { Writer } from 'n3';

export async function convertJsonToTtl(json: any): Promise<string> {
    const writer = new Writer({ format: 'text/turtle' });

    // Example: treat each top-level key as a subject
    for (const subjectKey of Object.keys(json)) {
        const subject = `:${subjectKey}`;
        const properties = json[subjectKey];

        for (const predicateKey of Object.keys(properties)) {
            const predicate = `:${predicateKey}`;
            const objectValue = properties[predicateKey];

            // Handle arrays and single values
            if (Array.isArray(objectValue)) {
                for (const value of objectValue) {
                    writer.addQuad(subject, predicate, literalOrResource(value));
                }
            } else {
                writer.addQuad(subject, predicate, literalOrResource(objectValue));
            }
        }
    }

    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

function literalOrResource(value: any) {
    if (typeof value === 'string' && value.startsWith('http')) {
        return { id: `<${value}>` };
    }
    return `"${value}"`;
}