import { useEffect, useMemo, useRef, useState } from "react";
import HeroPanel from "../components/pubs/HeroPanel";
import PubList from "../components/pubs/PubList";
import SelectedPubCard from "../components/pubs/SelectedPubCard";
import { getPubs } from "../api/pubs";
import {
  EDINBURGH_CENTRE,
  EDINBURGH_TIGHT_BOUNDS,
  EDINBURGH_TIGHT_BOUNDS_MOBILE,
  MIN_CLUSTER_POINTS,
  isInsideBounds,
  splitCoordinateOutliers,
} from "../features/pubs/geo";
import type { Pub } from "../types/pub";
import "./PubsPage.css";

type LeafletMap = {
  remove: () => void;
  setView: (centre: [number, number], zoom: number, options?: { animate?: boolean }) => void;
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: { padding?: [number, number]; maxZoom?: number; animate?: boolean },
  ) => void;
};

type LeafletLayerGroup = {
  clearLayers: () => void;
  addTo: (map: LeafletMap) => LeafletLayerGroup;
};

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

  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches;

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
  const bounds = isMobile ? EDINBURGH_TIGHT_BOUNDS_MOBILE : EDINBURGH_TIGHT_BOUNDS;
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

  const setPubItemRef = (pubId: number, element: HTMLButtonElement | null) => {
    pubItemRefs.current[pubId] = element;
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
          padding: isMobile ? [2, 2] : [56, 56],
          maxZoom: isMobile ? 18 : 14,
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

    map.setView([EDINBURGH_CENTRE.latitude, EDINBURGH_CENTRE.longitude], 12, {
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
        <HeroPanel visitedCount={visitedCount} mappedCount={mappablePubs.length} />

        <aside className="list-panel" aria-live="polite">
          {loading && <p className="status">Loading pubs...</p>}
          {!loading && error && <p className="status status--error">{error}</p>}

          {!loading && !error && pubs.length === 0 && (
            <p className="status">No pubs found yet.</p>
          )}

          {!loading && !error && pubs.length > 0 && (
            <>
              {selectedPub && (
                <SelectedPubCard
                  pubItem={selectedPub}
                  directionsUrl={getDirectionsUrl(selectedPub)}
                />
              )}

              <PubList
                pubs={pubs}
                activePubId={activePubId}
                outlierIds={outlierIds}
                onSelect={handleListSelect}
                setPubItemRef={setPubItemRef}
              />
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
