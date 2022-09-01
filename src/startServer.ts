import { ParserAdapter } from '@cucumber/language-service'
import { TextDocuments } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'
import { Files } from './Files'
import { version } from './version.js'

export function startServer(adapter: ParserAdapter, files: Files) {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  new CucumberLanguageServer(connection, documents, adapter, files)
  connection.listen()

  // Don't die on unhandled Promise rejections
  process.on('unhandledRejection', (reason, p) => {
    connection.console.error(
      `Cucumber Language Server ${version}: Unhandled Rejection at promise: ${p}, reason: ${reason}`
    )
  })
}
