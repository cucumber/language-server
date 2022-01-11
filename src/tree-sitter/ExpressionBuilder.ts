import {
  Expression,
  ExpressionFactory,
  ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions'
import Parser, { Language } from 'web-tree-sitter'

import { ParameterTypeMeta } from '../types'
import { makeParameterType, recordFromMatch, toString, toStringOrRegExp } from './helpers'
import { javaQueries } from './javaQueries.js'
import { LanguageName, TreeSitterQueries, WasmUrls } from './types'
import { typeScriptQueries } from './typeScriptQueries.js'

const treeSitterQueriesByLanguageName: Record<LanguageName, TreeSitterQueries> = {
  java: javaQueries,
  typescript: typeScriptQueries,
}

const defineStepDefinitionQueryKeys = <const>['expression']
const defineParameterTypeKeys = <const>['name', 'expression']

export class ExpressionBuilder {
  private parser: Parser
  private languages: Record<LanguageName, Language>

  async init(wasmUrls: WasmUrls) {
    await Parser.init()
    this.parser = new Parser()
    this.languages = {
      java: await Parser.Language.load(wasmUrls['java']),
      typescript: await Parser.Language.load(wasmUrls['typescript']),
    }
  }

  build(
    languageName: LanguageName,
    sources: readonly string[],
    parameterTypes: readonly ParameterTypeMeta[] | undefined
  ): readonly Expression[] {
    if (!this.parser) throw new Error(`Please call init() first`)
    const language = this.languages[languageName]
    const treeSitterQueries = treeSitterQueriesByLanguageName[languageName]
    this.parser.setLanguage(language)
    const expressions: Expression[] = []
    const parameterTypeRegistry = new ParameterTypeRegistry()
    const expressionFactory = new ExpressionFactory(parameterTypeRegistry)

    if (parameterTypes) {
      for (const parameterType of parameterTypes) {
        parameterTypeRegistry.defineParameterType(
          makeParameterType(parameterType.name, new RegExp(parameterType.regexp))
        )
      }
    }

    for (const source of sources) {
      const tree = this.parser.parse(source)
      for (const defineParameterTypeQuery of treeSitterQueries.defineParameterTypeQueries) {
        const matches = language.query(defineParameterTypeQuery).matches(tree.rootNode)
        const records = matches.map((match) => recordFromMatch(match, defineParameterTypeKeys))
        for (const record of records) {
          const name = record['name']
          const regexp = record['expression']
          if (name && regexp) {
            parameterTypeRegistry.defineParameterType(
              makeParameterType(toString(name), toStringOrRegExp(regexp))
            )
          }
        }
      }
    }

    for (const source of sources) {
      const tree = this.parser.parse(source)
      for (const defineStepDefinitionQuery of treeSitterQueries.defineStepDefinitionQueries) {
        const matches = language.query(defineStepDefinitionQuery).matches(tree.rootNode)
        const records = matches.map((match) =>
          recordFromMatch(match, defineStepDefinitionQueryKeys)
        )
        for (const record of records) {
          const expression = record['expression']
          if (expression) {
            expressions.push(expressionFactory.createExpression(toStringOrRegExp(expression)))
          }
        }
      }
    }

    return expressions
  }
}
