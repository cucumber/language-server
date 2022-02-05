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
  WasmUrls,
} from '@cucumber/language-service'
import { ExpressionBuilder } from '@cucumber/language-service'
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
import { ParameterTypeMeta, Settings } from './types.js'
import { version } from './version.js'

type ServerInfo = {
  name: string
  version: string
}

// In order to allow 0-config in LSP clients we provide default settings
const defaultSettings: Settings = {
  features: ['src/test/**/*.feature', 'features/**/*.feature'],
  glue: ['src/test/**/*.java', 'features/**/*.ts'],
  parameterTypes: [],
}

export class CucumberLanguageServer {
  private expressions: readonly Expression[] = []
  private searchIndex: Index
  private expressionBuilder = new ExpressionBuilder()
  private reindexingTimeout: NodeJS.Timeout

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>,
    wasmUrls: WasmUrls
  ) {
    connection.onInitialize(async (params) => {
      await this.expressionBuilder.init(wasmUrls)

      if (params.capabilities.workspace?.configuration) {
        connection.onDidChangeConfiguration((params) => {
          this.reindex(<Settings>params.settings).catch((err) => {
            connection.console.error(`Failed to reindex: ${err.message}`)
          })
        })
        try {
          await connection.client.register(DidChangeConfigurationNotification.type)
        } catch (err) {
          connection.console.info(
            `Could not register DidChangeConfigurationNotification: "${err.message}" - this is OK`
          )
        }
      } else {
        this.connection.console.info('onDidChangeConfiguration is disabled')
      }

      if (params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
        connection.onDidChangeWatchedFiles(async () => {
          connection.console.info(`onDidChangeWatchedFiles`)
        })
      } else {
        connection.console.info('onDidChangeWatchedFiles is disabled')
      }

      if (params.capabilities.textDocument?.semanticTokens) {
        connection.languages.semanticTokens.onDelta((semanticTokenParams) => {
          connection.console.info(
            `semanticTokens.onDelta params: ${JSON.stringify(semanticTokenParams)}`
          )
          return {
            data: [],
          }
        })
        connection.languages.semanticTokens.onRange((semanticTokenParams) => {
          connection.console.info(
            `semanticTokens.onRange params: ${JSON.stringify(semanticTokenParams)}`
          )
          return {
            data: [],
          }
        })
        connection.languages.semanticTokens.on((semanticTokenParams) => {
          connection.console.info(
            `semanticTokens.on params: ${JSON.stringify(semanticTokenParams)}`
          )

          const doc = documents.get(semanticTokenParams.textDocument.uri)
          if (!doc) return { data: [] }
          const gherkinSource = doc.getText()
          return getGherkinSemanticTokens(gherkinSource, this.expressions)
        })
      } else {
        connection.console.info('semanticTokens is disabled')
      }

      if (params.capabilities.textDocument?.completion?.completionItem?.snippetSupport) {
        connection.onCompletion((params) => {
          connection.console.info(
            `onCompletion params: ${JSON.stringify(params)}, indexed: ${!!this.searchIndex}`
          )

          if (!this.searchIndex) return []

          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          return getGherkinCompletionItems(gherkinSource, params.position.line, this.searchIndex)
        })

        connection.onCompletionResolve((item) => item)
      } else {
        connection.console.info('onCompletion is disabled')
      }

      if (params.capabilities.textDocument?.formatting) {
        connection.onDocumentFormatting((params) => {
          connection.console.info(`onDocumentFormatting params: ${JSON.stringify(params)}`)

          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          return getGherkinFormattingEdits(gherkinSource)
        })
      } else {
        connection.console.info('onDocumentFormatting is disabled')
      }

      connection.console.info('CucumberLanguageServer initialized!')

      return {
        capabilities: this.capabilities(),
        serverInfo: this.info(),
      }
    })

    connection.onInitialized(() => {
      this.connection.console.info('onInitialized')
    })

    documents.listen(connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    documents.onDidChangeContent(async (change) => {
      if (change.document.uri.match(/\.feature$/)) {
        this.validateGherkinDocument(change.document)
      }
      const settings = await this.getSettings()
      if (settings) {
        this.scheduleReindexing(settings, change.document)
      } else {
        await this.connection.console.error('Could not get cucumber.* settings')
      }

      if (change.document.uri.match(/\.feature$/)) {
        this.validateGherkinDocument(change.document)
      }
    })
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
        range: false,
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

  private scheduleReindexing(settings: Settings, textDocument: TextDocument) {
    clearTimeout(this.reindexingTimeout)
    // Update index immediately the first time
    const timeoutMillis = this.reindexingTimeout ? 3000 : 0
    this.connection.console.info(`Scheduling reindexing in ${timeoutMillis} ms`)
    this.reindexingTimeout = setTimeout(() => {
      this.reindex(settings)
        .then(() => {
          if (textDocument.uri.match(/\.feature$/)) {
            this.validateGherkinDocument(textDocument)
          }
        })
        .catch((err) => this.connection.console.error(`Failed to reindex: ${err.message}`))
    }, timeoutMillis)
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
        const settings: Settings | null = config[0]

        return {
          features: getArray(settings?.features, defaultSettings.features),
          glue: getArray(settings?.glue, defaultSettings.glue),
          parameterTypes: getArray(settings?.parameterTypes, defaultSettings.parameterTypes),
        }
      }
    } catch (err) {
      this.connection.console.error('Failed to request configuration: ' + err.message)
    }
  }

  private async reindex(settings: Settings) {
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
    this.searchIndex = jsSearchIndex(stepDocuments)

    // TODO: Send WorkDoneProgressEnd notification
  }

  private async buildStepDocuments(
    gherkinGlobs: readonly string[],
    glueGlobs: readonly string[],
    parameterTypes: readonly ParameterTypeMeta[] | undefined
  ): Promise<readonly StepDocument[]> {
    const gherkinSources = await loadAll(gherkinGlobs)
    await this.connection.console.info(`Found ${gherkinSources.length} feature file(s)`)
    const stepTexts = gherkinSources.reduce<readonly string[]>(
      (prev, gherkinSource) => prev.concat(buildStepTexts(gherkinSource.content)),
      []
    )
    await this.connection.console.info(`Found ${stepTexts.length} steps in those feature files`)
    const glueSources = await loadAll(glueGlobs)
    await this.connection.console.info(`Found ${glueSources.length} glue file(s)`)
    this.expressions = this.expressionBuilder.build(glueSources, parameterTypes)
    await this.connection.console.info(
      `Found ${this.expressions.length} step definitions in those glue files`
    )
    return buildStepDocuments(stepTexts, this.expressions)
  }
}

function getArray<T>(arr: readonly T[] | undefined | null, defaultArr: readonly T[]): readonly T[] {
  if (!Array.isArray(arr) || arr.length === 0) return defaultArr
  return arr
}
