# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/cucumber/language-server/compare/v0.5.1...HEAD
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
