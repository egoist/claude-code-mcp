# gemini-cli-mcp

MCP server for delegating tasks to Gemini CLI. This allows you to invoke Gemini CLI agent capabilities from other MCP-enabled tools.

## Prerequisites

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) must be installed and configured
- The `gemini` command must be available in your PATH

## Installation

### For Gemini CLI

Add to your `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "gemini-delegate": {
      "command": "bunx",
      "args": ["gemini-cli-mcp@latest"]
    }
  }
}
```

### For Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "gemini-cli-mcp": {
      "command": "bunx",
      "args": ["gemini-cli-mcp@latest"]
    }
  }
}
```

## Usage

Once installed, you can use the `task` tool to delegate tasks to Gemini CLI:

```
@gemini-delegate task("Create a Python script that prints hello world", cwd="/path/to/project")
```

### Parameters

- `task` (required): The task description to delegate to Gemini CLI
- `cwd` (required): The working directory where Gemini CLI should run (must be an absolute path)
- `historyId` (optional): Continue from a previous conversation history

## How it Works

This MCP server wraps the Gemini CLI and allows other tools to programmatically invoke it. When you call the `task` tool:

1. The MCP server spawns the `gemini` CLI with your task
2. It uses `--output-format stream-json` to get structured responses
3. The response is streamed back through the MCP protocol
4. The conversation history ID is preserved for follow-up tasks

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Test locally
bun run dist/index.js
```
