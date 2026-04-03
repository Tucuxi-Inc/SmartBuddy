# SmartBuddy

Cognitive coding companion plugin for Claude Code. Uses a real cognitive engine (50-trait personality, RNN directors, 8-voice council) extracted from Living Worlds.

## Structure
- `engine/` — Python cognitive engine (MCP server)
- `tests/` — pytest test suite
- `hooks/` — Claude Code hook event handlers
- `scripts/` — Shell scripts called by hooks
- `skills/` — User-invokable Claude Code skills

## Development
```bash
pip install -e ".[dev]"
pytest tests/ -v
```

## Key Constraints
- Only dependency: numpy + mcp
- No references to Living Worlds multi-NPC systems
- No API keys or secrets anywhere
- All cognitive state serializes to JSON
