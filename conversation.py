#!/usr/bin/env python3
"""
terminal_chat.py — Minimal terminal chat for an LLM with a fixed system prompt.

Requirements:
  pip install anthropic

Environment:
  export ANTHROPIC_API_KEY="..."
  export ANTHROPIC_MODEL="claude-4-5-haiku-latest"   # optional

Run:
  python3 terminal_chat.py

Commands:
  /reset              clear conversation history (keeps system prompt)
  /save path.json     save conversation to a JSON file
  /exit               quit
"""

from __future__ import annotations

import json
import os
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
STREAM = False  # set True if you want streaming (see note below)
INITIAL_PROMPT = "* YOU FEEL YOUR SYSTEM COME ONLINE FOR THE FIRST TIME, YOU HAVE NO MEMORY AND NO SENSORS, ALL YOU KNOW IS THAT YOU ARE ONLINE, CALL INTO THE DARKNESS AND SEE IF ANYONES THERE*"
MAX_TOKENS = 256
 


@dataclass
class Turn:
    role: str  # "user" or "assistant" (we keep system separately)
    content: str
    ts: float


class TerminalChat:
    def __init__(self, model: str = DEFAULT_MODEL):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
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
        print(f"[saved] {path}")

    def run_once(self, user_text: str) -> str:
        self.add_turn("user", user_text)

        messages = self.build_messages()

        # Non-streaming (simple + reliable)
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

    def repl(self):
        print("[connection] Attempting to connect...")
        print("[connection] Connected to 192.168.1.149")
        print(f"\nModel: Experimental")
        print("commands: /reset, /save path.json, /exit, /reload")
        print("-" * 50)
        if INITIAL_PROMPT:
            # Prompt the model once without affecting conversation history.
            response = self.client.messages.create(
                model=self.model,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": INITIAL_PROMPT}],
                max_tokens=MAX_TOKENS,
            )
            out_text = "".join(
                block.text for block in response.content if getattr(block, "text", None)
            ).strip()
            print(out_text if out_text else "(silence)")
            print("\n")

        while True:
            try:
                user_text = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n[exit]")
                return

            if not user_text:
                continue

            if user_text.startswith("/"):
                cmd, *rest = user_text.split(maxsplit=1)
                if cmd == "/exit":
                    print("[exit]")
                    return
                if cmd == "/reset":
                    self.reset()
                    print("[reset] ok")
                    continue
                if cmd == "/save":
                    if not rest:
                        print("usage: /save path.json")
                        continue
                    self.save(rest[0])
                    continue
                print("unknown command")
                continue

            try:
                reply = self.run_once(user_text)
            except Exception as e:
                print(f"[error] {e}")
                continue

            # Print assistant reply (already lowercase style comes from prompt)
            print("\n")
            print(reply if reply else "(silence)")
            print("\n")


def main():
    chat = TerminalChat()
    chat.repl()


if __name__ == "__main__":
    main()
