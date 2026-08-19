# OmniOps

English | [中文](README.zh.md)

**OmniOps** is the company-wide AIOps platform for intelligent IT operations, focused on fast problem diagnosis across the entire technology stack.

It is built on the open-source [DeepSeek Harness](https://deepseek.com) agent framework — an _everything is a plugin_ architecture powered by [Cordis](https://github.com/cordiverse/cordis) — and extends it into an operations-diagnosis toolkit. Its cascading three-level diagnosis scope (**TechStack → Component → Skill**) covers database deadlocks, big-key detection, GPU memory/utilization, drop-card detection, and more, helping engineers locate and resolve incidents quickly.

## Developer preview

OmniOps is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/luxiu666/OmniOps.git
cd OmniOps
pnpm install
pnpm run build
pnpm dsh web
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/luxiu666/OmniOps/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">OmniOps Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
