import {
  buildSuggestions,
  CucumberExpressions,
  ExpressionBuilder,
  ExpressionBuilderResult,
  getGenerateSnippetCodeAction,
  getGherkinCompletionItems,
  getGherkinDiagnostics,
  getGherkinDocumentFeatureSymbol,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  getStepDefinitionLocationLinks,
  Index,
  jsSearchIndex,
  LanguageName,
  ParserAdapter,
  semanticTokenTypes,
  Source,
  Suggestion,
} from '@cucumber/language-service'
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
import { extname, Files } from './Files.js'
import { getLanguage, loadGherkinSources, loadGlueSources } from './fs.js'
import { getStepDefinitionSnippetLinks } from './getStepDefinitionSnippetLinks.js'
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
  // IMPORTANT: If you change features or glue below, please also create a PR to update
  // the vscode extension defaults accordingly in https://github.com/cucumber/vscode/blob/main/README.md#extension-settings
  features: [
    // Cucumber-JVM
    'src/test/**/*.feature',
    // Cucumber-Ruby, Cucumber-Js, Behat, Behave, Godog
    'features/**/*.feature',
    // Pytest-BDD
    'tests/**/*.feature',
    // SpecFlow
    '*specs*/**/*.feature',
  ],
  glue: [
    // Cucumber-JVM
    'src/test/**/*.java',
    // Cucumber-Js
    'features/**/*.ts',
    'features/**/*.tsx',
    'features/**/*.js',
    'features/**/*.jsx',
    // Behat
    'features/**/*.php',
    // Behave
    'features/**/*.py',
    // Pytest-BDD
    'tests/**/*.py',
    // Cucumber Rust
    'tests/**/*.rs',
    'features/**/*.rs',
    // Cucumber-Ruby
    'features/**/*.rb',
    // SpecFlow
    '*specs*/**/*.cs',
    // Godog
    'features/**/*_test.go',
  ],
  parameterTypes: [],
  snippetTemplates: {},
  forceReindex: true,
}

export class CucumberLanguageServer {
  private readonly expressionBuilder: ExpressionBuilder
  private searchIndex: Index
  private expressionBuilderResult: ExpressionBuilderResult | undefined = undefined
  private reindexingTimeout: NodeJS.Timeout
  private rootUri: string
  private files: Files
  private gherkinSourcesCache: Map<string, Source<'gherkin'>> = new Map()
  private glueSourcesCache: Map<string, Source<LanguageName>> = new Map()
  private stepTextsCache: Map<string, readonly string[]> = new Map()
  private glueSourceChanged = true
  public registry: CucumberExpressions.ParameterTypeRegistry
  public expressions: readonly CucumberExpressions.Expression[] = []
  public suggestions: readonly Suggestion[] = []

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>,
    parserAdapter: ParserAdapter,
    private readonly makeFiles: (rootUri: string) => Files,
    private readonly onReindexed: (
      registry: CucumberExpressions.ParameterTypeRegistry,
      expressions: readonly CucumberExpressions.Expression[],
      suggestions: readonly Suggestion[]
    ) => void
  ) {
    this.expressionBuilder = new ExpressionBuilder(parserAdapter)

    connection.onInitialize(async (params) => {
      // connection.console.log(`PARAMS: ${JSON.stringify(params, null, 2)}`)
      await parserAdapter.init()
      if (params.clientInfo) {
        connection.console.info(
          `Initializing connection from ${params.clientInfo.name} ${params.clientInfo.version}`
        )
      } else {
        connection.console.info(`Initializing connection from unknown client`)
      }

      if (params.rootPath) {
        this.rootUri = `file://${params.rootPath}`
      } else if (params.rootUri) {
        this.rootUri = params.rootUri
      } else if (params.workspaceFolders && params.workspaceFolders.length > 0) {
        this.rootUri = params.workspaceFolders[0].uri
      } else {
        connection.console.error(`Could not determine rootPath`)
      }
      this.files = makeFiles(this.rootUri)
      // Some users have reported that the globs don't find any files. This is to debug that issue
      connection.console.info(`Root uri    : ${this.rootUri}`)
      connection.console.info(`Current dir : ${process.cwd()}`)

      if (params.capabilities.workspace?.configuration) {
        connection.onDidChangeConfiguration((params) => {
          this.connection.console.info(`Client sent workspace/configuration`)
          this.reindex(<Settings>params.settings).catch((err) => {
            connection.console.error(`Failed to reindex: ${err.message}`)
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
            (this.expressionBuilderResult?.expressionLinks || []).map((l) => l.expression)
          )
        })
      } else {
        connection.console.info('semanticTokens is disabled')
      }

      if (params.capabilities.textDocument?.completion?.completionItem?.snippetSupport) {
        connection.onCompletion((params) => {
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
          if (this.expressionBuilderResult) {
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
              const createFile = !(await this.files.exists(link.targetUri))
              const relativePath = this.files.relativePath(link.targetUri)
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
          if (!doc || !this.expressionBuilderResult) return []
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

      if (params.capabilities.textDocument?.documentSymbol) {
        connection.onDocumentSymbol((params) => {
          const doc = documents.get(params.textDocument.uri)
          if (!doc) return []
          const gherkinSource = doc.getText()
          const symbol = getGherkinDocumentFeatureSymbol(gherkinSource)
          return symbol ? [symbol] : null
        })
      } else {
        connection.console.info('onDocumentSymbol is disabled')
      }

      return {
        capabilities: this.capabilities(),
        serverInfo: this.info(),
      }
    })

    connection.onInitialized(() => {
      connection.console.info(`${this.info().name} ${this.info().version} initialized`)
      this.reindex().catch((err) => connection.console.error(err.message))
    })

    documents.listen(connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    documents.onDidSave(async (change) => {
      const uri = change.document.uri
      const content = change.document.getText()
      this.updateSourceCache(uri, content)
      const settings = await this.getSettings()
      if (!settings.forceReindex) {
        this.connection.console.info('SKIPPING reindexing due to cucumber.forceReindex setting')
        return
      }
      this.scheduleReindexing(true)
      if (uri.match(/\.feature$/)) {
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
      documentSymbolProvider: {
        label: 'Cucumber',
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
      (this.expressionBuilderResult?.expressionLinks || []).map((l) => l.expression)
    )
    await this.connection.sendDiagnostics({
      uri: textDocument.uri,
      diagnostics,
    })
  }

  private scheduleReindexing(useCache = false) {
    clearTimeout(this.reindexingTimeout)
    const timeoutMillis = 3000
    this.connection.console.info(`Scheduling reindexing in ${timeoutMillis} ms`)
    this.reindexingTimeout = setTimeout(() => {
      this.reindex(undefined, useCache).catch((err) =>
        this.connection.console.error(`Failed to reindex: ${err.message}`)
      )
    }, timeoutMillis)
  }

  private updateSourceCache(uri: string, content: string): void {
    const ext = extname(uri)
    if (ext === '.feature') {
      this.gherkinSourcesCache.set(uri, { languageName: 'gherkin', uri, content })
      // Update stepTexts cache for this file only
      this.stepTextsCache.set(uri, buildStepTexts(content))
    } else {
      const languageName = getLanguage(ext)
      if (languageName) {
        this.glueSourcesCache.set(uri, { languageName, uri, content })
        this.glueSourceChanged = true
      }
    }
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
          forceReindex: settings?.forceReindex ?? defaultSettings.forceReindex,
        }
      } else {
        this.connection.console.error(
          `The client responded with a config we cannot process: ${JSON.stringify(config, null, 2)}`
        )
        this.connection.console.error(`Using default settings`)
        return defaultSettings
      }
    } catch (err) {
      this.connection.console.error(`Failed to request configuration: ${err.message}`)
      this.connection.console.error(`Using default settings`)
      return defaultSettings
    }
  }

  private async reindex(settings?: Settings, useCache = false) {
    if (!settings) {
      settings = await this.getSettings()
    }
    // TODO: Send WorkDoneProgressBegin notification
    // https://microsoft.github.io/language-server-protocol/specifications/specification-3-17/#workDoneProgress

    this.connection.console.info(`Reindexing ${this.rootUri}, useCache: ${useCache}`)

    let gherkinSources: readonly Source<'gherkin'>[]
    let glueSources: readonly Source<LanguageName>[]

    if (useCache && this.gherkinSourcesCache.size > 0) {
      gherkinSources = Array.from(this.gherkinSourcesCache.values())
      glueSources = Array.from(this.glueSourcesCache.values())
      this.connection.console.info(`* Using cached sources`)
    } else {
      gherkinSources = await loadGherkinSources(this.files, settings.features)
      glueSources = await loadGlueSources(this.files, settings.glue)
      // Populate caches
      this.gherkinSourcesCache.clear()
      this.glueSourcesCache.clear()
      for (const source of gherkinSources) {
        this.gherkinSourcesCache.set(source.uri, source)
      }
      for (const source of glueSources) {
        this.glueSourcesCache.set(source.uri, source)
      }
    }

    this.connection.console.info(
      `* Found ${gherkinSources.length} feature file(s) in ${JSON.stringify(settings.features)}`
    )

    // Build stepTexts using cache when possible
    let stepTexts: readonly string[]
    if (useCache && this.stepTextsCache.size > 0) {
      // Merge all cached stepTexts
      stepTexts = Array.from(this.stepTextsCache.values()).flat()
      this.connection.console.info(`* Using cached stepTexts`)
    } else {
      // Build stepTexts for each gherkin source and populate cache
      this.stepTextsCache.clear()
      const allStepTexts: string[] = []
      for (const source of gherkinSources) {
        const fileStepTexts = buildStepTexts(source.content)
        this.stepTextsCache.set(source.uri, fileStepTexts)
        allStepTexts.push(...fileStepTexts)
      }
      stepTexts = allStepTexts
    }

    this.connection.console.info(`* Found ${stepTexts.length} steps in those feature files`)
    this.connection.console.info(
      `* Found ${glueSources.length} glue file(s) in ${JSON.stringify(settings.glue)}`
    )

    // Only rebuild expressions if glue sources changed or we don't have a result yet
    if (this.glueSourceChanged || !this.expressionBuilderResult) {
      this.expressionBuilderResult = this.expressionBuilder.build(
        glueSources,
        settings.parameterTypes
      )
      this.glueSourceChanged = false
      this.connection.console.info(`* Rebuilt expressions from glue sources`)
    } else {
      this.connection.console.info(`* Using cached expressions (no glue changes)`)
    }
    this.connection.console.info(
      `* Found ${this.expressionBuilderResult.parameterTypeLinks.length} parameter types in those glue files`
    )
    for (const parameterTypeLink of this.expressionBuilderResult.parameterTypeLinks) {
      this.connection.console.info(
        `  * {${parameterTypeLink.parameterType.name}} = ${parameterTypeLink.parameterType.regexpStrings}`
      )
    }
    this.connection.console.info(
      `* Found ${this.expressionBuilderResult.expressionLinks.length} step definitions in those glue files`
    )
    for (const error of this.expressionBuilderResult.errors) {
      this.connection.console.error(`* Step Definition errors: ${error.stack}`)
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

    try {
      const expressions = this.expressionBuilderResult.expressionLinks.map((l) => l.expression)
      const suggestions = buildSuggestions(
        this.expressionBuilderResult.registry,
        stepTexts,
        expressions
      )
      this.connection.console.info(`* Built ${suggestions.length} suggestions for auto complete`)
      this.searchIndex = jsSearchIndex(suggestions)
      const registry = this.expressionBuilderResult.registry
      this.registry = registry
      this.expressions = expressions
      this.suggestions = suggestions
      this.onReindexed(registry, expressions, suggestions)
    } catch (err) {
      this.connection.console.error(err.stack)
      this.connection.console.error(
        'Please report an issue at https://github.com/cucumber/language-service/issues with the above stack trace'
      )
    }

    // TODO: Send WorkDoneProgressEnd notification
  }
}

function getArray<T>(arr: readonly T[] | undefined | null, defaultArr: readonly T[]): readonly T[] {
  if (!Array.isArray(arr) || arr.length === 0) return defaultArr
  return arr
}
