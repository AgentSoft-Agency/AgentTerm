# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.3.0](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.2.0...v0.3.0) (2026-03-24)


### Features

* add output action to HookResult interface ([56ed09e](https://github.com/AgentSoft-Agency/AgentTerm/commit/56ed09ed240caa3f75ca22f2290e33e161095505))
* add tmux helpers for remain-on-exit and session creation ([9c0b06e](https://github.com/AgentSoft-Agency/AgentTerm/commit/9c0b06ed6450d8b340ea4e2cfe5bac9065138037))
* add uniqueSuffix() to naming module ([babc936](https://github.com/AgentSoft-Agency/AgentTerm/commit/babc936327cfc49f3d16ba85e59d2ad6a4a9f53c))
* handle output action in Gemini CLI adapter via temp file ([f016cc7](https://github.com/AgentSoft-Agency/AgentTerm/commit/f016cc790abf9a6735053520b2d7738587d4d684))
* replace pattern-based hook with universal tmux routing ([3a87554](https://github.com/AgentSoft-Agency/AgentTerm/commit/3a87554c06a049ee854fdc604b6db5ddc71d8762))


### Refactors

* remove config file creation from init command ([1342a19](https://github.com/AgentSoft-Agency/AgentTerm/commit/1342a19b3513f3ddd44c80527ce781ae64c56545))
* remove pattern dependency from Codex CLI adapter ([ccf65d9](https://github.com/AgentSoft-Agency/AgentTerm/commit/ccf65d94d41852f596acebdc8eafd1a28c34c461))

## [0.2.0](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.1.1...v0.2.0) (2026-03-24)


### Features

* **codex-cli:** implement full Codex CLI adapter with SessionStart context injection ([08b5b97](https://github.com/AgentSoft-Agency/AgentTerm/commit/08b5b973354cac7e2107904e8113b5e7814c9f6a))

### [0.1.1](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.1.0...v0.1.1) (2026-03-24)

## 0.1.0 (2026-03-24)


### Features

* add agent adapter system with Claude Code, Gemini, Codex ([c094bf6](https://github.com/AgentSoft-Agency/AgentTerm/commit/c094bf657732f1d1689829e278a38198288b18ab))
* add config module for pattern matching ([a2b4829](https://github.com/AgentSoft-Agency/AgentTerm/commit/a2b4829f2f1840a91e6dec227bd62640b3bdb22a))
* add hook command with pattern matching and adapter dispatch ([9897a23](https://github.com/AgentSoft-Agency/AgentTerm/commit/9897a23cbefe74d902412f0ae4a30527bacd8cd9))
* add interactive init command with agent auto-detection ([de6d687](https://github.com/AgentSoft-Agency/AgentTerm/commit/de6d68750d08b10a53972e4955b34135cd18b823))
* add naming module for auto-name generation ([f8500dd](https://github.com/AgentSoft-Agency/AgentTerm/commit/f8500ddb5fd4562a574276337cd847df1df0f5b1))
* add terminal management commands with tests ([4934c2e](https://github.com/AgentSoft-Agency/AgentTerm/commit/4934c2ebaaa4674e16d94ccdd3d30ee8caccb80d))
* add tmux wrapper module ([9069653](https://github.com/AgentSoft-Agency/AgentTerm/commit/9069653b8b727d5299f965bf136e0fca57f9ea79))
* **gemini-cli:** implement formatHookOutput with Gemini rewrite format ([c1b52d7](https://github.com/AgentSoft-Agency/AgentTerm/commit/c1b52d70273d3b7192081e684d2e00c7625dae01))
* **gemini-cli:** implement parseHookInput with defensive JSON parsing ([d6a5ca7](https://github.com/AgentSoft-Agency/AgentTerm/commit/d6a5ca7d168ca9de2b246dcc0966e502c2422104))
* **gemini-cli:** implement register/unregister with name-based detection ([78c3b16](https://github.com/AgentSoft-Agency/AgentTerm/commit/78c3b168fb2d19cb80348edf93362a89ea4f3631))
* wire all subcommands into CLI entry point ([153703a](https://github.com/AgentSoft-Agency/AgentTerm/commit/153703ac08fe440fc5f0f703ad992e5d56ce9ed9))


### Documentation

* add Gemini CLI adapter design spec ([4e6e221](https://github.com/AgentSoft-Agency/AgentTerm/commit/4e6e221e3db059e8d74d023f0b9965108858f458))
* add Gemini CLI adapter implementation plan ([5a323a3](https://github.com/AgentSoft-Agency/AgentTerm/commit/5a323a378fb32ee73834621a0a87a80ebc9a792c))
* add README with installation, usage, and configuration guide ([5a1aed2](https://github.com/AgentSoft-Agency/AgentTerm/commit/5a1aed2d7cd8d493478dd346e4400f2dc81f3b07))
* address spec review feedback for Gemini CLI adapter ([324b43e](https://github.com/AgentSoft-Agency/AgentTerm/commit/324b43eb3933421907758e5dac0167fbc6aad7b5))
* mark Gemini CLI as fully supported ([39a0f17](https://github.com/AgentSoft-Agency/AgentTerm/commit/39a0f1752112f46ea27692fa8e8a57fb82ae59f3))


### Refactors

* **gemini-cli:** address code review feedback ([5584ada](https://github.com/AgentSoft-Agency/AgentTerm/commit/5584ada6e72293d3d41cea4c1a7dafb00bbd6484))
