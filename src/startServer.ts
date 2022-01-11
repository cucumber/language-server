import { Connection, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from './CucumberLanguageServer'
import { ExpressionBuilder } from './tree-sitter'

export function startServer(connection: Connection, documents: TextDocuments<TextDocument>) {
  const server = new CucumberLanguageServer(connection, documents)
  connection.listen()

  connection.onInitialize(async (params) => {
    connection.console.info('CucumberLanguageServer initializing...')

    const expressionBuilder = new ExpressionBuilder()
    await expressionBuilder.init({
      // Relative to dist/src/cjs
      java: `${__dirname}/../../../tree-sitter-java.wasm`,
      typescript: `${__dirname}/../../../tree-sitter-typescript.wasm`,
    })

    server.initialize(params, expressionBuilder)
    connection.console.info('CucumberLanguageServer initialized')
    return {
      capabilities: server.capabilities(),
      serverInfo: server.info(),
    }
  })

  connection.onInitialized(() => {
    console.log('onInitialized')
  })
}
