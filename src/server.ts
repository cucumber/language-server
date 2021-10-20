import {
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  semanticTokenTypes,
} from '@cucumber/language-service'
import {
  DidChangeWatchedFilesNotification,
  DidChangeWatchedFilesRegistrationOptions,
  SemanticTokens,
  SemanticTokensOptions,
} from 'vscode-languageserver'
import {
  CompletionItem,
  createConnection,
  DidChangeConfigurationNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  SemanticTokensParams,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false
let hasDidChangeWatchedFilesCapability = false
let hasSemanticTokensSupport = false

connection.onInitialize(async (params: InitializeParams) => {
  hasConfigurationCapability = params.capabilities.workspace?.configuration || false
  hasWorkspaceFolderCapability = params.capabilities.workspace?.workspaceFolders || false
  hasDidChangeWatchedFilesCapability =
    params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration || false
  hasSemanticTokensSupport =
    params.capabilities.textDocument?.semanticTokens?.dynamicRegistration || false

  const semanticTokensProvider: SemanticTokensOptions | undefined = hasSemanticTokensSupport
    ? {
        full: {
          delta: false,
        },
        legend: {
          tokenTypes: semanticTokenTypes,
          tokenModifiers: [],
        },
      }
    : undefined

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
      },
      workspace: {
        workspaceFolders: {
          supported: hasWorkspaceFolderCapability,
        },
      },
      semanticTokensProvider,
      documentFormattingProvider: true,
    },
  }
  return result
})

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client
      .register(DidChangeConfigurationNotification.type, undefined)
      .catch((err) =>
        connection.console.error('Failed to register change notification: ' + err.message)
      )
  }
  if (hasWorkspaceFolderCapability) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    connection.workspace.onDidChangeWorkspaceFolders((_event) => {
      connection.console.log('Workspace folder change event received.')
    })
  }
  if (hasDidChangeWatchedFilesCapability) {
    const option: DidChangeWatchedFilesRegistrationOptions = {
      watchers: [{ globPattern: '**/*.ts' }],
    }
    connection.client
      .register(DidChangeWatchedFilesNotification.type, option)
      .catch((err) =>
        connection.console.error(
          'Failed to register DidChangeWatchedFilesNotification: ' + err.message
        )
      )
  }
  connection.console.log('Cucumber Language server initialized')
  // updateIndexAndExpressions()
})

connection.onDidChangeConfiguration(() => {
  documents.all().forEach(validateGherkinDocument)
})

connection.onDidChangeWatchedFiles(async ({ changes }) => {
  connection.console.log(`*** onDidChangeWatchedFiles: ${JSON.stringify(changes, null, 2)}`)
})

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
  connection.console.log(`*** onDidChangeContent: ${change.document.uri}`)
  // updateIndexAndExpressionsDebounce()
  if (change.document.uri.match(/\.feature$/)) {
    validateGherkinDocument(change.document)
  }
  if (change.document.uri.match(/\.(ts|java)$/)) {
    console.log('TODO: Update index using')
  }
})

function validateGherkinDocument(textDocument: TextDocument): void {
  // const diagnostics = getGherkinDiagnostics(textDocument.getText(), indexAndExpressions.expressions)
  const diagnostics = getGherkinDiagnostics(textDocument.getText(), [])
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  if (!textDocumentPosition) throw new Error('DELETEME')
  return []
  // const doc = documents.get(textDocumentPosition.textDocument.uri)
  // if (!doc || !indexAndExpressions) return []
  // const gherkinSource = doc.getText()
  // return getGherkinCompletionItems(
  //   gherkinSource,
  //   textDocumentPosition.position.line,
  //   indexAndExpressions.index
  // )
})

connection.onCompletionResolve((item) => item)

connection.languages.semanticTokens.on(
  (semanticTokenParams: SemanticTokensParams): SemanticTokens => {
    const doc = documents.get(semanticTokenParams.textDocument.uri)
    if (!doc) return { data: [] }
    const gherkinSource = doc.getText()
    // return getGherkinSemanticTokens(gherkinSource, indexAndExpressions.expressions)
    return getGherkinSemanticTokens(gherkinSource, [])
  }
)

connection.onDocumentFormatting(async (params): Promise<TextEdit[]> => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return []
  const gherkinSource = doc.getText()
  return getGherkinFormattingEdits(gherkinSource)
})

documents.listen(connection)

connection.listen()
