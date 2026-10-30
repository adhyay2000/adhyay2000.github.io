// Dynamic programming recorders. Each snapshot:
// { line, msg, table, rows, cols, cell, deps, path, extras }  (table cells: number | null | Infinity)
(function () {
  const U = window.Algo.util;

  function start(rows, cols, table) {
    const steps = [];
    const snap = (line, msg, o = {}) => steps.push(U.clone({
      line, msg, table, rows, cols, cell: o.cell || null, deps: o.deps || [], path: o.path || [], extras: o.extras || [],
    }));
    return { steps, snap };
  }
  const grid = (r, c, v = null) => Array.from({ length: r }, () => Array(c).fill(v));

  function knapsack(wt, val, cap) {
    const n = wt.length;
    const dp = grid(n + 1, cap + 1);
    const rows = ['no items', ...wt.map((w, i) => `item ${i + 1} (w${w}, v${val[i]})`)];
    const cols = Array.from({ length: cap + 1 }, (_, i) => i);
    const { steps, snap } = start(rows, cols, dp);
    dp[0].fill(0);
    snap(1, 'With no items the best value is 0 at every capacity.');
    for (let i = 1; i <= n; i++) {
      for (let w = 0; w <= cap; w++) {
        const deps = [[i - 1, w]];
        let best = dp[i - 1][w];
        let msg = `Skip item ${i}: ${best}.`;
        let line = 3;
        if (wt[i - 1] <= w) {
          deps.push([i - 1, w - wt[i - 1]]);
          const take = dp[i - 1][w - wt[i - 1]] + val[i - 1];
          msg = `Skip item ${i}: ${best}. Take it: ${dp[i - 1][w - wt[i - 1]]} + ${val[i - 1]} = ${take}. Best is ${Math.max(best, take)}.`;
          line = 5;
          best = Math.max(best, take);
        } else msg = `Item ${i} weighs ${wt[i - 1]}, more than ${w}. Skip it: ${best}.`;
        dp[i][w] = best;
        snap(line, msg, { cell: [i, w], deps });
      }
    }
    const path = [[n, cap]], chosen = [];
    for (let i = n, w = cap; i > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) { chosen.push(`item ${i}`); w -= wt[i - 1]; path.push([i - 1, w]); }
    }
    snap(6, `Best value = ${dp[n][cap]}. Tracing back shows which items were taken.`, { cell: [n, cap], path, extras: [{ label: 'Taken', items: chosen.length ? chosen.reverse() : ['none'] }] });
    return steps;
  }

  function lcs(a, b) {
    const n = a.length, m = b.length;
    const dp = grid(n + 1, m + 1);
    const { steps, snap } = start(['', ...a], ['', ...b], dp);
    for (let i = 0; i <= n; i++) dp[i][0] = 0;
    for (let j = 0; j <= m; j++) dp[0][j] = 0;
    snap(1, 'An empty string shares nothing with anything: the first row and column are 0.');
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
          snap(3, `'${a[i - 1]}' = '${b[j - 1]}': extend the diagonal, ${dp[i - 1][j - 1]} + 1 = ${dp[i][j]}.`, { cell: [i, j], deps: [[i - 1, j - 1]] });
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          snap(4, `'${a[i - 1]}' ≠ '${b[j - 1]}': take the better of above (${dp[i - 1][j]}) and left (${dp[i][j - 1]}).`, { cell: [i, j], deps: [[i - 1, j], [i, j - 1]] });
        }
      }
    }
    const path = [], seq = [];
    for (let i = n, j = m; i > 0 && j > 0;) {
      if (a[i - 1] === b[j - 1]) { seq.push(a[i - 1]); path.push([i, j]); i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    snap(5, `The longest common subsequence has length ${dp[n][m]}.`, { cell: [n, m], path, extras: [{ label: 'LCS', items: seq.length ? seq.reverse() : ['(empty)'] }] });
    return steps;
  }

  function lis(a) {
    const n = a.length;
    const dp = grid(2, n);
    a.forEach((x, i) => { dp[0][i] = x; });
    const { steps, snap } = start(['a[i]', 'LIS ending at i'], a.map((_, i) => i), dp);
    const prev = Array(n).fill(-1);
    snap(0, 'dp[i] will hold the length of the longest increasing subsequence that ends at index i.');
    for (let i = 0; i < n; i++) {
      dp[1][i] = 1;
      snap(1, `Every element alone is an increasing run of length 1: dp[${i}] = 1.`, { cell: [1, i] });
      for (let j = 0; j < i; j++) {
        if (a[j] < a[i]) {
          if (dp[1][j] + 1 > dp[1][i]) {
            dp[1][i] = dp[1][j] + 1; prev[i] = j;
            snap(4, `${a[j]} < ${a[i]}: extend the run ending at ${j}. dp[${i}] = ${dp[1][i]}.`, { cell: [1, i], deps: [[1, j]] });
          } else snap(4, `${a[j]} < ${a[i]}, but ${dp[1][j]} + 1 doesn't beat ${dp[1][i]}.`, { cell: [1, i], deps: [[1, j]] });
        } else snap(4, `${a[j]} ≥ ${a[i]}: cannot extend that run.`, { cell: [1, i], deps: [[1, j]] });
      }
    }
    let best = 0;
    dp[1].forEach((x, i) => { if (x > dp[1][best]) best = i; });
    const path = [], seq = [];
    for (let i = best; i !== -1; i = prev[i]) { path.push([1, i]); seq.push(a[i]); }
    snap(5, `The longest increasing subsequence has length ${dp[1][best]}.`, { cell: [1, best], path, extras: [{ label: 'One LIS', items: seq.reverse() }] });
    return steps;
  }

  function editDistance(a, b) {
    const n = a.length, m = b.length;
    const dp = grid(n + 1, m + 1);
    const { steps, snap } = start(['', ...a], ['', ...b], dp);
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    snap(1, 'Turning a string into an empty one (or back) costs one edit per character.');
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
          snap(3, `'${a[i - 1]}' = '${b[j - 1]}': no edit needed, copy the diagonal (${dp[i][j]}).`, { cell: [i, j], deps: [[i - 1, j - 1]] });
        } else {
          const rep = dp[i - 1][j - 1], del = dp[i - 1][j], ins = dp[i][j - 1];
          dp[i][j] = 1 + Math.min(rep, del, ins);
          snap(4, `'${a[i - 1]}' ≠ '${b[j - 1]}': 1 + min(replace ${rep}, delete ${del}, insert ${ins}) = ${dp[i][j]}.`, { cell: [i, j], deps: [[i - 1, j - 1], [i - 1, j], [i, j - 1]] });
        }
      }
    }
    const path = [[n, m]];
    for (let i = n, j = m; i > 0 || j > 0;) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { i--; j--; }
      else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
      else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) i--;
      else j--;
      path.push([i, j]);
    }
    snap(5, `The edit distance from "${a}" to "${b}" is ${dp[n][m]}.`, { cell: [n, m], path });
    return steps;
  }

  function coinChange(coins, amount) {
    const dp = [Array(amount + 1).fill(Infinity)];
    dp[0][0] = 0;
    const { steps, snap } = start(['fewest coins'], Array.from({ length: amount + 1 }, (_, i) => i), dp);
    const used = Array(amount + 1).fill(0);
    snap(1, 'Zero coins make 0. Every other amount starts as ∞ (not reachable yet).', { cell: [0, 0] });
    for (let a = 1; a <= amount; a++) {
      const deps = [];
      let best = Infinity;
      const parts = [];
      for (const c of coins) {
        if (c <= a) {
          deps.push([0, a - c]);
          const cand = dp[0][a - c] + 1;
          parts.push(`${c}: ${dp[0][a - c] === Infinity ? '∞' : cand}`);
          if (cand < best) { best = cand; used[a] = c; }
        }
      }
      dp[0][a] = best;
      snap(4, deps.length ? `Amount ${a}, trying each coin (${parts.join(', ')}): best is ${best === Infinity ? '∞' : best}.` : `Amount ${a} is smaller than every coin: not reachable.`, { cell: [0, a], deps });
    }
    const path = [[0, amount]], taken = [];
    if (dp[0][amount] !== Infinity) for (let a = amount; a > 0; a -= used[a]) { taken.push(used[a]); path.push([0, a - used[a]]); }
    snap(5, dp[0][amount] === Infinity ? `${amount} cannot be made with these coins.` : `Fewest coins for ${amount} = ${dp[0][amount]}.`, { cell: [0, amount], path, extras: [{ label: 'Coins', items: taken.length ? taken : ['none'] }] });
    return steps;
  }

  const word = (key, label, def) => ({ key, label, def, hint: '1 to 10 characters' });
  const rstr = n => Array.from({ length: n }, () => 'ABCD'[U.randInt(0, 3)]).join('');

  const DP = {
    knapsack: {
      name: '0/1 Knapsack', short: 'Knapsack', tag: 'OPTIMISATION · TABLE', stage: 'table', complexity: 'O(n · W)',
      blurb: 'Each cell answers: what is the best value using only the first i items with capacity w? Either skip item i, or take it and add its value to the best answer for the leftover capacity.',
      code: ['knapsack(items, W):', '  dp[0][w] ← 0 for every w', '  for each item i, capacity w:', '    dp[i][w] ← dp[i−1][w]  // skip item i', '    if wt[i] ≤ w:', '      dp[i][w] ← max(dp[i][w], dp[i−1][w−wt[i]] + val[i])', '  answer ← dp[n][W]'],
      fields: [{ key: 'weights', label: 'Weights', def: '1, 3, 4, 5', hint: 'up to 6 items, each 1–20' }, { key: 'values', label: 'Values', def: '1, 4, 5, 7', hint: 'one per item, each 1–99' }, { key: 'capacity', label: 'Capacity', def: '7', hint: '1–20' }],
      random: () => { const n = U.randInt(3, 5); const g = (lo, hi) => Array.from({ length: n }, () => U.randInt(lo, hi)).join(', '); return { weights: g(1, 6), values: g(1, 12), capacity: String(U.randInt(6, 12)) }; },
      run: v => {
        const wt = U.ints(v.weights, { min: 1, max: 20, maxLen: 6, name: 'Weights' });
        const val = U.ints(v.values, { min: 1, max: 99, maxLen: 6, name: 'Values' });
        if (wt.length !== val.length) throw new Error('Weights and values need the same number of entries.');
        return knapsack(wt, val, U.int(v.capacity, 1, 20, 'Capacity'));
      },
    },
    lcs: {
      name: 'Longest Common Subsequence', short: 'LCS', tag: 'STRINGS · TABLE', stage: 'table', complexity: 'O(n · m)',
      blurb: 'dp[i][j] is the LCS length of the first i letters of one string and the first j letters of the other. A match extends the diagonal; a mismatch takes the better of the cell above or to the left.',
      code: ['LCS(a, b):', '  dp[i][0] ← 0; dp[0][j] ← 0', '  for i in 1..n, j in 1..m:', '    if a[i] = b[j]: dp[i][j] ← dp[i−1][j−1] + 1', '    else: dp[i][j] ← max(dp[i−1][j], dp[i][j−1])', '  trace back from dp[n][m] to read the subsequence'],
      fields: [word('a', 'String A', 'ABCBDAB'), word('b', 'String B', 'BDCABA')],
      random: () => ({ a: rstr(U.randInt(5, 8)), b: rstr(U.randInt(5, 8)) }),
      run: v => lcs(U.str(v.a, { maxLen: 10, name: 'String A' }), U.str(v.b, { maxLen: 10, name: 'String B' })),
    },
    lis: {
      name: 'Longest Increasing Subsequence', short: 'LIS', tag: 'SEQUENCES · TABLE', stage: 'table', complexity: 'O(n²)',
      blurb: 'dp[i] is the length of the longest increasing subsequence ending at index i. Look at every earlier smaller value and extend its run by one.',
      code: ['LIS(a):', '  dp[i] ← 1 for every i', '  for i in 0..n−1:', '    for j in 0..i−1:', '      if a[j] < a[i]: dp[i] ← max(dp[i], dp[j] + 1)', '  answer ← max(dp)'],
      fields: [{ key: 'values', label: 'Array', def: '10, 9, 2, 5, 3, 7, 101, 18', hint: '1 to 12 whole numbers' }],
      random: () => ({ values: Array.from({ length: 8 }, () => U.randInt(1, 30)).join(', ') }),
      run: v => lis(U.ints(v.values, { min: -999, max: 999, maxLen: 12, name: 'Array' })),
    },
    edit: {
      name: 'Edit Distance', short: 'Edit Distance', tag: 'STRINGS · TABLE', stage: 'table', complexity: 'O(n · m)',
      blurb: 'The fewest single-character inserts, deletes and replacements needed to turn one string into the other. Each cell looks at its three neighbours: replace (diagonal), delete (above), insert (left).',
      code: ['editDistance(a, b):', '  dp[i][0] ← i; dp[0][j] ← j', '  for i in 1..n, j in 1..m:', '    if a[i] = b[j]: dp[i][j] ← dp[i−1][j−1]', '    else: dp[i][j] ← 1 + min(replace, delete, insert)', '  answer ← dp[n][m]'],
      fields: [word('a', 'From', 'KITTEN'), word('b', 'To', 'SITTING')],
      random: () => ({ a: rstr(U.randInt(4, 7)), b: rstr(U.randInt(4, 7)) }),
      run: v => editDistance(U.str(v.a, { maxLen: 10, name: 'From' }), U.str(v.b, { maxLen: 10, name: 'To' })),
    },
    coin: {
      name: 'Coin Change', short: 'Coin Change', tag: 'OPTIMISATION · TABLE', stage: 'table', complexity: 'O(amount · coins)',
      blurb: 'dp[a] is the fewest coins that add up to a. For each coin c, the answer for a − c plus one coin is a candidate; keep the smallest.',
      code: ['coinChange(coins, A):', '  dp[0] ← 0; dp[a] ← ∞ for a > 0', '  for a in 1..A:', '    for each coin c ≤ a:', '      dp[a] ← min(dp[a], dp[a − c] + 1)', '  answer ← dp[A] (or none if ∞)'],
      fields: [{ key: 'coins', label: 'Coins', def: '1, 2, 5', hint: 'up to 5 values, each 1–20' }, { key: 'amount', label: 'Amount', def: '11', hint: '1–30' }],
      random: () => ({ coins: [1, ...Array.from({ length: 2 }, () => U.randInt(2, 12))].join(', '), amount: String(U.randInt(8, 25)) }),
      run: v => coinChange(U.ints(v.coins, { min: 1, max: 20, maxLen: 5, name: 'Coins' }), U.int(v.amount, 1, 30, 'Amount')),
    },
  };

  window.Algo.DP = DP;
  window.Algo._dpFns = { knapsack, lcs, lis, editDistance, coinChange };
})();
