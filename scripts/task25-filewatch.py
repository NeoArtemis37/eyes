#!/usr/bin/env python3
"""Surveille les mtime du projet (hors node_modules/.next/.git) et logue chaque fichier modifié."""
import os, sys, time

ROOT = '/home/z/my-project'
EXCLUDE = {'node_modules', '.next', '.git', 'eyeofview', 'tool-results', '.agent-browser'}
OUT = '/tmp/task25-filewatch.log'

def scan(prev=None):
    snap = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE]
        for f in filenames:
            p = os.path.join(dirpath, f)
            try:
                snap[p] = os.stat(p).st_mtime
            except OSError:
                pass
    return snap

def main():
    with open(OUT, 'w') as fh:
        fh.write('start\n')
    prev = scan()
    t0 = time.time()
    with open(OUT, 'a') as fh:
        while time.time() - t0 < 150:
            time.sleep(3)
            cur = scan()
            for p, m in cur.items():
                if p not in prev or prev[p] != m:
                    fh.write(f'{time.strftime("%H:%M:%S")} CHANGED {p}\n')
            prev = cur
            fh.flush()

if __name__ == '__main__':
    main()
