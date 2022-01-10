import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'

import { startServer } from './startServer.js'

const connection = createConnection(ProposedFeatures.all)

startServer(connection)

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `CucumberLanguageServer: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
