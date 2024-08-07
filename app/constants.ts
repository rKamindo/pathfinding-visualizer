import axios from "axios";
import { cityDict, pair } from "./types";

export const cities: Array<pair> = [
  { value: "ann_arbor", label: "Ann Arbor, MI (33152 nodes, 16.1 MB)" },
  { value: "detroit", label: "Detroit, MI (141282 nodes, 29.l8 MB)" },
];

export const cityCenters: Record<string, { lat: number; long: number }> = {
  ann_arbor: { lat: 42.279, long: -83.732 },
  detroit: { lat: 42.331, long: -83.045 },
};

export const algos: Array<pair> = [
  { value: "dijkstras", label: "Dijkstra's (Shortest Distance)" },
  { value: "dijkstras-time", label: "Dijkstra's (Shortest Travel Time)" },
  { value: "astar-manhattan", label: "A* (Travel Time, Manhattan)" },
  { value: "astar-euclidean", label: "A* (Travel Time, Euclidean)" },
  { value: "bfs", label: "Breadth First Search" },
  { value: "dfs", label: "Depth First Search" },
];

export const cityData: cityDict = {
  ann_arbor: {
    data: {},
    file: "data.json",
    loaded: false,
  },
  detroit: {
    data: {},
    file: "detroit.json",
    loaded: false,
  },
};

export async function getCityData(
  city: string,
  setLoading: (isLoading: boolean) => void,
  onProgress: (progress: number) => void
) {
  console.log("getting data");
  if (cityData[city].loaded) {
    console.log("data already loaded");
    return cityData[city].data;
  } else {
    const file = cityData[city].file;
    setLoading(true);
    const { data: jsonData } = await axios.get(`/data/${file}`, {
      onDownloadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentage = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentage);
        }
      },
    });

    cityData[city].data = jsonData;
    setTimeout(() => {
      setLoading(false);
      cityData[city].loaded = true;
    }, 200);
    console.log("returning data");
    return cityData[city].data;
  }
}
