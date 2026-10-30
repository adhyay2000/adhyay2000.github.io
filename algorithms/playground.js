// Algorithm Playground UI. React + htm from CDN; the algorithms live in the sibling *.js files.
const { useState, useEffect, useRef, useMemo } = React;
const html = htm.bind(React.createElement);
const { ALGOS, label, util: U, SORTING, DP, STRUCTURES, DIST } = window.Algo;

const CATEGORIES = [
  { id: 'dist', name: 'Distributed Algorithms', kind: 'input', algos: DIST },
  { id: 'graph', name: 'Graph Algorithms', kind: 'graph', algos: ALGOS },
  { id: 'sorting', name: 'Sorting & Searching', kind: 'input', algos: SORTING },
  { id: 'dp', name: 'Dynamic Programming', kind: 'input', algos: DP },
  { id: 'ds', name: 'Data Structures', kind: 'input', algos: STRUCTURES },
];
const findAlgo = id => {
  const cat = CATEGORIES.find(c => c.algos[id]);
  return cat ? { cat, algo: cat.algos[id] } : null;
};
const hashAlgo = () => {
  const h = window.location.hash.slice(1);
  return findAlgo(h) ? h : Object.keys(CATEGORIES[0].algos)[0];
};

const W = 800, H = 480;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = d => (d === Infinity ? '∞' : d);

const SAMPLE = {
  nodes: [[110, 120], [300, 70], [500, 110], [690, 150], [200, 330], [410, 300], [620, 350]]
    .map(([x, y], id) => ({ id, x, y })),
  edges: [[0, 1, 4], [0, 4, 3], [1, 2, 6], [1, 5, 5], [4, 5, 2], [2, 5, 1], [2, 3, 3], [5, 6, 7], [3, 6, 2]]
    .map(([a, b, w], id) => ({ id, a, b, w })),
};

function randomGraph() {
  const count = 7;
  const nodes = [];
  for (let id = 0, tries = 0; id < count && tries < 500; tries++) {
    const x = 60 + Math.random() * (W - 120), y = 60 + Math.random() * (H - 120);
    if (nodes.every(n => Math.hypot(n.x - x, n.y - y) > 120)) nodes.push({ id: id++, x, y });
  }
  const edges = [];
  const has = (a, b) => edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const add = (a, b) => edges.push({ id: edges.length, a, b, w: 1 + Math.floor(Math.random() * 9) });
  // A random spanning tree keeps it connected (earlier node → later node, so it is also acyclic),
  // then a few extra edges make cycles for the undirected algorithms.
  for (let i = 1; i < nodes.length; i++) add(nodes[Math.floor(Math.random() * i)].id, nodes[i].id);
  for (let k = 0; k < 3; k++) {
    const a = nodes[Math.floor(Math.random() * nodes.length)].id, b = nodes[Math.floor(Math.random() * nodes.length)].id;
    if (a < b && !has(a, b)) add(a, b);
  }
  return { nodes, edges };
}

const BLANK = { line: -1, msg: 'Press Play or Step to begin.', cur: null, visited: [], edge: null, tree: [], dist: null, frontier: [], fLabel: '', matrix: null, extras: [] };
const EMPTY = { line: -1, msg: '', arr: [], marks: {}, ptr: {}, range: null, table: null, rows: [], cols: [], trees: [], cell: null, deps: [], path: [], extras: [], nodes: [], msgs: [], ring: null, procs: [], events: [], arrows: [] };

const NAV = [
  ['about', 'About'], ['projects', 'Projects'], ['algorithms', 'Algorithms'], ['experience', 'Experience'],
  ['cv', 'CV'], ['readings', 'Readings'], ['blog', 'Blog'], ['contact', 'Contact'],
];

function Header() {
  return html`
    <header className="header">
      <div className="header-content">
        <a href="../" className="logo">Aditya Upadhyay</a>
        <nav className="nav-tabs" aria-label="Sections">
          ${NAV.map(([id, name]) => id === 'algorithms'
            ? html`<a key=${id} className="nav-tab active" href="./" aria-current="page">${name}</a>`
            : html`<a key=${id} className="nav-tab" href=${`../#${id}`}>${name}</a>`)}
        </nav>
      </div>
    </header>`;
}

// ---- Playback

function usePlayer(steps) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  useEffect(() => { setIdx(0); setPlaying(false); }, [steps]);
  useEffect(() => {
    if (!playing) return;
    if (idx >= steps.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setIdx(i => i + 1), 1300 / speed);
    return () => clearTimeout(t);
  }, [playing, idx, speed, steps]);
  const last = steps.length - 1;
  const i = Math.min(idx, last);
  return {
    i, last, step: steps[i], playing, speed, setSpeed, atEnd: i >= last,
    reset: () => { setIdx(0); setPlaying(false); },
    stepBy: d => { setPlaying(false); setIdx(clamp(i + d, 0, last)); },
    seek: n => { setPlaying(false); setIdx(n); },
    toggle: () => { if (!playing && i >= last) setIdx(0); setPlaying(p => !p); },
  };
}

function Transport({ p }) {
  return html`
    <div className="controls">
      <div className="transport">
        <button className="btn btn-primary" onClick=${p.toggle} disabled=${p.last < 1}>${p.playing ? '⏸ Pause' : p.atEnd && p.i > 0 ? '↻ Replay' : '▶ Play'}</button>
        <button className="btn btn-secondary" onClick=${() => p.stepBy(-1)} disabled=${p.i === 0} aria-label="Step back">◀</button>
        <button className="btn btn-secondary" onClick=${() => p.stepBy(1)} disabled=${p.atEnd}>Step ▶</button>
        <button className="btn btn-secondary" onClick=${p.reset}>Reset</button>
        <label className="speed">Speed
          <input type="range" min="1" max="10" value=${p.speed} onChange=${e => p.setSpeed(+e.target.value)} />
        </label>
      </div>
      <input type="range" className="scrub" min="0" max=${Math.max(p.last, 0)} value=${p.i}
             aria-label="Step position" onChange=${e => p.seek(+e.target.value)} />
      <p className="counter">Step ${p.i} / ${p.last}</p>
    </div>`;
}

function Chips({ items, empty = '—' }) {
  return items.length
    ? html`<div className="chips">${items.map((c, i) => html`<span key=${i} className="chip">${c}</span>`)}</div>`
    : html`<span className="muted-sm">${empty}</span>`;
}

// Each pseudocode line keeps its indent but wraps with a hanging indent, so nothing is clipped.
function Pseudocode({ lines, active }) {
  return html`
    <div className="code" role="list">
      ${lines.map((l, n) => {
        const indent = l.length - l.trimStart().length;
        return html`<div key=${n} role="listitem" className=${`ln ${n === active ? 'on' : ''}`}
                         style=${{ paddingLeft: `${indent + 2.5}ch`, textIndent: '-2ch' }}>${l.trim()}</div>`;
      })}
    </div>`;
}

function Matrix({ m }) {
  return html`
    <table className="matrix">
      <thead><tr><th></th>${m.labels.map(l => html`<th key=${l}>${l}</th>`)}</tr></thead>
      <tbody>${m.data.map((row, i) => html`
        <tr key=${i}><th>${m.labels[i]}</th>${row.map((v, j) => html`
          <td key=${j} className=${[m.hl && m.hl[0] === i && m.hl[1] === j && 'hit', (m.k === i || m.k === j) && 'k', v === Infinity && 'inf'].filter(Boolean).join(' ')}>${fmt(v)}</td>`)}
        </tr>`)}
      </tbody>
    </table>`;
}

function Extras({ extras }) {
  return (extras || []).map((e, n) => html`
    <${React.Fragment} key=${n}><dt>${e.label}</dt><dd><${Chips} items=${e.items} /></dd><//>`);
}

function SidePanels({ algo, step, children }) {
  return html`
    <aside className="lab-side">
      <section className="panel"><h4>What's happening</h4><p className="live" aria-live="polite">${step.msg}</p></section>
      <section className="panel"><h4>Pseudocode</h4><${Pseudocode} lines=${algo.code} active=${step.line} /></section>
      <section className="panel"><h4>State</h4><dl className="state">${children}</dl></section>
      <section className="panel">
        <h4>About</h4>
        <p>${algo.blurb}</p>
        <p className="complexity-line">Complexity: <b>${algo.complexity}</b></p>
      </section>
    </aside>`;
}

function TitleBar({ algo }) {
  return html`
    <div className="lab-title">
      <div><h3>${algo.name}</h3><p className="tag-line">${algo.tag}</p></div>
      <span className="complexity">${algo.complexity}</span>
    </div>`;
}

// ---- Graph lab

function GraphCanvas({ nodes, edges, step, src, algo, tool, sel, setSel, pending, setPending, onMove, onAddNode, onAddEdge }) {
  const svgRef = useRef(null);
  const drag = useRef(null);
  const directed = !!algo.directed, weighted = algo.weighted !== false;
  const toSvg = e => {
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: clamp(p.x, 24, W - 24), y: clamp(p.y, 24, H - 24) };
  };
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const nodeDown = (e, n) => {
    e.stopPropagation();
    if (tool === 'edge') {
      if (pending == null) setPending(n.id);
      else { onAddEdge(pending, n.id); setPending(null); }
      return;
    }
    if (tool === 'select') {
      setSel({ type: 'node', id: n.id });
      drag.current = n.id;
      svgRef.current.setPointerCapture(e.pointerId);
    }
  };
  const bgDown = e => {
    if (tool === 'node') { const p = toSvg(e); onAddNode(p.x, p.y); }
    else { setSel(null); setPending(null); }
  };
  const move = e => { if (drag.current != null) { const p = toSvg(e); onMove(drag.current, p.x, p.y); } };
  const up = e => {
    if (drag.current != null) { drag.current = null; svgRef.current.releasePointerCapture(e.pointerId); }
  };
  const status = id => (step.edge && step.edge[0] === id ? step.edge[1] : step.tree.includes(id) ? 'tree' : '');

  return html`
    <svg ref=${svgRef} className=${`canvas tool-${tool}`} viewBox=${`0 0 ${W} ${H}`} role="img"
         aria-label="Interactive graph" onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="rgba(255,210,128,.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width=${W} height=${H} fill="url(#grid)" onPointerDown=${bgDown} />
      ${edges.map(e => {
        const a = byId.get(e.a), b = byId.get(e.b);
        if (!a || !b) return null;
        const selected = sel && sel.type === 'edge' && sel.id === e.id;
        const st = status(e.id);
        const pick = ev => { ev.stopPropagation(); if (tool === 'select') setSel({ type: 'edge', id: e.id }); };
        let arrow = null;
        if (directed) {
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
          const tx = b.x - ux * 27, ty = b.y - uy * 27, bx = tx - ux * 14, by = ty - uy * 14;
          arrow = html`<polygon className=${`arrow ${st}`} points=${`${tx},${ty} ${bx - uy * 7},${by + ux * 7} ${bx + uy * 7},${by - ux * 7}`} />`;
        }
        return html`
          <g key=${e.id}>
            ${selected && html`<line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} className="edge-sel" />`}
            <line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} className=${`edge ${st}`} />
            ${arrow}
            <line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} className="edge-hit" onPointerDown=${pick} />
            ${weighted && html`<text x=${(a.x + b.x) / 2} y=${(a.y + b.y) / 2} className="weight" textAnchor="middle" dominantBaseline="central">${e.w}</text>`}
          </g>`;
      })}
      ${nodes.map(n => {
        const cls = ['node', step.cur === n.id && 'cur', step.visited.includes(n.id) && 'seen', n.id === src && 'src',
          sel && sel.type === 'node' && sel.id === n.id && 'sel', pending === n.id && 'sel'].filter(Boolean).join(' ');
        return html`
          <g key=${n.id} className=${cls} onPointerDown=${ev => nodeDown(ev, n)} transform=${`translate(${n.x} ${n.y})`}>
            <circle r="24" />
            <text textAnchor="middle" dominantBaseline="central">${label(n.id)}</text>
            ${step.dist && html`<text y="40" className="dist" textAnchor="middle">${fmt(step.dist[n.id])}</text>`}
          </g>`;
      })}
    </svg>`;
}

function GraphLab({ algo }) {
  const [graph, setGraph] = useState(SAMPLE);
  const [nextId, setNextId] = useState({ node: SAMPLE.nodes.length, edge: SAMPLE.edges.length });
  const [src, setSrc] = useState(0);
  const [tool, setTool] = useState('select');
  const [sel, setSel] = useState(null);
  const [pending, setPending] = useState(null);
  const { nodes, edges } = graph;
  const source = nodes.some(n => n.id === src) ? src : (nodes[0] ? nodes[0].id : null);
  const directed = !!algo.directed, weighted = algo.weighted !== false;

  // Node positions change while dragging, so the steps depend only on topology and weights.
  const topoKey = JSON.stringify([nodes.map(n => n.id), edges]);
  const steps = useMemo(() => (source == null ? [BLANK] : [BLANK, ...algo.run(nodes, edges, source)]), [algo, topoKey, source]);
  const p = usePlayer(steps);
  const step = p.step;

  const loadGraph = g => {
    setGraph(g);
    setNextId({ node: g.nodes.length, edge: g.edges.length });
    setSrc(g.nodes[0] ? g.nodes[0].id : 0);
    setSel(null); setPending(null);
  };
  const moveNode = (id, x, y) => setGraph(g => ({ ...g, nodes: g.nodes.map(n => (n.id === id ? { ...n, x, y } : n)) }));
  const addNode = (x, y) => {
    if (nodes.length >= 26) return;
    setGraph(g => ({ ...g, nodes: [...g.nodes, { id: nextId.node, x, y }] }));
    setNextId(n => ({ ...n, node: n.node + 1 }));
  };
  const addEdge = (a, b) => {
    if (a === b || edges.some(e => (directed ? e.a === a && e.b === b : (e.a === a && e.b === b) || (e.a === b && e.b === a)))) return;
    setGraph(g => ({ ...g, edges: [...g.edges, { id: nextId.edge, a, b, w: 1 + Math.floor(Math.random() * 9) }] }));
    setSel({ type: 'edge', id: nextId.edge });
    setNextId(n => ({ ...n, edge: n.edge + 1 }));
  };
  const setWeight = (id, w) => setGraph(g => ({ ...g, edges: g.edges.map(e => (e.id === id ? { ...e, w: clamp(w || 1, 1, 99) } : e)) }));
  const reverse = id => setGraph(g => ({ ...g, edges: g.edges.map(e => (e.id === id ? { ...e, a: e.b, b: e.a } : e)) }));
  const removeSel = () => {
    if (!sel) return;
    setGraph(g => sel.type === 'edge'
      ? { ...g, edges: g.edges.filter(e => e.id !== sel.id) }
      : { nodes: g.nodes.filter(n => n.id !== sel.id), edges: g.edges.filter(e => e.a !== sel.id && e.b !== sel.id) });
    setSel(null);
  };
  const selEdge = sel && sel.type === 'edge' ? edges.find(e => e.id === sel.id) : null;
  const selNode = sel && sel.type === 'node' ? nodes.find(n => n.id === sel.id) : null;
  const pickTool = t => { setTool(t); setPending(null); if (t !== 'select') setSel(null); };
  const arrow = directed ? '→' : '–';
  const hints = {
    select: 'Drag nodes to move them. Click a node or an edge to edit it.',
    node: 'Click empty space to place a new node.',
    edge: pending == null ? `Click a node to start an edge${directed ? ' (this is the tail of the arrow)' : ''}.` : `Now click a second node to connect it to ${label(pending)}.`,
  };

  return html`
    <div className="lab">
      <div className="lab-main">
        <${TitleBar} algo=${algo} />
        <div className="canvas-wrap">
          <${GraphCanvas} nodes=${nodes} edges=${edges} step=${step} src=${algo.usesSource ? source : null} algo=${algo} tool=${tool}
            sel=${sel} setSel=${setSel} pending=${pending} setPending=${setPending}
            onMove=${moveNode} onAddNode=${addNode} onAddEdge=${addEdge} />
          <div className="legend" aria-hidden="true">
            <span><i className="lg cur"></i>current</span><span><i className="lg seen"></i>visited</span>
            <span><i className="lg tree"></i>tree / path</span><span><i className="lg rej"></i>skipped</span>
          </div>
        </div>
        <${Transport} p=${p} />
        <div className="editor">
          <div className="tools" role="group" aria-label="Graph tools">
            ${[['select', 'Move'], ['node', '+ Node'], ['edge', '+ Edge']].map(([t, name]) => html`
              <button key=${t} className=${`tag-btn ${tool === t ? 'on' : ''}`} onClick=${() => pickTool(t)}>${name}</button>`)}
            <span className="sep"></span>
            <button className="tag-btn" onClick=${() => loadGraph(randomGraph())}>🎲 Random</button>
            <button className="tag-btn" onClick=${() => loadGraph(SAMPLE)}>Sample</button>
            <button className="tag-btn" onClick=${() => loadGraph({ nodes: [], edges: [] })}>Clear</button>
          </div>
          <div className="inspector">
            ${selEdge ? html`
              <span>Edge <b>${label(selEdge.a)}${arrow}${label(selEdge.b)}</b></span>
              ${weighted && html`<label>weight <input type="number" min="1" max="99" value=${selEdge.w}
                onChange=${e => setWeight(selEdge.id, parseInt(e.target.value, 10))} /></label>`}
              ${directed && html`<button className="tag-btn" onClick=${() => reverse(selEdge.id)}>Reverse</button>`}
              <button className="tag-btn danger" onClick=${removeSel}>Delete</button>`
            : selNode ? html`
              <span>Node <b>${label(selNode.id)}</b></span>
              ${algo.usesSource && html`<button className="tag-btn" onClick=${() => setSrc(selNode.id)}
                disabled=${selNode.id === source}>${selNode.id === source ? 'Is the start node' : 'Set as start'}</button>`}
              <button className="tag-btn danger" onClick=${removeSel}>Delete</button>`
            : html`<span className="muted-sm">${hints[tool]}</span>`}
          </div>
        </div>
      </div>
      <${SidePanels} algo=${algo} step=${step}>
        ${algo.usesSource !== false || step.cur != null ? html`<dt>Current</dt><dd>${step.cur != null ? html`<span className="chip hot">${label(step.cur)}</span>` : html`<span className="muted-sm">—</span>`}</dd>` : null}
        <dt>Visited</dt><dd><${Chips} items=${step.visited.map(label)} /></dd>
        ${step.fLabel && html`<dt>${step.fLabel}</dt><dd><${Chips} items=${step.frontier} empty="empty" /></dd>`}
        ${step.dist && html`<dt>${algo.distLabel || 'Distances'}</dt><dd><${Chips} items=${nodes.map(n => `${label(n.id)} = ${fmt(step.dist[n.id])}`)} /></dd>`}
        <${Extras} extras=${step.extras} />
        ${step.matrix && html`<dt>Matrix</dt><dd><${Matrix} m=${step.matrix} /></dd>`}
      <//>
    </div>`;
}

// ---- Stages for the non-graph categories

function BarsStage({ step }) {
  const { arr, marks, ptr, range } = step;
  const max = Math.max(...arr, 1);
  const byIndex = {};
  Object.entries(ptr || {}).forEach(([name, i]) => { (byIndex[i] = byIndex[i] || []).push(name); });
  return html`
    <div className="bars" role="img" aria-label="Array as bars">
      ${arr.map((v, i) => {
        const out = range && (i < range[0] || i > range[1]);
        return html`
          <div key=${i} className=${`bar-col ${out ? 'dim' : ''}`}>
            <div className="ptrs">${(byIndex[i] || []).map(n => html`<span key=${n}>${n}</span>`)}</div>
            <div className=${`bar ${marks[i] || ''}`} style=${{ height: `${Math.max(8, (v / max) * 100)}%` }}><span>${v}</span></div>
            <div className="idx">${i}</div>
          </div>`;
      })}
    </div>`;
}

function TableStage({ step }) {
  if (!step.table) return html`<div className="stage-empty">Fix the input above to see the table.</div>`;
  const is = (list, r, c) => list.some(([a, b]) => a === r && b === c);
  return html`
    <div className="dp-wrap">
      <table className="dp">
        <thead><tr><th></th>${step.cols.map((c, i) => html`<th key=${i}>${c}</th>`)}</tr></thead>
        <tbody>${step.table.map((row, r) => html`
          <tr key=${r}><th>${step.rows[r]}</th>${row.map((v, c) => {
            const cls = [step.cell && step.cell[0] === r && step.cell[1] === c && 'cur', is(step.deps, r, c) && 'dep', is(step.path, r, c) && 'path', v === null && 'blank'].filter(Boolean).join(' ');
            return html`<td key=${c} className=${cls}>${v === null ? '' : fmt(v)}</td>`;
          })}</tr>`)}
        </tbody>
      </table>
    </div>`;
}

// Simple tidy layout: leaves get consecutive columns, parents sit above the middle of their children.
function layoutTrees(roots) {
  let leaf = 0, maxDepth = 0;
  const pos = new Map(), edges = [], nodes = [];
  const go = (n, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    let x;
    if (!n.children.length) x = leaf++;
    else {
      const xs = n.children.map(c => go(c, depth + 1));
      x = (xs[0] + xs[xs.length - 1]) / 2;
      n.children.forEach(c => edges.push([n.id, c.id]));
    }
    pos.set(n.id, { x, depth });
    nodes.push(n);
    return x;
  };
  roots.forEach(r => { go(r, 0); leaf += 0.5; });
  const gx = 64, gy = 74;
  const content = 80 + Math.max(leaf - 0.5, 0) * gx;
  const width = Math.max(360, content);
  const shift = (width - content) / 2;
  const xy = id => ({ x: shift + 40 + pos.get(id).x * gx, y: 34 + pos.get(id).depth * gy });
  return { nodes, edges, xy, width, height: 90 + maxDepth * gy };
}

function TreeView({ trees }) {
  if (!trees.length) return null;
  const L = layoutTrees(trees);
  return html`
    <svg className="tree-svg" viewBox=${`0 0 ${L.width} ${L.height}`} style=${{ maxHeight: `${L.height * 1.4}px` }} role="img" aria-label="Tree diagram">
      ${L.edges.map(([a, b]) => { const p = L.xy(a), q = L.xy(b); return html`<line key=${`${a}-${b}`} x1=${p.x} y1=${p.y} x2=${q.x} y2=${q.y} className="t-edge" />`; })}
      ${L.nodes.map(n => { const p = L.xy(n.id); return html`
        <g key=${n.id} className=${`tn ${n.cls || ''}`} transform=${`translate(${p.x} ${p.y})`}>
          <circle r="20" /><circle r="25" className="end-ring" />
          <text textAnchor="middle" dominantBaseline="central">${n.label}</text>
          ${n.sub != null && html`<text y="36" className="sub" textAnchor="middle">${n.sub}</text>`}
        </g>`; })}
    </svg>`;
}

function CellRows({ rows }) {
  return (rows || []).map((r, n) => html`
    <div key=${n} className="cell-row">
      <span className="row-title">${r.title}</span>
      <div className="cells">${r.cells.length ? r.cells.map((c, i) => html`
        <span key=${i} className=${`cellbox ${c.cls || ''}`}><b>${c.t}</b>${c.s != null && html`<i>${c.s}</i>`}</span>`) : html`<span className="muted-sm">empty</span>`}</div>
    </div>`);
}

function TreeStage({ step }) {
  const empty = !step.trees.length && !(step.rows || []).some(r => r.cells.length);
  return html`
    <div className="ds-stage">
      <${TreeView} trees=${step.trees} />
      <${CellRows} rows=${step.rows} />
      ${empty && html`<div className="stage-empty">Nothing stored yet.</div>`}
    </div>`;
}


// Cluster view: processes as circles with state lines underneath, messages as labelled arrows.
function ClusterStage({ step }) {
  const nodes = step.nodes || [];
  if (!nodes.length) return html`<div className="stage-empty">Fix the input below to see the cluster.</div>`;
  const by = new Map(nodes.map(n => [n.id, n]));
  return html`
    <svg className="cluster-svg" viewBox="0 0 800 400" role="img" aria-label="Cluster of nodes exchanging messages">
      ${(step.msgs || []).map((m, i) => {
        const a = by.get(m.from), b = by.get(m.to);
        if (!a || !b) return null;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len, nx = -uy * 7, ny = ux * 7;
        const x1 = a.x + ux * ((a.r || 26) + 3) + nx, y1 = a.y + uy * ((a.r || 26) + 3) + ny;
        const x2 = b.x - ux * ((b.r || 26) + 5) + nx, y2 = b.y - uy * ((b.r || 26) + 5) + ny;
        const bx = x2 - ux * 11, by2 = y2 - uy * 11;
        return html`
          <g key=${i} className=${`msg ${m.cls || ''}`}>
            <line x1=${x1} y1=${y1} x2=${x2} y2=${y2} />
            <polygon points=${`${x2},${y2} ${bx - uy * 5},${by2 + ux * 5} ${bx + uy * 5},${by2 - ux * 5}`} />
            ${m.label && html`<text x=${(x1 + x2) / 2 + nx * 1.3} y=${(y1 + y2) / 2 + ny * 1.3} textAnchor="middle" dominantBaseline="central">${m.label}</text>`}
          </g>`;
      })}
      ${nodes.map(n => html`
        <g key=${n.id} className=${`cn ${n.cls || ''}`} transform=${`translate(${n.x} ${n.y})`}>
          <circle r=${n.r || 26} />
          <text className="cn-label" textAnchor="middle" dominantBaseline="central">${n.label}</text>
          ${(n.lines || []).map((l, k) => html`<text key=${k} className="cn-line" y=${(n.r || 26) + 16 + k * 14} textAnchor="middle">${l}</text>`)}
        </g>`)}
    </svg>`;
}

const polar = (a, r, c = 230) => ({ x: 400 + r * Math.sin((a * Math.PI) / 180), y: c - r * Math.cos((a * Math.PI) / 180) });

function RingStage({ step }) {
  const ring = step.ring;
  if (!ring) return html`<div className="stage-empty">Fix the input below to see the ring.</div>`;
  const R = 160;
  const arc = ring.arc;
  let arcPath = null;
  if (arc) {
    const span = (arc.to - arc.from + 360) % 360;
    const p = polar(arc.from, R), q = polar(arc.to, R);
    if (span > 0) arcPath = `M${p.x},${p.y} A${R},${R} 0 ${span > 180 ? 1 : 0} 1 ${q.x},${q.y}`;
  }
  return html`
    <svg className="ring-svg" viewBox="0 0 800 460" role="img" aria-label="Consistent hash ring">
      <circle cx="400" cy="230" r=${R} className="ring-line" />
      ${[0, 90, 180, 270].map(a => { const p = polar(a, R + 40); return html`<text key=${a} x=${p.x} y=${p.y} className="ring-tick" textAnchor="middle" dominantBaseline="central">${a}°</text>`; })}
      ${arcPath && html`<path d=${arcPath} className="ring-arc" style=${{ stroke: arc.color }} />`}
      ${ring.keys.map(k => { const p = polar(k.pos, R), t = polar(k.pos, R - 24); return html`
        <g key=${k.name} className=${`rk ${k.cls}`}>
          <circle cx=${p.x} cy=${p.y} r="6" style=${{ fill: k.color }} />
          <text x=${t.x} y=${t.y} textAnchor="middle" dominantBaseline="central">${k.name}</text>
        </g>`; })}
      ${ring.nodes.map(n => { const p = polar(n.pos, R), t = polar(n.pos, R + 26); return html`
        <g key=${`${n.name}-${n.pos}`} className=${`rn ${n.cur ? 'cur' : ''}`}>
          <rect x=${p.x - 9} y=${p.y - 9} width="18" height="18" rx="4" style=${{ fill: n.color }} />
          <text x=${t.x} y=${t.y} textAnchor="middle" dominantBaseline="central">${n.name}</text>
        </g>`; })}
    </svg>`;
}

function TimelineStage({ step }) {
  const procs = step.procs || [];
  if (!procs.length) return html`<div className="stage-empty">Fix the input below to see the timeline.</div>`;
  const events = step.events || [];
  const cols = Math.max(events.length, 8);
  const gx = Math.min(92, 640 / cols);
  const laneY = i => 60 + i * 96, evX = c => 110 + c * gx;
  const width = Math.max(800, 150 + cols * gx), height = 40 + procs.length * 96;
  const ev = new Map(events.map(e => [e.id, e]));
  return html`
    <div className="timeline-wrap">
      <svg className="timeline-svg" viewBox=${`0 0 ${width} ${height}`} style=${{ minWidth: `${Math.min(width, 560)}px` }} role="img" aria-label="Message timeline">
        ${procs.map((p, i) => html`
          <g key=${p}>
            <line x1="70" y1=${laneY(i)} x2=${width - 20} y2=${laneY(i)} className="lane" />
            <text x="20" y=${laneY(i)} className="lane-name" dominantBaseline="central">${p}</text>
          </g>`)}
        ${(step.arrows || []).map((a, i) => {
          const f = ev.get(a.from), t = ev.get(a.to);
          if (!f || !t) return null;
          const x1 = evX(f.col), y1 = laneY(f.proc), x2 = evX(t.col), y2 = laneY(t.proc);
          const len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
          const ex = x2 - ux * 13, ey = y2 - uy * 13;
          return html`
            <g key=${i} className="msg req">
              <line x1=${x1} y1=${y1} x2=${ex} y2=${ey} />
              <polygon points=${`${ex + ux * 8},${ey + uy * 8} ${ex - uy * 5},${ey + ux * 5} ${ex + uy * 5},${ey - ux * 5}`} />
              <text x=${(x1 + x2) / 2 + 10} y=${(y1 + y2) / 2} dominantBaseline="central">${a.label}</text>
            </g>`;
        })}
        ${events.map(e => html`
          <g key=${e.id} className=${`ev ${e.cls || ''}`} transform=${`translate(${evX(e.col)} ${laneY(e.proc)})`}>
            <circle r="11" />
            <text className="ev-name" y="-34" textAnchor="middle">${e.name}</text>
            <text className="ev-kind" y="-21" textAnchor="middle">${e.label}</text>
            <text className="ev-vc" y="28" textAnchor="middle">[${e.vc.join(',')}]</text>
          </g>`)}
      </svg>
    </div>`;
}

const STAGES = { bars: BarsStage, table: TableStage, tree: TreeStage, cluster: ClusterStage, ring: RingStage, timeline: TimelineStage };

function InputLab({ algo }) {
  const defaults = () => Object.fromEntries(algo.fields.map(f => [f.key, f.def]));
  const [values, setValues] = useState(defaults);
  const { steps, error } = useMemo(() => {
    try { return { steps: algo.run(values), error: null }; }
    catch (e) { return { steps: [EMPTY], error: e.message }; }
  }, [algo, values]);
  const p = usePlayer(steps);
  const step = p.step;
  const Stage = STAGES[algo.stage];

  return html`
    <div className="lab">
      <div className="lab-main">
        <${TitleBar} algo=${algo} />
        <div className="stage"><${Stage} step=${step} /></div>
        <${Transport} p=${p} />
        <div className="editor">
          <div className="fields">
            ${algo.fields.map(f => html`
              <label key=${f.key} className=${`field ${f.wide ? 'wide' : ''}`}>
                <span>${f.label}</span>
                <input type="text" value=${values[f.key]} spellCheck="false" onChange=${e => setValues({ ...values, [f.key]: e.target.value })} />
                <small>${f.hint}</small>
              </label>`)}
          </div>
          <div className="tools">
            ${algo.random && html`<button className="tag-btn" onClick=${() => setValues(algo.random())}>🎲 Random</button>`}
            <button className="tag-btn" onClick=${() => setValues(defaults())}>Reset input</button>
          </div>
          ${error && html`<p className="error" role="alert">${error}</p>`}
        </div>
      </div>
      <${SidePanels} algo=${algo} step=${step}>
        ${step.extras && step.extras.length ? html`<${Extras} extras=${step.extras} />` : html`<dt>Info</dt><dd><span className="muted-sm">Nothing extra for this step.</span></dd>`}
        ${step.ptr && Object.keys(step.ptr).length > 0 && html`<dt>Pointers</dt><dd><${Chips} items=${Object.entries(step.ptr).map(([k, v]) => `${k} = ${v}`)} /></dd>`}
      <//>
    </div>`;
}

function App() {
  const [algoId, setAlgoId] = useState(hashAlgo);
  useEffect(() => {
    const onHash = () => setAlgoId(hashAlgo());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const { cat, algo } = findAlgo(algoId);
  const choose = id => { window.location.hash = id; setAlgoId(id); };

  return html`
    <${React.Fragment}>
      <${Header} />
      <main className="main-container lab-page">
        <div className="section-header">
          <p className="eyebrow">Interactive</p>
          <h2>Algorithm Playground</h2>
          <p>Pick an algorithm, change the input, and step through it one decision at a time.</p>
        </div>

        <div className="cats" role="tablist" aria-label="Categories">
          ${CATEGORIES.map(c => html`
            <button key=${c.id} role="tab" aria-selected=${c.id === cat.id} className=${`cat ${c.id === cat.id ? 'on' : ''}`}
                    onClick=${() => choose(Object.keys(c.algos)[0])}>${c.name}</button>`)}
        </div>

        <div className="algo-tabs" role="tablist" aria-label="Algorithms">
          ${Object.entries(cat.algos).map(([id, a]) => html`
            <button key=${id} role="tab" aria-selected=${id === algoId} className=${`algo-tab ${id === algoId ? 'on' : ''}`}
                    onClick=${() => choose(id)}>${a.short}</button>`)}
        </div>

        ${cat.kind === 'graph'
          ? html`<${GraphLab} algo=${algo} />`
          : html`<${InputLab} key=${algoId} algo=${algo} />`}
      </main>
      <footer className="footer"><p><a href="../">← Back to the main site</a></p></footer>
    <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
