import { Connection } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'

const connection: Connection = createConnection(ProposedFeatures.all)

connection.onInitialize(async (params) => {
  const server = await CucumberLanguageServer.create(connection, params)
  return server.initializeResult()
})

connection.listen()
