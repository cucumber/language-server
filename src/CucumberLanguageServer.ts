import { Expression } from '@cucumber/cucumber-expressions'
import {
  getGherkinCompletionItems,
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  Index,
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

import { ExpressionBuilder } from './tree-sitter/ExpressionBuilder.js'
import { version } from './version.js'

type ServerInfo = {
  name: string
  version: string
}

export class CucumberLanguageServer {
  public static async create(
    connection: Connection,
    params: InitializeParams
  ): Promise<CucumberLanguageServer> {
    const expressionBuilder = new ExpressionBuilder()
    await expressionBuilder.init({
      // Relative to dist/src/cjs
      java: `${__dirname}/../../../tree-sitter-java.wasm`,
      typescript: `${__dirname}/../../../tree-sitter-typescript.wasm`,
    })
    return new CucumberLanguageServer(connection, params, expressionBuilder)
  }

  private expressions: readonly Expression[] = []
  private index: Index
  private readonly documents = new TextDocuments(TextDocument)

  constructor(
    private readonly connection: Connection,
    private readonly params: InitializeParams,
    private readonly expressionBuilder: ExpressionBuilder
  ) {
    this.documents.listen(this.connection)

    // The content of a text document has changed. This event is emitted
    // when the text document is first opened or when its content has changed.
    this.documents.onDidChangeContent((change) => {
      connection.console.log(`*** onDidChangeContent: ${change.document.uri}`)
      connection.console.log(
        'DOCS:' +
          JSON.stringify(
            this.documents.all().map((d) => d.uri),
            null,
            2
          )
      )
      if (change.document.uri.match(/\.feature$/)) {
        this.validateGherkinDocument(change.document)
      }
    })

    connection.onCompletion((params) => {
      const doc = this.documents.get(params.textDocument.uri)
      if (!doc || !this.index) return []
      const gherkinSource = doc.getText()
      return getGherkinCompletionItems(gherkinSource, params.position.line, this.index)
    })

    connection.onCompletionResolve((item) => item)

    connection.languages.semanticTokens.on((semanticTokenParams) => {
      const doc = this.documents.get(semanticTokenParams.textDocument.uri)
      if (!doc) return { data: [] }
      const gherkinSource = doc.getText()
      return getGherkinSemanticTokens(gherkinSource, this.expressions)
    })

    connection.onDocumentFormatting((params) => {
      const doc = this.documents.get(params.textDocument.uri)
      if (!doc) return []
      const gherkinSource = doc.getText()
      return getGherkinFormattingEdits(gherkinSource)
    })
  }

  public initialize() {
    if (this.params.capabilities.workspace?.configuration) {
      this.connection.client
        .register(DidChangeConfigurationNotification.type, undefined)
        .catch((err) =>
          this.connection.console.error('Failed to register change notification: ' + err.message)
        )
    }
    if (this.params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
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
}
