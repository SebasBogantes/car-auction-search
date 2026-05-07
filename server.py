#!/usr/bin/env python3
"""
Dev server local: sirve archivos estáticos + proxy para Auto.dev (fix CORS).
Uso: python server.py
Luego abre: http://localhost:8080
"""
import http.server
import urllib.request
import urllib.error
import os

PORT = 8080
AUTODEV_BASE = 'https://api.auto.dev'


class DevHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        if self.path.startswith('/proxy/autodev'):
            target = AUTODEV_BASE + self.path[len('/proxy/autodev'):]
            self._proxy(target)
        else:
            super().do_GET()

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def _proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self._cors()
            self.end_headers()
            self.wfile.write(str(e).encode())

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')

    def log_message(self, fmt, *args):
        if args and 'favicon' not in str(args[0]):
            print(f'  {args[1]} {args[0]}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    print(f'Servidor local: http://localhost:{PORT}')
    with http.server.HTTPServer(('', PORT), DevHandler) as httpd:
        httpd.serve_forever()
