export type Extension = '.java' | '.ts'
export type LanguageName = 'java' | 'typescript'

export type Source = {
  language: LanguageName
  content: string
}

export type WasmUrls = Record<LanguageName, string>

export type TreeSitterQueries = {
  defineParameterTypeQueries: readonly string[]
  defineStepDefinitionQueries: readonly string[]
}
