// Data structure recorders, driven by a short script of operations.
// Snapshot: { line, msg, trees: [node], rows: [{ title, cells: [{ t, s, cls }] }], extras }
// node: { id, label, sub, cls, children }
(function () {
  const U = window.Algo.util;

  const recorder = () => {
    const steps = [];
    const snap = (line, msg, o = {}) => steps.push(U.clone({ line, msg, trees: o.trees || [], rows: o.rows || [], extras: o.extras || [] }));
    return { steps, snap };
  };

  // ---- Trie
  function trie(v) {
    const ops = U.ops(v.ops, { max: 12 });
    const { steps, snap: push } = recorder();
    let nid = 0;
    const mk = ch => ({ id: nid++, ch, kids: {}, end: false });
    const root = mk('∅');
    const words = [];
    const view = (cur, mode) => {
      const conv = n => ({
        id: n.id, label: n.ch,
        cls: [n.end && 'end', n.id === cur && mode].filter(Boolean).join(' '),
        children: Object.keys(n.kids).sort().map(k => conv(n.kids[k])),
      });
      return [conv(root)];
    };
    const snap = (line, msg, cur = null, mode = '') => push(line, msg, { trees: view(cur, mode), extras: [{ label: 'Words', items: words.length ? words : ['(none yet)'] }] });
    snap(1, 'An empty trie: just the root. Each path from the root spells a prefix. A double ring marks the end of a word.');
    for (const [cmd, raw = ''] of ops) {
      const w = raw.toLowerCase();
      if (!/^[a-z]{1,8}$/.test(w) || !['insert', 'search', 'prefix'].includes(cmd)) throw new Error('Use: insert word, search word, prefix word (letters a–z, up to 8).');
      let node = root;
      if (cmd === 'insert') {
        snap(1, `insert("${w}"): start at the root.`, root.id, 'cur');
        for (const ch of w) {
          if (!node.kids[ch]) { node.kids[ch] = mk(ch); node = node.kids[ch]; snap(3, `'${ch}' has no child here: create a node.`, node.id, 'new'); }
          else { node = node.kids[ch]; snap(4, `'${ch}' already exists: follow it.`, node.id, 'cur'); }
        }
        if (!node.end) words.push(w);
        node.end = true;
        snap(5, `Mark the last node as a word end. "${w}" is stored.`, node.id, 'ok');
      } else {
        snap(7, `${cmd}("${w}"): start at the root.`, root.id, 'cur');
        let ok = true;
        for (const ch of w) {
          if (!node.kids[ch]) { snap(7, `'${ch}' has no child: "${w}" is ${cmd === 'search' ? 'not in the trie' : 'not a prefix of any word'}.`, node.id, 'bad'); ok = false; break; }
          node = node.kids[ch];
          snap(7, `Follow '${ch}'.`, node.id, 'cur');
        }
        if (ok) {
          if (cmd === 'prefix') snap(8, `The path exists: some stored word starts with "${w}".`, node.id, 'ok');
          else if (node.end) snap(8, `"${w}" ends on a word-end node: found.`, node.id, 'ok');
          else snap(8, `The path exists, but it is not marked as a word end: "${w}" is only a prefix.`, node.id, 'bad');
        }
      }
    }
    return steps;
  }

  // ---- Min-heap
  function heap(v) {
    const ops = U.ops(v.ops, { max: 16 });
    const { steps, snap: push } = recorder();
    const h = [];
    const out = [];
    const tree = (i, m) => (i >= h.length ? null : {
      id: i, label: h[i], cls: m[i] || '',
      children: [2 * i + 1, 2 * i + 2].map(c => tree(c, m)).filter(Boolean),
    });
    const snap = (line, msg, m = {}) => push(line, msg, {
      trees: h.length ? [tree(0, m)] : [],
      rows: [{ title: 'Array', cells: h.map((x, i) => ({ t: x, s: i, cls: m[i] || '' })) }],
      extras: [{ label: 'Extracted', items: out.length ? out : ['—'] }],
    });
    snap(0, 'An empty min-heap. The smallest value always sits at the root; children are never smaller than their parent.');
    for (const [cmd, raw] of ops) {
      if (cmd === 'insert') {
        const x = U.int(raw, 1, 99, 'insert value');
        if (h.length >= 15) throw new Error('Keep the heap to 15 elements or fewer.');
        h.push(x);
        let i = h.length - 1;
        snap(0, `Insert ${x}: append it at index ${i}.`, { [i]: 'new' });
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (h[p] > h[i]) {
            [h[p], h[i]] = [h[i], h[p]];
            snap(1, `Parent ${h[i]} > ${h[p]}: swap them (sift up).`, { [p]: 'swap', [i]: 'swap' });
            i = p;
          } else { snap(1, `Parent ${h[p]} ≤ ${h[i]}: the heap property holds.`, { [i]: 'ok' }); break; }
        }
        if (i === 0) snap(1, `${h[0]} reached the root.`, { 0: 'ok' });
      } else if (cmd === 'extract') {
        if (!h.length) { snap(2, 'extractMin on an empty heap: nothing to remove.'); continue; }
        const top = h[0], last = h.pop();
        if (h.length) h[0] = last;
        out.push(top);
        snap(3, `Remove the root ${top}. Move the last element ${last} to the root.`, h.length ? { 0: 'cur' } : {});
        let i = 0;
        while (h.length) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < h.length && h[l] < h[m]) m = l;
          if (r < h.length && h[r] < h[m]) m = r;
          if (m === i) { snap(4, `${h[i]} is no bigger than its children: done sifting down.`, { [i]: 'ok' }); break; }
          [h[i], h[m]] = [h[m], h[i]];
          snap(4, `Swap with the smaller child (${h[i]}): sift down.`, { [i]: 'swap', [m]: 'swap' });
          i = m;
        }
        snap(5, `extractMin returned ${top}.`);
      } else throw new Error('Use: insert 5, extract');
    }
    return steps;
  }

  // ---- Segment tree (sum)
  function segmentTree(v) {
    const vals = U.ints(v.values, { min: 1, max: 99, minLen: 2, maxLen: 8, name: 'Array' });
    const ops = U.ops(v.ops, { max: 8 });
    const { steps, snap: push } = recorder();
    let id = 0;
    const build = (l, r) => {
      const n = { id: id++, l, r, left: null, right: null, sum: 0 };
      if (l === r) n.sum = vals[l];
      else { const m = (l + r) >> 1; n.left = build(l, m); n.right = build(m + 1, r); n.sum = n.left.sum + n.right.sum; }
      return n;
    };
    const root = build(0, vals.length - 1);
    const conv = (n, m) => ({ id: n.id, label: n.sum, sub: `[${n.l},${n.r}]`, cls: m[n.id] || '', children: n.left ? [conv(n.left, m), conv(n.right, m)] : [] });
    const snap = (line, msg, m = {}, cellCls = {}) => push(line, msg, {
      trees: [conv(root, m)],
      rows: [{ title: 'Array', cells: vals.map((x, i) => ({ t: x, s: i, cls: cellCls[i] || '' })) }],
    });
    snap(0, 'Built the tree: every node stores the sum of its range [l, r]. Leaves are the array elements.');
    for (const [cmd, a, b] of ops) {
      const m = {};
      if (cmd === 'query') {
        const ql = U.int(a, 0, vals.length - 1, 'query left'), qr = U.int(b, 0, vals.length - 1, 'query right');
        if (ql > qr) throw new Error('For query l r, l must not exceed r.');
        const cells = {};
        for (let i = ql; i <= qr; i++) cells[i] = 'cur';
        snap(1, `query(${ql}, ${qr}): sum of indices ${ql} to ${qr}.`, m, cells);
        const q = n => {
          if (n.r < ql || n.l > qr) { m[n.id] = 'bad'; snap(2, `[${n.l},${n.r}] is outside the query: contributes 0.`, m, cells); return 0; }
          if (ql <= n.l && n.r <= qr) { m[n.id] = 'ok'; snap(3, `[${n.l},${n.r}] is fully inside: take its sum ${n.sum}.`, m, cells); return n.sum; }
          m[n.id] = 'cur'; snap(4, `[${n.l},${n.r}] partly overlaps: ask both children.`, m, cells);
          return q(n.left) + q(n.right);
        };
        const total = q(root);
        snap(1, `Sum of indices ${ql} to ${qr} = ${total}.`, m, cells);
      } else if (cmd === 'update') {
        const i = U.int(a, 0, vals.length - 1, 'update index'), x = U.int(b, 1, 99, 'update value');
        snap(5, `update(${i}, ${x}): walk down to leaf ${i}.`, m, { [i]: 'cur' });
        const upd = n => {
          if (n.l === n.r) { n.sum = x; vals[i] = x; m[n.id] = 'ok'; snap(5, `Set leaf [${i}] to ${x}.`, m, { [i]: 'ok' }); return; }
          m[n.id] = 'cur';
          snap(5, `[${n.l},${n.r}]: go ${i <= (n.l + n.r) >> 1 ? 'left' : 'right'}.`, m, { [i]: 'cur' });
          upd(i <= (n.l + n.r) >> 1 ? n.left : n.right);
          n.sum = n.left.sum + n.right.sum; m[n.id] = 'swap';
          snap(5, `Recompute [${n.l},${n.r}] = ${n.left.sum} + ${n.right.sum} = ${n.sum}.`, m, { [i]: 'ok' });
        };
        upd(root);
      } else throw new Error('Use: query 1 4, update 2 10');
    }
    return steps;
  }

  // ---- Union-Find
  function unionFind(v) {
    const n = U.int(v.n, 2, 10, 'Elements');
    const ops = U.ops(v.ops, { max: 14 });
    const { steps, snap: push } = recorder();
    const parent = Array.from({ length: n }, (_, i) => i);
    const rank = Array(n).fill(0);
    const conv = (i, m) => ({
      id: i, label: i, sub: `rank ${rank[i]}`, cls: m[i] || '',
      children: parent.map((p, c) => (p === i && c !== i ? c : -1)).filter(c => c >= 0).map(c => conv(c, m)),
    });
    const snap = (line, msg, m = {}, extras = []) => push(line, msg, {
      trees: parent.map((p, i) => i).filter(i => parent[i] === i).map(i => conv(i, m)),
      rows: [
        { title: 'parent[]', cells: parent.map((p, i) => ({ t: p, s: i, cls: m[i] || '' })) },
        { title: 'rank[]', cells: rank.map((r, i) => ({ t: r, s: i, cls: '' })) },
      ],
      extras,
    });
    const find = x => {
      const path = [x];
      while (parent[path[path.length - 1]] !== path[path.length - 1]) path.push(parent[path[path.length - 1]]);
      const root = path[path.length - 1];
      path.forEach((p, k) => snap(1, k === path.length - 1 ? `${p} is its own parent: it is the root.` : `Follow parent[${p}] = ${parent[p]}.`, { [p]: k === path.length - 1 ? 'ok' : 'cur' }));
      path.slice(0, -1).forEach(p => {
        if (parent[p] !== root) { parent[p] = root; snap(2, `Path compression: point ${p} straight at ${root}.`, { [p]: 'swap', [root]: 'ok' }); }
      });
      return root;
    };
    snap(0, `${n} separate sets, each element is its own root. Union joins sets, find returns a set's root.`);
    for (const [cmd, a, b] of ops) {
      const x = U.int(a, 0, n - 1, 'element');
      if (cmd === 'find') {
        snap(0, `find(${x}).`, { [x]: 'cur' });
        const r = find(x);
        snap(3, `find(${x}) = ${r}.`, { [r]: 'ok' });
      } else if (cmd === 'union') {
        const y = U.int(b, 0, n - 1, 'element');
        snap(4, `union(${x}, ${y}): find both roots first.`, { [x]: 'cur', [y]: 'cur' });
        const rx = find(x), ry = find(y);
        if (rx === ry) { snap(5, `${x} and ${y} already share root ${rx}: nothing to do.`, { [rx]: 'ok' }); continue; }
        const [hi, lo] = rank[rx] >= rank[ry] ? [rx, ry] : [ry, rx];
        parent[lo] = hi;
        snap(6, `Attach the lower-rank root ${lo} under ${hi}.`, { [lo]: 'swap', [hi]: 'ok' });
        if (rank[rx] === rank[ry]) { rank[hi]++; snap(7, `Ranks were equal: rank[${hi}] becomes ${rank[hi]}.`, { [hi]: 'ok' }); }
      } else throw new Error('Use: union 0 1, find 3');
    }
    return steps;
  }

  // ---- LRU cache
  function lru(v) {
    const cap = U.int(v.capacity, 1, 6, 'Capacity');
    const ops = U.ops(v.ops, { max: 16 });
    const { steps, snap: push } = recorder();
    let cache = [];
    let result = '—';
    const snap = (line, msg, m = {}, extra = []) => push(line, msg, {
      rows: [{ title: 'Most recent → least recent', cells: cache.map(([k, val]) => ({ t: k, s: val, cls: m[k] || '' })) }],
      extras: [{ label: 'Result', items: [result] }, ...extra],
    });
    snap(0, `An empty cache with room for ${cap}. The front is the most recently used entry; the back is evicted first.`);
    for (const [cmd, k, val] of ops) {
      if (!k || k.length > 3) throw new Error('Use: put 1 A, get 1 (keys up to 3 characters).');
      const at = cache.findIndex(e => e[0] === k);
      if (cmd === 'get') {
        if (at >= 0) {
          const e = cache.splice(at, 1)[0]; cache.unshift(e); result = e[1];
          snap(0, `get(${k}) hits: returns ${e[1]} and moves ${k} to the front.`, { [k]: 'ok' });
        } else { result = '−1'; snap(1, `get(${k}) misses: returns −1. Nothing changes.`); }
      } else if (cmd === 'put') {
        if (val === undefined) throw new Error('put needs a value: put 1 A');
        if (at >= 0) {
          const e = cache.splice(at, 1)[0]; e[1] = val; cache.unshift(e); result = 'updated';
          snap(3, `put(${k}, ${val}): ${k} exists, so update it and move it to the front.`, { [k]: 'ok' });
        } else {
          if (cache.length >= cap) {
            const tail = cache[cache.length - 1];
            snap(4, `The cache is full. Evict the least recently used entry: ${tail[0]}.`, { [tail[0]]: 'bad' });
            cache.pop();
            result = `evicted ${tail[0]}`;
          } else result = 'inserted';
          cache.unshift([k, val]);
          snap(5, `Insert (${k}, ${val}) at the front.`, { [k]: 'new' });
        }
      } else throw new Error('Use: put 1 A, get 1');
    }
    return steps;
  }

  const opsField = (def, hint) => ({ key: 'ops', label: 'Operations', def, hint, wide: true });

  const STRUCTURES = {
    trie: {
      name: 'Trie', short: 'Trie', tag: 'PREFIX TREE · STRINGS', stage: 'tree', complexity: 'O(L) per operation',
      blurb: 'A tree where each edge is a letter. Words that share a prefix share a path, so lookups and prefix checks cost the length of the word, not the number of words stored.',
      code: ['insert(word):', '  node ← root', '  for each char c of word:', '    if c not in node.children: create it', '    node ← node.children[c]', '  node.isEnd ← true', 'search(word) / prefix(p):', '  walk down char by char; fail if a child is missing', '  search needs isEnd; prefix just needs the path'],
      fields: [opsField('insert car, insert card, insert cat, search car, search ca, prefix ca, search dog', 'insert w · search w · prefix w, separated by commas')],
      run: trie,
    },
    heap: {
      name: 'Min-Heap', short: 'Heap', tag: 'PRIORITY QUEUE · COMPLETE BINARY TREE', stage: 'tree', complexity: 'O(log n) insert / extract',
      blurb: 'A complete binary tree stored in an array where every parent is no bigger than its children. Insert sifts the new value up; extract replaces the root with the last element and sifts it down.',
      code: ['insert(x): append x at the end', '  while parent > child: swap them  // sift up', 'extractMin():', '  swap root with the last element; remove last', '  while a child < parent: swap with the smaller child', '  return the old root'],
      fields: [opsField('insert 7, insert 3, insert 9, insert 1, insert 5, extract, extract', 'insert n · extract, separated by commas')],
      run: heap,
    },
    segment: {
      name: 'Segment Tree', short: 'Segment Tree', tag: 'RANGE QUERIES · SUM', stage: 'tree', complexity: 'O(log n) query / update',
      blurb: 'Each node stores the sum of a range. A range query only visits the few nodes needed to cover it, so it takes logarithmic time instead of adding up every element.',
      code: ['build: node.sum ← left.sum + right.sum', 'query(node, l, r, ql, qr):', '  if [l, r] is outside [ql, qr]: return 0', '  if [l, r] is inside [ql, qr]: return node.sum', '  return query(left) + query(right)', 'update(i, x): walk to leaf i, set it, recompute sums on the way up'],
      fields: [{ key: 'values', label: 'Array', def: '5, 8, 6, 3, 2, 7, 2, 6', hint: '2 to 8 numbers (1–99)' }, opsField('query 1 4, update 2 10, query 0 3', 'query l r · update i x, separated by commas')],
      run: segmentTree,
    },
    uf: {
      name: 'Union-Find', short: 'Union-Find', tag: 'DISJOINT SETS · FOREST', stage: 'tree', complexity: 'O(α(n)) amortised',
      blurb: 'Tracks which elements belong to the same set. Union by rank keeps the trees shallow, and path compression flattens a path every time find walks it.',
      code: ['find(x):', '  if parent[x] ≠ x:', '    parent[x] ← find(parent[x])  // path compression', '  return parent[x]', 'union(a, b):', '  ra ← find(a); rb ← find(b); stop if ra = rb', '  attach the lower-rank root under the higher-rank root', '  if ranks tie: rank[new root] += 1'],
      fields: [{ key: 'n', label: 'Elements', def: '8', hint: '2 to 10' }, opsField('union 0 1, union 2 3, union 0 2, union 4 5, union 6 7, union 4 6, union 0 4, find 3', 'union a b · find x, separated by commas')],
      run: unionFind,
    },
    lru: {
      name: 'LRU Cache', short: 'LRU Cache', tag: 'CACHING · HASH MAP + LIST', stage: 'tree', complexity: 'O(1) get / put',
      blurb: 'Keeps the most recently used entries and evicts the one untouched for longest when full. A hash map finds an entry instantly and a linked list keeps the usage order.',
      code: ['get(k): if k in cache: move it to the front; return value', '        else: return −1  // miss', 'put(k, v):', '  if k in cache: update value, move to front', '  else: if cache is full: evict the least recently used (tail)', '        insert (k, v) at the front'],
      fields: [{ key: 'capacity', label: 'Capacity', def: '3', hint: '1 to 6' }, opsField('put 1 A, put 2 B, put 3 C, get 1, put 4 D, get 2, put 3 X', 'put key value · get key, separated by commas')],
      run: lru,
    },
  };

  window.Algo.STRUCTURES = STRUCTURES;
})();
