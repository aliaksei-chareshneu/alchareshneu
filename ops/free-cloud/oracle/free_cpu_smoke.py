#!/usr/bin/env python3
"""Bounded localhost-only CPU smoke test; synthetic data, no dependencies."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json,hashlib,time
def reply(h,code,obj):
    b=json.dumps(obj,separators=(",",":")).encode()
    h.send_response(code)
    h.send_header("Content-Type","application/json")
    h.send_header("Content-Length",str(len(b)))
    h.send_header("Cache-Control","no-store")
    h.send_header("X-Content-Type-Options","nosniff")
    h.end_headers()
    h.wfile.write(b)
def primes(n):
    c=0
    for x in range(2,n+1):
        if all(x%j for j in range(2,int(x**.5)+1)):c+=1
    return c
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def do_GET(self):
        if self.path!="/health":return reply(self,404,{"status":"NOT_FOUND"})
        return reply(self,200,{"status":"LIVE","app":"imperion-free-cpu-smoke","runtime":"oracle-ubuntu-x86_64","network":"loopback-only","external_calls":False})
    def do_POST(self):
        if self.path!="/compute":return reply(self,404,{"status":"NOT_FOUND"})
        n=self.headers.get("Content-Length","0")
        if not n.isdecimal() or int(n)>2048:return reply(self,413,{"status":"PAYLOAD_TOO_LARGE"})
        try:data=json.loads(self.rfile.read(int(n)))
        except Exception:return reply(self,400,{"status":"INVALID_JSON"})
        if not isinstance(data,dict):return reply(self,400,{"status":"INVALID_BODY"})
        if data.get("op")=="primes" and type(data.get("n"))==int and 2<=data["n"]<=5000:
            return reply(self,200,{"status":"EXECUTED","op":"primes","n":data["n"],"prime_count":primes(data["n"])})
        if data.get("op")=="sha256" and isinstance(data.get("text"),str) and len(data["text"])<=1024:
            b=data["text"].encode()
            return reply(self,200,{"status":"EXECUTED","op":"sha256","digest":hashlib.sha256(b).hexdigest()})
        return reply(self,400,{"status":"OP_NOT_ALLOWED"})
ThreadingHTTPServer(("127.0.0.1",8787),Handler).serve_forever()
