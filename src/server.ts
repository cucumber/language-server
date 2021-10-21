import {
  getGherkinDiagnostics,
  getGherkinFormattingEdits,
  getGherkinSemanticTokens,
  semanticTokenTypes,
  ExpressionBuilder,
  getGherkinCompletionItems,
  Index,
  parseGherkinDocument,
  buildStepDocuments,
  jsSearchIndex,
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
import { Expression } from '@cucumber/cucumber-expressions'
import { extractStepTexts } from '@cucumber/language-service'

const expressionBuilder = new ExpressionBuilder()
let expressions: readonly Expression[] = []
let index: Index

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false
let hasDidChangeWatchedFilesCapability = false
let hasSemanticTokensSupport = false

connection.onInitialize(async (params: InitializeParams) => {
  connection.console.log('onInitialize. Directory: ' + process.cwd())
  await expressionBuilder.init({
    java: '/Users/Aslak.Hellesoy/git/cucumber/language-server/node_modules/@cucumber/language-service/tree-sitter-java.wasm',
    typescript:
      '/Users/Aslak.Hellesoy/git/cucumber/language-server/node_modules/@cucumber/language-service/tree-sitter-typescript.wasm',
  })

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
  if (change.document.uri.match(/\.feature$/)) {
    validateGherkinDocument(change.document)
    // TODO: only parse once - validateGherkinDocument also parses...
    const { gherkinDocument, error } = parseGherkinDocument(change.document.getText())
    if (gherkinDocument) {
      const stepTexts = extractStepTexts(gherkinDocument, [])
      const stepDocuments = buildStepDocuments(stepTexts, expressions)
      index = jsSearchIndex(stepDocuments)
    }
  }
  if (change.document.uri.match(/\.ts$/)) {
    const doc = documents.get(change.document.uri)
    if (!doc) return
    const sources = [doc.getText()]
    expressions = expressionBuilder.build('typescript', sources)
  }
})

function validateGherkinDocument(textDocument: TextDocument): void {
  const diagnostics = getGherkinDiagnostics(textDocument.getText(), expressions)
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
  const doc = documents.get(textDocumentPosition.textDocument.uri)
  if (!doc || !index) return []
  const gherkinSource = doc.getText()
  return getGherkinCompletionItems(gherkinSource, textDocumentPosition.position.line, index)
})

connection.onCompletionResolve((item) => item)

connection.languages.semanticTokens.on(
  (semanticTokenParams: SemanticTokensParams): SemanticTokens => {
    const doc = documents.get(semanticTokenParams.textDocument.uri)
    if (!doc) return { data: [] }
    const gherkinSource = doc.getText()
    return getGherkinSemanticTokens(gherkinSource, expressions)
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
