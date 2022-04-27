import { TextDocuments } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { ParserAdapter } from '../../language-service'
import { CucumberLanguageServer } from './CucumberLanguageServer.js'

export function startServer(adapter: ParserAdapter) {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  new CucumberLanguageServer(connection, documents, adapter)
  connection.listen()

  // Don't die on unhandled Promise rejections
  process.on('unhandledRejection', (reason, p) => {
    connection.console.error(
      `CucumberLanguageServer: Unhandled Rejection at promise: ${p}, reason: ${reason}`
    )
  })
}
