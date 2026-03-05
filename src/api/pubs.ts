import { api } from "./client";
import type { Pub } from "../types/pub";

export async function getPubs(): Promise<Pub[]> {
    const res = await api.get<Pub[]>("/pubs");
    return res.data;
}
