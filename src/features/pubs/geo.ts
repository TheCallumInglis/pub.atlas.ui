import type { Pub } from "../../types/pub";

export type Bounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ClusterResult = {
  inliers: Pub[];
  outliers: Pub[];
};

export const EDINBURGH_TIGHT_BOUNDS: Bounds = {
  north: 55.987,
  south: 55.918,
  east: -3.102,
  west: -3.242,
};

export const EDINBURGH_TIGHT_BOUNDS_MOBILE: Bounds = {
  north: 55.968,
  south: 55.944,
  east: -3.170,
  west: -3.215,
};

export const EDINBURGH_CENTRE = {
  latitude: 55.9533,
  longitude: -3.1883,
};

const EDINBURGH_RADIUS_KM = 24;
const CLUSTER_NEIGHBOUR_RADIUS_KM = 12;
const CLUSTER_RADIUS_KM = 22;
export const MIN_CLUSTER_POINTS = 4;

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

export function splitCoordinateOutliers(pubs: Pub[]): ClusterResult {
  if (pubs.length < 4) {
    return { inliers: pubs, outliers: [] };
  }

  const edinburghInliers = pubs.filter((pub) => {
    const distance = haversineDistanceKm(
      Number(pub.latitude),
      Number(pub.longitude),
      EDINBURGH_CENTRE.latitude,
      EDINBURGH_CENTRE.longitude,
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

  const centreLat = median(pubs.map((pub) => Number(pub.latitude)));
  const centreLon = median(pubs.map((pub) => Number(pub.longitude)));

  let bestSeed: Pub | null = null;
  let bestNeighbourCount = 0;

  for (const seed of pubs) {
    let neighbourCount = 0;
    for (const candidate of pubs) {
      const distance = haversineDistanceKm(
        Number(seed.latitude),
        Number(seed.longitude),
        Number(candidate.latitude),
        Number(candidate.longitude),
      );
      if (distance <= CLUSTER_NEIGHBOUR_RADIUS_KM) {
        neighbourCount += 1;
      }
    }

    if (neighbourCount > bestNeighbourCount) {
      bestNeighbourCount = neighbourCount;
      bestSeed = seed;
    }
  }

  if (!bestSeed || bestNeighbourCount < MIN_CLUSTER_POINTS) {
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

  const refinedCentreLat =
    seededCluster.reduce((sum, pub) => sum + Number(pub.latitude), 0) /
    seededCluster.length;
  const refinedCentreLon =
    seededCluster.reduce((sum, pub) => sum + Number(pub.longitude), 0) /
    seededCluster.length;

  const inliers: Pub[] = [];
  const outliers: Pub[] = [];

  pubs.forEach((pub) => {
    const distance = haversineDistanceKm(
      Number(pub.latitude),
      Number(pub.longitude),
      refinedCentreLat,
      refinedCentreLon,
    );

    if (distance <= CLUSTER_RADIUS_KM) {
      inliers.push(pub);
      return;
    }

    outliers.push(pub);
  });

  const medianDistanceFromDatasetCentre = haversineDistanceKm(
    refinedCentreLat,
    refinedCentreLon,
    centreLat,
    centreLon,
  );

  if (inliers.length < MIN_CLUSTER_POINTS || medianDistanceFromDatasetCentre > 1000) {
    return {
      inliers: seededCluster,
      outliers: pubs.filter((pub) => !seededCluster.includes(pub)),
    };
  }

  return { inliers, outliers };
}

export function isInsideBounds(pub: Pub, bounds: Bounds): boolean {
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
