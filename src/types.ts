import { LanguageName } from './tree-sitter'

export type ParameterTypeMeta = { name: string; regexp: string }

export type Settings = {
  language: LanguageName
  features: readonly string[]
  stepdefinitions: readonly string[]
  parametertypes?: readonly ParameterTypeMeta[]
}
