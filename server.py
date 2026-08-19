#!/usr/bin/env python3
"""
GeoTimeline Server
A lightweight, robust local web server to serve the GeoTimeline Web Application.
"""

import http.server
import socketserver
import os
import sys
import mimetypes

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Ensure common MIME types are set properly
mimetypes.init()
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

class GeoTimelineRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and disable caching during development
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run_server(port=PORT):
    # Allow port reuse to avoid address already in use error
    socketserver.TCPServer.allow_reuse_address = True
    
    # Try preferred port, fallback if busy
    for p in [port, 8081, 8082, 3000, 5000]:
        try:
            with socketserver.TCPServer(("", p), GeoTimelineRequestHandler) as httpd:
                print(f"======================================================")
                print(f" 🚀 GeoTimeline Photos & Videos Organizer Server")
                print(f" 🌍 Running at: http://localhost:{p}")
                print(f" 📁 Serving from: {DIRECTORY}")
                print(f"======================================================")
                httpd.serve_forever()
                break
        except OSError as e:
            if "Address already in use" in str(e):
                print(f"Port {p} is busy, trying next port...")
                continue
            else:
                raise e

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
