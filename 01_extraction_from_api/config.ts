export const config = {
    logLevel: 'info',
    logFile: "app.log",
    outputDir: "output",
    outputJsonLd: "output.jsonld",
    outputRdf: "output.ttl",
    api: {
        baseURL: "http://localhost/api"
    },
    context: {
        baseURI: "http://example.globalise.nl/temp",
        uniqueField: ["id", "@type"],
        stopTables: ["logentry", "permission", "group", "user", "contenttype", "session", "postgisgeometrycolumns", "postgisspatialrefsys", "places"],
        middleTables: ["timespan2source", "polity2source", "politylabel2source"," rulership2source",
            "rulershiplabel2source", "rulergender2source", "ruler2source", "rulerlabel2source",
            "reign2source", "location2countrycode", "location2coordsource", "location2source",
            "location2externalid", "location2type", "locationtype2source", "locationlabel2source",
            "locationpartof2source", "shiplabel2source", "ship2externalid", "ship2type",
            "ship2source", "event2source", "event2location", "translocation2externalid",
            "translocation2source", "translocation2location", "locationlabel"
        ],
        mainEntryTables: ["polity", "politylabel", "reign", "ruler", "rulership", "rulershiplabel", "rulerlabel",
            "shiplabel", "location", "event", "translocation"],
        notSure: ["locationpartof"]
    },
}