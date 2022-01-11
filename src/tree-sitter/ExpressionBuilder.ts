import {
  Expression,
  ExpressionFactory,
  ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions'
import Parser, { Language } from 'web-tree-sitter'

import { ParameterTypeMeta } from '../types.js'
import { makeParameterType, recordFromMatch, toString, toStringOrRegExp } from './helpers.js'
import { javaQueries } from './javaQueries.js'
import { LanguageName, Source, TreeSitterQueries, WasmUrls } from './types.js'
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
    sources: readonly Source[],
    parameterTypes: readonly ParameterTypeMeta[] | undefined
  ): readonly Expression[] {
    if (!this.parser) throw new Error(`Please call init() first`)
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
      const language = this.languages[source.language]
      this.parser.setLanguage(language)
      const treeSitterQueries = treeSitterQueriesByLanguageName[source.language]
      const tree = this.parser.parse(source.content)

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
      const language = this.languages[source.language]
      this.parser.setLanguage(language)
      const treeSitterQueries = treeSitterQueriesByLanguageName[source.language]
      const tree = this.parser.parse(source.content)

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
