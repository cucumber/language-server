#!/usr/bin/env node
const path = require('path')
require('source-map-support').install()
const { startServer } = require('../dist/cjs/src/startServer')
startServer()
