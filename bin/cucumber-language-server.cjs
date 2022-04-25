#!/usr/bin/env node
require('source-map-support').install()
const { startServer } = require('../dist/cjs/src/startServer')
const { NodeParserAdapter } = require('@cucumber/language-service/node')
startServer(new NodeParserAdapter())
