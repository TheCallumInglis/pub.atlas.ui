export type Pub = {
  id: number;
  name: string;
  area?: string | null;
  latitude: number | null;
  longitude: number | null;
  visited?: boolean;
  visit_date?: string | null;
  googleMapsUrl?: string | null;
};
