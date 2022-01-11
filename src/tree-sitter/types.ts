export type LanguageName = 'java' | 'typescript'

export type WasmUrls = Record<LanguageName, string>

export type TreeSitterQueries = {
  defineParameterTypeQueries: readonly string[]
  defineStepDefinitionQueries: readonly string[]
}
