import { CucumberExpression, RegularExpression } from '@cucumber/cucumber-expressions'
import assert from 'assert'

import { ExpressionBuilder, WasmUrls } from '../../src/index.js'

const wasmUrls: WasmUrls = {
  java: 'tree-sitter-java.wasm',
  typescript: 'tree-sitter-typescript.wasm',
}

describe('ExpressionBuilder', () => {
  const expressionBuilder = new ExpressionBuilder()
  let initialized = false

  beforeEach(async () => {
    if (!initialized) {
      await expressionBuilder.init(wasmUrls)
      initialized = true
    }
  })

  it('builds expressions from Java source', async () => {
    const stepdefs = `
class StepDefinitions {
    @Given("I have {int} cukes in my belly"  )
    void method1() {
    }

    @When("you have some time")
    void method2() {
    }

    @Then("a {iso-date}")
    void method3() {
    }

    @Then("a {date}")
    void method4() {
    }
}
`

    const parameterTypes = `
class ParameterTypes {
    @ParameterType("(?:.*) \\\\d{1,2}, \\\\d{4}")
    public Date date(String date) throws ParseException {
        return getDateInstance(MEDIUM, ENGLISH).parse(date);
    }

    @ParameterType(name = "iso-date", value = "\\\\d{4}-\\\\d{2}-\\\\d{2}")
    public Date isoDate(String date) throws ParseException {
        return new SimpleDateFormat("yyyy-mm-dd").parse(date);
    }
}
`

    const expressions = expressionBuilder.build('java', [stepdefs, parameterTypes])
    assert.deepStrictEqual(
      expressions.map((e) => e.source),
      ['I have {int} cukes in my belly', 'you have some time', 'a {iso-date}', 'a {date}']
    )
  })

  it('builds expressions from TypeScript source', async () => {
    const stepdefs = `
import { Given, Then, When } from '@cucumber/cucumber'

Given('a {uuid}', async function (uuid: string) {
})

When('a {date}', async function (date: Date) {
})

Then(/a regexp/, async function () {
})
`

    const parameterTypes = `
import { defineParameterType } from '@cucumber/cucumber'

defineParameterType({
  name: 'uuid',
  regexp: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  transformer: (uuid: string) => uuid,
})

defineParameterType({
  name: 'date',
  regexp: /\\d{4}-\\d{2}-\\d{2}/,
  transformer: (name: string) => new Date(name),
})
`

    const expressions = expressionBuilder.build('typescript', [stepdefs, parameterTypes])
    assert.deepStrictEqual(
      expressions.map((e) =>
        e instanceof CucumberExpression ? e.source : (e as RegularExpression).regexp
      ),
      ['a {uuid}', 'a {date}', /a regexp/]
    )
  })
})
