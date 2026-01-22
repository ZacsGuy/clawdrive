#!/usr/bin/env python3
"""
ember_client.py — connect to ember_server over LAN and chat.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys


def send_json(writer, payload):
    writer.write(json.dumps(payload, ensure_ascii=False) + "\n")
    writer.flush()


def safe_print(text=""):
    print(text)


def handle_message(msg):
    msg_type = msg.get("type")
    if msg_type == "assistant":
        content = msg.get("content", "")
        safe_print("")
        safe_print(content if content else "(silence)")
        safe_print("")
    elif msg_type == "info":
        safe_print(f"[info] {msg.get('message', '')}")
    elif msg_type == "error":
        safe_print(f"[error] {msg.get('message', '')}")
    elif msg_type == "saved":
        safe_print(f"[saved] {msg.get('path', '')}")
    elif msg_type == "ready":
        pass
    else:
        safe_print("[info] message received")


def read_message(reader):
    line = reader.readline()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return {"type": "error", "message": "bad json from server"}


def main():
    parser = argparse.ArgumentParser(description="Ember LAN chat client")
    parser.add_argument("--host", required=True, help="server IP or hostname")
    parser.add_argument("--port", type=int, default=5050, help="server port")
    args = parser.parse_args()

    try:
        sock = socket.create_connection((args.host, args.port))
    except OSError as exc:
        print(f"[error] {exc}")
        sys.exit(1)

    reader = sock.makefile("r", encoding="utf-8")
    writer = sock.makefile("w", encoding="utf-8")

    buffered = []
    printed_commands = False
    while True:
        msg = read_message(reader)
        if msg is None:
            print("[error] disconnected")
            sys.exit(1)
        if msg.get("type") == "ready":
            break
        if msg.get("type") == "info" and msg.get("message") == "connected":
            handle_message(msg)
            if not printed_commands:
                safe_print("commands: /reset, /save path.json, /exit")
                printed_commands = True
        else:
            buffered.append(msg)

    if not printed_commands:
        safe_print("commands: /reset, /save path.json, /exit")
    for msg in buffered:
        handle_message(msg)

    while True:
        try:
            sys.stdout.write("> ")
            sys.stdout.flush()
            user_text = sys.stdin.readline()
            if not user_text:
                user_text = "/exit"
            user_text = user_text.strip()
        except (EOFError, KeyboardInterrupt):
            user_text = "/exit"

        if not user_text:
            continue

        if user_text.startswith("/"):
            cmd, *rest = user_text.split(maxsplit=1)
            if cmd == "/exit":
                send_json(writer, {"type": "command", "name": "exit"})
                break
            if cmd == "/reset":
                send_json(writer, {"type": "command", "name": "reset"})
                msg = read_message(reader)
                if msg is None:
                    print("[error] disconnected")
                    break
                handle_message(msg)
                continue
            if cmd == "/save":
                if not rest:
                    print("usage: /save path.json")
                    continue
                send_json(writer, {"type": "command", "name": "save", "path": rest[0]})
                msg = read_message(reader)
                if msg is None:
                    print("[error] disconnected")
                    break
                handle_message(msg)
                continue
            print("unknown command")
            continue

        send_json(writer, {"type": "user", "content": user_text})
        while True:
            msg = read_message(reader)
            if msg is None:
                print("[error] disconnected")
                return
            handle_message(msg)
            if msg.get("type") in ("assistant", "error"):
                break

    try:
        sock.close()
    except OSError:
        pass


if __name__ == "__main__":
    main()
