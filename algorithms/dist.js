// Distributed algorithm recorders. Three kinds of snapshot, depending on the stage:
//   cluster:  { nodes: [{ id, label, x, y, r, cls, lines }], msgs: [{ from, to, label, cls }], extras }
//   ring:     { ring: { nodes: [{ name, pos, color }], keys: [{ name, pos, color, cls }], arc }, extras }
//   timeline: { procs, events: [{ id, proc, col, name, label, vc, cls }], arrows: [{ from, to, label }], extras }
(function () {
  const U = window.Algo.util;
  const W = 800;

  const recorder = () => {
    const steps = [];
    const snap = (line, msg, o = {}) => steps.push(U.clone({ line, msg, nodes: [], msgs: [], extras: [], ...o }));
    return { steps, snap };
  };
  const spread = (n, y, lo = 100, hi = 700) => Array.from({ length: n }, (_, i) => ({ x: n === 1 ? W / 2 : lo + (i * (hi - lo)) / (n - 1), y }));
  const list = (s, { min = 1, max = 8, maxLen = 6, name = 'List' } = {}) => {
    const items = String(s).split(/[,;]+/).map(x => x.trim()).filter(Boolean);
    if (items.length < min || items.length > max) throw new Error(`${name}: enter ${min} to ${max} items separated by commas.`);
    if (items.some(x => x.length > maxLen || /\s/.test(x))) throw new Error(`${name}: each item must be ${maxLen} characters or fewer, with no spaces.`);
    return items;
  };

  // ---- Paxos (single decree)
  function paxos(v) {
    const n = U.int(v.acceptors, 3, 7, 'Acceptors');
    const valA = U.str(v.valA, { maxLen: 6, name: 'Value A' });
    const valB = String(v.valB).trim() ? U.str(v.valB, { maxLen: 6, name: 'Value B' }) : null;
    const maj = (n >> 1) + 1;
    const k = valB ? Math.min(n, U.int(v.k, 0, 99, 'A reaches')) : n;
    const { steps, snap: push } = recorder();
    const acc = Array.from({ length: n }, () => ({ promised: 0, accepted: null }));
    const pos = spread(n, 300, 90, 710);
    const role = { A: { x: 250, y: 70, state: 'idle' }, B: { x: 550, y: 70, state: 'idle' } };
    const status = {};
    const view = (msgs, cls = {}) => {
      const nodes = [];
      if (true) nodes.push({ id: 'A', label: 'A', x: role.A.x, y: role.A.y, cls: cls.A || '', lines: [`proposer · ${role.A.state}`] });
      if (valB) nodes.push({ id: 'B', label: 'B', x: role.B.x, y: role.B.y, cls: cls.B || '', lines: [`proposer · ${role.B.state}`] });
      acc.forEach((a, i) => nodes.push({
        id: i, label: `P${i + 1}`, x: pos[i].x, y: pos[i].y, r: 22, cls: cls[i] || status[i] || '',
        lines: [`promised ${a.promised || '–'}`, a.accepted ? `accepted ${a.accepted.n}:${a.accepted.v}` : 'accepted –'],
      }));
      return nodes;
    };
    const snap = (line, msg, msgs = [], cls = {}, extras = []) => push(line, msg, { nodes: view(msgs, cls), msgs, extras });
    let chosen = null;
    const chosenExtra = () => [{ label: 'Chosen', items: [chosen || 'nothing yet'] }];
    snap(0, `${n} acceptors, so a majority is ${maj}. Proposer A wants to propose "${valA}"${valB ? `, and B wants "${valB}"` : ''}.`, [], {}, chosenExtra());

    // Round 1: proposer A
    role.A.state = 'phase 1';
    snap(0, 'Phase 1a: A picks proposal number 1 and sends prepare(1) to every acceptor.', acc.map((_, i) => ({ from: 'A', to: i, label: 'prepare(1)', cls: 'req' })), { A: 'cur' }, chosenExtra());
    acc.forEach(a => { a.promised = 1; });
    snap(1, 'Phase 1b: each acceptor has promised nothing higher, so it promises not to accept anything below 1.', acc.map((_, i) => ({ from: i, to: 'A', label: 'promise(1)', cls: 'rep' })), {}, chosenExtra());
    role.A.state = 'phase 2';
    const kk = Math.min(k, n);
    const sent = Array.from({ length: kk }, (_, i) => i);
    snap(2, kk ? `Phase 2a: no acceptor reported an accepted value, so A uses its own, "${valA}". It sends accept(1, ${valA}) but only reaches the first ${kk} acceptor${kk === 1 ? '' : 's'}${kk < n ? ' before crashing' : ''}.` : 'Phase 2a: A crashes before it can send any accept message.',
      sent.map(i => ({ from: 'A', to: i, label: `accept(1,${valA})`, cls: 'req' })), { A: 'cur' }, chosenExtra());
    if (kk) {
      sent.forEach(i => { acc[i].accepted = { n: 1, v: valA }; });
      snap(3, `Phase 2b: those acceptors accept (1, ${valA}) because 1 ≥ their promise.`, sent.map(i => ({ from: i, to: 'A', label: 'accepted', cls: 'rep' })), Object.fromEntries(sent.map(i => [i, 'ok'])), chosenExtra());
    }
    if (kk >= maj) {
      chosen = valA; role.A.state = 'done';
      snap(4, `${kk} of ${n} acceptors accepted (1, ${valA}): a majority. "${valA}" is chosen and can never change.`, [], { A: 'ok', ...Object.fromEntries(sent.map(i => [i, 'ok'])) }, chosenExtra());
    } else {
      role.A.state = 'crashed'; role.A.crashed = true;
      snap(4, `Only ${kk} of ${n} accepted, fewer than the majority ${maj}. Nothing is chosen yet, and A has crashed.`, [], { A: 'crashed' }, chosenExtra());
    }

    // Round 2: proposer B, which can only reach the last `maj` acceptors
    if (valB) {
      const q = Array.from({ length: maj }, (_, i) => n - maj + i);
      role.B.state = 'phase 1';
      snap(0, `B starts with proposal number 2 and can only reach acceptors ${q.map(i => `P${i + 1}`).join(', ')} (a majority). It sends prepare(2).`, q.map(i => ({ from: 'B', to: i, label: 'prepare(2)', cls: 'req' })), { B: 'cur' }, chosenExtra());
      q.forEach(i => { acc[i].promised = 2; });
      const seen = q.map(i => acc[i].accepted).filter(Boolean);
      snap(1, seen.length
        ? `Each acceptor promises 2 and reports what it already accepted. ${seen.length > 1 ? 'They' : 'One'} reported (1, ${valA}).`
        : 'Each acceptor promises 2. None of them has accepted anything yet.',
      q.map(i => ({ from: i, to: 'B', label: acc[i].accepted ? `promise(2,${acc[i].accepted.n}:${acc[i].accepted.v})` : 'promise(2)', cls: 'rep' })), {}, chosenExtra());
      const val = seen.length ? seen.reduce((b, s) => (s.n > b.n ? s : b)).v : valB;
      role.B.state = 'phase 2';
      snap(2, seen.length
        ? `B must adopt the value with the highest number it saw: "${val}", not its own "${valB}". This is what keeps Paxos safe.`
        : `Nobody has accepted a value, so B is free to propose its own, "${valB}".`,
      q.map(i => ({ from: 'B', to: i, label: `accept(2,${val})`, cls: 'req' })), { B: 'cur' }, chosenExtra());
      q.forEach(i => { acc[i].accepted = { n: 2, v: val }; });
      chosen = val; role.B.state = 'done';
      snap(4, `A majority accepted (2, ${val}). "${val}" is chosen.${valB && val !== valB ? ` B's own value "${valB}" is dropped.` : ''}`,
        q.map(i => ({ from: i, to: 'B', label: 'accepted', cls: 'rep' })), { B: 'ok', ...Object.fromEntries(q.map(i => [i, 'ok'])) }, chosenExtra());
    }
    return steps;
  }

  // ---- Raft: election then log replication, optionally followed by a leader crash
  function raft(v) {
    const n = U.int(v.nodes, 3, 5, 'Nodes');
    const cmds = list(v.cmds, { min: 1, max: 3, name: 'Commands' });
    const crash = /^y/i.test(String(v.crash).trim());
    const { steps, snap: push } = recorder();
    const timeouts = [150, 190, 240, 210, 270];
    const S = Array.from({ length: n }, () => ({ role: 'Follower', term: 0, log: [], down: false, note: '' }));
    const pos = Array.from({ length: n }, (_, i) => ({ x: 400 + 270 * Math.sin((2 * Math.PI * i) / n), y: 205 - 125 * Math.cos((2 * Math.PI * i) / n) }));
    const view = cls => [
      { id: 'C', label: 'Client', x: 90, y: 55, r: 26, cls: '', lines: [] },
      ...S.map((s, i) => ({
        id: i, label: `S${i}`, x: pos[i].x, y: pos[i].y, r: 26,
        cls: [s.down ? 'crashed' : s.role === 'Leader' ? 'leader' : s.role === 'Candidate' ? 'cand' : '', cls[i]].filter(Boolean).join(' '),
        lines: [s.down ? 'down' : `${s.role} · term ${s.term}`, s.note || `log: ${s.log.map(e => e.cmd + (e.c ? '✓' : '')).join(' ') || '–'}`],
      })),
    ];
    const snap = (line, msg, msgs = [], cls = {}, extras = []) => push(line, msg, { nodes: view(cls), msgs, extras });
    const alive = () => S.map((s, i) => i).filter(i => !S[i].down);
    const others = id => alive().filter(i => i !== id);
    const logExtra = () => [{ label: 'Committed', items: (S.find(s => s.role === 'Leader' && !s.down) || { log: [] }).log.filter(e => e.c).map(e => e.cmd).concat([]) }];

    S.forEach((s, i) => { s.note = `timeout ${timeouts[i]}ms`; });
    snap(0, `${n} servers start as followers, each with a different election timeout. Whoever times out first starts an election.`);
    S.forEach(s => { s.note = ''; });

    function elect(c, term) {
      S[c].role = 'Candidate'; S[c].term = term;
      snap(1, `S${c} hears no leader within its timeout. It becomes a candidate for term ${term} and votes for itself.`, [], { [c]: 'cur' });
      snap(2, `S${c} sends RequestVote(term ${term}) to every other server.`, others(c).map(i => ({ from: c, to: i, label: 'RequestVote', cls: 'req' })), { [c]: 'cur' });
      others(c).forEach(i => { S[i].term = term; });
      snap(3, `Each server has not voted in term ${term}${term > 1 ? ' and sees the candidate\'s log is at least as up to date as its own' : ''}, so it grants its vote.`, others(c).map(i => ({ from: i, to: c, label: 'vote', cls: 'rep' })), {});
      S[c].role = 'Leader';
      snap(4, `S${c} has ${others(c).length + 1} of ${n} votes, a majority. It becomes leader and sends heartbeats.`, others(c).map(i => ({ from: c, to: i, label: 'heartbeat', cls: 'req' })), { [c]: 'ok' });
    }

    elect(0, 1);
    const L = 0;
    cmds.forEach(cmd => {
      snap(5, `Client sends "${cmd}" to the leader S${L}. S${L} appends it to its log (not committed yet).`, [{ from: 'C', to: L, label: cmd, cls: 'req' }], {});
      S[L].log.push({ cmd, c: false });
      snap(5, `S${L} wrote "${cmd}" to its own log.`, [], { [L]: 'cur' });
      snap(6, `S${L} sends AppendEntries("${cmd}") to the followers.`, others(L).map(i => ({ from: L, to: i, label: 'AppendEntries', cls: 'req' })), {});
      others(L).forEach(i => S[i].log.push({ cmd, c: false }));
      snap(7, 'Followers append the entry to their logs and acknowledge.', others(L).map(i => ({ from: i, to: L, label: 'ack', cls: 'rep' })), {});
      S[L].log[S[L].log.length - 1].c = true;
      snap(8, `A majority has "${cmd}", so the leader commits it (✓) and can reply to the client.`, [{ from: L, to: 'C', label: 'ok', cls: 'rep' }], { [L]: 'ok' });
      others(L).forEach(i => { S[i].log[S[i].log.length - 1].c = true; });
      snap(9, 'The next AppendEntries carries the new commit index, so followers commit too.', others(L).map(i => ({ from: L, to: i, label: 'commit', cls: 'req' })), {});
    });
    if (crash) {
      S[L].down = true;
      snap(10, `Leader S${L} crashes. Followers stop receiving heartbeats.`, [], { [L]: 'crashed' });
      const next = alive()[0];
      S[next].role = 'Follower';
      elect(next, 2);
      snap(9, `S${next} is the new leader. Because it was elected with an up-to-date log, no committed entry is lost.`, [], { [next]: 'ok' });
    }
    return steps;
  }

  // ---- Two-phase commit
  function twoPC(v) {
    const n = U.int(v.participants, 2, 5, 'Participants');
    const votes = list(v.votes, { min: n, max: n, maxLen: 3, name: 'Votes' }).map(x => x.toLowerCase());
    if (votes.some(x => x !== 'yes' && x !== 'no')) throw new Error('Votes: use yes or no for each participant.');
    const crash = /^y/i.test(String(v.crash).trim());
    const { steps, snap: push } = recorder();
    const pos = spread(n, 300, 110, 690);
    const co = { state: 'init', crashed: false };
    const P = votes.map(() => ({ state: 'init', blocked: false }));
    const view = cls => [
      { id: 'K', label: 'Coord', x: 400, y: 70, r: 30, cls: co.crashed ? 'crashed' : cls.K || '', lines: [co.state] },
      ...P.map((p, i) => ({ id: i, label: `P${i + 1}`, x: pos[i].x, y: pos[i].y, r: 24, cls: p.blocked ? 'bad' : cls[i] || '', lines: [p.state] })),
    ];
    const snap = (line, msg, msgs = [], cls = {}) => push(line, msg, { nodes: view(cls), msgs, extras: [{ label: 'Votes', items: votes.map((x, i) => `P${i + 1}: ${x}`) }] });
    snap(0, `One coordinator and ${n} participants, all in the init state. They want to commit one transaction atomically: all or nobody.`);
    co.state = 'waiting for votes';
    snap(1, 'Phase 1 (prepare): the coordinator asks every participant whether it can commit.', P.map((_, i) => ({ from: 'K', to: i, label: 'PREPARE', cls: 'req' })), { K: 'cur' });
    P.forEach((p, i) => { p.state = votes[i] === 'yes' ? 'prepared (yes)' : 'aborted (no)'; });
    snap(2, 'Each participant votes. A YES vote is a promise: it will commit if told to, so it holds its locks. A NO voter aborts right away.', P.map((_, i) => ({ from: i, to: 'K', label: votes[i].toUpperCase(), cls: votes[i] === 'yes' ? 'rep' : 'err' })), Object.fromEntries(votes.map((x, i) => [i, x === 'yes' ? 'info' : 'bad'])));
    const commit = votes.every(x => x === 'yes');
    if (crash) {
      co.crashed = true; co.state = 'crashed';
      P.forEach((p, i) => { if (votes[i] === 'yes') { p.blocked = true; p.state = 'prepared, blocked'; } });
      snap(5, 'The coordinator crashes before sending its decision. YES voters cannot commit (someone might have voted no) or abort (the coordinator might have decided commit). They are blocked, holding locks, until it recovers. This is the weakness of 2PC.');
      return steps;
    }
    co.state = commit ? 'COMMIT' : 'ABORT';
    snap(3, commit ? 'Phase 2 (decide): every vote was YES, so the coordinator decides COMMIT.' : 'Phase 2 (decide): at least one vote was NO, so the coordinator decides ABORT. One NO is enough.', [], { K: commit ? 'ok' : 'bad' });
    snap(4, `The coordinator sends ${commit ? 'COMMIT' : 'ABORT'} to every participant.`, P.map((_, i) => ({ from: 'K', to: i, label: commit ? 'COMMIT' : 'ABORT', cls: commit ? 'req' : 'err' })), {});
    P.forEach(p => { p.state = commit ? 'committed' : 'aborted'; });
    snap(4, `Participants ${commit ? 'commit and release their locks' : 'roll back'}, then acknowledge.`, P.map((_, i) => ({ from: i, to: 'K', label: 'ACK', cls: 'rep' })), Object.fromEntries(P.map((_, i) => [i, commit ? 'ok' : 'bad'])));
    co.state = 'done';
    snap(4, commit ? 'Done: the transaction committed everywhere.' : 'Done: the transaction aborted everywhere. Either way, all participants agree.', [], { K: 'ok' });
    return steps;
  }

  // ---- Gossip (rumour spreading)
  function gossip(v) {
    const n = U.int(v.nodes, 4, 16, 'Nodes');
    const fanout = U.int(v.fanout, 1, 3, 'Fanout');
    const seed = U.int(v.seed, 1, 99, 'Seed');
    const start = U.int(v.start, 0, n - 1, 'Start node');
    let s = seed * 2654435761 >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const { steps, snap: push } = recorder();
    const infected = new Set([start]);
    const R = n > 10 ? 18 : 22;
    const ring = Array.from({ length: n }, (_, i) => ({ x: 400 + 150 * Math.sin((2 * Math.PI * i) / n) * 1.5, y: 205 - 150 * Math.cos((2 * Math.PI * i) / n) }));
    let sent = 0, wasted = 0;
    const snap = (line, msg, msgs = [], fresh = [], round = 0) => push(line, msg, {
      nodes: ring.map((p, i) => ({ id: i, label: i, x: p.x, y: p.y, r: R, cls: fresh.includes(i) ? 'new' : infected.has(i) ? 'ok' : '', lines: [] })),
      msgs,
      extras: [{ label: 'Round', items: [round] }, { label: 'Infected', items: [`${infected.size} / ${n}`] }, { label: 'Messages', items: [`${sent} sent, ${wasted} wasted`] }],
    });
    snap(0, `Node ${start} learns a rumour. Nobody else knows it yet. Each round, every infected node tells ${fanout} random peer${fanout > 1 ? 's' : ''}.`);
    for (let round = 1; round <= 20 && infected.size < n; round++) {
      const msgs = [], fresh = [];
      [...infected].forEach(u => {
        const peers = Array.from({ length: n }, (_, i) => i).filter(i => i !== u);
        for (let f = 0; f < fanout; f++) {
          const t = peers.splice(Math.floor(rnd() * peers.length), 1)[0];
          msgs.push({ from: u, to: t, label: '', cls: infected.has(t) || fresh.includes(t) ? 'err' : 'req' });
          sent++;
          if (infected.has(t) || fresh.includes(t)) wasted++; else fresh.push(t);
        }
      });
      snap(2, `Round ${round}: ${msgs.length} message${msgs.length > 1 ? 's' : ''} sent. ${fresh.length} node${fresh.length === 1 ? '' : 's'} hear the rumour for the first time${msgs.length > fresh.length ? ` (red arrows reached nodes that already knew it)` : ''}.`, msgs, fresh, round);
      fresh.forEach(i => infected.add(i));
      snap(3, `After round ${round}, ${infected.size} of ${n} nodes know the rumour.`, [], [], round);
    }
    if (infected.size < n) steps[steps.length - 1].msg += ' (Stopped after 20 rounds.)';
    else steps[steps.length - 1].msg += ' Everyone is infected, after roughly log n rounds.';
    return steps;
  }

  // ---- Consistent hashing
  const PALETTE = ['#e07a7a', '#8fcf7a', '#7ab8e0', '#e0c47a', '#b58fe0', '#7ae0cf'];
  // FNV-1a with a murmur-style finalizer, so similar names ("user1", "user2") spread around the ring.
  const hash = s => {
    let h = 2166136261;
    for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    h = (h ^ (h >>> 16)) >>> 0; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) % 360;
  };

  function consistent(v) {
    const names = list(v.nodes, { min: 2, max: 5, maxLen: 4, name: 'Nodes' });
    const vn = U.int(v.vnodes, 1, 4, 'Virtual nodes');
    const keys = list(v.keys, { min: 3, max: 14, maxLen: 6, name: 'Keys' });
    const ops = String(v.ops).trim() ? U.ops(v.ops, { max: 4 }) : [];
    const { steps, snap: push } = recorder();
    const color = new Map();
    const colorOf = nm => { if (!color.has(nm)) color.set(nm, PALETTE[color.size % PALETTE.length]); return color.get(nm); };
    let tokens = []; // { pos, node, name }
    const free = p => { while (tokens.some(t => t.pos === p)) p = (p + 1) % 360; return p; };
    const addNode = nm => {
      if (tokens.some(t => t.node === nm)) throw new Error(`Node ${nm} is already on the ring.`);
      const mine = [];
      for (let i = 0; i < vn; i++) { const t = { pos: free(hash(`${nm}#${i}`)), node: nm, name: vn > 1 ? `${nm}${i + 1}` : nm }; tokens.push(t); mine.push(t); }
      tokens.sort((a, b) => a.pos - b.pos);
      return mine;
    };
    const ownerTok = k => tokens.find(t => t.pos >= hash(k)) || tokens[0] || null;
    const owners = () => Object.fromEntries(keys.map(k => [k, ownerTok(k) ? ownerTok(k).node : null]));
    const view = (o = {}) => ({
      ring: {
        nodes: tokens.map(t => ({ name: t.node, pos: t.pos, color: colorOf(t.node), cur: o.hot && o.hot.includes(t.node) })),
        keys: o.noKeys ? [] : keys.filter(k => !o.upTo || o.upTo.includes(k)).map(k => {
          const t = ownerTok(k);
          return { name: k, pos: hash(k), color: t ? colorOf(t.node) : '#888', cls: o.cur === k ? 'cur' : (o.moved || []).includes(k) ? 'moved' : '' };
        }),
        arc: o.cur && ownerTok(o.cur) ? { from: hash(o.cur), to: ownerTok(o.cur).pos, color: colorOf(ownerTok(o.cur).node) } : null,
      },
    });
    const counts = () => { const c = {}; tokens.forEach(t => { c[t.node] = 0; }); Object.values(owners()).forEach(nm => { if (nm) c[nm]++; }); return Object.entries(c).map(([k, x]) => `${k}: ${x}`); };
    const snap = (line, msg, o = {}, extras = []) => push(line, msg, { ...view(o), extras });

    snap(0, 'The hash space is a ring from 0 to 359. Servers and keys are both hashed onto it.', { noKeys: true });
    names.forEach(nm => {
      const mine = addNode(nm);
      snap(1, `Place server ${nm}${vn > 1 ? ` as ${vn} virtual nodes` : ''} at ${mine.map(t => t.pos + '°').join(', ')}.`, { noKeys: true, hot: [nm] });
    });
    const placed = [];
    keys.forEach(k => {
      placed.push(k);
      const t = ownerTok(k);
      snap(2, `hash("${k}") = ${hash(k)}°. Walk clockwise to the first server: ${t.node} at ${t.pos}°.`, { cur: k, upTo: placed });
    });
    snap(vn > 1 ? 5 : 2, `Every key has an owner. Load per server: ${counts().join(', ')}.${vn === 1 ? ' With one point per server the split can be lumpy. Try more virtual nodes.' : ''}`, {}, [{ label: 'Keys per server', items: counts() }]);

    for (const [cmd, nm] of ops) {
      if (!nm || !['add', 'remove'].includes(cmd)) throw new Error('Use: add D, remove B');
      const before = owners();
      const modBefore = Object.fromEntries(keys.map(k => [k, [...new Set(tokens.map(t => t.node))].sort()[hash(k) % new Set(tokens.map(t => t.node)).size]]));
      if (cmd === 'add') addNode(nm);
      else {
        if (!tokens.some(t => t.node === nm)) throw new Error(`Node ${nm} is not on the ring.`);
        if (new Set(tokens.map(t => t.node)).size < 2) throw new Error('Keep at least one server on the ring.');
        tokens = tokens.filter(t => t.node !== nm);
      }
      const after = owners();
      const moved = keys.filter(k => before[k] !== after[k]);
      const nodesNow = [...new Set(tokens.map(t => t.node))].sort();
      const modMoved = keys.filter(k => modBefore[k] !== nodesNow[hash(k) % nodesNow.length]).length;
      snap(cmd === 'add' ? 3 : 4,
        `${cmd === 'add' ? 'Add' : 'Remove'} server ${nm}: just ${moved.length} of ${keys.length} keys change owner${moved.length ? ` (${moved.join(', ')})` : ''}. Hashing with "hash mod N" would have moved ${modMoved}.`,
        { moved, hot: cmd === 'add' ? [nm] : [] }, [{ label: 'Keys moved', items: [`${moved.length} of ${keys.length}`] }, { label: 'mod N would move', items: [`${modMoved} of ${keys.length}`] }, { label: 'Keys per server', items: counts() }]);
    }
    return steps;
  }

  // ---- Vector clocks
  function vectorClocks(v) {
    const ops = U.ops(v.ops, { max: 16 });
    const letters = [...new Set(ops.map(o => (o[0] || '').toUpperCase()))];
    if (letters.some(l => !/^[A-D]$/.test(l))) throw new Error('Processes must be A, B, C or D. Example: A send m1, B recv m1');
    const n = Math.max(...letters.map(l => l.charCodeAt(0) - 64));
    const procs = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const vc = procs.map(() => Array(n).fill(0));
    const count = Array(n).fill(0);
    const events = [], arrows = [], pending = {};
    const { steps, snap: push } = recorder();
    const snap = (line, msg, extras = []) => push(line, msg, {
      procs,
      events: events.map((e, i) => ({ ...e, cls: i === events.length - 1 ? 'cur' : '' })),
      arrows: arrows.slice(),
      extras: [{ label: 'Clocks', items: procs.map((p, i) => `${p}: [${vc[i].join(',')}]`) }, ...extras],
    });
    snap(0, `${n} processes, each with a vector of ${n} counters starting at 0. Entry j counts the events of process j that this process knows about.`);
    for (const [p, cmd, m] of ops) {
      const i = p.toUpperCase().charCodeAt(0) - 65;
      const name = `${procs[i]}${++count[i]}`;
      const ev = { id: events.length, proc: i, col: events.length, name, label: '', vc: [] };
      if (cmd === 'e') {
        vc[i][i]++; ev.label = 'event'; ev.vc = [...vc[i]];
        events.push(ev);
        snap(1, `${procs[i]} has a local event (${name}): increment its own entry. Clock is now [${vc[i].join(',')}].`);
      } else if (cmd === 'send') {
        if (!m) throw new Error('send needs a message name: A send m1');
        vc[i][i]++; ev.label = `send ${m}`; ev.vc = [...vc[i]];
        pending[m] = { ev: ev.id, vc: [...vc[i]], from: procs[i] };
        events.push(ev);
        snap(2, `${procs[i]} sends ${m} (${name}): increment its own entry, then attach the clock [${vc[i].join(',')}] to the message.`);
      } else if (cmd === 'recv') {
        if (!m || !pending[m]) throw new Error(`recv ${m || ''}: that message hasn't been sent yet.`);
        const before = [...vc[i]], msg = pending[m].vc;
        vc[i] = vc[i].map((x, j) => Math.max(x, msg[j]));
        const merged = [...vc[i]];
        vc[i][i]++; ev.label = `recv ${m}`; ev.vc = [...vc[i]];
        arrows.push({ from: pending[m].ev, to: ev.id, label: m });
        events.push(ev);
        snap(3, `${procs[i]} receives ${m} (${name}). Element-wise max of [${before.join(',')}] and [${msg.join(',')}] is [${merged.join(',')}], then it increments its own entry: [${vc[i].join(',')}].`);
      } else throw new Error('Use: A e, A send m1, B recv m1');
    }
    const le = (a, b) => a.every((x, k) => x <= b[k]);
    const pairs = [];
    for (let a = 0; a < events.length; a++) for (let b = a + 1; b < events.length; b++) {
      if (events[a].proc !== events[b].proc && !le(events[a].vc, events[b].vc) && !le(events[b].vc, events[a].vc)) pairs.push(`${events[a].name} vs ${events[b].name}`);
    }
    events.forEach((e, i) => { e.cls = ''; });
    snap(4, `Two events are concurrent when neither vector is ≤ the other: neither could have influenced the other. ${pairs.length ? `Found ${pairs.length}.` : 'In this run every pair is causally ordered.'}`,
      [{ label: 'Concurrent', items: pairs.length ? pairs.slice(0, 10) : ['none'] }]);
    steps[steps.length - 1].events = steps[steps.length - 1].events.map(e => ({ ...e, cls: '' }));
    return steps;
  }

  const DIST = {
    paxos: {
      name: 'Paxos', short: 'Paxos', tag: 'CONSENSUS · SINGLE DECREE', stage: 'cluster', complexity: '2 round trips, majority quorum',
      blurb: 'Acceptors agree on one value even if proposers crash or compete. Phase 1 gathers promises and learns about earlier proposals; phase 2 asks acceptors to accept. Any two majorities overlap, so a later proposer always sees a value that may already be chosen, and must adopt it.',
      code: ['Phase 1a, proposer: pick a number n; send prepare(n) to the acceptors', 'Phase 1b, acceptor: if n > promised: promised ← n; reply promise(n, accepted)', 'Phase 2a, proposer: on a majority of promises, use the value with the highest accepted number (else your own); send accept(n, v)', 'Phase 2b, acceptor: if n ≥ promised: accepted ← (n, v); reply accepted', 'Chosen: once a majority has accepted the same (n, v)'],
      fields: [
        { key: 'acceptors', label: 'Acceptors', def: '5', hint: '3 to 7' },
        { key: 'valA', label: 'Proposer A value', def: 'X', hint: 'up to 6 characters' },
        { key: 'valB', label: 'Proposer B value', def: 'Y', hint: 'leave empty for a single proposer' },
        { key: 'k', label: 'A reaches first k acceptors', def: '3', hint: 'A crashes after its accept reaches P1..Pk. B can only reach the last majority.' },
      ],
      run: paxos,
    },
    raft: {
      name: 'Raft', short: 'Raft', tag: 'CONSENSUS · REPLICATED LOG', stage: 'cluster', complexity: 'one round trip per commit',
      blurb: 'A leader is elected by majority vote, then appends client commands to its log and replicates them. An entry is committed once a majority has it. Voters only back candidates whose logs are at least as up to date, so a new leader never loses committed entries.',
      code: ['Followers wait; each has a random election timeout', 'Timeout fires: become candidate, term++, vote for self', 'Send RequestVote(term, lastLogIndex, lastLogTerm) to everyone', 'Grant a vote if not yet voted this term and the candidate log is at least as up to date', 'Majority of votes: become leader and send heartbeats', 'Leader appends the client command to its log', 'Leader sends AppendEntries(entry) to the followers', 'Followers append the entry and acknowledge', 'Majority acknowledged: the entry is committed', 'The next AppendEntries tells followers to commit', 'Leader fails: a follower times out and a new election starts'],
      fields: [
        { key: 'nodes', label: 'Servers', def: '5', hint: '3 to 5' },
        { key: 'cmds', label: 'Client commands', def: 'x=1, y=2', hint: '1 to 3, separated by commas' },
        { key: 'crash', label: 'Crash the leader afterwards?', def: 'yes', hint: 'yes or no' },
      ],
      run: raft,
    },
    chash: {
      name: 'Consistent Hashing', short: 'Consistent Hashing', tag: 'PARTITIONING · HASH RING', stage: 'ring', complexity: 'O(log n) lookup, ~K/n keys move',
      blurb: 'Keys and servers are hashed onto a ring. A key belongs to the next server clockwise. When a server joins or leaves, only its neighbouring slice of keys moves, unlike "hash mod N" which reshuffles almost everything. Virtual nodes smooth out the load.',
      code: ['Hash space is a ring 0–359; servers and keys are hashed onto it', 'Place each server (and each virtual node) at hash(name#i)', 'A key belongs to the first server clockwise from hash(key)', 'Adding a server only steals the keys just before it', 'Removing a server hands its keys to its clockwise successor', 'Virtual nodes spread each server around the ring for an even load'],
      fields: [
        { key: 'nodes', label: 'Servers', def: 'A, B, C', hint: '2 to 5 names' },
        { key: 'vnodes', label: 'Virtual nodes per server', def: '3', hint: '1 to 4' },
        { key: 'keys', label: 'Keys', def: 'user1, user2, user3, user4, user5, user6, user7, user8', hint: '3 to 14 names' },
        { key: 'ops', label: 'Changes', def: 'add D, remove B', hint: 'add X · remove X, separated by commas (optional)', wide: true },
      ],
      run: consistent,
    },
    vclock: {
      name: 'Vector Clocks', short: 'Vector Clocks', tag: 'CAUSALITY · LOGICAL TIME', stage: 'timeline', complexity: 'O(n) per message',
      blurb: 'Each process keeps one counter per process. Sending and local events bump your own counter; receiving first merges the sender\'s vector. Comparing vectors tells you whether one event happened before another or whether they were concurrent, which a single Lamport clock cannot.',
      code: ['Every process keeps a vector with one counter per process, all 0', 'Local event: increment your own entry', 'Send: increment your own entry and attach the vector to the message', 'Receive: take the element-wise max with the message vector, then increment your own entry', 'a happened before b if VC(a) ≤ VC(b) everywhere and differs somewhere; if neither is ≤ the other, they are concurrent'],
      fields: [{ key: 'ops', label: 'Events', def: 'A e, A send m1, B e, B recv m1, B send m2, C recv m2, A e, C e', hint: 'process (A–D) then e, send m, or recv m. For example: A send m1, B recv m1', wide: true }],
      run: vectorClocks,
    },
    gossip: {
      name: 'Gossip Protocol', short: 'Gossip', tag: 'DISSEMINATION · EPIDEMIC', stage: 'cluster', complexity: 'O(log n) rounds',
      blurb: 'No central coordinator: each round, every node that knows the rumour tells a few random peers. The number of informed nodes roughly doubles each round, so everyone hears it in about log n rounds, and it survives crashes and message loss.',
      code: ['One node starts out knowing the rumour', 'Each round, every infected node picks `fanout` random peers', 'It sends them the rumour', 'Receivers that did not know it become infected', 'Repeat until everyone is infected (about log n rounds)'],
      fields: [
        { key: 'nodes', label: 'Nodes', def: '10', hint: '4 to 16' },
        { key: 'fanout', label: 'Fanout', def: '1', hint: 'peers told per round, 1 to 3' },
        { key: 'start', label: 'Start node', def: '0', hint: 'index of the first infected node' },
        { key: 'seed', label: 'Random seed', def: '7', hint: '1 to 99. Same seed, same run' },
      ],
      random: () => ({ nodes: String(U.randInt(8, 14)), fanout: String(U.randInt(1, 2)), start: '0', seed: String(U.randInt(1, 99)) }),
      run: gossip,
    },
    twopc: {
      name: 'Two-Phase Commit', short: '2PC', tag: 'ATOMIC COMMIT · COORDINATOR', stage: 'cluster', complexity: '3n messages',
      blurb: 'A coordinator makes a distributed transaction all-or-nothing. Phase 1 asks everyone to prepare and vote; phase 2 broadcasts COMMIT only if every vote was YES. Its weakness: if the coordinator dies after the votes, prepared participants are blocked.',
      code: ['Coordinator and participants start in the init state', 'Phase 1: coordinator sends PREPARE to every participant', 'Each participant votes YES (and promises it can commit) or NO (and aborts)', 'Phase 2: coordinator decides COMMIT if every vote was YES, else ABORT', 'Coordinator sends the decision; participants apply it and acknowledge', 'If the coordinator crashes after PREPARE, YES voters are blocked until it recovers'],
      fields: [
        { key: 'participants', label: 'Participants', def: '3', hint: '2 to 5' },
        { key: 'votes', label: 'Votes', def: 'yes, yes, yes', hint: 'yes or no for each participant, in order' },
        { key: 'crash', label: 'Coordinator crashes after votes?', def: 'no', hint: 'yes or no' },
      ],
      run: twoPC,
    },
  };

  window.Algo.DIST = DIST;
  window.Algo._distFns = { paxos, raft, twoPC, gossip, consistent, vectorClocks };
})();
