import assert from 'assert'
import { LocationLink, Range } from 'vscode-languageserver-types'

import { guessStepDefinitionSnippetLink } from '../src/guessStepDefinitionSnippetLink.js'

describe('guessStepDefinitionSnippetPath', () => {
  it('creates a location 2 lines below the first link', async () => {
    const targetRange = Range.create(10, 0, 20, 14)
    const link: LocationLink = {
      targetUri: 'file://home/testdata/typescript/*.ts',
      targetRange,
      targetSelectionRange: targetRange,
    }

    const result = await guessStepDefinitionSnippetLink([link])
    assert.strictEqual(result!.targetUri, link.targetUri)
    assert.deepStrictEqual(result!.targetRange, Range.create(21, 0, 21, 0))
  })
})
