import assert from 'assert'
import { Duplex } from 'stream'
import { Logger, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'
import {
  Connection,
  createProtocolConnection,
  InitializeParams,
  InitializeRequest,
  ProtocolConnection,
} from 'vscode-languageserver'
import { createConnection } from 'vscode-languageserver/node'

import { CucumberLanguageServer } from '../src/CucumberLanguageServer.js'
import { startServer } from '../src/startServer'

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

class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit('data', chunk)
    done()
  }

  _read() {
    // no-op
  }
}

describe('CucumberLanguageServer', () => {
  let inputStream: Duplex
  let outputStream: Duplex
  let clientConnection: ProtocolConnection
  let serverConnection: Connection

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
    startServer(serverConnection)

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

  it('does something', async () => {
    console.log('hello')
  })

  it('does something else', async () => {
    console.log('hello')
  })
})
