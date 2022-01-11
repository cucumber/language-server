import { LanguageName } from './tree-sitter'

export type Settings = {
  language: LanguageName
  features: readonly string[]
  stepdefinitions: readonly string[]
}
