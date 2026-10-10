#!/usr/bin/env python3
"""Compare P0 inventories without treating line shifts or sequential IDs as new sites.

Usage: compare-audits.py BEFORE/inventory.json AFTER/inventory.json OUTPUT_DIRECTORY
Exact scanner-text matches are paired as multisets (text is truncated by audit.cjs;
these are lexical matches, not a semantic equivalence proof). Remaining singleton buckets with
the same file/kind/symbol/context are *candidate* edits, never proven semantic moves.
Ambiguous buckets remain additions/removals. Evidence stays outside the repository.
"""
import collections
import hashlib
import json
import pathlib
import sys


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def counts(rows):
    return {c: sum(r['category'] == c for r in rows) for c in 'ABCD'}


def compare(before, after):
    def bucket(rows, fields):
        result = collections.defaultdict(list)
        for row in rows:
            result[tuple(row[f] for f in fields)].append(row)
        for group in result.values():
            group.sort(key=lambda r: (r['line'], r['column'], r['id']))
        return result

    fields = ('scope', 'file', 'kind', 'symbol', 'context')
    old, new = bucket(before, (*fields, 'text')), bucket(after, (*fields, 'text'))
    matched, removed, added = [], [], []
    for key in sorted(old.keys() | new.keys()):
        left, right = old[key], new[key]
        n = min(len(left), len(right))
        matched.extend({'before': a, 'after': b} for a, b in zip(left[:n], right[:n]))
        removed.extend(left[n:])
        added.extend(right[n:])
    old, new = bucket(removed, fields), bucket(added, fields)
    changed, removed, added = [], [], []
    for key in sorted(old.keys() | new.keys()):
        left, right = old[key], new[key]
        if len(left) == len(right) == 1:
            changed.append({'before': left[0], 'after': right[0]})
        else:
            removed.extend(left)
            added.extend(right)
    return matched, changed, removed, added


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    before_path, after_path, out = map(pathlib.Path, sys.argv[1:])
    out = out.resolve()
    root = pathlib.Path(__file__).resolve().parents[2]
    if out == root or root in out.parents:
        raise SystemExit('Audit output must be outside the repository')
    out.mkdir(parents=True, exist_ok=True)
    before, after = (json.loads(p.read_text()) for p in (before_path, after_path))
    result = {'schema': 1, 'beforeHead': before['head'], 'afterHead': after['head'],
              'beforeSha256': digest(before_path), 'afterSha256': digest(after_path),
              'method': __doc__, 'scopes': {}}
    for scope in sorted({r['scope'] for r in before['entries'] + after['entries']}):
        left = [r for r in before['entries'] if r['scope'] == scope]
        right = [r for r in after['entries'] if r['scope'] == scope]
        matched, changed, removed, added = compare(left, right)
        assert len(left) == len(matched) + len(changed) + len(removed)
        assert len(right) == len(matched) + len(changed) + len(added)
        relocated = [p for p in matched if any(p['before'][k] != p['after'][k]
                                              for k in ('line', 'column'))]
        recategorized = [p for p in matched if p['before']['category'] != p['after']['category']]
        result['scopes'][scope] = {
            'before': len(left), 'after': len(right), 'beforeCategories': counts(left),
            'afterCategories': counts(right), 'exactMatches': len(matched),
            'relocatedCount': len(relocated), 'recategorized': recategorized,
            'changedCandidates': changed, 'removed': removed, 'added': added,
            'relocated': relocated,
        }
    old_fields = {r['name']: r for r in before['stateFields']}
    new_fields = {r['name']: r for r in after['stateFields']}
    result['stateFields'] = {
        'added': [new_fields[k] for k in sorted(new_fields.keys() - old_fields.keys())],
        'removed': [old_fields[k] for k in sorted(old_fields.keys() - new_fields.keys())],
        'changed': [{'before': old_fields[k], 'after': new_fields[k]}
                    for k in sorted(old_fields.keys() & new_fields.keys())
                    if old_fields[k] != new_fields[k]],
    }
    (out / 'delta.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    summary = {k: v for k, v in result.items() if k != 'scopes'}
    summary['scopes'] = {scope: {k: len(v) if isinstance(v, list) else v
                                for k, v in row.items()}
                         for scope, row in result['scopes'].items()}
    (out / 'delta-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
