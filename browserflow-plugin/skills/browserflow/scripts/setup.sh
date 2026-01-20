#!/bin/bash
# BrowserFlow Setup Script
# Installs the bf CLI and its dependencies

set -e

echo "Setting up BrowserFlow..."

# Detect package manager
if command -v bun &> /dev/null; then
    PKG_MGR="bun"
elif command -v npm &> /dev/null; then
    PKG_MGR="npm"
else
    echo "Error: No package manager found (bun or npm required)"
    exit 1
fi

echo "Using package manager: $PKG_MGR"

# Find browserflow root (look for package.json with "browserflow" name)
find_browserflow_root() {
    local dir="$1"
    while [ "$dir" != "/" ]; do
        if [ -f "$dir/package.json" ]; then
            if grep -q '"name": "browserflow"' "$dir/package.json" 2>/dev/null; then
                echo "$dir"
                return 0
            fi
        fi
        dir=$(dirname "$dir")
    done
    return 1
}

# Try to find browserflow installation
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BF_ROOT=$(find_browserflow_root "$SCRIPT_DIR") || BF_ROOT=""

if [ -z "$BF_ROOT" ]; then
    echo "BrowserFlow not found locally. Installing from npm..."

    if [ "$PKG_MGR" = "bun" ]; then
        bun add -g @browserflow/cli
    else
        npm install -g @browserflow/cli
    fi
else
    echo "Found BrowserFlow at: $BF_ROOT"
    cd "$BF_ROOT"

    # Install dependencies
    echo "Installing dependencies..."
    if [ "$PKG_MGR" = "bun" ]; then
        bun install
    else
        npm install
    fi

    # Build packages
    echo "Building packages..."
    if [ "$PKG_MGR" = "bun" ]; then
        bun run build
    else
        npm run build
    fi

    # Link CLI globally
    echo "Linking bf CLI globally..."
    cd packages/cli
    if [ "$PKG_MGR" = "bun" ]; then
        bun link
    else
        npm link
    fi
fi

# Install Playwright browsers
echo "Installing Playwright browsers..."
if [ "$PKG_MGR" = "bun" ]; then
    bunx playwright install chromium
else
    npx playwright install chromium
fi

# Create project directories
echo "Creating project directories..."
mkdir -p specs
mkdir -p .browserflow/explorations
mkdir -p e2e/tests

# Add .browserflow to .gitignore if not present
if [ -f .gitignore ]; then
    if ! grep -q "^\.browserflow/$" .gitignore 2>/dev/null; then
        echo "" >> .gitignore
        echo "# BrowserFlow exploration artifacts" >> .gitignore
        echo ".browserflow/" >> .gitignore
        echo "Added .browserflow/ to .gitignore"
    fi
else
    echo "# BrowserFlow exploration artifacts" > .gitignore
    echo ".browserflow/" >> .gitignore
    echo "Created .gitignore with .browserflow/"
fi

echo ""
echo "BrowserFlow setup complete!"
echo ""
echo "Quick start:"
echo "  1. Create a spec:  vim specs/my-feature.yaml"
echo "  2. Explore:        bf explore --spec my-feature --url http://localhost:3000"
echo "  3. Review:         bf review"
echo "  4. Generate test:  (AI writes Playwright code from artifacts)"
echo ""
echo "Run 'bf --help' for more commands."
