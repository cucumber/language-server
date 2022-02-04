import { WasmUrls } from '@cucumber/language-service'
import { TextDocuments } from 'vscode-languageserver'
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

const wasmUrls: WasmUrls = {
  java: `tree-sitter-java.wasm`,
  typescript: `tree-sitter-typescript.wasm`,
}

new CucumberLanguageServer(connection, documents, wasmUrls)
connection.listen()

// Don't die on unhandled Promise rejections
process.on('unhandledRejection', (reason, p) => {
  connection.console.error(
    `CucumberLanguageServer: Unhandled Rejection at promise: ${p}, reason: ${reason}`
  )
})
