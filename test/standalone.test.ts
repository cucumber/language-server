import assert from 'assert'
import { ChildProcess, fork } from 'child_process'
import { Duplex } from 'stream'
import { NullLogger, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'
import {
  createProtocolConnection,
  DidChangeConfigurationNotification,
  DidChangeConfigurationParams,
  InitializeParams,
  InitializeRequest,
  LogMessageNotification,
  LogMessageParams,
  ProtocolConnection,
} from 'vscode-languageserver'

import { Settings } from '../src/types.js'

describe('Standalone', () => {
  let serverFork: ChildProcess
  let logMessages: LogMessageParams[]
  let clientConnection: ProtocolConnection

  beforeEach(async () => {
    logMessages = []
    serverFork = fork('./bin/cucumber-language-server.cjs', ['--stdio'], {
      silent: true,
    })

    const initializeParams: InitializeParams = {
      rootUri: `file://${process.cwd()}`,
      processId: NaN, // This id is used by vscode-languageserver. Set as NaN so that the watchdog responsible for watching this process does not run.
      capabilities: {
        workspace: {
          configuration: true,
          didChangeWatchedFiles: {
            dynamicRegistration: true,
          },
        },
        textDocument: {
          moniker: {
            dynamicRegistration: false,
          },
          completion: {
            completionItem: {
              snippetSupport: true,
            },
          },
          semanticTokens: {
            tokenTypes: [],
            tokenModifiers: [],
            formats: [],
            requests: {},
          },
          formatting: {
            dynamicRegistration: true,
          },
        },
      },
      workspaceFolders: null,
    }
    if (!serverFork.stdin || !serverFork.stdout) {
      throw 'Process created without stdio streams'
    }
    clientConnection = createProtocolConnection(
      new StreamMessageReader(serverFork.stdout as Duplex),
      new StreamMessageWriter(serverFork.stdin as Duplex),
      NullLogger
    )
    clientConnection.onError((err) => {
      console.error('ERROR', err)
    })
    clientConnection.onNotification(LogMessageNotification.type, (params) => {
      if (params.type !== 3) {
        logMessages.push(params)
      }
    })
    clientConnection.onUnhandledNotification((n) => {
      console.error('Unhandled notification', n)
    })
    clientConnection.listen()
    const { serverInfo } = await clientConnection.sendRequest(
      InitializeRequest.type,
      initializeParams
    )
    assert.strictEqual(serverInfo?.name, 'Cucumber Language Server')
  })

  afterEach(() => {
    clientConnection.end()
    clientConnection.dispose()
    serverFork.kill('SIGTERM') // Try to terminate first
    serverFork.kill('SIGKILL') // Then try to kill if it is not killed
  })

  context('workspace/didChangeConfiguration', () => {
    it(`startup success`, async () => {
      // First we need to configure the server, telling it where to find Gherkin documents and Glue code.
      // Note that *pushing* settings from the client to the server is deprecated in the LSP. We're only using it
      // here because it's easier to implement in the test.
      const settings: Settings = {
        features: ['testdata/**/*.feature'],
        glue: ['testdata/**/*.js'],
        parameterTypes: [],
        snippetTemplates: {},
        forceReindex: true,
      }
      const configParams: DidChangeConfigurationParams = {
        settings,
      }

      await clientConnection.sendNotification(DidChangeConfigurationNotification.type, configParams)

      await new Promise((resolve) => setTimeout(resolve, 1000))

      assert.strictEqual(
        logMessages.length,
        // TODO: change this to 0 when `workspace/semanticTokens/refresh` issue was solved
        1,
        // print readable log messages
        logMessages
          .map(({ type, message }) => `**Type**: ${type}\n**Message**:\n${message}\n`)
          .join('\n--------------------\n')
      )
    })
  })
})
