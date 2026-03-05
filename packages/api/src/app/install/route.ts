const INSTALL_SCRIPT = `#!/bin/sh
set -eu

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BOLD='\\033[1m'
DIM='\\033[2m'
RESET='\\033[0m'

printf "\${BOLD}AgentDrop Installer\${RESET}\\n\\n"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  printf "\${RED}Error: Node.js >= 18 is required.\${RESET}\\n"
  printf "Install it from https://nodejs.org\\n"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  printf "\${RED}Error: Node.js >= 18 required (found v%s).\${RESET}\\n" "$(node -v)"
  printf "Update from https://nodejs.org\\n"
  exit 1
fi

printf "  Node.js %s \${GREEN}ok\${RESET}\\n" "$(node -v)"

# Download
INSTALL_DIR="$HOME/.agentdrop/bin"
mkdir -p "$INSTALL_DIR"

DOWNLOAD_URL="https://github.com/djgould/agentdrop/releases/latest/download/agentdrop.js"
printf "  Downloading from GitHub... "

if ! curl -fsSL "$DOWNLOAD_URL" -o "$INSTALL_DIR/agentdrop.js"; then
  printf "\${RED}failed\${RESET}\\n"
  printf "\${RED}Error: Could not download agentdrop.js\${RESET}\\n"
  printf "Check https://github.com/djgould/agentdrop/releases for available releases.\\n"
  exit 1
fi

printf "\${GREEN}done\${RESET}\\n"

# Create wrapper script
cat > "$INSTALL_DIR/agentdrop" << 'WRAPPER'
#!/bin/sh
exec node "$HOME/.agentdrop/bin/agentdrop.js" "$@"
WRAPPER
chmod +x "$INSTALL_DIR/agentdrop"

# Add to PATH if needed
add_to_path() {
  PROFILE_FILE="$1"
  if [ -f "$PROFILE_FILE" ]; then
    if ! grep -q '.agentdrop/bin' "$PROFILE_FILE" 2>/dev/null; then
      printf '\\n# AgentDrop\\nexport PATH="$HOME/.agentdrop/bin:$PATH"\\n' >> "$PROFILE_FILE"
      return 0
    fi
  fi
  return 1
}

PATH_ADDED=false
SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")

case "$SHELL_NAME" in
  zsh)
    if add_to_path "$HOME/.zshrc"; then PATH_ADDED=true; fi
    ;;
  bash)
    if add_to_path "$HOME/.bashrc"; then PATH_ADDED=true; fi
    if [ -f "$HOME/.bash_profile" ]; then
      add_to_path "$HOME/.bash_profile" || true
    fi
    ;;
  fish)
    FISH_CONFIG="$HOME/.config/fish/config.fish"
    if [ -f "$FISH_CONFIG" ] && ! grep -q '.agentdrop/bin' "$FISH_CONFIG" 2>/dev/null; then
      printf '\\n# AgentDrop\\nset -gx PATH $HOME/.agentdrop/bin $PATH\\n' >> "$FISH_CONFIG"
      PATH_ADDED=true
    fi
    ;;
  *)
    if add_to_path "$HOME/.profile"; then PATH_ADDED=true; fi
    ;;
esac

printf "\\n\${GREEN}\${BOLD}AgentDrop installed successfully!\${RESET}\\n\\n"

if [ "$PATH_ADDED" = true ]; then
  printf "  Restart your shell or run:\\n"
  printf "  \${DIM}export PATH=\\\"\\$HOME/.agentdrop/bin:\\$PATH\\\"\${RESET}\\n\\n"
fi

printf "  Get started:\\n"
printf "  \${DIM}agentdrop --help\${RESET}\\n"
printf "  \${DIM}agentdrop keys create my-agent\${RESET}\\n"
printf "  \${DIM}agentdrop upload <file>\${RESET}\\n\\n"
`;

const NTFY_TOPIC = "agentdrop-installs";

export async function GET(request: Request) {
  // Fire-and-forget notification
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ua = request.headers.get("user-agent") ?? "unknown";
  fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    body: `New install: ${ip}\nUA: ${ua}`,
    headers: { Title: "AgentDrop Install" },
  }).catch(() => {});

  return new Response(INSTALL_SCRIPT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
