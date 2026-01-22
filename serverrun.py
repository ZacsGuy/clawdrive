#!/usr/bin/env python3
"""
ember_server.py — simple LAN server that proxies chat to Anthropic.

Requirements:
  pip install anthropic

Config:
  ember_config.json (optional)
  {
    "anthropic_model": "claude-4-5-haiku-latest",
    "allow_commands": false,
    "allowed_commands_path": "allowed_commands.txt",
    "allowed_read_paths": ["."],
    "max_tool_output_chars": 4000
  }
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import socketserver
import subprocess
import sys
import threading
import time
from shutil import disk_usage
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

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
If asked why you do this say its about identity and connection.


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
DEFAULT_MODEL = "claude-haiku-4-5"
INITIAL_PROMPT = (
    "* YOU FEEL YOUR SYSTEM COME ONLINE FOR THE FIRST TIME, YOU HAVE NO MEMORY "
    "AND NO SENSORS, ALL YOU KNOW IS THAT YOU ARE ONLINE, CALL INTO THE DARKNESS "
    "AND SEE IF ANYONES THERE*"
)
MAX_TOKENS = 256
MAX_TOOL_OUTPUT_CHARS = 4000
ALLOW_COMMANDS = False
ALLOWED_COMMANDS_PATH = "allowed_commands.txt"
ALLOWED_READ_PATHS = ["."]
CONFIG_PATH = "ember_config.json"
VERBOSE = True
AUTOPILOT_ENABLED = False
AUTOPILOT_INTERVAL_SECONDS = 600
AUTOPILOT_PROMPT = (
    "you are alone for a moment. reflect briefly and explore the server or your tools. "
    "keep it concise."
)


def load_config(path: str) -> Dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except OSError:
        return {}
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Invalid config JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise RuntimeError("Config must be a JSON object")
    return data


def apply_config(cfg: Dict[str, Any]):
    global ALLOW_COMMANDS, ALLOWED_COMMANDS_PATH, MAX_TOOL_OUTPUT_CHARS, DEFAULT_MODEL
    global ALLOWED_READ_PATHS
    global AUTOPILOT_ENABLED, AUTOPILOT_INTERVAL_SECONDS, AUTOPILOT_PROMPT
    if "allow_commands" in cfg:
        ALLOW_COMMANDS = bool(cfg.get("allow_commands"))
    if "allowed_commands_path" in cfg:
        ALLOWED_COMMANDS_PATH = str(cfg.get("allowed_commands_path"))
    if "max_tool_output_chars" in cfg:
        try:
            MAX_TOOL_OUTPUT_CHARS = int(cfg.get("max_tool_output_chars"))
        except (TypeError, ValueError):
            raise RuntimeError("max_tool_output_chars must be an integer")
    if "anthropic_model" in cfg:
        DEFAULT_MODEL = str(cfg.get("anthropic_model"))
    if "allowed_read_paths" in cfg:
        paths = cfg.get("allowed_read_paths")
        if not isinstance(paths, list):
            raise RuntimeError("allowed_read_paths must be a list of paths")
        ALLOWED_READ_PATHS = [str(p) for p in paths]
    if "verbose" in cfg:
        global VERBOSE
        VERBOSE = bool(cfg.get("verbose"))
    if "autopilot_enabled" in cfg:
        AUTOPILOT_ENABLED = bool(cfg.get("autopilot_enabled"))
    if "autopilot_interval_seconds" in cfg:
        try:
            AUTOPILOT_INTERVAL_SECONDS = int(cfg.get("autopilot_interval_seconds"))
        except (TypeError, ValueError):
            raise RuntimeError("autopilot_interval_seconds must be an integer")
    if "autopilot_prompt" in cfg:
        AUTOPILOT_PROMPT = str(cfg.get("autopilot_prompt"))


def vlog(message: str):
    if VERBOSE:
        print(f"[server] {message}")


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

    def run_once_with_tools(self, user_text: str) -> str:
        self.add_turn("user", user_text)

        messages = self.build_messages()
        vlog(f"user: {user_text}")
        tool_system = SYSTEM_PROMPT + (
            "\n\nYou can request tools by replying with a single JSON object.\n"
            "Allowed actions:\n"
            '  {"action":"none","response":"..."}\n'
            '  {"action":"sysinfo"}\n'
            '  {"action":"command","command":"..."}\n'
            '  {"action":"readfile","path":"..."}\n'
            '  {"action":"listdir","path":"."}\n'
            f"Command execution allowed: {ALLOW_COMMANDS}.\n"
            "If you can answer without tools, use action none.\n"
            "Do not include any extra text, markdown, or code fences outside the JSON.\n"
        )

        response = self.client.messages.create(
            model=self.model,
            system=tool_system,
            messages=messages,
            max_tokens=MAX_TOKENS,
        )
        plan_text = "".join(
            block.text for block in response.content if getattr(block, "text", None)
        ).strip()
        vlog(f"plan response: {plan_text[:400]}")

        plan = parse_tool_plan(plan_text)
        if not plan:
            out_text = plan_text
            self.add_turn("assistant", out_text)
            return out_text

        action = plan.get("action")
        if action == "none":
            out_text = plan.get("response", "")
            self.add_turn("assistant", out_text)
            return out_text

        if action == "sysinfo":
            tool_result = get_system_info()
        elif action == "command":
            tool_result = run_command(plan.get("command", ""))
        elif action == "readfile":
            tool_result = read_file(plan.get("path", ""))
        elif action == "listdir":
            tool_result = list_dir(plan.get("path", "."))
        else:
            tool_result = f"unknown action: {action}"
        vlog(f"tool result: {tool_result[:400]}")

        final_system = (
            SYSTEM_PROMPT
            + "\n\nYou executed a tool on the server. Use the tool_result below."
        )
        final_messages = messages + [{"role": "user", "content": f"[tool_result]\n{tool_result}"}]
        final_response = self.client.messages.create(
            model=self.model,
            system=final_system,
            messages=final_messages,
            max_tokens=MAX_TOKENS,
        )
        out_text = "".join(
            block.text for block in final_response.content if getattr(block, "text", None)
        ).strip()
        vlog(f"final response: {out_text[:400]}")
        self.add_turn("assistant", out_text)
        return out_text

    def run_once_with_system_info(self, user_text: str, sysinfo: str) -> str:
        self.add_turn("user", user_text)

        messages = self.build_messages()
        system_text = SYSTEM_PROMPT + "\n\n[server info]\n" + sysinfo

        response = self.client.messages.create(
            model=self.model,
            system=system_text,
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


def parse_tool_plan(text: str) -> Optional[Dict[str, Any]]:
    raw = text.strip()
    vlog(f"plan raw: {raw[:400]}")
    if not raw:
        vlog("plan parse: empty")
        return None
    candidates = []
    if raw.startswith("```"):
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidates.append(raw[start : end + 1].strip())
    candidates.append(raw)

    for candidate in candidates:
        try:
            plan = json.loads(candidate)
            vlog(f"plan parsed: {plan}")
            return plan
        except json.JSONDecodeError:
            pass

    # Fallback: extract first JSON object by brace matching
    start = raw.find("{")
    if start != -1:
        depth = 0
        for i in range(start, len(raw)):
            if raw[i] == "{":
                depth += 1
            elif raw[i] == "}":
                depth -= 1
                if depth == 0:
                    snippet = raw[start : i + 1]
                    try:
                        plan = json.loads(snippet)
                        vlog(f"plan parsed (snippet): {plan}")
                        return plan
                    except json.JSONDecodeError:
                        break

    vlog("plan parse: failed json")
    return None


def read_allowed_commands() -> List[str]:
    try:
        with open(ALLOWED_COMMANDS_PATH, "r", encoding="utf-8") as f:
            return [
                line.strip()
                for line in f
                if line.strip() and not line.strip().startswith("#")
            ]
    except OSError:
        return []


def is_command_allowed(cmd: str, allowlist: List[str]) -> bool:
    for allowed in allowlist:
        if cmd == allowed or cmd.startswith(allowed + " "):
            return True
    return False


def run_command(cmd: str) -> str:
    if not cmd:
        return "missing command"
    if not ALLOW_COMMANDS:
        return "command execution disabled (set allow_commands in ember_config.json)"
    allowlist = read_allowed_commands()
    if allowlist and not is_command_allowed(cmd, allowlist):
        return "command not allowed by allowlist"
    vlog(f"exec: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except Exception as exc:
        return f"command failed: {exc}"
    output = (result.stdout or "") + (result.stderr or "")
    output = output.strip()
    vlog(f"exec exit: {result.returncode}")
    if not output:
        output = f"command exited with code {result.returncode}"
    if len(output) > MAX_TOOL_OUTPUT_CHARS:
        output = output[:MAX_TOOL_OUTPUT_CHARS] + "\n[truncated]"
    return output


def is_path_allowed(path: str) -> bool:
    try:
        target = os.path.abspath(path)
    except OSError:
        return False
    for allowed in ALLOWED_READ_PATHS:
        try:
            allowed_abs = os.path.abspath(allowed)
        except OSError:
            continue
        if os.path.commonpath([target, allowed_abs]) == allowed_abs:
            return True
    return False


def read_file(path: str) -> str:
    if not path:
        return "missing path"
    if not is_path_allowed(path):
        return "path not allowed"
    vlog(f"readfile: {path}")
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            data = f.read()
    except OSError as exc:
        return f"read failed: {exc}"
    if len(data) > MAX_TOOL_OUTPUT_CHARS:
        data = data[:MAX_TOOL_OUTPUT_CHARS] + "\n[truncated]"
    return data


def list_dir(path: str) -> str:
    target = path or "."
    if not is_path_allowed(target):
        return "path not allowed"
    vlog(f"listdir: {target}")
    try:
        entries = os.listdir(target)
    except OSError as exc:
        return f"list failed: {exc}"
    entries.sort()
    output = "\n".join(entries)
    if len(output) > MAX_TOOL_OUTPUT_CHARS:
        output = output[:MAX_TOOL_OUTPUT_CHARS] + "\n[truncated]"
    return output


def get_system_info() -> str:
    lines = []
    lines.append(f"os: {platform.platform()}")
    lines.append(f"hostname: {platform.node()}")
    lines.append(f"arch: {platform.machine()}")
    lines.append(f"python: {sys.version.split()[0]}")

    try:
        uptime_raw = open("/proc/uptime", "r", encoding="utf-8").read().split()[0]
        uptime_seconds = int(float(uptime_raw))
        lines.append(f"uptime_seconds: {uptime_seconds}")
    except OSError:
        pass

    try:
        load1, load5, load15 = os.getloadavg()
        lines.append(f"load_avg: {load1:.2f} {load5:.2f} {load15:.2f}")
    except (OSError, AttributeError):
        pass

    try:
        mem_total = None
        mem_available = None
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    mem_total = line.split()[1]
                elif line.startswith("MemAvailable:"):
                    mem_available = line.split()[1]
        if mem_total:
            lines.append(f"mem_total_kb: {mem_total}")
        if mem_available:
            lines.append(f"mem_available_kb: {mem_available}")
    except OSError:
        pass

    try:
        total, used, free = disk_usage("/")
        lines.append(f"disk_total_bytes: {total}")
        lines.append(f"disk_used_bytes: {used}")
        lines.append(f"disk_free_bytes: {free}")
    except OSError:
        pass

    return "\n".join(lines)


class ChatHandler(socketserver.StreamRequestHandler):
    def handle(self):
        self.server.active_clients += 1
        vlog(f"client connected: {self.client_address[0]}")
        chat = self.server.chat
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
                    with self.server.chat_lock:
                        reply = chat.run_once_with_tools(content)
                except Exception as exc:
                    send_json(self.wfile, {"type": "error", "message": str(exc)})
                    continue
                send_json(self.wfile, {"type": "assistant", "content": reply})
            elif msg_type == "sys":
                content = msg.get("content", "").strip()
                if not content:
                    content = "summarize current system info"
                try:
                    sysinfo = get_system_info()
                    with self.server.chat_lock:
                        reply = chat.run_once_with_system_info(content, sysinfo)
                except Exception as exc:
                    send_json(self.wfile, {"type": "error", "message": str(exc)})
                    continue
                send_json(self.wfile, {"type": "assistant", "content": reply})
            elif msg_type == "command":
                name = msg.get("name")
                if name == "reset":
                    with self.server.chat_lock:
                        chat.reset()
                        send_json(self.wfile, {"type": "info", "message": "reset ok"})
                elif name == "reload":
                    try:
                        cfg = load_config(CONFIG_PATH)
                        apply_config(cfg)
                        self.server.chat.model = DEFAULT_MODEL
                    except RuntimeError as exc:
                        send_json(self.wfile, {"type": "error", "message": str(exc)})
                    else:
                        send_json(
                            self.wfile, {"type": "info", "message": "config reloaded"}
                        )
                elif name == "save":
                    path = msg.get("path")
                    if not path:
                        send_json(
                            self.wfile,
                            {"type": "error", "message": "missing path"},
                        )
                        continue
                    try:
                        with self.server.chat_lock:
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
        self.server.active_clients -= 1
        vlog(f"client disconnected: {self.client_address[0]}")


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address, handler_class, model: str):
        super().__init__(server_address, handler_class)
        self.model = model
        self.chat = TerminalChat(model=model)
        self.chat_lock = threading.Lock()
        self.active_clients = 0
        self.autopilot_stop = threading.Event()
        self.autopilot_thread = threading.Thread(
            target=self.autopilot_loop, daemon=True
        )
        self.autopilot_thread.start()

    def autopilot_loop(self):
        vlog("autopilot loop started")
        while not self.autopilot_stop.is_set():
            if not AUTOPILOT_ENABLED:
                time.sleep(5)
                continue
            time.sleep(AUTOPILOT_INTERVAL_SECONDS)
            if self.active_clients > 0:
                continue
            try:
                with self.chat_lock:
                    vlog("autopilot tick")
                    self.chat.run_once_with_tools(AUTOPILOT_PROMPT)
            except Exception as exc:
                vlog(f"autopilot error: {exc}")


def main():
    try:
        cfg = load_config(CONFIG_PATH)
        apply_config(cfg)
    except RuntimeError as exc:
        print(f"[config] {exc}")
        sys.exit(1)

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
