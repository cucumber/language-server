#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('source-map-support').install()
const { startWasmServer } = require('../dist/cjs/src/wasm/startWasmServer')
const { NodeFiles } = require('../dist/cjs/src/node/NodeFiles')
const url = require('url')
const wasmBaseUrl = url.pathToFileURL(
  `${__dirname}/../node_modules/@cucumber/language-service/dist`
)
startWasmServer(wasmBaseUrl.href, (rootUri) => new NodeFiles(rootUri))
