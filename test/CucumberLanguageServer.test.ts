import assert from 'assert'
import { Duplex } from 'stream'
import { Logger, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'
import {
  CompletionItem,
  Connection,
  createProtocolConnection,
  DidChangeConfigurationNotification,
  DidChangeConfigurationParams,
  InitializeParams,
  InitializeRequest,
  ProtocolConnection,
  TextDocuments,
} from 'vscode-languageserver'
import { createConnection } from 'vscode-languageserver/node'
import {
  CompletionParams,
  CompletionRequest,
} from 'vscode-languageserver-protocol/lib/common/protocol'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { CucumberLanguageServer } from '../src/CucumberLanguageServer.js'
import { startServer } from '../src/startServer'
import { Settings } from '../src/types'

describe.only('CucumberLanguageServer', () => {
  let inputStream: Duplex
  let outputStream: Duplex
  let clientConnection: ProtocolConnection
  let serverConnection: Connection
  let documents: TextDocuments<TextDocument>

  beforeEach(async () => {
    inputStream = new TestStream()
    outputStream = new TestStream()
    const logger = new NullLogger()
    clientConnection = createProtocolConnection(
      new StreamMessageReader(outputStream),
      new StreamMessageWriter(inputStream),
      logger
    )
    clientConnection.listen()
    serverConnection = createConnection(inputStream, outputStream)
    documents = new TextDocuments(TextDocument)
    startServer(serverConnection, documents)

    const init: InitializeParams = {
      rootUri: 'file:///home/dirkb',
      processId: 1,
      capabilities: {},
      workspaceFolders: null,
    }
    const { serverInfo } = await clientConnection.sendRequest(InitializeRequest.type, init)
    assert.strictEqual(serverInfo?.name, 'Cucumber Language Server')
  })

  afterEach(() => {
    clientConnection.end()
    clientConnection.dispose()
    serverConnection.dispose()
  })

  context('textDocument/completion', () => {
    it('returns completion items for typescript', async () => {
      // First we need to configure the server, telling it where to find Gherkin documents and Glue code
      const settings: Settings = {
        language: 'typescript',
        gherkinGlobs: ['test/testdata/gherkin/*.feature'],
        glueGlobs: ['test/testdata/typescript/*.xts'],
      }
      const configParams: DidChangeConfigurationParams = {
        settings,
      }
      await clientConnection.sendNotification(DidChangeConfigurationNotification.type, configParams)

      // TODO: Wait for a WorkDoneProgressEnd notification instead
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Create a document for auto completion
      // @ts-ignore
      documents._documents['testdoc'] = TextDocument.create(
        'testdoc',
        'gherkin',
        1,
        `Feature: Hello
  Scenario: World
    Given I have
    `
      )
      const completionParams: CompletionParams = {
        textDocument: {
          uri: 'testdoc',
        },
        position: {
          line: 2, // The step line
          character: 16, // End of the step line
        },
      }
      const completionItems = await clientConnection.sendRequest(
        CompletionRequest.type,
        completionParams
      )
      const expected: CompletionItem[] = [
        {
          label: 'I have {int} cukes',
          insertTextFormat: 2,
          kind: 1,
          textEdit: {
            newText: 'I have ${1|5,8|} cukes',
            range: {
              start: {
                line: 2,
                character: 10,
              },
              end: {
                line: 2,
                character: 16,
              },
            },
          },
        },
      ]
      assert.deepStrictEqual(completionItems, expected)
    })
  })
})

class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit('data', chunk)
    done()
  }

  _read() {
    // no-op
  }
}

class NullLogger implements Logger {
  error(): void {
    // no-op
  }

  warn(): void {
    // no-op
  }

  info(): void {
    // no-op
  }

  log(): void {
    // no-op
  }
}
