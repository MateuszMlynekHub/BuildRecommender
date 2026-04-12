import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const STORAGE_KEY = 'draftsense:favorites';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly document = inject(DOCUMENT);
  private readonly _ids = signal<Set<number>>(this.load());

  readonly ids = this._ids.asReadonly();

  isFavorite(championId: number): boolean {
    return this._ids().has(championId);
  }

  toggle(championId: number): void {
    const next = new Set(this._ids());
    if (next.has(championId)) next.delete(championId);
    else next.add(championId);
    this._ids.set(next);
    this.persist(next);
  }

  private load(): Set<number> {
    try {
      const raw = this.document.defaultView?.localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as number[]);
    } catch {
      return new Set();
    }
  }

  private persist(ids: Set<number>): void {
    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {}
  }
}
