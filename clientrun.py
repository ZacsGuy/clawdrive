#!/usr/bin/env python3
"""
ember_client.py — connect to ember_server over LAN and chat.
"""

from __future__ import annotations

import argparse
import json
import socket
import sys
import threading


def send_json(writer, payload):
    writer.write(json.dumps(payload, ensure_ascii=False) + "\n")
    writer.flush()


STDOUT_LOCK = threading.Lock()


def safe_print(text=""):
    with STDOUT_LOCK:
        print(text)


def show_prompt():
    with STDOUT_LOCK:
        sys.stdout.write("> ")
        sys.stdout.flush()


def handle_message(msg):
    msg_type = msg.get("type")
    if msg_type == "assistant":
        content = msg.get("content", "")
        safe_print("")
        safe_print(content if content else "(silence)")
        safe_print("")
        show_prompt()
    elif msg_type == "info":
        safe_print(f"[info] {msg.get('message', '')}")
        show_prompt()
    elif msg_type == "error":
        safe_print(f"[error] {msg.get('message', '')}")
        show_prompt()
    elif msg_type == "saved":
        safe_print(f"[saved] {msg.get('path', '')}")
        show_prompt()
    elif msg_type == "ready":
        pass
    else:
        safe_print("[info] message received")
        show_prompt()


def recv_loop(reader, stop_event):
    for line in reader:
        if stop_event.is_set():
            break
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            print("[error] bad json from server")
            continue
        handle_message(msg)


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
        line = reader.readline()
        if not line:
            print("[error] disconnected")
            sys.exit(1)
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            print("[error] bad json from server")
            continue
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
    stop_event = threading.Event()
    thread = threading.Thread(target=recv_loop, args=(reader, stop_event), daemon=True)
    thread.start()

    while True:
        try:
            show_prompt()
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
                continue
            if cmd == "/save":
                if not rest:
                    print("usage: /save path.json")
                    continue
                send_json(writer, {"type": "command", "name": "save", "path": rest[0]})
                continue
            print("unknown command")
            continue

        send_json(writer, {"type": "user", "content": user_text})

    stop_event.set()
    try:
        sock.close()
    except OSError:
        pass


if __name__ == "__main__":
    main()
