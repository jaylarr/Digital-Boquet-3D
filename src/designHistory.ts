/** Bounded snapshots retain structural sharing, including photo strings. A drag is one edit. */
export class DesignHistory<T> {
  current: T;
  past: T[] = [];
  future: T[] = [];
  private grouped = false;
  private recorded = false;
  private limit: number;
  constructor(initial: T, limit = 60) { this.current = initial; this.limit = limit; }
  begin() { if (!this.grouped) { this.grouped = true; this.recorded = false; } }
  end() { this.grouped = false; this.recorded = false; }
  update(next: T | ((value: T) => T)) {
    const value = typeof next === 'function' ? (next as (value: T) => T)(this.current) : next;
    if (Object.is(value, this.current)) return false;
    if (!this.grouped || !this.recorded) { this.past.push(this.current); if (this.past.length > this.limit) this.past.shift(); this.recorded = true; }
    this.current = value; this.future = []; return true;
  }
  undo() { this.end(); if (!this.past.length) return false; this.future.unshift(this.current); this.current = this.past.pop()!; return true; }
  redo() { this.end(); if (!this.future.length) return false; this.past.push(this.current); this.current = this.future.shift()!; return true; }
  replace(value: T) { this.end(); this.current = value; this.past = []; this.future = []; }
}
