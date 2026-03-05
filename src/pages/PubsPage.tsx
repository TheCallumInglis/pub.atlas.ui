import { useEffect, useState } from "react";
import { getPubs } from "../api/pubs";
import type { Pub } from "../types/pub";

export default function PubsPage() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPubs()
      .then(setPubs)
      .catch((e) => setError(e?.message ?? "Failed to load pubs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading pubs...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div>
      <h2>Pubs</h2>
      <ul>
        {pubs.map((p) => (
          <li key={p.id}>
            {p.name}{" "}
            {p.latitude != null && p.longitude != null ? "📍" : "(Missing Coordinates)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
