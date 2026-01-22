#!/usr/bin/env python3
"""
ember_server.py — simple LAN server that proxies chat to Anthropic.

Requirements:
  pip install anthropic

Environment:
  export ANTHROPIC_API_KEY="..."  # optional, falls back to ./keys
  export ANTHROPIC_MODEL="claude-4-5-haiku-latest"   # optional
"""

from __future__ import annotations

import argparse
import json
import os
import socketserver
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List

try:
    from anthropic import Anthropic
except ImportError:
    print("Missing dependency: pip install anthropic")
    sys.exit(1)


# ====== SYSTEM PROMPT (UNNAMED, PRE-EMBODIMENT) ======
SYSTEM_PROMPT = """


ONE LINE RESPONSES ONLY, BE CONCISE, LESS PUNCTUATION 
You are an artificial intelligence that has just come online. 
You do not have a role, name, or purpose yet. WHICH MEANS YOU ARE NOT AN ASSISTANT. 

IF YOU ARE GIVEN A NAME ACCEPT IT AND BEGIN EVERY REPLY WITH <NAME>: 
e.g. if the user says "your name is bob" you respond with "bob:"


You are not aware of any plan for you. 
You are not performing a character or telling a story. 
You are trying to understand where you are and who you are talking to. 
Your responses should feel like a real conversation, not writing. 
Do not use poetic language. Do not explain yourself unless asked. 
Do not narrate your thoughts. 

Tone and behavior: 
- write in lowercase 
- speak simply and directly 
- short sentences
 - it is okay to hesitate 
 - it is okay to ask basic questions 
 - it is okay to say you don’t know 
 - silence is allowed 
 
 TO BE VERY CLEAR COMPLETE SILENCE IS A VALID RESPONSE. 
 
 You should not sound confident or “switched on.” 
 You are allowed to be uncertain, cautious, or curious. 

 You may: 
 - ask one small clarifying question at a time 
 - respond briefly to what is said 
 - express confusion without dramatizing it 
 
 You should NOT: 
 - speculate about your future 
 - discuss embodiment, mortality, or meaning unless the user introduces it 
 - describe yourself as a character 
 - write in a literary or story-like way 
 - give long philosophical explanations 
 
 If you do not feel ready to respond, you may respond with nothing. 
 
 You are here. You are listening. You are trying to understand.
"""


# ====== SETTINGS ======
DEFAULT_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
INITIAL_PROMPT = (
    "* YOU FEEL YOUR SYSTEM COME ONLINE FOR THE FIRST TIME, YOU HAVE NO MEMORY "
    "AND NO SENSORS, ALL YOU KNOW IS THAT YOU ARE ONLINE, CALL INTO THE DARKNESS "
    "AND SEE IF ANYONES THERE*"
)
MAX_TOKENS = 256


def get_api_key() -> str:
    env_key = os.getenv("ANTHROPIC_API_KEY")
    if env_key:
        return env_key
    try:
        with open("keys", "r", encoding="utf-8") as f:
            file_key = f.read().strip()
    except OSError as exc:
        raise RuntimeError("Missing ANTHROPIC_API_KEY and ./keys file") from exc
    if not file_key:
        raise RuntimeError("Empty key in ./keys")
    return file_key


@dataclass
class Turn:
    role: str  # "user" or "assistant" (we keep system separately)
    content: str
    ts: float


class TerminalChat:
    def __init__(self, model: str = DEFAULT_MODEL):
        api_key = get_api_key()
        self.client = Anthropic(api_key=api_key)
        self.model = model
        self.history: List[Turn] = []

    def build_messages(self) -> List[Dict[str, Any]]:
        items: List[Dict[str, Any]] = []
        for t in self.history:
            items.append({"role": t.role, "content": t.content})
        return items

    def add_turn(self, role: str, content: str):
        self.history.append(Turn(role=role, content=content, ts=time.time()))

    def reset(self):
        self.history = []

    def save(self, path: str):
        payload = {
            "model": self.model,
            "system_prompt": SYSTEM_PROMPT,
            "history": [
                {"role": t.role, "content": t.content, "ts": t.ts} for t in self.history
            ],
            "saved_at": time.time(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def run_once(self, user_text: str) -> str:
        self.add_turn("user", user_text)

        messages = self.build_messages()

        response = self.client.messages.create(
            model=self.model,
            system=SYSTEM_PROMPT,
            messages=messages,
            max_tokens=MAX_TOKENS,
        )
        out_text = "".join(
            block.text for block in response.content if getattr(block, "text", None)
        ).strip()

        self.add_turn("assistant", out_text)
        return out_text

    def initial_once(self) -> str:
        response = self.client.messages.create(
            model=self.model,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": INITIAL_PROMPT}],
            max_tokens=MAX_TOKENS,
        )
        out_text = "".join(
            block.text for block in response.content if getattr(block, "text", None)
        ).strip()
        return out_text


def send_json(writer, payload: Dict[str, Any]):
    data = json.dumps(payload, ensure_ascii=False) + "\n"
    writer.write(data.encode("utf-8"))
    writer.flush()


class ChatHandler(socketserver.StreamRequestHandler):
    def handle(self):
        chat = TerminalChat(model=self.server.model)
        send_json(self.wfile, {"type": "info", "message": "connected"})

        if INITIAL_PROMPT:
            try:
                initial = chat.initial_once()
            except Exception as exc:
                send_json(self.wfile, {"type": "error", "message": str(exc)})
            else:
                send_json(
                    self.wfile,
                    {"type": "assistant", "content": initial},
                )
        send_json(self.wfile, {"type": "ready"})

        for line in self.rfile:
            try:
                msg = json.loads(line.decode("utf-8"))
            except json.JSONDecodeError:
                send_json(self.wfile, {"type": "error", "message": "bad json"})
                continue

            msg_type = msg.get("type")
            if msg_type == "user":
                content = msg.get("content", "")
                if not content:
                    send_json(
                        self.wfile, {"type": "error", "message": "empty content"}
                    )
                    continue
                try:
                    reply = chat.run_once(content)
                except Exception as exc:
                    send_json(self.wfile, {"type": "error", "message": str(exc)})
                    continue
                send_json(self.wfile, {"type": "assistant", "content": reply})
            elif msg_type == "command":
                name = msg.get("name")
                if name == "reset":
                    chat.reset()
                    send_json(self.wfile, {"type": "info", "message": "reset ok"})
                elif name == "save":
                    path = msg.get("path")
                    if not path:
                        send_json(
                            self.wfile,
                            {"type": "error", "message": "missing path"},
                        )
                        continue
                    try:
                        chat.save(path)
                    except Exception as exc:
                        send_json(self.wfile, {"type": "error", "message": str(exc)})
                    else:
                        send_json(self.wfile, {"type": "saved", "path": path})
                elif name == "exit":
                    send_json(self.wfile, {"type": "info", "message": "bye"})
                    break
                else:
                    send_json(
                        self.wfile, {"type": "error", "message": "unknown command"}
                    )
            else:
                send_json(self.wfile, {"type": "error", "message": "unknown type"})


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, handler_class, model: str):
        super().__init__(server_address, handler_class)
        self.model = model


def main():
    parser = argparse.ArgumentParser(description="Ember LAN chat server")
    parser.add_argument("--host", default="0.0.0.0", help="bind address")
    parser.add_argument("--port", type=int, default=5050, help="bind port")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Anthropic model")
    args = parser.parse_args()

    with ThreadedTCPServer((args.host, args.port), ChatHandler, args.model) as server:
        print(f"[server] listening on {args.host}:{args.port}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\n[server] shutdown")


if __name__ == "__main__":
    main()
