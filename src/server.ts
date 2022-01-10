import { Connection } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'

const connection = createConnection(ProposedFeatures.all)
let server: CucumberLanguageServer

connection.onInitialize(async (params) => {
  connection.console.info('CucumberLanguageServer initializing...')
  server = await CucumberLanguageServer.create(connection, params)
  connection.console.info('CucumberLanguageServer initialized')
  return {
    capabilities: server.capabilities(),
    serverInfo: server.info(),
  }
})

connection.onInitialized(() => {
  server.initialize()
})

connection.listen()

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `CucumberLanguageServer: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
