declare global {
  interface Window {
    L: {
      map: (element: HTMLElement, options?: Record<string, unknown>) => {
        remove: () => void;
        setView: (
          centre: [number, number],
          zoom: number,
          options?: { animate?: boolean },
        ) => void;
        fitBounds: (
          bounds: [[number, number], [number, number]],
          options?: {
            padding?: [number, number];
            maxZoom?: number;
            animate?: boolean;
          },
        ) => void;
      };
      tileLayer: (
        url: string,
        options?: Record<string, unknown>,
      ) => { addTo: (map: unknown) => void };
      layerGroup: () => {
        clearLayers: () => void;
        addTo: (map: unknown) => unknown;
      };
      marker: (
        latLng: [number, number],
        options?: Record<string, unknown>,
      ) => {
        on: (eventName: string, callback: () => void) => void;
        addTo: (layer: unknown) => void;
      };
      divIcon: (options?: Record<string, unknown>) => unknown;
    };
  }
}

export {};
