#!/usr/bin/env node
import 'source-map-support/register.js'
import path from 'node:path'
import { NodeFiles } from '../dist/src/node/NodeFiles.js'
import { version } from '../dist/src/version.js'
import { startStandaloneServer } from '../dist/src/wasm/startStandaloneServer.js'

const wasmBasePath = path.resolve(
  `${import.meta.dirname}/../node_modules/@cucumber/language-service/dist`
)
const { connection } = startStandaloneServer(wasmBasePath, (rootUri) => new NodeFiles(rootUri))

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `Cucumber Language Server ${version}: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
