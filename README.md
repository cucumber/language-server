<h1 align="center">
  <img src="https://raw.githubusercontent.com/cucumber/cucumber-js/7df2c9b4f04099b81dc5c00cd73b404401cd6e46/docs/images/logo.svg" alt="">
  <br>
  Cucumber Language Server
</h1>
<p align="center">
  <b>A <a href="https://langserver.org/">Language Server</a> for Cucumber</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@cucumber/language-server">
    <img src="https://img.shields.io/npm/v/@cucumber/language-server.svg?color=dark-green" alt="npm">
  </a>
  <a href="https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml">
    <img src="https://github.com/cucumber/language-server/actions/workflows/test-javascript.yml/badge.svg" alt="test-javascript-package">
  </a>
  <a href="https://github.com/cucumber/language-server/actions/workflows/release-github.yml">
    <img src="https://github.com/cucumber/language-server/actions/workflows/release-github.yml/badge.svg" alt="release-package-github">
  </a>
  <a href="https://opencollective.com/cucumber">
    <img src="https://opencollective.com/cucumber/backers/badge.svg" alt="backers">
  </a>
  <a href="https://opencollective.com/cucumber">
    <img src="https://opencollective.com/cucumber/sponsors/badge.svg" alt="sponsors">
  </a>
</p>

Provides most of the functionality offered by the
[Cucumber Visual Studio Code Extension](https://github.com/cucumber/vscode) and can also be utilised with other editors that support the Language Server Protocol (LSP).

## Features

See [Cucumber Language Service](https://github.com/cucumber/language-service), which implements most of the logic in this server.
If you are looking to add a new feature, you should probably add it to [Cucumber Language Service](https://github.com/cucumber/language-service).

## Install

Cucumber Language Server is [available on npm](https://www.npmjs.com/package/@cucumber/language-server):

```console
npm install @cucumber/language-server
```

### Settings

The LSP client can provide settings to the server, but the server provides [reasonable defaults](https://github.com/cucumber/language-server/blob/main/src/CucumberLanguageServer.ts) (see `defaultSettings`) if the client does not
provide them.

The server retrieves `cucumber.*` settings from the client with a [workspace/configuration](https://microsoft.github.io/language-server-protocol/specification#workspace_configuration) request.

See [Settings](https://github.com/cucumber/language-server/blob/main/src/types.ts) for details about the expected format.

## External VSCode Usage

We've encountered an issue with the Node version used by [Treesitter](https://github.com/tree-sitter/tree-sitter/issues/2338), a
dependency of this language server, when working outside of VSCode. For optimal
compatibility, please use the same Node version as version 18 of VSCode.

## Support

Support is [available from the community](https://cucumber.io/tools/cucumber-open/support/) if you need it.
