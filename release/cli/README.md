# babalcode

Terminal coding agent — an AI pair programmer that runs in your shell.

## Install

```bash
npm install -g @babalcode/cli
```

Requires **Node.js 18+** (used only by the tiny install launcher; the app itself is a standalone binary).

## Quick start

```bash
babalcode
```

On first launch:

1. Run `/connect` to add an API key for your provider (stored in the OS keychain).
2. Run `/models` to pick a model.
3. Type a task at the prompt.

## Commands

| Command | Description |
|---------|-------------|
| `/connect` | Add or update provider API keys |
| `/models` | Switch the active model |
| `/custom` | Add an OpenAI-compatible endpoint |
| `/sessions` | Browse past sessions |
| `/clear` | Clear the current chat |
| `/exit` | Quit |

## API keys

babalcode is **bring-your-own-key**. Keys are stored in your OS credential manager (Windows Credential Manager, macOS Keychain, or Linux libsecret). Environment variables for supported providers still work as a fallback.

## Supported platforms

Prebuilt binaries are provided for:

- macOS (Apple Silicon and Intel)
- Linux (x64 and arm64)
- Windows (x64)

If install fails with “no prebuilt binary”, your OS/arch combination is not supported yet.

## Version

```bash
babalcode --version
```

## License

Proprietary — see [LICENSE](./LICENSE). Unauthorized copying, redistribution, or reverse engineering is prohibited.
