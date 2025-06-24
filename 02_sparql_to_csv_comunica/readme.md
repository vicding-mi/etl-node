# Comunica

## how to run comunica using command line
Two ways to run the sparql query using Comunica:
1. Using the command line
2. Using a Typescript file

Each tested below:

### Install Comunica
```bash
npm install -g @comunica/actor-query-sparql
```

### Run webserver
Make sure that the `locations.ttl` and `query.sparql` files are in the folder `sample_data/`.
```bash
docker compose up -d
```

### Run SPARQL query
```bash
comunica-sparql http://localhost:8080/locations.ttl -f sample_data/query.sparql
```


## how to run comunica using TS
### Install Comunica
```bash
npm install @comunica/actor-query-sparql
```

### Run webserver
Make sure that the `locations.ttl` and `query.sparql` files are in the folder `sample_data/`.
```bash
docker compose up -d
```

### Run the `test.ts` file
```bash
npx tsx test.ts
```

## how to run comunica with docker
```shell
docker run -it --rm \
  -v $(pwd)/sample_data:/data \
  comunica/comunica-sparql \
  /data/locations.ttl -f /data/query.sparql
```

```shell
docker run -it --rm comunica/query-sparql \
  https://fragments.dbpedia.org/2015-10/en \
  "CONSTRUCT WHERE { ?s ?p ?o } LIMIT 100"
```
