import assert from 'assert'
import { LocationLink, Range } from 'vscode-languageserver-types'

import { getStepDefinitionSnippetLinks } from '../src/getStepDefinitionSnippetLinks.js'

describe('guessStepDefinitionSnippetPath', () => {
  it('creates a location 2 lines below the first link', async () => {
    const targetRangeA1 = Range.create(10, 0, 20, 14)
    const targetRangeA2 = Range.create(30, 0, 40, 14)
    const targetRangeB = Range.create(25, 0, 35, 14)
    const links: LocationLink[] = [
      {
        targetUri: 'file://home/testdata/typescript/a.ts',
        targetRange: targetRangeA2,
        targetSelectionRange: targetRangeA2,
      },
      {
        targetUri: 'file://home/testdata/typescript/b.ts',
        targetRange: targetRangeB,
        targetSelectionRange: targetRangeB,
      },
      {
        targetUri: 'file://home/testdata/typescript/a.ts',
        targetRange: targetRangeA1,
        targetSelectionRange: targetRangeA1,
      },
    ]

    const expectedRange1 = Range.create(21, 0, 21, 0)
    const expectedRange2 = Range.create(36, 0, 36, 0)
    const expected: LocationLink[] = [
      {
        targetUri: 'file://home/testdata/typescript/a.ts',
        targetRange: expectedRange1,
        targetSelectionRange: expectedRange1,
      },
      {
        targetUri: 'file://home/testdata/typescript/b.ts',
        targetRange: expectedRange2,
        targetSelectionRange: expectedRange2,
      },
    ]
    const result = getStepDefinitionSnippetLinks(links)
    assert.deepStrictEqual(result, expected)
  })
})
