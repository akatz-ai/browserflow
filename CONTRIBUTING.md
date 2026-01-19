# Contributing to BrowserFlow

Thank you for your interest in contributing to BrowserFlow!

## Development Setup

```bash
git clone https://github.com/your-org/browserflow.git
cd browserflow
bun install
bunx bf doctor  # Verify setup
```

## Code Style

- TypeScript: Follow project's ESLint configuration
- Use `bun run typecheck` to verify types
- Keep functions small and focused

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun test`
5. Run build: `bun run build`
6. Commit with clear messages
7. Push and create a PR

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
