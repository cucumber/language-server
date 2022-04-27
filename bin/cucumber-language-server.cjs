#!/usr/bin/env node
require('source-map-support').install()
const { startNodeServer } = require('../dist/cjs/src/node/startNodeServer')
startNodeServer()
