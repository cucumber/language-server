export type ParameterTypeMeta = { name: string; regexp: string }

export type Settings = {
  features: readonly string[]
  glue: readonly string[]
  parameterTypes?: readonly ParameterTypeMeta[]
}
