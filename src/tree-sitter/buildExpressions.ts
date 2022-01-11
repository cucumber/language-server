import {
  Expression,
  ExpressionFactory,
  ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions'
import Parser from 'web-tree-sitter'

import { ParameterTypeMeta } from '../types'
import { makeParameterType, recordFromMatch, toString, toStringOrRegExp } from './helpers.js'

const defineStepDefinitionQueryKeys = <const>['expression']
const defineParameterTypeKeys = <const>['name', 'expression']

export type TreeSitterQueries = {
  defineParameterTypeQueries: readonly string[]
  defineStepDefinitionQueries: readonly string[]
}

export function buildExpressions(
  parser: Parser,
  language: Parser.Language,
  treeSitterQueries: TreeSitterQueries,
  sources: readonly string[],
  parameterTypes: readonly ParameterTypeMeta[] | undefined
): readonly Expression[] {
  parser.setLanguage(language)
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
    const tree = parser.parse(source)
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
    const tree = parser.parse(source)
    for (const defineStepDefinitionQuery of treeSitterQueries.defineStepDefinitionQueries) {
      const matches = language.query(defineStepDefinitionQuery).matches(tree.rootNode)
      const records = matches.map((match) => recordFromMatch(match, defineStepDefinitionQueryKeys))
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
