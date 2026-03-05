import { api } from "./client";
import type { Pub } from "../types/pub";

function toNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizePub(raw: Partial<Pub>): Pub {
  return {
    id: Number(raw.id ?? 0),
    name: String(raw.name ?? "Unnamed Pub"),
    area: toStringOrNull(raw.area),
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    visited: Boolean(raw.visited),
    visit_date: toStringOrNull(raw.visit_date),
    googleMapsUrl: toStringOrNull(raw.googleMapsUrl),
  };
}

export async function getPubs(): Promise<Pub[]> {
  const res = await api.get<Partial<Pub>[]>("/pubs");
  return (res.data ?? []).map(normalizePub);
}
