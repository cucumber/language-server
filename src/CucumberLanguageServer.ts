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
} from '@cucumber/language-service'
import {
  Connection,
  DidChangeConfigurationNotification,
  DidChangeWatchedFilesNotification,
  DidChangeWatchedFilesRegistrationOptions,
  InitializeParams,
  ServerCapabilities,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { buildStepTexts } from './buildStepTexts'
import { loadAll } from './loadAll'
import { ExpressionBuilder } from './tree-sitter/ExpressionBuilder.js'
import { Settings } from './types'
import { version } from './version.js'

type ServerInfo = {
  name: string
  version: string
}

export class CucumberLanguageServer {
  private expressions: readonly Expression[] = []
  private index: Index
  private expressionBuilder: ExpressionBuilder

  constructor(
    private readonly connection: Connection,
    private readonly documents: TextDocuments<TextDocument>
  ) {
    documents.listen(connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    documents.onDidChangeContent((change) => {
      connection.console.log(`*** onDidChangeContent: ${change.document.uri}`)
      connection.console.log(
        'DOCS:' +
          JSON.stringify(
            documents.all().map((d) => d.uri),
            null,
            2
          )
      )
      if (change.document.uri.match(/\.feature$/)) {
        this.validateGherkinDocument(change.document)
      }
    })

    connection.onDidChangeConfiguration((params) => {
      this.updateSettings(<Settings>params.settings).catch((err) => {
        this.connection.console.error(`Failed to update settings: ${err.message}`)
      })
    })

    connection.onCompletion((params) => {
      const doc = documents.get(params.textDocument.uri)
      if (!doc || !this.index) return []
      const gherkinSource = doc.getText()
      return getGherkinCompletionItems(gherkinSource, params.position.line, this.index)
    })

    connection.onCompletionResolve((item) => item)

    connection.languages.semanticTokens.on((semanticTokenParams) => {
      const doc = documents.get(semanticTokenParams.textDocument.uri)
      if (!doc) return { data: [] }
      const gherkinSource = doc.getText()
      return getGherkinSemanticTokens(gherkinSource, this.expressions)
    })

    connection.onDocumentFormatting((params) => {
      const doc = documents.get(params.textDocument.uri)
      if (!doc) return []
      const gherkinSource = doc.getText()
      return getGherkinFormattingEdits(gherkinSource)
    })
  }

  public initialize(params: InitializeParams, expressionBuilder: ExpressionBuilder) {
    this.expressionBuilder = expressionBuilder
    if (params.capabilities.workspace?.configuration) {
      this.connection.client
        .register(DidChangeConfigurationNotification.type, undefined)
        .catch((err) =>
          this.connection.console.error('Failed to register change notification: ' + err.message)
        )
    }
    if (params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
      this.connection.onDidChangeWatchedFiles(async ({ changes }) => {
        this.connection.console.log(
          `*** onDidChangeWatchedFiles: ${JSON.stringify(changes, null, 2)}`
        )
      })

      const option: DidChangeWatchedFilesRegistrationOptions = {
        watchers: [{ globPattern: 'features/**/*.{feature,java,ts}' }],
      }
      this.connection.client
        .register(DidChangeWatchedFilesNotification.type, option)
        .catch((err) =>
          this.connection.console.error(
            'Failed to register DidChangeWatchedFilesNotification: ' + err.message
          )
        )
    }
    this.connection.console.log('Cucumber Language server initialized')
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

  private async updateSettings(settings: Settings) {
    const glueSources = await loadAll(settings.glueGlobs)
    const expressions = this.expressionBuilder.build(settings.language, glueSources)
    const gherkinSources = await loadAll(settings.gherkinGlobs)
    const stepTexts = gherkinSources.reduce<readonly string[]>(
      (prev, gherkinSource) => prev.concat(buildStepTexts(gherkinSource)),
      []
    )
    const stepDocuments = buildStepDocuments(stepTexts, expressions)
    this.index = jsSearchIndex(stepDocuments)
    console.log('Indexed!')
  }
}
