import { useEffect, useMemo, useRef, useState } from "react";
import { getPubs } from "../api/pubs";
import type { Pub } from "../types/pub";
import "./PubsPage.css";

type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

type ClusterResult = {
  inliers: Pub[];
  outliers: Pub[];
};

type LeafletMap = {
  remove: () => void;
  setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: [number, number]; maxZoom?: number; animate?: boolean },
  ) => void;
};

type LeafletLayerGroup = {
  clearLayers: () => void;
  addTo: (map: LeafletMap) => LeafletLayerGroup;
};

const EDINBURGH_TIGHT_BOUNDS: Bounds = {
  north: 55.987,
  south: 55.918,
  east: -3.102,
  west: -3.242,
};

const EDINBURGH_CENTER = {
  latitude: 55.9533,
  longitude: -3.1883,
};
const EDINBURGH_RADIUS_KM = 24;
const CLUSTER_NEIGHBOR_RADIUS_KM = 12;
const CLUSTER_RADIUS_KM = 22;
const MIN_CLUSTER_POINTS = 4;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function splitCoordinateOutliers(pubs: Pub[]): ClusterResult {
  if (pubs.length < 4) {
    return { inliers: pubs, outliers: [] };
  }

  const edinburghInliers = pubs.filter((pub) => {
    const distance = haversineDistanceKm(
      Number(pub.latitude),
      Number(pub.longitude),
      EDINBURGH_CENTER.latitude,
      EDINBURGH_CENTER.longitude,
    );
    return distance <= EDINBURGH_RADIUS_KM;
  });

  if (edinburghInliers.length >= MIN_CLUSTER_POINTS) {
    const inlierIds = new Set(edinburghInliers.map((pub) => pub.id));
    return {
      inliers: edinburghInliers,
      outliers: pubs.filter((pub) => !inlierIds.has(pub.id)),
    };
  }

  const centerLat = median(pubs.map((pub) => Number(pub.latitude)));
  const centerLon = median(pubs.map((pub) => Number(pub.longitude)));

  let bestSeed: Pub | null = null;
  let bestNeighborCount = 0;

  for (const seed of pubs) {
    let neighborCount = 0;
    for (const candidate of pubs) {
      const distance = haversineDistanceKm(
        Number(seed.latitude),
        Number(seed.longitude),
        Number(candidate.latitude),
        Number(candidate.longitude),
      );
      if (distance <= CLUSTER_NEIGHBOR_RADIUS_KM) {
        neighborCount += 1;
      }
    }

    if (neighborCount > bestNeighborCount) {
      bestNeighborCount = neighborCount;
      bestSeed = seed;
    }
  }

  if (!bestSeed || bestNeighborCount < MIN_CLUSTER_POINTS) {
    return { inliers: pubs, outliers: [] };
  }

  const clusterSeed = bestSeed;

  const seededCluster = pubs.filter((pub) => {
    const distance = haversineDistanceKm(
      Number(pub.latitude),
      Number(pub.longitude),
      Number(clusterSeed.latitude),
      Number(clusterSeed.longitude),
    );
    return distance <= CLUSTER_RADIUS_KM;
  });

  if (seededCluster.length < MIN_CLUSTER_POINTS) {
    return { inliers: pubs, outliers: [] };
  }

  const refinedCenterLat =
    seededCluster.reduce((sum, pub) => sum + Number(pub.latitude), 0) /
    seededCluster.length;
  const refinedCenterLon =
    seededCluster.reduce((sum, pub) => sum + Number(pub.longitude), 0) /
    seededCluster.length;

  const inliers: Pub[] = [];
  const outliers: Pub[] = [];

  pubs.forEach((pub) => {
    const distance = haversineDistanceKm(
      Number(pub.latitude),
      Number(pub.longitude),
      refinedCenterLat,
      refinedCenterLon,
    );

    if (distance <= CLUSTER_RADIUS_KM) {
      inliers.push(pub);
      return;
    }

    outliers.push(pub);
  });

  const medianDistanceFromDatasetCenter = haversineDistanceKm(
    refinedCenterLat,
    refinedCenterLon,
    centerLat,
    centerLon,
  );

  if (inliers.length < MIN_CLUSTER_POINTS || medianDistanceFromDatasetCenter > 1000) {
    return {
      inliers: seededCluster,
      outliers: pubs.filter((pub) => !seededCluster.includes(pub)),
    };
  }

  return { inliers, outliers };
}

function isInsideBounds(pub: Pub, bounds: Bounds): boolean {
  if (pub.latitude == null || pub.longitude == null) {
    return false;
  }

  return (
    pub.latitude <= bounds.north &&
    pub.latitude >= bounds.south &&
    pub.longitude <= bounds.east &&
    pub.longitude >= bounds.west
  );
}

function getDirectionsUrl(pub: Pub): string {
  if (pub.googleMapsUrl) {
    return pub.googleMapsUrl;
  }

  if (pub.latitude == null || pub.longitude == null) {
    return "https://www.google.com/maps/place/Edinburgh";
  }

  return `https://www.google.com/maps/search/?api=1&query=${pub.latitude},${pub.longitude}`;
}

export default function PubsPage() {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [listFocusSeq, setListFocusSeq] = useState(0);

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletLayerGroup | null>(null);
  const viewportKeyRef = useRef<string | null>(null);
  const pubItemRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    let active = true;

    getPubs()
      .then((items) => {
        if (!active) {
          return;
        }
        setPubs(items);
      })
      .catch((e) => {
        if (active) {
          setError(e?.message ?? "Failed to load pubs");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const pubsWithCoords = useMemo(
    () => pubs.filter((pub) => pub.latitude != null && pub.longitude != null),
    [pubs],
  );

  const clusterResult = useMemo(
    () => splitCoordinateOutliers(pubsWithCoords),
    [pubsWithCoords],
  );

  const edinburghCorePubs = useMemo(
    () =>
      clusterResult.inliers.filter((pub) =>
        isInsideBounds(pub, EDINBURGH_TIGHT_BOUNDS),
      ),
    [clusterResult.inliers],
  );

  const mappablePubs =
    edinburghCorePubs.length >= MIN_CLUSTER_POINTS
      ? edinburghCorePubs
      : clusterResult.inliers;

  const outlierIds = useMemo(
    () => new Set(clusterResult.outliers.map((pub) => pub.id)),
    [clusterResult.outliers],
  );
  const mappablePubIds = useMemo(
    () => new Set(mappablePubs.map((pub) => pub.id)),
    [mappablePubs],
  );

  const selectedPub = useMemo(() => {
    if (pubs.length === 0) {
      return null;
    }

    if (selectedId != null) {
      const selected = pubs.find((pub) => pub.id === selectedId);
      if (selected) {
        return selected;
      }
    }

    return mappablePubs[0] ?? pubsWithCoords[0] ?? pubs[0];
  }, [pubs, pubsWithCoords, mappablePubs, selectedId]);

  const activePubId = selectedPub?.id ?? null;

  const visitedCount = pubs.filter((pub) => pub.visited).length;
  const bounds = EDINBURGH_TIGHT_BOUNDS;
  const viewportKey = useMemo(() => {
    const ids = mappablePubs.map((pub) => pub.id).join(",");
    return [
      "edinburgh",
      bounds.north.toFixed(5),
      bounds.south.toFixed(5),
      bounds.east.toFixed(5),
      bounds.west.toFixed(5),
      ids,
    ].join("|");
  }, [bounds, mappablePubs]);

  const handleListSelect = (pubId: number) => {
    setSelectedId(pubId);
    setListFocusSeq((value) => value + 1);
  };

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current || typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let retryCount = 0;
    let retryTimer: number | undefined;

    const initMap = () => {
      if (disposed || !mapElementRef.current || mapRef.current) {
        return;
      }

      const leaflet = window.L;
      if (!leaflet) {
        retryCount += 1;

        if (retryCount >= 80) {
          setError((current) => current ?? "Map library failed to load.");
          return;
        }

        retryTimer = window.setTimeout(initMap, 50);
        return;
      }

      const map = leaflet.map(mapElementRef.current, {
        zoomControl: false,
        preferCanvas: true,
        attributionControl: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);

      const layerGroup = leaflet.layerGroup() as LeafletLayerGroup;
      layerGroup.addTo(map);
      mapRef.current = map;
      markersRef.current = layerGroup;
      setMapReady(true);
    };

    initMap();

    return () => {
      disposed = true;
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
      }
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markersRef.current;
    const leaflet = typeof window !== "undefined" ? window.L : undefined;

    if (!mapReady || !map || !markerLayer || !leaflet) {
      return;
    }

    markerLayer.clearLayers();

    mappablePubs.forEach((pub) => {
      if (pub.latitude == null || pub.longitude == null) {
        return;
      }

      const isActive = pub.id === activePubId;
      const marker = leaflet.marker([pub.latitude, pub.longitude], {
        icon: leaflet.divIcon({
          className: "pub-marker-wrapper",
          html: `<span class="pub-marker${isActive ? " is-active" : ""}"></span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        title: pub.name,
      });

      marker.on("click", () => setSelectedId(pub.id));
      marker.addTo(markerLayer);
    });

    if (viewportKeyRef.current === viewportKey) {
      return;
    }
    viewportKeyRef.current = viewportKey;

    if (mappablePubs.length > 1) {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        {
          padding: [56, 56],
          maxZoom: 14,
          animate: false,
        },
      );
      return;
    }

    if (mappablePubs.length === 1) {
      const pub = mappablePubs[0];
      map.setView([Number(pub.latitude), Number(pub.longitude)], 14, {
        animate: false,
      });
      return;
    }

    map.setView([EDINBURGH_CENTER.latitude, EDINBURGH_CENTER.longitude], 12, {
      animate: false,
    });
  }, [activePubId, bounds, mapReady, mappablePubs, viewportKey]);

  useEffect(() => {
    if (!mapReady || selectedId == null || listFocusSeq === 0) {
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const targetPub = pubs.find((pub) => pub.id === selectedId) ?? null;
    if (
      !targetPub ||
      targetPub.latitude == null ||
      targetPub.longitude == null ||
      !mappablePubIds.has(targetPub.id)
    ) {
      return;
    }

    map.setView([targetPub.latitude, targetPub.longitude], 15, {
      animate: false,
    });
  }, [listFocusSeq, mapReady, mappablePubIds, pubs, selectedId]);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }

    const target = pubItemRefs.current[selectedId];
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId]);

  return (
    <main className="pub-atlas" aria-busy={loading}>
      <section className="map-shell" aria-label="Map of visited Edinburgh pubs">
        <div className="leaflet-map" ref={mapElementRef} />
        <div className="map-wash" />
      </section>

      <section className="overlay">
        <header className="hero-panel">
          <p className="eyebrow">Edinburgh</p>
          <h1>Callum's Pub Atlas</h1>
          <p className="subtitle">
            A personal map of pints around Edinburgh.
          </p>

          <div className="stats-row">
            <div className="stat-card">
              <span className="stats-value">{visitedCount}</span>
              <span className="stats-label">Visited</span>
            </div>
            <div className="stat-card">
              <span className="stats-value">{mappablePubs.length}</span>
              <span className="stats-label">Mapped</span>
            </div>
          </div>
        </header>

        <aside className="list-panel" aria-live="polite">
          {loading && <p className="status">Loading pubs...</p>}
          {!loading && error && <p className="status status--error">{error}</p>}

          {!loading && !error && pubs.length === 0 && (
            <p className="status">No pubs found yet.</p>
          )}

          {!loading && !error && pubs.length > 0 && (
            <>
              {selectedPub && (
                <article className="selected-card">
                  <p className="selected-card__area">
                    {selectedPub.area ?? "Edinburgh"}
                  </p>
                  <h2>{selectedPub.name}</h2>
                  <a
                    href={getDirectionsUrl(selectedPub)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </article>
              )}

              <div className="pub-list" role="list" aria-label="Pubs">
                {pubs.map((pub, index) => (
                  <button
                    type="button"
                    key={pub.id}
                    ref={(element) => {
                      pubItemRefs.current[pub.id] = element;
                    }}
                    className={`pub-item${pub.id === activePubId ? " is-active" : ""}`}
                    style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
                    onClick={() => handleListSelect(pub.id)}
                    role="listitem"
                  >
                    <span>{pub.name}</span>
                    <small>
                      {pub.latitude == null || pub.longitude == null
                        ? "Missing coordinates"
                        : outlierIds.has(pub.id)
                          ? "Outside Edinburgh"
                          : pub.area ?? "Mapped"}
                    </small>
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
