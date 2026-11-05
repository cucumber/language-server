import assert from 'node:assert'
import { type ChildProcess, fork } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Duplex } from 'node:stream'
import { NullLogger, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'
import {
  createProtocolConnection,
  DidChangeConfigurationNotification,
  type DidChangeConfigurationParams,
  type InitializeParams,
  InitializeRequest,
  LogMessageNotification,
  type LogMessageParams,
  type ProtocolConnection,
} from 'vscode-languageserver'

import type { Settings } from '../src/types.js'

const tempDirs: string[] = []

function makeHoistedInstall(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cucumber-language-server-'))
  tempDirs.push(root)
  const nodeModules = path.join(root, 'node_modules')
  const serverDir = path.join(nodeModules, '@cucumber', 'language-server')
  fs.mkdirSync(serverDir, { recursive: true })
  for (const entry of ['bin', 'dist', 'package.json']) {
    fs.cpSync(entry, path.join(serverDir, entry), { recursive: true })
  }
  for (const entry of fs.readdirSync('node_modules')) {
    if (entry.startsWith('.')) {
      continue
    }
    if (entry === '@cucumber') {
      for (const scoped of fs.readdirSync('node_modules/@cucumber')) {
        fs.symlinkSync(
          path.resolve('node_modules/@cucumber', scoped),
          path.join(nodeModules, '@cucumber', scoped)
        )
      }
    } else {
      fs.symlinkSync(path.resolve('node_modules', entry), path.join(nodeModules, entry))
    }
  }
  return path.join(serverDir, 'bin', 'cucumber-language-server.js')
}

const layouts: Record<string, () => string> = {
  'local checkout': () => './bin/cucumber-language-server.js',
  'hoisted dependencies': makeHoistedInstall,
}

for (const [layout, getBinPath] of Object.entries(layouts)) {
  describe(`Standalone (${layout})`, () => {
    let serverFork: ChildProcess
    let logMessages: LogMessageParams[]
    let clientConnection: ProtocolConnection
    let binPath: string

    before(() => {
      binPath = getBinPath()
    })

    after(() => {
      for (const dir of tempDirs.splice(0)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })

    beforeEach(async () => {
      logMessages = []
      serverFork = fork(binPath, ['--stdio'], {
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
        }
        const configParams: DidChangeConfigurationParams = {
          settings,
        }

        await clientConnection.sendNotification(
          DidChangeConfigurationNotification.type,
          configParams
        )

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
}
