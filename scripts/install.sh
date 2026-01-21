#!/bin/bash
#
# BrowserFlow installer
# Usage: curl -fsSL https://raw.githubusercontent.com/akatz-ai/browserflow/main/scripts/install.sh | bash
#
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() {
  echo -e "${GREEN}▸${NC} $1"
}

warn() {
  echo -e "${YELLOW}▸${NC} $1"
}

error() {
  echo -e "${RED}▸${NC} $1" >&2
  exit 1
}

header() {
  echo -e "${BLUE}$1${NC}"
}

# Check if a command exists
has_command() {
  command -v "$1" >/dev/null 2>&1
}

main() {
  header "
╔══════════════════════════════════════════╗
║         BrowserFlow Installer            ║
║   Human-in-the-Loop E2E Test Generation  ║
╚══════════════════════════════════════════╝
"

  # Check for bun or npm
  if has_command bun; then
    info "Found bun, installing with bun..."
    bun add -g @browserflow/cli
  elif has_command npm; then
    info "Found npm, installing with npm..."
    npm install -g @browserflow/cli
  else
    error "Neither bun nor npm found. Please install one of them first.

To install bun:
  curl -fsSL https://bun.sh/install | bash

To install Node.js/npm:
  https://nodejs.org/
"
  fi

  echo ""
  info "✓ BrowserFlow installed successfully!"
  echo ""

  # Verify installation
  if has_command bf; then
    info "Installed version:"
    bf --version
  else
    warn "Note: 'bf' command not found in PATH."
    echo ""
    echo "You may need to:"
    echo "  1. Restart your terminal, or"
    echo "  2. Add the global bin directory to your PATH"
    echo ""
    if has_command bun; then
      echo "  For bun, add this to your shell profile:"
      echo "    export PATH=\"\$HOME/.bun/bin:\$PATH\""
    fi
  fi

  echo ""
  header "Next steps:"
  echo ""
  echo "  # Install Playwright browsers"
  echo "  bunx playwright install chromium"
  echo ""
  echo "  # Initialize in your project"
  echo "  cd your-project"
  echo "  bf init"
  echo ""
  echo "  # Create a spec and start exploring"
  echo "  bf explore --spec my-spec --url http://localhost:3000"
  echo ""
  echo "  # Review the exploration"
  echo "  bf review"
  echo ""
}

main "$@"
