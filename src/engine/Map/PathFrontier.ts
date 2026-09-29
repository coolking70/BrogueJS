import type { Pos } from '../../types';

interface Entry {
    key: string;
    pos: Pos;
    score: number;
    order: number;
    index: number;
}

/** Indexed A* frontier with the former open array's exact selection order:
 * lowest f first, then earliest insertion. Improving an open node keeps its
 * insertion order; reopening a removed node gives it a new order. */
export class PathFrontier {
    private heap: Entry[] = [];
    private open = new Map<string, Entry>();
    private nextOrder = 0;

    get length(): number { return this.heap.length; }

    public improve(key: string, pos: Pos, score: number): void {
        const entry = this.open.get(key);
        if (entry) {
            // findPath calls this only after a strictly lower g; h is unchanged.
            entry.score = score;
            this.up(entry.index);
        } else {
            const added: Entry = { key, pos, score, order: this.nextOrder++, index: this.heap.length };
            this.open.set(key, added);
            this.heap.push(added);
            this.up(added.index);
        }
    }

    public pop(): Pos {
        const first = this.heap[0]!;
        const last = this.heap.pop()!;
        this.open.delete(first.key);
        if (this.heap.length > 0) {
            this.heap[0] = last;
            last.index = 0;
            this.down(0);
        }
        return first.pos;
    }

    private before(a: Entry, b: Entry): boolean {
        return a.score < b.score || (a.score === b.score && a.order < b.order);
    }

    private swap(a: number, b: number): void {
        const left = this.heap[a]!, right = this.heap[b]!;
        this.heap[a] = right; right.index = a;
        this.heap[b] = left; left.index = b;
    }

    private up(index: number): void {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (!this.before(this.heap[index]!, this.heap[parent]!)) break;
            this.swap(index, parent);
            index = parent;
        }
    }

    private down(index: number): void {
        while (index * 2 + 1 < this.heap.length) {
            let child = index * 2 + 1;
            if (child + 1 < this.heap.length && this.before(this.heap[child + 1]!, this.heap[child]!)) child++;
            if (!this.before(this.heap[child]!, this.heap[index]!)) break;
            this.swap(index, child);
            index = child;
        }
    }
}
