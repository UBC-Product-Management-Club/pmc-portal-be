import { Sheet } from "../../src/ops/sheet";

// A sheet held in memory, behaving like the Google one: rows grow as cells are written
export class MemorySheet implements Sheet {
  tabs: Record<string, string[][]> = {};
  writes: { tab: string; kind: "replace" | "append" | "update"; count: number }[] = [];

  constructor(tabs: Record<string, string[][]> = {}) {
    this.tabs = JSON.parse(JSON.stringify(tabs));
  }

  async read(tab: string) {
    return JSON.parse(JSON.stringify(this.tabs[tab] ?? []));
  }

  async replace(tab: string, rows: string[][]) {
    this.tabs[tab] = rows.map((r) => [...r]);
    this.writes.push({ tab, kind: "replace", count: rows.length });
  }

  async append(tab: string, rows: string[][]) {
    if (!rows.length) return;
    this.tabs[tab] = [...(this.tabs[tab] ?? []), ...rows.map((r) => [...r])];
    this.writes.push({ tab, kind: "append", count: rows.length });
  }

  async update(tab: string, cells: { row: number; col: number; value: string }[]) {
    if (!cells.length) return;
    const rows = (this.tabs[tab] ??= []);
    for (const { row, col, value } of cells) {
      while (rows.length <= row) rows.push([]);
      while (rows[row].length <= col) rows[row].push("");
      rows[row][col] = value;
    }
    this.writes.push({ tab, kind: "update", count: cells.length });
  }
}
