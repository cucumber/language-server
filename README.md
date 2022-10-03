[![test-javascript](https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml/badge.svg)](https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml)

# Cucumber Language Server

A [Language Server](https://langserver.org/) for Cucumber.

This language server provides most of the functionality offered by the
[Cucumber Visual Studio Code Extension](https://github.com/cucumber/vscode).

It may also be used to power other LSP editors.

## Supported features

See [Cucumber Language Service](https://github.com/cucumber/language-service), which implements most of the logic in this server. 
If you are looking to add a new feature, you should probably add it to [Cucumber Language Service](https://github.com/cucumber/language-service).

### Settings

The LSP client can provide settings to the server, but the server provides [reasonable defaults](https://github.com/cucumber/language-server/blob/main/src/CucumberLanguageServer.ts) (see `defaultSettings`) if the client does not
provide them.

The server retrieves `cucumber.*` settings from the client with a [workspace/configuration](https://microsoft.github.io/language-server-protocol/specification#workspace_configuration) request.

See [Settings](https://github.com/cucumber/language-server/blob/main/src/types.ts) for details about the expected format.
