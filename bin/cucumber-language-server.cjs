#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('source-map-support').install()
const { startStandaloneServer } = require('../dist/cjs/src/wasm/startStandaloneServer')
const { NodeFiles } = require('../dist/cjs/src/node/NodeFiles')
const path = require('path')
const { version } = require('../dist/cjs/src/version')

// Use require.resolve so this works regardless of whether npm hoisted
// @cucumber/language-service or installed it nested inside our node_modules.
// Main CJS entry is dist/cjs/src/index.js — go up two dirs to reach dist/.
const wasmBasePath = path.join(path.dirname(require.resolve('@cucumber/language-service')), '../..')
const { connection } = startStandaloneServer(wasmBasePath, (rootUri) => new NodeFiles(rootUri))

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `Cucumber Language Server ${version}: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
