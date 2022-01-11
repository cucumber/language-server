import { Expression } from '@cucumber/cucumber-expressions'
import {
  buildStepDocuments,
  getGherkinCompletionItems,
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  Index,
  jsSearchIndex,
  semanticTokenTypes,
  StepDocument,
} from '@cucumber/language-service'
import {
  ConfigurationRequest,
  Connection,
  DidChangeConfigurationNotification,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { buildStepTexts } from './buildStepTexts.js'
import { loadAll } from './loadAll.js'
import { ExpressionBuilder } from './tree-sitter/ExpressionBuilder.js'
import { ParameterTypeMeta, Settings } from './types.js'
import { version } from './version.js'

type ServerInfo = {
  name: string
  version: string
}

const defaultSettings: Settings = {
  features: ['src/test/**/*.feature', 'features/**/*.feature'],
  glue: ['src/test/**/*.java', 'features/**/*.ts'],
}

export class CucumberLanguageServer {
  private expressions: readonly Expression[] = []
  private index: Index
  private expressionBuilder = new ExpressionBuilder()

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>
  ) {
    connection.onInitialize(async (params) => {
      // await connection.console.info(
      //   'CucumberLanguageServer initializing: ' + JSON.stringify(params, null, 2)
      // )

      await this.expressionBuilder.init({
        // Relative to dist/src/cjs
        java: `${__dirname}/../../../tree-sitter-java.wasm`,
        typescript: `${__dirname}/../../../tree-sitter-typescript.wasm`,
      })

      if (params.capabilities.workspace?.configuration) {
        connection.onDidChangeConfiguration((params) => {
          this.connection.console.log(
            '*** onDidChangeConfiguration: ' + JSON.stringify(params, null, 2)
          )
          this.updateSettings(<Settings>params.settings).catch((err) => {
            this.connection.console.error(`Failed to update settings: ${err.message}`)
          })
        })
        try {
          await connection.client.register(DidChangeConfigurationNotification.type)
        } catch (err) {
          await connection.console.warn(
            'Could not register DidChangeConfigurationNotification: ' + err.message
          )
        }
      } else {
        console.log('*** Disabled onDidChangeConfiguration')
      }

      if (params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
        connection.onDidChangeWatchedFiles(async ({ changes }) => {
          if (!changes) {
            await connection.console.error('*** onDidChangeWatchedFiles - no changes??')
          } else {
            await connection.console.info(`*** onDidChangeWatchedFiles`)
          }
        })
        // await connection.client.register(DidChangeWatchedFilesNotification.type, {
        //   // TODO: Take from settings
        //   watchers: [{ globPattern: 'features/**/*.{feature,java,ts}' }],
        // })
      } else {
        console.log('*** Disabled onDidChangeWatchedFiles')
      }

      if (params.capabilities.textDocument?.semanticTokens) {
        connection.languages.semanticTokens.on((semanticTokenParams) => {
          const doc = documents.get(semanticTokenParams.textDocument.uri)
          if (!doc) return { data: [] }
          const gherkinSource = doc.getText()
          return getGherkinSemanticTokens(gherkinSource, this.expressions)
        })
      } else {
        console.log('*** Disabled semanticTokens')
      }

      if (params.capabilities.textDocument?.completion?.completionItem?.snippetSupport) {
        connection.onCompletion((params) => {
          if (!this.index) return []
          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          return getGherkinCompletionItems(gherkinSource, params.position.line, this.index)
        })

        connection.onCompletionResolve((item) => item)
      } else {
        console.log('*** Disabled onCompletion')
      }

      if (params.capabilities.textDocument?.formatting) {
        connection.onDocumentFormatting((params) => {
          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          return getGherkinFormattingEdits(gherkinSource)
        })
      } else {
        console.log('*** Disabled onDocumentFormatting')
      }

      await connection.console.info('Cucumber Language server initialized')

      return {
        capabilities: this.capabilities(),
        serverInfo: this.info(),
      }
    })

    connection.onInitialized(() => {
      console.log('*** onInitialized')
    })

    documents.listen(connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    documents.onDidChangeContent(async (change) => {
      const settings = await this.getSettings()
      if (settings) {
        await this.updateSettings(settings)
      } else {
        await this.connection.console.warn('Could not get cucumber.* settings')
      }

      if (change.document.uri.match(/\.feature$/)) {
        this.validateGherkinDocument(change.document)
      }
      console.log('onDidChangeContent', { settings })
    })
  }

  private async getSettings(): Promise<Settings | undefined> {
    try {
      const config = await this.connection.sendRequest(ConfigurationRequest.type, {
        items: [
          {
            section: 'cucumber',
          },
        ],
      })
      if (config && config.length === 1) {
        return { defaultSettings, ...config[0] }
      }
    } catch (err) {
      await this.connection.console.error('Could not request configuration: ' + err.message)
    }
  }

  public capabilities(): ServerCapabilities {
    return {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
      },
      workspace: {
        workspaceFolders: {
          changeNotifications: true,
          supported: true,
        },
      },
      semanticTokensProvider: {
        full: {
          delta: false,
        },
        legend: {
          tokenTypes: semanticTokenTypes,
          tokenModifiers: [],
        },
      },
      documentFormattingProvider: true,
    }
  }

  public info(): ServerInfo {
    return {
      name: 'Cucumber Language Server',
      version,
    }
  }

  private validateGherkinDocument(textDocument: TextDocument): void {
    const diagnostics = getGherkinDiagnostics(textDocument.getText(), this.expressions)
    this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  // TODO: This is slow - debounce it
  private async updateSettings(settings: Settings) {
    // TODO: Send WorkDoneProgressBegin notification
    // https://microsoft.github.io/language-server-protocol/specifications/specification-3-17/#workDoneProgress

    const stepDocuments = await this.buildStepDocuments(
      settings.features,
      settings.glue,
      settings.parameterTypes
    )
    await this.connection.console.info(
      `Built ${stepDocuments.length} step documents for auto complete`
    )
    this.index = jsSearchIndex(stepDocuments)

    // TODO: Send WorkDoneProgressEnd notification
  }

  private async buildStepDocuments(
    gherkinGlobs: readonly string[],
    glueGlobs: readonly string[],
    parameterTypes: readonly ParameterTypeMeta[] | undefined
  ): Promise<readonly StepDocument[]> {
    const gherkinSources = await loadAll(gherkinGlobs)
    await this.connection.console.info(`Found ${gherkinSources.length} feature files`)
    const stepTexts = gherkinSources.reduce<readonly string[]>(
      (prev, gherkinSource) => prev.concat(buildStepTexts(gherkinSource.content)),
      []
    )
    await this.connection.console.info(`Found ${stepTexts.length} steps in those feature files`)
    const glueSources = await loadAll(glueGlobs)
    await this.connection.console.info(`Found ${glueSources.length} glue files`)
    this.expressions = this.expressionBuilder.build(glueSources, parameterTypes)
    await this.connection.console.info(
      `Found ${this.expressions.length} step definitions in those glue files`
    )
    return buildStepDocuments(stepTexts, this.expressions)
  }
}
