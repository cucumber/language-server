import { CucumberExpressions, ExpressionLink, Source } from '@cucumber/language-service'
import assert from 'assert'
import { Location, Position, Range } from 'vscode-languageserver-types'

import { getExpressionLinksAt, getStepReferences } from '../src/getStepReferences.js'

const glueUri = 'file:///home/testdata/rust/steps.rs'

function link(expression: CucumberExpressions.Expression, line: number): ExpressionLink {
  const targetSelectionRange = Range.create(line, 12, line, 40)
  return {
    expression,
    locationLink: {
      targetUri: glueUri,
      targetRange: Range.create(0, 0, 100, 0),
      targetSelectionRange,
    },
  }
}

describe('getExpressionLinksAt', () => {
  const registry = new CucumberExpressions.ParameterTypeRegistry()
  const links = [
    link(new CucumberExpressions.CucumberExpression('I have {int} cukes', registry), 3),
    link(new CucumberExpressions.CucumberExpression('I eat {int} cukes', registry), 8),
  ]

  it('returns the links whose selection range contains the position', () => {
    const result = getExpressionLinksAt(links, glueUri, Position.create(8, 20))
    assert.deepStrictEqual(result, [links[1]])
  })

  it('returns nothing outside the selection ranges', () => {
    assert.deepStrictEqual(getExpressionLinksAt(links, glueUri, Position.create(5, 0)), [])
  })

  it('returns nothing for another file', () => {
    assert.deepStrictEqual(
      getExpressionLinksAt(links, 'file:///home/testdata/rust/other.rs', Position.create(3, 20)),
      []
    )
  })
})

describe('getStepReferences', () => {
  const registry = new CucumberExpressions.ParameterTypeRegistry()
  const haveCukes = link(
    new CucumberExpressions.CucumberExpression('I have {int} cukes', registry),
    3
  )
  const eatCukes = link(
    new CucumberExpressions.RegularExpression(/^I eat (\d+) cukes$/, registry),
    8
  )

  const featureUri = 'file:///home/testdata/features/cukes.feature'
  const source: Source<'gherkin'> = {
    languageName: 'gherkin',
    uri: featureUri,
    content: `Feature: Cukes

  Scenario: Breakfast
    Given I have 3 cukes
    When I eat 1 cukes
    Then 2 cukes remain

  Scenario Outline: Meals
    Given I have <stock> cukes
    When I eat <amount> cukes

    Examples:
      | stock | amount |
      | 5     | 2      |
      | 8     | 3      |
`,
  }

  it('finds steps matching a Cucumber Expression', () => {
    const result = getStepReferences([source], [haveCukes])
    assert.deepStrictEqual(result, [
      Location.create(featureUri, Range.create(3, 4, 3, 24)),
      Location.create(featureUri, Range.create(8, 4, 8, 30)),
    ])
  })

  it('finds Scenario Outline steps once, with Examples values substituted', () => {
    const result = getStepReferences([source], [eatCukes])
    assert.deepStrictEqual(result, [
      Location.create(featureUri, Range.create(4, 4, 4, 22)),
      Location.create(featureUri, Range.create(9, 4, 9, 29)),
    ])
  })

  it('matches against the union of several links', () => {
    const result = getStepReferences([source], [haveCukes, eatCukes])
    assert.strictEqual(result.length, 4)
  })

  it('returns nothing when no step matches', () => {
    const none = link(new CucumberExpressions.CucumberExpression('nothing here', registry), 1)
    assert.deepStrictEqual(getStepReferences([source], [none]), [])
  })
})
