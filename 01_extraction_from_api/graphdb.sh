#!/usr/bin/env bash

docker run -d -p 7200:7200 --name graphdb -t ontotext/graphdb:10.8.0
