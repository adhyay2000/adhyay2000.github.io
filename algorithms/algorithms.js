// Graph algorithms as step recorders. Each run(nodes, edges, src) returns a list of
// snapshots the UI can play back, so stepping backwards is just changing an index.
// Edges are undirected: { id, a, b, w }.
(function () {
  const INF = Infinity;

  const label = i => {
    let s = '';
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  };
  const names = ids => ids.map(label);
  const edgeName = e => `${label(e.a)}–${label(e.b)} (${e.w})`;

  function buildAdj(nodes, edges) {
    const adj = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) {
      adj.get(e.a).push({ to: e.b, w: e.w, eid: e.id });
      adj.get(e.b).push({ to: e.a, w: e.w, eid: e.id });
    }
    adj.forEach(list => list.sort((x, y) => x.to - y.to));
    return adj;
  }

  function recorder() {
    const steps = [];
    const st = { cur: null, visited: [], edge: null, tree: [], dist: null, frontier: [], fLabel: '', matrix: null, extras: [] };
    const snap = (line, msg, patch = {}) => {
      Object.assign(st, patch);
      steps.push({
        line, msg,
        cur: st.cur,
        visited: [...st.visited],
        edge: st.edge,
        tree: [...st.tree],
        dist: st.dist && { ...st.dist },
        frontier: [...st.frontier],
        fLabel: st.fLabel,
        matrix: st.matrix && structuredClone(st.matrix),
        extras: st.extras.map(e => ({ ...e, items: [...e.items] })),
      });
    };
    return { steps, st, snap };
  }

  function bfs(nodes, edges, src) {
    const adj = buildAdj(nodes, edges);
    const { steps, st, snap } = recorder();
    st.fLabel = 'Queue';
    const seen = new Set([src]);
    const parent = new Map();
    const q = [src];
    snap(1, `Mark ${label(src)} and put it in the queue.`, { visited: [src], frontier: names(q) });
    while (q.length) {
      const u = q.shift();
      snap(3, `Dequeue ${label(u)} and explore its neighbours.`, { cur: u, edge: null, frontier: names(q) });
      for (const { to: v, eid } of adj.get(u)) {
        if (eid === parent.get(u)) continue;
        if (seen.has(v)) {
          snap(5, `${label(v)} is already marked, skip it.`, { edge: [eid, 'reject'] });
        } else {
          seen.add(v); parent.set(v, eid); q.push(v);
          st.visited.push(v); st.tree.push(eid);
          snap(6, `${label(v)} is new: mark it and enqueue.`, { edge: [eid, 'accept'], frontier: names(q) });
        }
      }
    }
    snap(2, `Queue is empty. ${seen.size} node${seen.size === 1 ? '' : 's'} reached.`, { cur: null, edge: null });
    return steps;
  }

  function dfs(nodes, edges, src) {
    const adj = buildAdj(nodes, edges);
    const { steps, st, snap } = recorder();
    st.fLabel = 'Call stack';
    const seen = new Set();
    const stack = [];
    function visit(u, via) {
      seen.add(u); stack.push(u); st.visited.push(u);
      if (via != null) st.tree.push(via);
      snap(1, `Enter ${label(u)} and mark it.`, { cur: u, edge: via != null ? [via, 'accept'] : null, frontier: names(stack) });
      for (const { to: v, eid } of adj.get(u)) {
        if (eid === via) continue;
        if (seen.has(v)) {
          snap(3, `${label(v)} is already marked, skip it.`, { cur: u, edge: [eid, 'reject'] });
        } else {
          snap(4, `${label(v)} is unvisited: recurse into it.`, { cur: u, edge: [eid, 'look'] });
          visit(v, eid);
          snap(2, `Back at ${label(u)}, check the next neighbour.`, { cur: u, edge: null, frontier: names(stack) });
        }
      }
      stack.pop();
      if (stack.length === 0) snap(2, `${label(u)} is finished. The search is complete.`, { cur: null, edge: null, frontier: [] });
    }
    visit(src, null);
    return steps;
  }

  function dijkstra(nodes, edges, src) {
    const adj = buildAdj(nodes, edges);
    const { steps, st, snap } = recorder();
    st.fLabel = 'Priority queue';
    const dist = {};
    nodes.forEach(n => { dist[n.id] = INF; });
    dist[src] = 0;
    st.dist = dist;
    const par = new Map();
    const done = new Set();
    const pq = [[0, src]];
    const show = () => pq.map(([d, v]) => `${label(v)}:${d}`);
    snap(2, `Every distance starts at ∞, except ${label(src)} = 0. Push it into the queue.`, { frontier: show() });
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
      const [d, u] = pq.shift();
      if (done.has(u)) {
        snap(5, `${label(u)} is already final, drop this stale entry.`, { cur: u, edge: null, frontier: show() });
        continue;
      }
      done.add(u); st.visited.push(u);
      if (par.has(u)) st.tree.push(par.get(u));
      snap(4, `Extract ${label(u)} with the smallest distance (${d}). It is now final.`, { cur: u, edge: null, frontier: show() });
      for (const { to: v, w, eid } of adj.get(u)) {
        const nd = d + w;
        if (nd < dist[v]) {
          const old = dist[v] === INF ? '∞' : dist[v];
          dist[v] = nd; par.set(v, eid); pq.push([nd, v]);
          snap(8, `${label(u)}→${label(v)}: ${d} + ${w} = ${nd} < ${old}, update ${label(v)}.`, { edge: [eid, 'accept'], frontier: show() });
        } else {
          snap(7, `${label(u)}→${label(v)}: ${d} + ${w} = ${nd} ≥ ${dist[v]}, no improvement.`, { edge: [eid, 'reject'] });
        }
      }
    }
    snap(3, 'Queue is empty. All reachable distances are final.', { cur: null, edge: null });
    return steps;
  }

  function bellmanFord(nodes, edges, src) {
    const { steps, st, snap } = recorder();
    st.fLabel = 'Progress';
    const dist = {};
    nodes.forEach(n => { dist[n.id] = INF; });
    dist[src] = 0;
    st.dist = dist;
    const par = new Map();
    const sync = () => {
      st.visited = nodes.filter(n => dist[n.id] !== INF).map(n => n.id);
      st.tree = [...new Set(par.values())];
    };
    sync();
    snap(1, `Every distance starts at ∞, except ${label(src)} = 0.`, { frontier: [] });
    const passes = Math.max(nodes.length - 1, 1);
    for (let i = 1; i <= passes; i++) {
      let changed = false;
      snap(2, `Pass ${i} of ${passes}: try to relax every edge.`, { cur: null, edge: null, frontier: [`pass ${i}/${passes}`] });
      for (const e of edges) {
        for (const [u, v] of [[e.a, e.b], [e.b, e.a]]) {
          if (dist[u] !== INF && dist[u] + e.w < dist[v]) {
            const old = dist[v] === INF ? '∞' : dist[v];
            dist[v] = dist[u] + e.w; par.set(v, e.id); changed = true; sync();
            snap(5, `${label(u)}→${label(v)}: ${dist[u]} + ${e.w} = ${dist[v]} < ${old}, update ${label(v)}.`, { cur: u, edge: [e.id, 'accept'] });
          } else {
            const via = dist[u] === INF ? '∞' : dist[u] + e.w;
            snap(4, `${label(u)}→${label(v)}: ${dist[u] === INF ? '∞' : dist[u]} + ${e.w} = ${via}, not better than ${dist[v] === INF ? '∞' : dist[v]}.`, { cur: u, edge: [e.id, 'reject'] });
          }
        }
      }
      if (!changed) {
        snap(6, `Nothing changed in pass ${i}, so we can stop early.`, { cur: null, edge: null });
        return steps;
      }
    }
    snap(2, 'All passes done. Distances are final.', { cur: null, edge: null, frontier: [] });
    return steps;
  }

  function prim(nodes, edges, src) {
    const adj = buildAdj(nodes, edges);
    const { steps, st, snap } = recorder();
    st.fLabel = 'Candidate edges';
    const inTree = new Set([src]);
    const eById = new Map(edges.map(e => [e.id, e]));
    let pq = [];
    let total = 0;
    const push = u => adj.get(u).forEach(({ to, w, eid }) => { if (!inTree.has(to)) pq.push({ w, eid, to }); });
    const show = () => pq.map(c => edgeName(eById.get(c.eid)));
    st.visited = [src];
    push(src);
    snap(1, `Start the tree at ${label(src)} and queue its edges.`, { cur: src, frontier: show() });
    while (pq.length) {
      pq.sort((x, y) => x.w - y.w || x.eid - y.eid);
      const c = pq.shift();
      if (inTree.has(c.to)) {
        snap(4, `${label(c.to)} is already in the tree, skip ${edgeName(eById.get(c.eid))}.`, { edge: [c.eid, 'reject'], frontier: show() });
        continue;
      }
      inTree.add(c.to); st.visited.push(c.to); st.tree.push(c.eid); total += c.w;
      push(c.to);
      snap(5, `Cheapest edge is ${edgeName(eById.get(c.eid))}. Add ${label(c.to)} to the tree.`, { cur: c.to, edge: [c.eid, 'accept'], frontier: show() });
    }
    snap(2, `Done. Tree weight = ${total}${inTree.size < nodes.length ? ' (graph is disconnected, so this spans one component)' : ''}.`, { cur: null, edge: null, frontier: [] });
    return steps;
  }

  function kruskal(nodes, edges) {
    const { steps, st, snap } = recorder();
    st.fLabel = 'Sorted edges';
    const sorted = [...edges].sort((x, y) => x.w - y.w || x.id - y.id);
    const parent = new Map(nodes.map(n => [n.id, n.id]));
    const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const touched = new Set();
    let total = 0;
    const rest = i => sorted.slice(i + 1).map(edgeName);
    snap(1, 'Sort all edges by weight.', { frontier: sorted.map(edgeName) });
    snap(2, 'Put every node in its own set.', {});
    sorted.forEach((e, i) => {
      const ra = find(e.a), rb = find(e.b);
      if (ra !== rb) {
        parent.set(ra, rb); st.tree.push(e.id); total += e.w;
        touched.add(e.a); touched.add(e.b); st.visited = [...touched];
        snap(5, `${edgeName(e)} joins two different sets: add it to the MST.`, { edge: [e.id, 'accept'], frontier: rest(i) });
      } else {
        snap(6, `${edgeName(e)} would close a cycle: skip it.`, { edge: [e.id, 'reject'], frontier: rest(i) });
      }
    });
    snap(3, `Done. Tree weight = ${total}.`, { edge: null, frontier: [] });
    return steps;
  }


  function floydWarshall(nodes, edges) {
    const { steps, st, snap } = recorder();
    const n = nodes.length;
    const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
    const at = new Map(nodes.map((nd, i) => [nd.id, i]));
    for (const e of edges) {
      const i = at.get(e.a), j = at.get(e.b);
      d[i][j] = Math.min(d[i][j], e.w); d[j][i] = Math.min(d[j][i], e.w);
    }
    st.matrix = { labels: nodes.map(nd => label(nd.id)), data: d, hl: null, k: null };
    snap(1, 'Start with the edge weights: 0 on the diagonal, ∞ where there is no direct edge.');
    for (let k = 0; k < n; k++) {
      st.matrix.k = k; st.matrix.hl = null;
      snap(2, `Allow ${label(nodes[k].id)} as an intermediate stop on every path.`, { cur: nodes[k].id, visited: [], edge: null });
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === k || j === k || i === j) continue;
          if (d[i][k] !== INF && d[k][j] !== INF && d[i][k] + d[k][j] < d[i][j]) {
            const old = d[i][j] === INF ? '∞' : d[i][j];
            d[i][j] = d[i][k] + d[k][j];
            st.matrix.hl = [i, j];
            snap(4, `${label(nodes[i].id)}→${label(nodes[k].id)}→${label(nodes[j].id)} costs ${d[i][k]} + ${d[k][j]} = ${d[i][j]} < ${old}, so update.`,
              { cur: nodes[k].id, visited: [nodes[i].id, nodes[j].id] });
          }
        }
      }
    }
    st.matrix.k = null; st.matrix.hl = null;
    snap(5, 'Done. Every entry is now the shortest distance between that pair.', { cur: null, visited: [] });
    return steps;
  }

  function topoSort(nodes, edges) {
    const { steps, st, snap } = recorder();
    st.fLabel = 'Queue';
    const out = new Map(nodes.map(n => [n.id, []]));
    const indeg = {};
    nodes.forEach(n => { indeg[n.id] = 0; });
    for (const e of edges) { out.get(e.a).push({ to: e.b, eid: e.id }); indeg[e.b]++; }
    out.forEach(l => l.sort((x, y) => x.to - y.to));
    st.dist = indeg;
    snap(1, 'Count the incoming edges of every node (shown under each node).');
    const q = nodes.filter(n => indeg[n.id] === 0).map(n => n.id);
    snap(2, q.length ? `Nodes with nothing pointing at them can go first: ${names(q).join(', ')}.` : 'No node is free of incoming edges, so there is no valid order.', { frontier: names(q) });
    const order = [];
    while (q.length) {
      const u = q.shift();
      order.push(u); st.visited.push(u);
      st.extras = [{ label: 'Order', items: names(order) }];
      snap(4, `Output ${label(u)} as number ${order.length} in the order.`, { cur: u, edge: null, frontier: names(q) });
      for (const { to: v, eid } of out.get(u)) {
        indeg[v]--;
        if (indeg[v] === 0) {
          q.push(v); q.sort((x, y) => x - y);
          st.tree.push(eid);
          snap(6, `Remove ${label(u)}→${label(v)}. ${label(v)} has no unmet prerequisites left: enqueue it.`, { edge: [eid, 'accept'], frontier: names(q) });
        } else {
          snap(5, `Remove ${label(u)}→${label(v)}. ${label(v)} still waits on ${indeg[v]} more.`, { edge: [eid, 'look'], frontier: names(q) });
        }
      }
    }
    if (order.length < nodes.length) {
      snap(7, `Cycle detected: only ${order.length} of ${nodes.length} nodes could be ordered.`, { cur: null, edge: null, frontier: [] });
    } else {
      snap(3, 'Done. Every edge points from an earlier node to a later one.', { cur: null, edge: null, frontier: [] });
    }
    return steps;
  }

  const ALGOS = {
    bfs: {
      name: 'Breadth-First Search', short: 'BFS', tag: 'TRAVERSAL · UNWEIGHTED', usesSource: true, weighted: false, run: bfs,
      blurb: 'Explores the graph level by level using a queue. It finds the fewest-hop path from the source to every reachable node.',
      complexity: 'O(V + E)',
      code: ['BFS(G, s):', '  mark s; queue ← [s]', '  while queue is not empty:', '    u ← dequeue()', '    for each neighbour v of u:', '      if v is marked: skip', '      else: mark v; enqueue(v)'],
    },
    dfs: {
      name: 'Depth-First Search', short: 'DFS', tag: 'TRAVERSAL · UNWEIGHTED', usesSource: true, weighted: false, run: dfs,
      blurb: 'Dives as deep as possible along each branch before backtracking. The call stack is what keeps track of the way back.',
      complexity: 'O(V + E)',
      code: ['DFS(u):', '  mark u', '  for each neighbour v of u:', '    if v is marked: skip', '    else: DFS(v)'],
    },
    dijkstra: {
      name: "Dijkstra's Algorithm", short: 'Dijkstra', tag: 'SHORTEST PATH · WEIGHTED GRAPH', usesSource: true, distLabel: 'Distances', run: dijkstra,
      blurb: 'Always finalises the closest unfinished node, then relaxes its edges. Correct as long as no edge weight is negative.',
      complexity: 'O((V + E) log V)',
      code: ['Dijkstra(G, s):', '  dist[v] ← ∞; dist[s] ← 0', '  pq ← [(0, s)]', '  while pq is not empty:', '    (d, u) ← pq.extractMin()', '    if u is final: continue', '    for each edge (u, v, w):', '      if d + w < dist[v]:', '        dist[v] ← d + w; pq.push(v)'],
    },
    bellmanford: {
      name: 'Bellman-Ford', short: 'Bellman-Ford', tag: 'SHORTEST PATH · WEIGHTED GRAPH', usesSource: true, distLabel: 'Distances', run: bellmanFord,
      blurb: 'Relaxes every edge V − 1 times, so shortest paths of 1, 2, 3… edges settle one pass at a time. Each undirected edge is tried in both directions here. It also copes with negative weights on directed graphs, but this playground keeps weights positive.',
      complexity: 'O(V · E)',
      code: ['BellmanFord(G, s):', '  dist[v] ← ∞; dist[s] ← 0', '  repeat V − 1 times:', '    for each edge (u, v, w):', '      if dist[u] + w < dist[v]:', '        dist[v] ← dist[u] + w', '    stop early if nothing changed'],
    },

    floyd: {
      name: 'Floyd-Warshall', short: 'Floyd-Warshall', tag: 'ALL-PAIRS SHORTEST PATH · WEIGHTED GRAPH', usesSource: false, run: floydWarshall,
      blurb: 'Builds the answer for every pair of nodes at once. For each node k in turn, it checks whether going through k beats the best known route from i to j. Only improvements get their own step here.',
      complexity: 'O(V³)',
      code: ['FloydWarshall(G):', '  d[i][j] ← weight(i, j), 0 on the diagonal, ∞ otherwise', '  for each intermediate node k:', '    for each pair (i, j):', '      if d[i][k] + d[k][j] < d[i][j]: update', '  d now holds every shortest distance'],
    },
    topo: {
      name: 'Topological Sort', short: 'Topo Sort', tag: 'ORDERING · DIRECTED GRAPH', usesSource: false, weighted: false, directed: true, distLabel: 'In-degree', run: topoSort,
      blurb: "Kahn's algorithm. Repeatedly output a node with no unmet prerequisites, then remove its outgoing edges. Edges are directed here: they point from the first node you click to the second. A cycle leaves some nodes stuck, which is how it gets detected.",
      complexity: 'O(V + E)',
      code: ['TopoSort(G):', '  compute indegree of every node', '  queue ← nodes with indegree 0', '  while queue is not empty:', '    u ← dequeue(); append u to order', '    for each edge u → v: indegree[v] −= 1', '      if indegree[v] = 0: enqueue(v)', '  if order has fewer than V nodes: cycle!'],
    },
    prim: {
      name: "Prim's Algorithm", short: 'Prim', tag: 'MINIMUM SPANNING TREE', usesSource: true, run: prim,
      blurb: 'Grows a single tree from the start node, always adding the cheapest edge that reaches a node outside the tree.',
      complexity: 'O(E log V)',
      code: ["Prim(G, s):", '  tree ← {s}; pq ← edges of s', '  while pq is not empty:', '    (w, u, v) ← pq.extractMin()', '    if v is in tree: continue', '    add v and edge (u, v) to tree', '    push v’s edges into pq'],
    },
    kruskal: {
      name: "Kruskal's Algorithm", short: 'Kruskal', tag: 'MINIMUM SPANNING TREE', usesSource: false, run: kruskal,
      blurb: 'Considers edges from cheapest to heaviest and keeps an edge only if it joins two different components (tracked with union-find).',
      complexity: 'O(E log E)',
      code: ['Kruskal(G):', '  sort edges by weight', '  make-set(v) for every node', '  for each edge (u, v, w) in order:', '    if find(u) ≠ find(v):', '      union(u, v); add edge to MST', '    else: skip (would form a cycle)'],
    },
  };


  const util = {
    clone: x => structuredClone(x),
    ints(str, { min = -Infinity, max = Infinity, minLen = 1, maxLen = 99, name = 'Values' } = {}) {
      const nums = String(str).split(/[\s,]+/).filter(Boolean).map(Number);
      if (nums.some(n => !Number.isInteger(n))) throw new Error(`${name}: use whole numbers separated by commas.`);
      if (nums.length < minLen || nums.length > maxLen) throw new Error(`${name}: enter ${minLen} to ${maxLen} numbers.`);
      if (nums.some(n => n < min || n > max)) throw new Error(`${name}: each number must be between ${min} and ${max}.`);
      return nums;
    },
    int(str, min, max, name) {
      const n = Number(str);
      if (!String(str).trim() || !Number.isInteger(n) || n < min || n > max) throw new Error(`${name}: enter a whole number from ${min} to ${max}.`);
      return n;
    },
    str(s, { minLen = 1, maxLen = 10, name = 'Text' } = {}) {
      const t = String(s).replace(/\s+/g, '');
      if (t.length < minLen || t.length > maxLen) throw new Error(`${name}: enter ${minLen} to ${maxLen} characters.`);
      return t;
    },
    ops(s, { max = 14 } = {}) {
      const list = String(s).split(/[,;\n]+/).map(x => x.trim().split(/\s+/).filter(Boolean)).filter(a => a.length);
      if (!list.length || list.length > max) throw new Error(`Enter 1 to ${max} operations separated by commas.`);
      return list;
    },
    randInt: (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)),
  };

  window.Algo = { ALGOS, label, util };
})();
