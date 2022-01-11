import { LanguageName } from './tree-sitter'

export type Settings = {
  language: LanguageName
  gherkinGlobs: readonly string[]
  glueGlobs: readonly string[]
}
