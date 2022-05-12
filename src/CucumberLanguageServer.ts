import { ParameterTypeRegistry } from '@cucumber/cucumber-expressions'
import {
  buildSuggestions,
  ExpressionBuilder,
  ExpressionBuilderResult,
  getGherkinCompletionItems,
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  Index,
  jsSearchIndex,
  ParserAdapter,
  semanticTokenTypes,
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
import { loadGherkinSources, loadGlueSources } from './fs.js'
import { Settings } from './types.js'
import { version } from './version.js'

type ServerInfo = {
  name: string
  version: string
}

// In order to allow 0-config in LSP clients we provide default settings.
// This should be consistent with the `README.md` in `cucumber/vscode` - this is to
// ensure the docs for the plugin reflect the defaults.
const defaultSettings: Settings = {
  features: ['src/test/**/*.feature', 'features/**/*.feature'],
  glue: [
    'src/test/**/*.java',
    'features/**/*.ts',
    'features/**/*.php',
    'features/**/*.rb',
    '*specs*/**/.cs',
  ],
  parameterTypes: [],
}

export class CucumberLanguageServer {
  private readonly expressionBuilder: ExpressionBuilder
  private searchIndex: Index
  private expressionBuilderResult: ExpressionBuilderResult = { expressions: [], errors: [] }
  private reindexingTimeout: NodeJS.Timeout

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>,
    parserAdapter: ParserAdapter
  ) {
    this.expressionBuilder = new ExpressionBuilder(parserAdapter)
    connection.onInitialize(async (params) => {
      await parserAdapter.init()

      if (params.capabilities.workspace?.configuration) {
        connection.onDidChangeConfiguration((params) => {
          this.reindex(<Settings>params.settings).catch((err) => {
            connection.console.error(`Failed to reindex: ${err.stack}`)
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
        connection.languages.semanticTokens.onDelta(() => {
          return {
            data: [],
          }
        })
        connection.languages.semanticTokens.onRange(() => {
          return {
            data: [],
          }
        })
        connection.languages.semanticTokens.on((semanticTokenParams) => {
          const doc = documents.get(semanticTokenParams.textDocument.uri)
          if (!doc) return { data: [] }
          const gherkinSource = doc.getText()
          return getGherkinSemanticTokens(gherkinSource, this.expressionBuilderResult.expressions)
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
          return getGherkinCompletionItems(gherkinSource, params.position, this.searchIndex).slice()
        })

        connection.onCompletionResolve((item) => item)
      } else {
        connection.console.info('onCompletion is disabled')
      }

      if (params.capabilities.textDocument?.formatting) {
        connection.onDocumentFormatting((params) => {
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
      const settings = await this.getSettings()
      if (settings) {
        this.scheduleReindexing(settings)
      } else {
        this.connection.console.error('Could not get cucumber.* settings')
      }

      if (change.document.uri.match(/\.feature$/)) {
        await this.sendDiagnostics(change.document)
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

  private async sendDiagnostics(textDocument: TextDocument): Promise<void> {
    const diagnostics = getGherkinDiagnostics(
      textDocument.getText(),
      this.expressionBuilderResult.expressions
    )
    await this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  private scheduleReindexing(settings: Settings) {
    clearTimeout(this.reindexingTimeout)
    // Update index immediately the first time
    const timeoutMillis = this.reindexingTimeout ? 3000 : 0
    this.connection.console.info(`Scheduling reindexing in ${timeoutMillis} ms`)
    this.reindexingTimeout = setTimeout(() => {
      this.reindex(settings).catch((err) =>
        this.connection.console.error(`Failed to reindex: ${err.message}`)
      )
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
        const settings: Partial<Settings> | null = config[0]

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

    this.connection.console.info(`Reindexing...`)
    const gherkinSources = await loadGherkinSources(settings.features)
    this.connection.console.info(`* Found ${gherkinSources.length} feature file(s)`)
    const stepTexts = gherkinSources.reduce<readonly string[]>(
      (prev, gherkinSource) => prev.concat(buildStepTexts(gherkinSource.content)),
      []
    )
    this.connection.console.info(`* Found ${stepTexts.length} steps in those feature files`)
    const glueSources = await loadGlueSources(settings.glue)
    this.connection.console.info(`* Found ${glueSources.length} glue file(s)`)
    this.expressionBuilderResult = this.expressionBuilder.build(
      glueSources,
      settings.parameterTypes
    )
    this.connection.console.info(
      `* Found ${this.expressionBuilderResult.expressions.length} step definitions in those glue files`
    )
    for (const error of this.expressionBuilderResult.errors) {
      this.connection.console.error(`* Step Definition errors: ${error.message}`)
    }

    // Send diagnostics for all documents now that we're updated
    const gherkinDocuments = this.documents.all().filter((doc) => doc.uri.match(/\.feature$/))
    await Promise.all(
      gherkinDocuments.map((doc) =>
        this.sendDiagnostics(doc).catch((err) =>
          this.connection.console.error(`Error: ${err.message}`)
        )
      )
    )

    const registry = new ParameterTypeRegistry()
    const suggestions = buildSuggestions(
      registry,
      stepTexts,
      this.expressionBuilderResult.expressions
    )
    this.connection.console.info(`* Built ${suggestions.length} suggestions for auto complete`)
    this.searchIndex = jsSearchIndex(suggestions)

    // TODO: Send WorkDoneProgressEnd notification
  }
}

function getArray<T>(arr: readonly T[] | undefined | null, defaultArr: readonly T[]): readonly T[] {
  if (!Array.isArray(arr) || arr.length === 0) return defaultArr
  return arr
}
