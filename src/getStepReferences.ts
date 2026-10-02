import { compile } from '@cucumber/gherkin'
import { walkGherkinDocument } from '@cucumber/gherkin-utils'
import { ExpressionLink, parseGherkinDocument, Source } from '@cucumber/language-service'
import { IdGenerator, Step } from '@cucumber/messages'
import { Location, LocationLink, Position, Range } from 'vscode-languageserver-types'

const newId = IdGenerator.uuid()

/**
 * Returns the step definitions that contain the given position in a glue file
 * (anywhere in the step definition, from its expression to the end of its body).
 */
export function getExpressionLinksAt(
  expressionLinks: readonly ExpressionLink[],
  uri: string,
  position: Position
): readonly ExpressionLink[] {
  return expressionLinks.filter(
    ({ locationLink }) =>
      locationLink.targetUri === uri && contains(definitionRange(locationLink), position)
  )
}

// A targetRange starting at the top of the file is the whole file
// (cucumber/language-service#315); use the expression literal instead.
function definitionRange(locationLink: LocationLink): Range {
  const { targetRange, targetSelectionRange } = locationLink
  const startsAtTop = targetRange.start.line === 0 && targetRange.start.character === 0
  const selectionAtTop =
    targetSelectionRange.start.line === 0 && targetSelectionRange.start.character === 0
  return startsAtTop && !selectionAtTop ? targetSelectionRange : targetRange
}

function contains(range: Range, position: Position): boolean {
  if (position.line < range.start.line || position.line > range.end.line) return false
  if (position.line === range.start.line && position.character < range.start.character) return false
  if (position.line === range.end.line && position.character > range.end.character) return false
  return true
}

/**
 * Returns the location of every Gherkin step that matches at least one of the
 * expressions. Scenario Outline steps are matched with their Examples values
 * substituted (via pickles) and reported once, at the outline step's location.
 */
export function getStepReferences(
  gherkinSources: readonly Source<'gherkin'>[],
  expressionLinks: readonly ExpressionLink[]
): readonly Location[] {
  const locations: Location[] = []
  for (const source of gherkinSources) {
    const { gherkinDocument } = parseGherkinDocument(source.content)
    if (!gherkinDocument) continue
    const stepsById = walkGherkinDocument(gherkinDocument, new Map<string, Step>(), {
      step(step, acc) {
        acc.set(step.id, step)
        return acc
      },
    })
    const seen = new Set<string>()
    for (const pickle of compile(gherkinDocument, source.uri, newId)) {
      for (const pickleStep of pickle.steps) {
        const step = stepsById.get(pickleStep.astNodeIds[0])
        if (!step || seen.has(step.id)) continue
        if (expressionLinks.some((link) => link.expression.match(pickleStep.text) !== null)) {
          seen.add(step.id)
          locations.push(Location.create(source.uri, stepRange(step)))
        }
      }
    }
  }
  return locations
}

function stepRange(step: Step): Range {
  const line = step.location.line - 1
  const start = (step.location.column ?? 1) - 1
  return Range.create(line, start, line, start + step.keyword.length + step.text.length)
}
