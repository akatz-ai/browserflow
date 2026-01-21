# BrowserFlow JSON Schemas

This directory contains JSON Schemas generated from BrowserFlow's Zod schemas. These enable IDE features like autocomplete, inline validation, and documentation for YAML spec files and config files.

## Available Schemas

| Schema | Description |
|--------|-------------|
| `spec-v2.schema.json` | Validates BrowserFlow test specification YAML files |
| `browserflow.schema.json` | Validates browserflow.yaml configuration files |
| `lockfile.schema.json` | Validates lockfile.json exploration result files |

## VS Code Setup

### Option 1: Inline Schema Reference

Add a schema reference comment at the top of your YAML files:

```yaml
# yaml-language-server: $schema=./node_modules/@akatz-ai/core/schemas/spec-v2.schema.json
version: 2
name: my-test
steps:
  - id: step-1
    action: navigate
    url: https://example.com
```

For config files:

```yaml
# yaml-language-server: $schema=./node_modules/@akatz-ai/core/schemas/browserflow.schema.json
project:
  name: my-project
  base_url: http://localhost:3000
```

### Option 2: Workspace Settings

Add schema associations to your `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "./node_modules/@akatz-ai/core/schemas/spec-v2.schema.json": "specs/**/*.yaml",
    "./node_modules/@akatz-ai/core/schemas/browserflow.schema.json": "browserflow.yaml"
  }
}
```

### Option 3: User Settings

For global configuration, add to your VS Code user settings:

```json
{
  "yaml.schemas": {
    "https://browserflow.dev/schemas/spec-v2.schema.json": [
      "**/specs/**/*.yaml",
      "**/*.bf.yaml"
    ],
    "https://browserflow.dev/schemas/browserflow.schema.json": "**/browserflow.yaml"
  }
}
```

## Other IDEs

### JetBrains IDEs (WebStorm, IntelliJ)

1. Open Settings > Languages & Frameworks > Schemas and DTDs > JSON Schema Mappings
2. Add a new mapping:
   - Schema file: `node_modules/@akatz-ai/core/schemas/spec-v2.schema.json`
   - File path pattern: `specs/*.yaml`

### Neovim (with nvim-lspconfig)

Configure yaml-language-server with schema associations:

```lua
require('lspconfig').yamlls.setup({
  settings = {
    yaml = {
      schemas = {
        ["./node_modules/@akatz-ai/core/schemas/spec-v2.schema.json"] = "specs/**/*.yaml",
        ["./node_modules/@akatz-ai/core/schemas/browserflow.schema.json"] = "browserflow.yaml",
      },
    },
  },
})
```

## Regenerating Schemas

Schemas are automatically regenerated during the build process:

```bash
bun run build
```

To regenerate schemas only:

```bash
cd packages/core
bun run generate:schemas
```

## Schema URLs

The schemas use these canonical URLs (for when hosted):
- `https://browserflow.dev/schemas/spec-v2.schema.json`
- `https://browserflow.dev/schemas/browserflow.schema.json`
- `https://browserflow.dev/schemas/lockfile.schema.json`
