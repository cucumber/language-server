import { TextDocuments } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { startServer } from './startServer.js'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

startServer(connection, documents)

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `CucumberLanguageServer: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
