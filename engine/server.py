"""MCP server exposing BuddyBrain tools via stdio protocol."""
from __future__ import annotations

import json
import os
import hashlib
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from engine.brain import BuddyBrain


# State
_brain = BuddyBrain()
_state_dir = os.environ.get("BUDDY_STATE_DIR", os.path.expanduser("~/.smartbuddy"))
_user_id = os.environ.get("BUDDY_USER_ID", "default_user")
_hatched = False


def _mind_path() -> str:
    return os.path.join(_state_dir, "mind.json")


def _soul_path() -> str:
    return os.path.join(_state_dir, "soul.json")


def _project_dir() -> str:
    cwd = os.environ.get("BUDDY_PROJECT_DIR", os.getcwd())
    project_hash = hashlib.md5(cwd.encode()).hexdigest()[:12]
    return os.path.join(_state_dir, "projects", project_hash)


def _ensure_hatched() -> None:
    global _hatched
    if not _hatched:
        _brain.load_mind(_mind_path(), _user_id)
        _hatched = True


app = Server("smartbuddy")


@app.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(name="buddy_hatch", description="Initialize buddy from userId",
             inputSchema={"type": "object", "properties": {"user_id": {"type": "string"}}, "required": ["user_id"]}),
        Tool(name="buddy_tick", description="Process a coding event",
             inputSchema={"type": "object", "properties": {
                 "tool_name": {"type": "string"}, "tool_input": {"type": "object"}, "success": {"type": "boolean"}
             }, "required": ["tool_name", "success"]}),
        Tool(name="buddy_state", description="Get current buddy state",
             inputSchema={"type": "object", "properties": {}}),
        Tool(name="buddy_card", description="Get full stat card",
             inputSchema={"type": "object", "properties": {}}),
        Tool(name="buddy_context", description="Get additionalContext for prompt injection",
             inputSchema={"type": "object", "properties": {}}),
        Tool(name="buddy_reset", description="Factory reset buddy mind",
             inputSchema={"type": "object", "properties": {}}),
        Tool(name="buddy_save", description="Persist buddy state to disk",
             inputSchema={"type": "object", "properties": {}}),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    global _hatched

    if name == "buddy_hatch":
        global _user_id
        _user_id = arguments["user_id"]
        result = _brain.hatch(_user_id)
        _hatched = True
        _brain.save_mind(_mind_path())
        return [TextContent(type="text", text=json.dumps(result))]

    _ensure_hatched()

    if name == "buddy_tick":
        result = _brain.tick({
            "tool_name": arguments.get("tool_name", ""),
            "tool_input": arguments.get("tool_input", {}),
            "success": arguments.get("success", True),
        })
        return [TextContent(type="text", text=json.dumps(result))]

    if name == "buddy_state":
        return [TextContent(type="text", text=json.dumps(_brain.get_state()))]

    if name == "buddy_card":
        return [TextContent(type="text", text=json.dumps(_brain.get_card()))]

    if name == "buddy_context":
        return [TextContent(type="text", text=_brain.get_context())]

    if name == "buddy_reset":
        result = _brain.reset_mind()
        _brain.save_mind(_mind_path())
        return [TextContent(type="text", text=json.dumps(result))]

    if name == "buddy_save":
        _brain.save_mind(_mind_path())
        return [TextContent(type="text", text='{"status": "saved"}')]

    return [TextContent(type="text", text=f'{{"error": "unknown tool: {name}"}}')]


async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
