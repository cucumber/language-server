import { TreeSitterQueries } from './buildExpressions.js'

export const typeScriptQueries: TreeSitterQueries = {
  defineParameterTypeQueries: [
    `
(call_expression
  function: (identifier) @function-name
  arguments: (arguments
    (object
      [
        (
          (pair
            key: (property_identifier) @name-key
            value: (string) @name
          )
          (pair
            key: (property_identifier) @regexp-key
            value: [(regex) (string)] @expression
          )
        )
        (
          (pair
            key: (property_identifier) @regexp-key
            value: [(regex) (string)] @expression
          )
          (pair
            key: (property_identifier) @name-key
            value: (string) @name
          )
        )
      ]
    )
  )
  (#eq? @function-name "defineParameterType")
  (#eq? @name-key "name")
  (#eq? @regexp-key "regexp")
)
`,
  ],
  defineStepDefinitionQueries: [
    `
(call_expression
  function: (identifier) @function-name
  arguments: (arguments
    [
      (string) @expression
      (regex) @expression
    ]
  )
  (#match? @function-name "Given|When|Then")
)
`,
  ],
}
