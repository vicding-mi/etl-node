# ETL PoC

This repository is a proof of concept for an ETL process for Globalise. The steps in the process are as follows:
1. Go from Django API to LD (in nodejs) (step in folder `01_extraction_from_api`)
2. SPARQL to go to a universal table (via communica) (step in folder `02_sparql_to_csv_comunica`)
3. from csv go to LD (currently in Pythong TODO: convert to nodejs) (step in folder `03_csv_to_ld`)
4. apply the Takin' mapping (per row?) (via XSLT and communica) (TODO: `where?`)
5. result = a graph per row (TODO: `where?`)

## TODO:
- [ ] convert the python code to nodejs
- [ ] add the Takin' mapping
- [ ] workflow system to check: n8n?

