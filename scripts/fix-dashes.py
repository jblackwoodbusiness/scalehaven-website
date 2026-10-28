#!/usr/bin/env python3 -I
"""Em/en dash sweep with neighbour-aware rules. Usage: dashes2.py [--apply] file..."""
import re, sys
apply = '--apply' in sys.argv
files = [a for a in sys.argv[1:] if not a.startswith('--')]
DASH = r'(?:—|–|&mdash;|&ndash;|&#8212;|&#8211;)'
range_re = re.compile(r'(?<=[\d%$kKxX+])\s?' + DASH + r'\s?(?=[\d$])')
sp_re = re.compile(r'[ \t]*' + DASH + r'[ \t]*')
CONJ = re.compile(r"(and|or|but|so|because|which|not|then|yet|nor|though|although|while|unless|whether|in|at|for|with|without|from|to|on|by|before|after|under|over|like|as|just|even|especially|usually|often|plus|if|when|where|unlike|including|except)\b", re.I)
CLAUSE = re.compile(r"(it's|it is|it was|they|you|we\b|we'|that's|that is|this is|there's|there is|there are|he |she |i |most |some |nobody|everyone|everybody|no one|that means|which means)", re.I)
QUOTES = ('"', '“', '‘', "'", '(')
def sentence_tail(left):
    return re.split(r'[.!?]\s', left)[-1]
def choose(left, right):
    r = right.lstrip(); first = r[:1]; tail = sentence_tail(left).rstrip()
    if tail.endswith((':', ',', ';')):
        return ' ', False
    if not r:
        return ('' if tail.endswith(('.', '!', '?')) else ':'), False
    if CONJ.match(r):
        return ', ', False
    if first.isupper() or first in QUOTES:
        return ('. ' if len(tail.split()) > 3 else ': '), False
    if first.isdigit() or first == '$':
        return ': ', False
    if CLAUSE.match(r) and len(tail.split()) >= 3:
        return '. ', True
    if ':' in tail:
        return ', ', False
    return ': ', False
def cap(s):
    s2 = s.lstrip(); return s2[:1].upper() + s2[1:] if s2 else s2
def fix_segment(text, prev='', nxt=''):
    lead = text[:len(text) - len(text.lstrip())]; trail = text[len(text.rstrip()):]
    core = range_re.sub('-', text.strip())
    toks = sp_re.split(core)
    if len(toks) == 1:
        return lead + core + trail
    out = toks[0]; k = 1
    while k < len(toks):
        right = toks[k]
        nx = toks[k + 1].lstrip() if k + 1 < len(toks) else None
        if nx is not None and right[:1].islower() and not re.search(r'[.!?]', right) and nx[:1] and (nx[:1].islower() or nx[:1] in ',;'):
            inner = right.strip()
            if not out.strip(): lead = ''
            if ',' in inner:
                out = out.rstrip() + ' (' + inner + ')' + ('' if nx[:1] in ',;' else ' ') + nx
            else:
                out = out.rstrip() + ', ' + inner + (', ' if nx[:1] not in ',;' else '') + nx
            k += 2; continue
        left_ctx = out if out.strip() else prev
        right_ctx = right if right.strip() else nxt
        sep, docap = choose(left_ctx, right_ctx)
        if not out.strip():
            lead = ''; out = sep.lstrip() if sep.strip() else ''
        else:
            out = out.rstrip() + sep
        out += cap(right) if docap else right.lstrip()
        k += 1
    out = re.sub(r'([.!?:,])\s*\.(?=\s|$)', r'\1', out)
    return lead + out + trail
ATTR = re.compile(r'\b(content|alt|title|aria-label|placeholder|excerpt|tag)="([^"]*)"')
def process(src):
    parts = re.split(r'(<script\b[\s\S]*?</script>|<style\b[\s\S]*?</style>|<!--[\s\S]*?-->|<[^>]+>)', src)
    texts = [(i, p) for i, p in enumerate(parts) if not p.startswith('<') and p.strip()]
    pos = {i: n for n, (i, _) in enumerate(texts)}
    out = []; log = []
    for i, seg in enumerate(parts):
        if not re.search(DASH, seg):
            out.append(seg); continue
        if seg.startswith('<'):
            if re.match(r'<script[^>]*application/ld\+json', seg):
                m = re.match(r'(<script[^>]*>)([\s\S]*)(</script>)$', seg)
                inner = re.sub(r'"((?:[^"\\]|\\.)*)"', lambda mm: '"' + fix_segment(mm.group(1)) + '"' if re.search(DASH, mm.group(1)) else mm.group(0), m.group(2))
                fixed = m.group(1) + inner + m.group(3)
            elif seg.startswith('<!--') and not re.match(r'<!--\s*META', seg):
                out.append(seg); continue
            elif seg.startswith('<script') or seg.startswith('<style'):
                out.append(seg); continue
            else:
                fixed = ATTR.sub(lambda mm: mm.group(1) + '="' + fix_segment(mm.group(2)) + '"' if re.search(DASH, mm.group(2)) else mm.group(0), seg)
            if fixed != seg: log.append((seg.strip()[:170], fixed.strip()[:170]))
            out.append(fixed); continue
        n = pos.get(i)
        prev = texts[n - 1][1][-120:] if n is not None and n > 0 else ''
        nxt = texts[n + 1][1][:120] if n is not None and n + 1 < len(texts) else ''
        fixed = fix_segment(seg, prev, nxt)
        if fixed != seg: log.append((seg.strip()[:170], fixed.strip()[:170]))
        out.append(fixed)
    return ''.join(out), log
tb = ta = 0
for f in files:
    src = open(f, encoding='utf8').read()
    cnt = lambda s: len(re.findall(DASH, re.sub(r'<!--(?!\s*META)[\s\S]*?-->', '', s)))
    before = cnt(src); new, log = process(src); after = cnt(new); tb += before; ta += after
    if apply:
        if new != src: open(f, 'w', encoding='utf8').write(new)
        if after: print(f'{f}: {before} -> {after} REMAINING')
    else:
        print(f'=== {f}: {before} -> {after}')
        for a, b in log[:14]: print('  -', a); print('  +', b)
print(f'TOTAL dashes {tb} -> {ta} across {len(files)} files')
