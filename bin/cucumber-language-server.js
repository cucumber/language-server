#!/usr/bin/env node
import 'source-map-support/register.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeFiles } from '../dist/node/NodeFiles.js'
import { version } from '../dist/version.js'
import { startStandaloneServer } from '../dist/wasm/startStandaloneServer.js'

const wasmBasePath = path.dirname(fileURLToPath(import.meta.resolve('@cucumber/language-service')))
const { connection } = startStandaloneServer(wasmBasePath, (rootUri) => new NodeFiles(rootUri))

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `Cucumber Language Server ${version}: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
