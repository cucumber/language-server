#!/usr/bin/env node
const path = require('path')
require('source-map-support').install()
const { startServer } = require('../dist/cjs/src/startServer')

const wasmUrls = {
  java: path.resolve(
    __dirname,
    '..',
    'node_modules/@cucumber/language-service/tree-sitter-java.wasm'
  ),
  typescript: path.resolve(
    __dirname,
    '..',
    'node_modules/@cucumber/language-service/tree-sitter-typescript.wasm'
  ),
}

startServer(wasmUrls)
