export type LanguageName = 'java' | 'typescript'

export type Source = {
  language: LanguageName
  content: string
}

export const languageByExt: Record<string, LanguageName> = {
  '.xts': 'typescript',
  '.ts': 'typescript',
  '.java': 'java',
}

export type WasmUrls = Record<LanguageName, string>

export type TreeSitterQueries = {
  defineParameterTypeQueries: readonly string[]
  defineStepDefinitionQueries: readonly string[]
}
