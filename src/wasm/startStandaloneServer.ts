import { WasmParserAdapter } from '@cucumber/language-service/wasm'
import { TextDocuments } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from '../CucumberLanguageServer.js'
import type { Files } from '../Files.js'

export function startStandaloneServer(wasmBaseUrl: string, makeFiles: (rootUri: string) => Files) {
  const adapter = new WasmParserAdapter(wasmBaseUrl)
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  new CucumberLanguageServer(connection, documents, adapter, makeFiles, () => undefined)
  connection.listen()

  return {
    connection,
  }
}
