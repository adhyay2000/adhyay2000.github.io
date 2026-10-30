// Sorting & searching recorders. Each snapshot: { line, msg, arr, marks, ptr, range, extras }.
// marks: index → 'cmp' | 'swap' | 'pivot' | 'sorted' | 'found'; ptr: name → index; range: [lo, hi] still in play.
(function () {
  const U = window.Algo.util;

  function start(input) {
    const a = input.slice();
    const steps = [];
    const done = new Set();
    const snap = (line, msg, o = {}) => {
      const marks = {};
      done.forEach(i => { marks[i] = 'sorted'; });
      Object.assign(marks, o.marks || {});
      steps.push(U.clone({ line, msg, arr: a, marks, ptr: o.ptr || {}, range: o.range || null, extras: o.extras || [] }));
    };
    return { a, steps, done, snap };
  }

  const finish = c => { c.a.forEach((_, i) => c.done.add(i)); c.snap(-1, 'Sorted.'); return c.steps; };

  function mergeSort(arr) {
    const c = start(arr);
    const { a, snap } = c;
    snap(0, 'Unsorted input. Merge sort splits it in half, sorts each half, then merges.');
    (function sort(lo, hi) {
      if (lo >= hi) return;
      const mid = (lo + hi) >> 1;
      snap(2, `Split [${lo}..${hi}] at index ${mid}.`, { range: [lo, hi], ptr: { lo, mid, hi } });
      sort(lo, mid); sort(mid + 1, hi);
      const L = a.slice(lo, mid + 1), R = a.slice(mid + 1, hi + 1);
      let i = 0, j = 0, k = lo;
      while (i < L.length || j < R.length) {
        const both = i < L.length && j < R.length;
        const takeL = !(j < R.length) || (i < L.length && L[i] <= R[j]);
        const msg = both ? `Compare ${L[i]} and ${R[j]}: take ${takeL ? L[i] : R[j]}.` : `One side is empty: copy ${takeL ? L[i] : R[j]}.`;
        a[k] = takeL ? L[i++] : R[j++];
        snap(4, msg, { marks: { [k]: 'swap' }, range: [lo, hi], extras: [{ label: 'Left', items: L.slice(i) }, { label: 'Right', items: R.slice(j) }] });
        k++;
      }
    })(0, a.length - 1);
    return finish(c);
  }

  // Lomuto partition shared by quicksort and quickselect. L maps roles to pseudocode lines.
  function partition(c, lo, hi, L) {
    const { a, snap } = c;
    const pv = a[hi];
    let i = lo;
    snap(L.pivot, `Pick the last element, ${pv}, as the pivot.`, { marks: { [hi]: 'pivot' }, range: [lo, hi], ptr: { i } });
    for (let j = lo; j < hi; j++) {
      if (a[j] < pv) {
        if (i !== j) [a[i], a[j]] = [a[j], a[i]];
        snap(L.swap, `${a[i]} < ${pv}: ${i !== j ? `swap it into position ${i}` : 'it is already in place'}.`, { marks: { [hi]: 'pivot', [i]: 'swap', [j]: 'swap' }, range: [lo, hi], ptr: { i, j } });
        i++;
      } else {
        snap(L.cmp, `${a[j]} ≥ ${pv}: leave it where it is.`, { marks: { [hi]: 'pivot', [j]: 'cmp' }, range: [lo, hi], ptr: { i, j } });
      }
    }
    [a[i], a[hi]] = [a[hi], a[i]];
    snap(L.final, `Swap the pivot ${pv} into index ${i}. It is now in its final place.`, { marks: { [i]: 'pivot' }, range: [lo, hi], ptr: { i } });
    return i;
  }

  function quickSort(arr) {
    const c = start(arr);
    c.snap(0, 'Unsorted input. Quick sort partitions around a pivot, then recurses on both sides.');
    (function qs(lo, hi) {
      if (lo > hi) return;
      if (lo === hi) { c.done.add(lo); c.snap(1, `A single element at ${lo} is already sorted.`, { range: [lo, hi] }); return; }
      const p = partition(c, lo, hi, { pivot: 2, cmp: 4, swap: 4, final: 5 });
      c.done.add(p);
      c.snap(6, `Recurse on [${lo}..${p - 1}] and [${p + 1}..${hi}].`, { range: [lo, hi] });
      qs(lo, p - 1); qs(p + 1, hi);
    })(0, c.a.length - 1);
    return finish(c);
  }

  function heapSort(arr) {
    const c = start(arr);
    const { a, snap } = c;
    const n = a.length;
    function siftDown(start, end) {
      let i = start;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < end && a[l] > a[m]) m = l;
        if (r < end && a[r] > a[m]) m = r;
        const kids = [l, r].filter(x => x < end);
        if (m === i) {
          snap(4, `${a[i]} is at least as big as its children: this part is a heap.`, { marks: { [i]: 'found' }, range: [0, end - 1] });
          return;
        }
        snap(4, `Largest of ${a[i]} and its children is ${a[m]}.`, { marks: Object.fromEntries([i, ...kids].map(x => [x, 'cmp'])), range: [0, end - 1], ptr: { parent: i } });
        [a[i], a[m]] = [a[m], a[i]];
        snap(4, `Swap ${a[i]} up, ${a[m]} down.`, { marks: { [i]: 'swap', [m]: 'swap' }, range: [0, end - 1] });
        i = m;
      }
    }
    snap(0, 'Unsorted input. Heap sort first arranges it as a max-heap (parent ≥ children).');
    for (let s = (n >> 1) - 1; s >= 0; s--) {
      snap(1, `Build the heap: sift down index ${s}.`, { marks: { [s]: 'cmp' }, range: [0, n - 1] });
      siftDown(s, n);
    }
    for (let end = n - 1; end >= 1; end--) {
      [a[0], a[end]] = [a[end], a[0]];
      c.done.add(end);
      snap(3, `Swap the max ${a[end]} to index ${end}. It is in its final place.`, { marks: { 0: 'swap', [end]: 'swap' }, range: [0, end - 1] });
      siftDown(0, end);
    }
    return finish(c);
  }

  function binarySearch(arr, target) {
    const a = arr.slice().sort((x, y) => x - y);
    const c = start(a);
    const { snap } = c;
    let lo = 0, hi = a.length - 1;
    snap(1, `Binary search needs sorted data, so the input is sorted. Looking for ${target}.`, { ptr: { lo, hi } });
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      snap(3, `Look at the middle of [${lo}..${hi}]: index ${mid} holds ${a[mid]}.`, { marks: { [mid]: 'cmp' }, range: [lo, hi], ptr: { lo, mid, hi } });
      if (a[mid] === target) {
        snap(4, `${a[mid]} = ${target}. Found at index ${mid}.`, { marks: { [mid]: 'found' }, range: [lo, hi], ptr: { mid } });
        return c.steps;
      }
      if (a[mid] < target) {
        lo = mid + 1;
        snap(5, `${a[mid]} < ${target}: the target must be to the right. Discard the left half.`, { range: [lo, hi], ptr: { lo, hi } });
      } else {
        hi = mid - 1;
        snap(6, `${a[mid]} > ${target}: the target must be to the left. Discard the right half.`, { range: [lo, Math.max(hi, lo - 1)], ptr: { lo, hi } });
      }
    }
    snap(7, `The range is empty: ${target} is not in the array.`, { range: [0, -1] });
    return c.steps;
  }

  function quickselect(arr, k) {
    const c = start(arr);
    const { a, snap } = c;
    const t = k - 1;
    let lo = 0, hi = a.length - 1;
    snap(0, `Find the ${k}${k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th'} smallest value. That is index ${t} once sorted, but we won't sort everything.`, { ptr: { target: t } });
    while (lo <= hi) {
      if (lo === hi) {
        snap(2, `Only one element is left, so the answer is ${a[lo]}.`, { marks: { [lo]: 'found' }, ptr: { target: t } });
        return c.steps;
      }
      const p = partition(c, lo, hi, { pivot: 1, cmp: 1, swap: 1, final: 1 });
      if (p === t) {
        snap(2, `The pivot landed at index ${p}, which is the target index. The answer is ${a[p]}.`, { marks: { [p]: 'found' }, ptr: { target: t } });
        return c.steps;
      }
      if (t < p) {
        hi = p - 1;
        snap(3, `Target index ${t} < ${p}: keep only the left part.`, { range: [lo, hi], ptr: { target: t } });
      } else {
        lo = p + 1;
        snap(4, `Target index ${t} > ${p}: keep only the right part.`, { range: [lo, hi], ptr: { target: t } });
      }
    }
    return c.steps;
  }

  const arrField = { key: 'values', label: 'Array', def: '38, 27, 43, 3, 9, 82, 10, 55', hint: '2 to 16 whole numbers (1–99), separated by commas' };
  const parseArr = v => U.ints(v.values, { min: 1, max: 99, minLen: 2, maxLen: 16, name: 'Array' });
  const randomArr = () => Array.from({ length: 8 }, () => U.randInt(5, 95));

  const SORTING = {
    merge: {
      name: 'Merge Sort', short: 'Merge Sort', tag: 'SORTING · DIVIDE AND CONQUER', stage: 'bars', complexity: 'O(n log n)',
      blurb: 'Splits the array in half until pieces have one element, then merges sorted halves back together by repeatedly taking the smaller front element. Always O(n log n), but needs O(n) extra space.',
      code: ['mergeSort(a, lo, hi):', '  if lo ≥ hi: return', '  mid ← (lo + hi) / 2', '  mergeSort(a, lo, mid); mergeSort(a, mid+1, hi)', '  merge: take the smaller front element each time'],
      fields: [arrField], random: () => ({ values: randomArr().join(', ') }), run: v => mergeSort(parseArr(v)),
    },
    quick: {
      name: 'Quick Sort', short: 'Quick Sort', tag: 'SORTING · DIVIDE AND CONQUER', stage: 'bars', complexity: 'O(n log n) average, O(n²) worst',
      blurb: 'Picks a pivot, moves smaller elements to its left and the rest to its right, then recurses on both sides. The pivot is already in its final place after each partition.',
      code: ['quickSort(a, lo, hi):', '  if lo ≥ hi: return', '  pivot ← a[hi]; i ← lo', '  for j in lo..hi−1:', '    if a[j] < pivot: swap(a[i], a[j]); i++', '  swap(a[i], a[hi])  // pivot lands in place', '  quickSort(lo, i−1); quickSort(i+1, hi)'],
      fields: [arrField], random: () => ({ values: randomArr().join(', ') }), run: v => quickSort(parseArr(v)),
    },
    heap: {
      name: 'Heap Sort', short: 'Heap Sort', tag: 'SORTING · IN PLACE', stage: 'bars', complexity: 'O(n log n)',
      blurb: 'Arranges the array as a max-heap, then repeatedly swaps the largest element to the end and restores the heap on what is left. Sorts in place with no extra memory.',
      code: ['heapSort(a):', '  build a max-heap (sift down from n/2−1 to 0)', '  for end from n−1 down to 1:', '    swap(a[0], a[end])  // max to the back', '    siftDown(a, 0, end)  // restore the heap'],
      fields: [arrField], random: () => ({ values: randomArr().join(', ') }), run: v => heapSort(parseArr(v)),
    },
    binary: {
      name: 'Binary Search', short: 'Binary Search', tag: 'SEARCHING · SORTED ARRAY', stage: 'bars', complexity: 'O(log n)',
      blurb: 'Compares the target with the middle element and throws away the half that cannot contain it, so each step halves the search range.',
      code: ['binarySearch(a, target):', '  lo ← 0; hi ← n − 1', '  while lo ≤ hi:', '    mid ← (lo + hi) / 2', '    if a[mid] = target: return mid', '    if a[mid] < target: lo ← mid + 1', '    else: hi ← mid − 1', '  return not found'],
      fields: [arrField, { key: 'target', label: 'Target', def: '43', hint: 'the value to look for' }],
      random: () => { const a = randomArr(); return { values: a.join(', '), target: String(Math.random() < 0.75 ? a[U.randInt(0, a.length - 1)] : U.randInt(1, 99)) }; },
      run: v => binarySearch(parseArr(v), U.int(v.target, 1, 99, 'Target')),
    },
    quickselect: {
      name: 'Quickselect', short: 'Quickselect', tag: 'SELECTION · K-TH SMALLEST', stage: 'bars', complexity: 'O(n) average, O(n²) worst',
      blurb: 'Like quick sort, but after each partition it only follows the side that contains the target index. That finds the k-th smallest without sorting everything.',
      code: ['quickselect(a, lo, hi, k):', '  pivot ← a[hi]; partition → index p', '  if p = k: return a[p]', '  if k < p: recurse into the left part', '  else: recurse into the right part'],
      fields: [arrField, { key: 'k', label: 'k (k-th smallest)', def: '3', hint: '1 = smallest' }],
      random: () => ({ values: randomArr().join(', '), k: String(U.randInt(1, 8)) }),
      run: v => { const a = parseArr(v); return quickselect(a, U.int(v.k, 1, a.length, 'k')); },
    },
  };

  window.Algo.SORTING = SORTING;
  window.Algo._sortFns = { mergeSort, quickSort, heapSort, binarySearch, quickselect };
})();
