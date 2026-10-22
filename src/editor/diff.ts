/** A line diff (longest common subsequence), with a few lines of context around each change. */
export function lineDiff(a: string, b: string, context = 2): { kind: ' ' | '+' | '-'; text: string }[]
{
    const x = a.split('\n');
    const y = b.split('\n');
    const n = x.length;
    const m = y.length;
    const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    const all: { kind: ' ' | '+' | '-'; text: string }[] = [];
    let i = 0;
    let j = 0;
    while (i < n || j < m)
    {
        if (i < n && j < m && x[i] === y[j]) { all.push({ kind: ' ', text: x[i] }); i++; j++; }
        else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) { all.push({ kind: '+', text: y[j] }); j++; }
        else { all.push({ kind: '-', text: x[i] }); i++; }
    }
    const keep = new Array<boolean>(all.length).fill(false);
    all.forEach((l, k) =>
    {
        if (l.kind === ' ') return;
        for (let d = -context; d <= context; d++) if (all[k + d]) keep[k + d] = true;
    });
    const out: typeof all = [];
    all.forEach((l, k) =>
    {
        if (keep[k]) out.push(l);
        else if (out.length && out[out.length - 1].text !== '…') out.push({ kind: ' ', text: '…' });
    });
    return out;
}
