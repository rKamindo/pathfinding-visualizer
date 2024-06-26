export interface pair {
  label: string;
  value: string;
}

export interface adjacencyInfo {
  nodeId: string;
  distance: number;
  time: number;
}

export interface nodeInfo {
  lat: number;
  lon: number;
  adj: Array<adjacencyInfo>;
}

export interface qtNode {
  key: string;
  lat: number;
  lon: number;
}

export interface dataDict {
  [key: string]: nodeInfo;
}

export interface cityDict {
  [key: string]: {
    data: dataDict;
    file: string;
    loaded: boolean;
  };
}

export interface LeafletLatLng {
  lat: number;
  lng: number;
}