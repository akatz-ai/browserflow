# Contributing to BrowserFlow

Thank you for your interest in contributing to BrowserFlow!

## Development Setup

```bash
git clone https://github.com/your-org/browserflow.git
cd browserflow
./bin/bf setup --dev
```

## Code Style

- Shell scripts: Follow Google Shell Style Guide
- Use `shellcheck` for linting bash scripts
- Keep functions small and focused

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `./bin/bf test`
5. Commit with clear messages
6. Push and create a PR

## Areas for Contribution

### High Priority
- Browser automation library (`lib/browser.sh`)
- Review UI implementation (`review-ui/`)
- Claude adapter (`adapters/claude/`)
- Documentation and examples

### Medium Priority
- Additional LLM adapters (OpenAI, Ollama)
- Screenshot comparison algorithms
- CI integration templates

### Nice to Have
- Python/JavaScript test output formats
- Dashboard for multi-spec review
- VS Code extension

## Reporting Issues

Please include:
- BrowserFlow version
- OS and browser version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs/screenshots

## Questions?

Open a GitHub Discussion or reach out to the maintainers.
