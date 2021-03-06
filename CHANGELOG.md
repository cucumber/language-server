# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [0.12.11] - 2022-07-14
### Fixed
- Use wasm server in standalone mode. Fixes [#56](https://github.com/cucumber/language-server/issues/56)
- Fix invalid file URI on Windows. [#57](https://github.com/cucumber/language-server/pull/57). Fixes
[cucumber/vscode#78]https://github.com/cucumber/vscode/issues/78),
[cucumber/vscode#82](https://github.com/cucumber/vscode/issues/82),
[cucumber/language-service#70](https://github.com/cucumber/language-service/issues/70)

## [0.12.10] - 2022-06-14
### Fixed
- Bugfixes in [@cucumber/language-service 0.30.0](https://github.com/cucumber/language-service/releases/tag/v0.30.0)

## [0.12.9] - 2022-05-26
### Fixed
- Log working directory in addition to root path

## [0.12.8] - 2022-05-26
### Fixed
- Don't throw an error when generating suggestions for RegExp.

## [0.12.7] - 2022-05-26
### Fixed
- Improved logging

## [0.12.6] - 2022-05-26
### Fixed
- Don't crash on optionals following non-text or whitespace

## [0.12.5] - 2022-05-25
### Fixed
- Upgrade to `@cucumber/language-service 0.25.0`

## [0.12.4] - 2022-05-25
### Fixed
- Generate step definition now correctly uses `Given`, `When` or `Then` for undefined steps that use `And` or `But`
- Generated C# step definitions now follow SpecFlow conventions.

## [0.12.3] - 2022-05-25
### Fixed
- Correctly parse Java parameter types

## [0.12.2] - 2022-05-24
### Fixed
- No longer throw `Failed to reindex: No parameter type named ***` for custom parameter types.
- Fixed other concurrency bugs.
- Let the user choose in what file to generate step definitions.

## [0.12.1] - 2022-05-24
### Fixed
- Fixed a bug with snippet generation

## [0.12.0] - 2022-05-24
### Added
- Add Generate Step Definition (`textDocument/codeAction`) ([#45](https://github.com/cucumber/language-server/pull/45))

## [0.11.0] - 2022-05-23
### Added
- Add Go To Step Definition (`textDocument/definition`) ([#46](https://github.com/cucumber/language-server/pull/46))

## [0.10.4] - 2022-05-12
### Fixed
- Don't error when a parameter type is already registered

## [0.10.3] - 2022-05-12
### Fixed
- Tell client to refresh semantic tokens after a reindex

## [0.10.2] - 2022-05-12
### Fixed
- Automatically update all Gherkin documents when glue changes

## [0.10.1] - 2022-05-12
### Fixed
- Don't error if a step def expression fails to parse.

## [0.10.0] - 2022-05-12
### Fixed
- Parse files correctly if the user has spefied globs without extensions.

## [0.9.0] - 2022-05-11
### Fixed
- Ignore parse errors and print them to STDERR

## [0.8.2] - 2022-05-10
### Fixed
- The `0.8.1` release failed

## [0.8.1] - 2022-05-10
### Fixed
- Autocomplete suggestions are showing better results

## [0.8.0] - 2022-05-09
### Added
- Support for Ruby

## [0.7.1] - 2022-05-05
### Fixed
- Autocomplete for unmatched step definitions

## [0.7.0] - 2022-04-27
### Added
- Support for C#
- Support for PHP

### Changed
- Remove external dependency on `@cucumber/language-service` - always use tree-sitter wasm

## [0.6.0] - 2022-04-26
### Changed
- Use tree-sitter Node.js bindings instead of web (WASM) bindings.
- Updated to `@cucumber/language-service 0.13.0`

### Removed
- Support for Node.js 17 removed - see [tree-sitter/tree-sitter#1503](https://github.com/tree-sitter/tree-sitter/issues/1503)

## [0.5.1] - 2022-02-11
### Fixed
- Fix server immediately crashing when starting [#30](https://github.com/cucumber/language-server/pull/30)

## [0.5.0] - 2022-02-05
### Changed
- Moved tree-sitter logic to language-service [#28](https://github.com/cucumber/language-server/issues/28)

### Fixed
- Do not crash anymore when cucumber settings are missing

## [0.4.0] - 2022-01-19
### Added
- Added settings (with reasonable defaults) so the client can specify where the source
code is. The server uses this for auto complete and detecting defined steps.

### Fixed
- Fixed auto complete by re-enabling the building of the index that backs it.

## [0.3.3] - 2022-01-10
### Fixed
- Export `./bin/cucumber-language-server.cjs`
- Fix server initialization

## [0.3.2] - 2022-01-10
### Fixed
- Fix startup script

## [0.3.1] - 2021-11-08
### Fixed
- Fix release process

## [0.3.0] - 2021-11-08
### Added
- Add tree-sitter functionality for extracting expressions from source code

## [0.2.0] - 2021-10-12
### Changed
- Upgrade to `@cucumber/cucumber-expressions 14.0.0`

## [0.1.0] - 2021-09-07
### Added
- Document Formatting
([#1732](https://github.com/cucumber/common/pull/1732)
[aslakhellesoy](https://github.com/aslakhellesoy))

## [0.0.1] - 2021-09-02
### Added
- First release

[Unreleased]: https://github.com/cucumber/language-server/compare/v0.12.11...HEAD
[0.12.11]: https://github.com/cucumber/language-server/compare/v0.12.10...v0.12.11
[0.12.10]: https://github.com/cucumber/language-server/compare/v0.12.9...v0.12.10
[0.12.9]: https://github.com/cucumber/language-server/compare/v0.12.8...v0.12.9
[0.12.8]: https://github.com/cucumber/language-server/compare/v0.12.7...v0.12.8
[0.12.7]: https://github.com/cucumber/language-server/compare/v0.12.6...v0.12.7
[0.12.6]: https://github.com/cucumber/language-server/compare/v0.12.5...v0.12.6
[0.12.5]: https://github.com/cucumber/language-server/compare/v0.12.4...v0.12.5
[0.12.4]: https://github.com/cucumber/language-server/compare/v0.12.3...v0.12.4
[0.12.3]: https://github.com/cucumber/language-server/compare/v0.12.2...v0.12.3
[0.12.2]: https://github.com/cucumber/language-server/compare/v0.12.1...v0.12.2
[0.12.1]: https://github.com/cucumber/language-server/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/cucumber/language-server/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/cucumber/language-server/compare/v0.10.4...v0.11.0
[0.10.4]: https://github.com/cucumber/language-server/compare/v0.10.3...v0.10.4
[0.10.3]: https://github.com/cucumber/language-server/compare/v0.10.2...v0.10.3
[0.10.2]: https://github.com/cucumber/language-server/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/cucumber/language-server/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/cucumber/language-server/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/cucumber/language-server/compare/v0.8.2...v0.9.0
[0.8.2]: https://github.com/cucumber/language-server/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/cucumber/language-server/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/cucumber/language-server/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/cucumber/language-server/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/cucumber/language-server/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/cucumber/language-server/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/cucumber/language-server/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/cucumber/language-server/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/cucumber/language-server/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/cucumber/language-server/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/cucumber/language-server/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/cucumber/language-server/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/cucumber/language-server/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cucumber/language-server/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cucumber/language-server/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/cucumber/common/tree/v0.0.1
