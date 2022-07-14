#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('source-map-support').install()
const { startWasmServer } = require('../dist/cjs/src/wasm/startWasmServer')
startWasmServer(`${__dirname}/../node_modules/@cucumber/language-service/dist`)
