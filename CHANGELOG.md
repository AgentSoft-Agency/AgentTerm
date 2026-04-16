# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.4.1...v1.0.0) (2026-04-16)

### Breaking changes & migration

- The `agent-term hook` subcommand is removed. agent-term now integrates with each supported agent via a bundled `SKILL.md` installed into the agent's skills directory.
- **Upgrade path:** run `agent-term init`. It detects and removes any pre-1.0 hook entries from your agent config files, then installs the skill.
- Affected agents: Claude Code (`~/.claude/skills/agent-term/SKILL.md`), Codex CLI (`$CODEX_HOME/skills/agent-term/SKILL.md` or `~/.codex/skills/agent-term/SKILL.md`), Gemini CLI (`~/.gemini/skills/agent-term/SKILL.md`).

### ⚠ BREAKING CHANGES

* the 'agent-term hook' subcommand is removed. The
adapter interface drops parseHookInput, formatHookOutput, isSessionStart,
generateContext, register, unregister in favor of installSkill,
uninstallSkill, removeLegacyHooks. Stubs throw until wired up in
subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

### Features

* **assets:** add bundled SKILL.md for skill-based integration ([a498fdf](https://github.com/AgentSoft-Agency/AgentTerm/commit/a498fdf965d010d665c7029867b73e53098576da))
* **claude-code:** implement installSkill ([54cfc31](https://github.com/AgentSoft-Agency/AgentTerm/commit/54cfc3141dff968e498a3713aef0d4c40e5d8a9d))
* **claude-code:** implement removeLegacyHooks ([814741d](https://github.com/AgentSoft-Agency/AgentTerm/commit/814741d41157b4b405382b1c14d03c790d27a0bf))
* **claude-code:** implement uninstallSkill ([2385539](https://github.com/AgentSoft-Agency/AgentTerm/commit/238553981c092bae26f08d4ebed7bfe6e5fb94e9))
* **codex-cli:** implement installSkill, uninstallSkill, removeLegacyHooks ([099fd1d](https://github.com/AgentSoft-Agency/AgentTerm/commit/099fd1d34c6a8a994d141538f588dab8bc929aeb))
* **gemini-cli:** implement installSkill, uninstallSkill, removeLegacyHooks ([5c368e9](https://github.com/AgentSoft-Agency/AgentTerm/commit/5c368e9eb0646f667f663bd2db7b78a1058f106c))
* **hook:** add LONG_RUNNING_PATTERNS gate (pre-1.0 work, to be removed) ([4cdf516](https://github.com/AgentSoft-Agency/AgentTerm/commit/4cdf516b333e667145ffd70b072b6af73ebbc8f4))


### Refactors

* remove hook machinery, collapse AgentAdapter to skill surface ([9824e3c](https://github.com/AgentSoft-Agency/AgentTerm/commit/9824e3c545e3d62ac671cb3b818b1e0bd2489235))


### Documentation

* add v1.0.0 skill-based integration design ([889365e](https://github.com/AgentSoft-Agency/AgentTerm/commit/889365edd333ff352d2940d875d0678b61ebe394))
* add v1.0.0 skill-based integration implementation plan ([d2e37f1](https://github.com/AgentSoft-Agency/AgentTerm/commit/d2e37f1e1eee3f6ae86d79ba951ecef81907d34c))
* rewrite README for skill-based integration; fix init description ([58a849a](https://github.com/AgentSoft-Agency/AgentTerm/commit/58a849a76f81d30707cd312d92bf28b834e144f2))
* **specs:** mark pre-1.0 hook-era designs as superseded ([ed9e2fe](https://github.com/AgentSoft-Agency/AgentTerm/commit/ed9e2fe04312728258eb518d5c228b2546c82a83))
* update README for universal tmux hook and context injection ([c668062](https://github.com/AgentSoft-Agency/AgentTerm/commit/c6680620f55e8e6fd66bfcd885c38ece08dd78ec))

### [0.4.1](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.4.0...v0.4.1) (2026-03-24)


### Features

* add restart command to kill and re-run a terminal ([0e124e9](https://github.com/AgentSoft-Agency/AgentTerm/commit/0e124e91a4f193c0dc2e5fcfcb4210058ac8bb79))

## [0.4.0](https://github.com/AgentSoft-Agency/AgentTerm/compare/v0.3.0...v0.4.0) (2026-03-24)


### Features

* add isSessionStart to adapter interface, remove hookMode ([9f052fb](https://github.com/AgentSoft-Agency/AgentTerm/commit/9f052fbc9416ea4a1272c8ac91344a2a40754569))
* add SessionStart context injection to Claude Code adapter ([8c76ed7](https://github.com/AgentSoft-Agency/AgentTerm/commit/8c76ed7cdc92fa81d3e094b1395be54b168a1f13))
* add SessionStart context injection to Gemini CLI adapter ([bbd0f8e](https://github.com/AgentSoft-Agency/AgentTerm/commit/bbd0f8e131be0bd412097253c89df83f8ffa17a0))
* add shared context module for SessionStart injection ([e9078a9](https://github.com/AgentSoft-Agency/AgentTerm/commit/e9078a9623b49c1d5ea7ea94425ca5542ecd1ebd))


### Bug Fixes

* correct hook output format and session reliability ([db23119](https://github.com/AgentSoft-Agency/AgentTerm/commit/db23119534102080eaa118d4c61a6bd856807511))
* make context injection more directive about using agent-term ([244910c](https://github.com/AgentSoft-Agency/AgentTerm/commit/244910cb0afd0da6506c13c3783ec6a37b27d7f4))
* remove empty matcher from SessionStart hook registration ([8a5cd87](https://github.com/AgentSoft-Agency/AgentTerm/commit/8a5cd87df27dc437de2a674e47262d2877d51460))
* skip tmux commands in hook to prevent recursion ([636b39c](https://github.com/AgentSoft-Agency/AgentTerm/commit/636b39c511c1b3fca7d7d16eaac7d7f34f7a7a3a))
* soften context instructions to check agent-term first, then fallback ([671074a](https://github.com/AgentSoft-Agency/AgentTerm/commit/671074af16828c5821296ae2e1577087c4898d3e))
* use hook_event_name for Claude Code SessionStart detection ([a13f773](https://github.com/AgentSoft-Agency/AgentTerm/commit/a13f7735427231beba8bf114bec0be2b11aef906))


### Refactors

* codex CLI adapter uses shared context, adds isSessionStart ([7f9e8c8](https://github.com/AgentSoft-Agency/AgentTerm/commit/7f9e8c8d4d3d23d9cb58a8c8517f75171d06b77e))
* improve context text to prevent agents using tmux directly ([c8e8915](https://github.com/AgentSoft-Agency/AgentTerm/commit/c8e8915fd5d42e490412750020d8543f5b42bbcc))
* replace hookMode routing with isSessionStart detection ([5fb10a1](https://github.com/AgentSoft-Agency/AgentTerm/commit/5fb10a17c0e9f35fe5fa634b443296f62f7075f0))

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
