[![test-javascript](https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml/badge.svg)](https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml)

# Cucumber Language Server

A [Language Server](https://langserver.org/) for Cucumber.

This language server provides most of the functionality offered by the
[Cucumber Visual Studio Code Extension](https://github.com/cucumber/vscode).

It may also be used to power other LSP editors.

## Supported features

See [Cucumber Language Service](https://github.com/cucumber/language-service)

### Settings

The LSP client can provide settings to the server, but the server provides reasonable defaults if the client does not
provide them.

The server retrieves `cucumber.*` settings from the client with a [workspace/configuration](https://microsoft.github.io/language-server-protocol/specification#workspace_configuration) request.
The server expects settings in the following format:

features: ['src/test/**/*.feature', 'features/**/*.feature'],
glue: ['src/test/**/*.java', 'features/**/*.ts'],

| setting          | default                                              | example                                      |
| ---------------- | ---------------------------------------------------- | -------------------------------------------- |
| `features`       | `['src/test/**/*.feature', 'features/**/*.feature']` | (see default)                                |
| `glue`           | `['src/test/**/*.java', 'features/**/*.ts']`         | (see default)                                |
| `parameterTypes` | `[]`                                                 | `[{ name: 'actor', regexp: '[A-Z][a-z]+' }]` |

The `parameterTypes` setting can be used to define [Custom Parameter Types](https://github.com/cucumber/cucumber-expressions#custom-parameter-types)
that are not directly visible in the source code. For example, if you're using the `actor` parameter type from
[@cucumber/screenplay](https://github.com/cucumber/screenplay.js#actors) you'll have to
declare this in the `parameterTypes` setting.
