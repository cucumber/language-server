import { ParserAdapter } from '@cucumber/language-service'
import { WasmParserAdapter } from '@cucumber/language-service/wasm'
import { PassThrough } from 'stream'
import { TextDocuments } from 'vscode-languageserver'
import { createConnection } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'
import { Files } from './Files'

export type StreamInfo = {
  writer: NodeJS.WritableStream
  reader: NodeJS.ReadableStream
}

export function newWasmServer(wasmBaseUrl: string, makeFiles: (rootUri: string) => Files) {
  const adapter: ParserAdapter = new WasmParserAdapter(wasmBaseUrl)
  const inputStream = new PassThrough()
  const outputStream = new PassThrough()

  const connection = createConnection(inputStream, outputStream)
  const documents = new TextDocuments(TextDocument)
  new CucumberLanguageServer(connection, documents, adapter, makeFiles)
  connection.listen()

  return {
    writer: inputStream,
    reader: outputStream,
  }
}
