import { LocationLink, Range } from 'vscode-languageserver-types'

export function getStepDefinitionSnippetLinks(
  links: readonly LocationLink[]
): readonly LocationLink[] {
  // TODO: Find the most relevant one by looking at the words in the expression
  // If none found, use the most recently modified
  const linksByFile: Record<string, LocationLink> = {}
  for (const link of links) {
    // Insert right after the last step definition

    const targetRange = Range.create(
      link.targetRange.end.line + 1,
      0,
      link.targetRange.end.line + 1,
      0
    )

    linksByFile[link.targetUri] = {
      targetUri: link.targetUri,
      targetRange,
      targetSelectionRange: targetRange,
    }
  }

  return Object.values(linksByFile).sort((a, b) => a.targetUri.localeCompare(b.targetUri))
}
