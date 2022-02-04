#!/usr/bin/env node
require('source-map-support').install()
const startServer = require('../dist/cjs/src/startServer')

const wasmUrls = {
  java: `node_modules/@cucumber/language-service/tree-sitter-java.wasm`,
  typescript: `node_modules/@cucumber/language-service/tree-sitter-typescript.wasm`,
}

startServer(wasmUrls)
