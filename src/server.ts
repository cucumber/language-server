import { Connection } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'

const connection: Connection = createConnection(ProposedFeatures.all)

connection.onInitialize(async (params) => {
  console.log('initializing')
  const server = await CucumberLanguageServer.create(connection, params)
  console.log('initialize')
  return server.initializeResult()
})

connection.onInitialized(() => {
  console.log('initialized')
})

connection.listen()
