import { ParserAdapter } from '@cucumber/language-service'
import { WasmParserAdapter } from '@cucumber/language-service/wasm'
import { PassThrough } from 'stream'
import { TextDocuments } from 'vscode-languageserver'
import { createConnection } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from './CucumberLanguageServer.js'

export type StreamInfo = {
  writer: NodeJS.WritableStream
  reader: NodeJS.ReadableStream
}

export function newWasmServer(wasmBaseUrl: string) {
  const adapter: ParserAdapter = new WasmParserAdapter(wasmBaseUrl)
  const inputStream = new PassThrough()
  const outputStream = new PassThrough()

  const connection = createConnection(inputStream, outputStream)
  const documents = new TextDocuments(TextDocument)
  new CucumberLanguageServer(connection, documents, adapter)
  connection.listen()

  return {
    writer: inputStream,
    reader: outputStream,
  }
}
