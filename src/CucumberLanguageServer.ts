import {
  buildSuggestions,
  ExpressionBuilder,
  ExpressionBuilderResult,
  getGenerateSnippetCodeAction,
  getGherkinCompletionItems,
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  getStepDefinitionLocationLinks,
  Index,
  jsSearchIndex,
  ParserAdapter,
  semanticTokenTypes,
} from '@cucumber/language-service'
import { stat as statCb } from 'fs'
import { extname, relative } from 'path'
import { promisify } from 'util'
import {
  CodeAction,
  CodeActionKind,
  ConfigurationRequest,
  Connection,
  DidChangeConfigurationNotification,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { buildStepTexts } from './buildStepTexts.js'
import { getLanguage, loadGherkinSources, loadGlueSources } from './fs.js'
import { getStepDefinitionSnippetLinks } from './getStepDefinitionSnippetLinks.js'
import { Settings } from './types.js'
import { version } from './version.js'

const stat = promisify(statCb)

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
  snippetTemplates: {},
}

export class CucumberLanguageServer {
  private readonly expressionBuilder: ExpressionBuilder
  private searchIndex: Index
  private expressionBuilderResult: ExpressionBuilderResult
  private reindexingTimeout: NodeJS.Timeout
  private folderUri: string

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>,
    parserAdapter: ParserAdapter
  ) {
    this.expressionBuilder = new ExpressionBuilder(parserAdapter)
    connection.onInitialize(async (params) => {
      await parserAdapter.init()

      if (params.workspaceFolders && params.workspaceFolders.length > 0) {
        this.folderUri = params.workspaceFolders[0].uri
      }
      await this.reindex()

      if (params.capabilities.workspace?.configuration) {
        connection.onDidChangeConfiguration((params) => {
          this.connection.console.info(`Client sent workspace/configuration`)
          this.reindex(<Settings>params.settings).catch((err) => {
            connection.console.error(`Failed to reindex: ${err.stack}`)
          })
        })
        try {
          await connection.client.register(DidChangeConfigurationNotification.type)
        } catch (err) {
          connection.console.info(`Client does not support client/registerCapability. This is OK.`)
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
          return getGherkinSemanticTokens(
            gherkinSource,
            this.expressionBuilderResult.expressionLinks.map((l) => l.expression)
          )
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

      if (params.capabilities.textDocument?.codeAction) {
        connection.onCodeAction(async (params) => {
          const diagnostics = params.context.diagnostics
          if (this.folderUri) {
            const settings = await this.getSettings()
            const links = getStepDefinitionSnippetLinks(
              this.expressionBuilderResult.expressionLinks.map((l) => l.locationLink)
            )
            if (links.length === 0) {
              connection.console.info(
                `Unable to generate step definition. Please create one first manually.`
              )
              return []
            }

            const codeActions: CodeAction[] = []
            for (const link of links) {
              const languageName = getLanguage(extname(link.targetUri))
              if (!languageName) {
                connection.console.info(
                  `Unable to generate step definition snippet for unknown extension ${link}`
                )
                return []
              }
              const mustacheTemplate = settings.snippetTemplates[languageName]
              let createFile = false
              try {
                await stat(new URL(link.targetUri))
              } catch {
                createFile = true
              }
              const relativePath = relative(
                new URL(this.folderUri).pathname,
                new URL(link.targetUri).pathname
              )
              const codeAction = getGenerateSnippetCodeAction(
                diagnostics,
                link,
                relativePath,
                createFile,
                mustacheTemplate,
                languageName,
                this.expressionBuilderResult.registry
              )
              if (codeAction) {
                codeActions.push(codeAction)
              }
            }
            return codeActions
          }
          return []
        })
      } else {
        connection.console.info('onCodeAction is disabled')
      }

      if (params.capabilities.textDocument?.definition) {
        connection.onDefinition((params) => {
          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          return getStepDefinitionLocationLinks(
            gherkinSource,
            params.position,
            this.expressionBuilderResult.expressionLinks
          )
        })
      } else {
        connection.console.info('onDefinition is disabled')
      }

      return {
        capabilities: this.capabilities(),
        serverInfo: this.info(),
      }
    })

    connection.onInitialized(() => {
      connection.console.info(`${this.info().name} ${this.info().version} initialized`)
    })

    documents.listen(connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    documents.onDidChangeContent(async (change) => {
      this.scheduleReindexing()
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
      codeActionProvider: {
        resolveProvider: false,
        workDoneProgress: false,
        codeActionKinds: [CodeActionKind.QuickFix],
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
      definitionProvider: true,
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
      this.expressionBuilderResult.expressionLinks.map((l) => l.expression)
    )
    await this.connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
  }

  private scheduleReindexing() {
    clearTimeout(this.reindexingTimeout)
    const timeoutMillis = 3000
    this.connection.console.info(`Scheduling reindexing in ${timeoutMillis} ms`)
    this.reindexingTimeout = setTimeout(() => {
      this.reindex().catch((err) =>
        this.connection.console.error(`Failed to reindex: ${err.message}`)
      )
    }, timeoutMillis)
  }

  private async getSettings(): Promise<Settings> {
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
          snippetTemplates: {},
        }
      } else {
        this.connection.console.error(
          `The client responded with a config we cannot process: ${JSON.stringify(config, null, 2)}`
        )
        this.connection.console.error(`Using default settings: ${defaultSettings}`)
        return defaultSettings
      }
    } catch (err) {
      this.connection.console.error(`Failed to request configuration: ${err.message}`)
      this.connection.console.error(`Using default settings: ${defaultSettings}`)
      return defaultSettings
    }
  }

  private async reindex(settings?: Settings) {
    if (!settings) {
      settings = await this.getSettings()
    }
    // TODO: Send WorkDoneProgressBegin notification
    // https://microsoft.github.io/language-server-protocol/specifications/specification-3-17/#workDoneProgress

    this.connection.console.info(`Reindexing...`)
    const gherkinSources = await loadGherkinSources(settings.features)
    this.connection.console.info(
      `* Found ${gherkinSources.length} feature file(s) in ${JSON.stringify(settings.features)}`
    )
    const stepTexts = gherkinSources.reduce<readonly string[]>(
      (prev, gherkinSource) => prev.concat(buildStepTexts(gherkinSource.content)),
      []
    )
    this.connection.console.info(`* Found ${stepTexts.length} steps in those feature files`)
    const glueSources = await loadGlueSources(settings.glue)
    this.connection.console.info(
      `* Found ${glueSources.length} glue file(s) in ${JSON.stringify(settings.glue)}`
    )
    this.expressionBuilderResult = this.expressionBuilder.build(
      glueSources,
      settings.parameterTypes
    )
    this.connection.console.info(
      `* Found ${this.expressionBuilderResult.expressionLinks.length} step definitions in those glue files`
    )
    this.connection.console.info(
      `* Found ${this.expressionBuilderResult.parameterTypeLinks.length} parameter types in those glue files`
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
    // Tell the client to update all semantic tokens
    this.connection.languages.semanticTokens.refresh()

    const suggestions = buildSuggestions(
      this.expressionBuilderResult.registry,
      stepTexts,
      this.expressionBuilderResult.expressionLinks.map((l) => l.expression)
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
