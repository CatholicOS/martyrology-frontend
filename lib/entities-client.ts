"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MAX_IDS, type Entity } from "@/lib/entities";

/** One item's details in this session: not asked for yet, on their way, failed, or known (null: no snapshot has it). */
export type EntityState = { status: "idle" | "loading" | "error" } | { status: "ready"; entity: Entity | null };

const IDLE: EntityState = { status: "idle" };
const LOADING: EntityState = { status: "loading" };
const ERROR: EntityState = { status: "error" };
// Kept for the session: the snapshots change only with a deploy.
const states = new Map<string, EntityState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// Bumped by a reset: a request begun before it must not write into the answers that follow.
let generation = 0;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only: forgets every answer, tells the components showing one, and drops the answers still on their way. */
export function __resetEntities() {
  generation++;
  states.clear();
  emit();
}

/** Asks /api/entities for the items not known, nor on their way, MAX_IDS at a time; a failed item is asked again. */
export async function requestEntities(qids: string[]): Promise<void> {
  const wanted = [...new Set(qids)].filter((q) => {
    const s = states.get(q)?.status;
    return s === undefined || s === "idle" || s === "error";
  });
  if (wanted.length === 0) return;
  const asked = generation;
  for (const q of wanted) states.set(q, LOADING);
  emit();
  for (let i = 0; i < wanted.length; i += MAX_IDS) {
    const batch = wanted.slice(i, i + MAX_IDS);
    try {
      const res = await fetch(`/api/entities?ids=${batch.join(",")}`, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { entities } = (await res.json()) as { entities: Record<string, Entity> };
      if (asked !== generation) return;
      for (const q of batch) states.set(q, { status: "ready", entity: entities[q] ?? null });
    } catch (err) {
      if (asked !== generation) return;
      console.error(`markup: the details of ${batch.length} items could not be loaded`, err);
      for (const q of batch) states.set(q, ERROR);
    }
    emit();
  }
}

/** One item's details; asks for them when nothing has yet (a popup opened before the page's prefetch). */
export function useEntity(qid: string | null): EntityState {
  const state = useSyncExternalStore(subscribe, () => (qid ? states.get(qid) ?? IDLE : IDLE), () => IDLE);
  useEffect(() => {
    if (qid && state.status === "idle") void requestEntities([qid]);
  }, [qid, state.status]);
  return state;
}

/** While the markup is on, asks at once for every item a page names, so its popups open without waiting. */
export function usePrefetchEntities(qids: string[], on: boolean): void {
  const key = qids.join(",");
  useEffect(() => {
    if (on && key) void requestEntities(key.split(","));
  }, [on, key]);
}
