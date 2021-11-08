import { TreeSitterQueries } from './buildExpressions.js'

export const javaQueries: TreeSitterQueries = {
  defineParameterTypeQueries: [
    `
(method_declaration 
  (modifiers 
    (annotation 
      name: (identifier) @annotation-name 
      arguments: (annotation_argument_list
        [
          (string_literal) @expression
        ]
      )
    )
  )
  name: (identifier) @name
  (#eq? @annotation-name "ParameterType")
)
    `,
    `
(method_declaration 
  (modifiers 
    (annotation 
      name: (identifier) @annotation-name 
      arguments: (annotation_argument_list
        [
          (
            (element_value_pair
              key: (identifier) @name-key
              value: (string_literal) @name
            )
            (element_value_pair
              key: (identifier) @value-key
              value: (string_literal) @expression
            )
          )
          (
            (element_value_pair
              key: (identifier) @value-key
              value: (string_literal) @expression
            )
            (element_value_pair
              key: (identifier) @name-key
              value: (string_literal) @name
            )
          )
        ]
      )
    )
  )
  (#eq? @annotation-name "ParameterType")
  (#eq? @name-key "name")
  (#eq? @value-key "value")
)
`,
  ],
  defineStepDefinitionQueries: [
    `
(method_declaration 
  (modifiers 
    (annotation 
      name: (identifier) @annotation-name 
      arguments: (annotation_argument_list
        [
          (string_literal) @expression
        ]
      )
    )
  )
  (#match? @annotation-name "Given|When|Then")
)
`,
  ],
}
