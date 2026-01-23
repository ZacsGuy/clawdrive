#!/usr/bin/env python3
"""
Simple local HTTP server for Ember to hit with curl.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = {
            "ok": True,
            "path": self.path,
            "message": "hello from ember test server",
        }
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    server = HTTPServer(("0.0.0.0", 8080), Handler)
    print("[testhttp] listening on 0.0.0.0:8080")
    server.serve_forever()


if __name__ == "__main__":
    main()
