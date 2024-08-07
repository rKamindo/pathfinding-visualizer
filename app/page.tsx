"use client";
import React, { RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Child,
  IconWrapper,
  Select,
  Settings,
} from "./components/Styles";
import { algos, cities, cityCenters } from "./constants";
import { getCityData } from "./constants";
import { MoonIcon, SunIcon } from "@primer/octicons-react";
import { qtNode, dataDict } from "./types";
import * as d3 from "d3-quadtree";
import { LatLng, LeafletMouseEvent, Marker as LeafletMarker } from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { markerA, markerB } from "./Icons";
import AnimatedPolyline from "./lib/react-leaflet-animated-polyline/AnimatedPolyline";

export default function Home() {
  const [lat, setLat] = useState<number>(42.279);
  const [long, setLong] = useState<number>(-83.732);
  const [zoom, setZoom] = useState<number>(12);

  const [worker, setWorker] = useState<Worker>(
    new Worker(new URL("Worker.ts", import.meta.url))
  );

  // start and end markers
  const [startNode, setStartNode] = useState<string | null>(null);
  const [endNode, setEndNode] = useState<string | null>(null);

  // configuration options
  const [algorithm, setAlgorithm] = useState<string>("dijkstras");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [city, setCity] = useState<string>("ann_arbor");
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);

  const [startMarkerPos, setStartMarkerPos] = useState<LatLng | null>(null);
  const [endMarkerPos, setEndMarkerPos] = useState<LatLng | null>(null);
  // defines refs for the Maker components, gives a reference to the marker components useful when dragging
  const startNodeMarker = useRef<LeafletMarker>(null);
  const endNodeMarker = useRef<LeafletMarker>(null);

  const [qt, setQt] = useState<d3.Quadtree<qtNode>>(d3.quadtree<qtNode>());
  const [nodeData, setNodeData] = useState<dataDict>({});

  const [path, setPath] = useState<Array<string>>(new Array<string>());
  const [executionTime, setExecutionTime] = useState<number>(-1);
  const [distance, setDistance] = useState<number>(-1);
  const [travelTime, setTravelTime] = useState<number>(-1);
  const [pathCoordinates, setPathCoordinates] = useState<Array<LatLng>>(
    new Array<LatLng>()
  );
  const [pathFound, setPathFound] = useState<boolean>(false);

  const layerTiles = darkMode
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    if (city && city in cityCenters) {
      setLat(cityCenters[city].lat);
      setLong(cityCenters[city].long);
    }

    // reset the state of the application
    setStartNode(null);
    setEndNode(null);
    setPathCoordinates(new Array<LatLng>());
    setStartMarkerPos(null);
    setEndMarkerPos(null);
    setPathFound(false);
    setDistance(-1);
    setTravelTime(-1);
    setExecutionTime(-1);
    setPath(new Array<string>());

    getCityData(
      city,
      () => {},
      () => {}
    ).then((data) => {
      setNodeData(data);
    });
  }, [city]);

  useEffect(() => {
    worker.onmessage = (event: any) => {
      const data = JSON.parse(event.data);
      const type = data.type;
      if (type === "setPath") {
        const [
          path,
          pathCoordinates,
          executionTime,
          distanceInMiles,
          travelTime,
        ] = data.result;
        if (path) {
          console.log(travelTime);
          setPath(path);
          setDistance(distanceInMiles);
          setExecutionTime(executionTime);
          setPathCoordinates(pathCoordinates);
          setTravelTime(travelTime);
          setPathFound(true);
        }
      }

      return () => {
        worker.terminate();
      };
    };
  }, [worker]);

  useEffect(() => {
    // when node data changes,build quadtree from nodes
    // this allows us to find closest node to a coordinate in O(log n) time

    // we need to format data to store it as a node in quadtree
    // original { x, y }
    // new: { nodeId, x, y}
    const transformed = [];
    for (let [key, value] of Object.entries(nodeData)) {
      transformed.push({ key: key, lat: value.lat, lon: value.lon });
    }

    setQt(
      qt
        .x((d: qtNode) => {
          return d.lat;
        })
        .y((d: qtNode) => {
          return d.lon;
        })
        .addAll(transformed)
    );
  }, [nodeData]);

  // Takes a { lat, lng } object and finds the closest node, uses the quad tree
  const findClosestNode = (latlng: LatLng) => {
    if (qt.size() > 0) {
      const lat = latlng.lat;
      const lon = latlng.lng;
      const closestNode = qt.find(lat, lon);
      console.log("nearest node:", closestNode);
      return closestNode;
    }
  };

  const handleClick = (e: LeafletMouseEvent) => {
    // either we have not set a start or end node, find the closest node near the click
    if (!startNode || !endNode) {
      const closestNode = findClosestNode(e.latlng);
      if (closestNode) {
        if (!startNode) {
          setStartNode(closestNode.key);
          setStartMarkerPos(new LatLng(closestNode.lat, closestNode.lon));
        } else {
          setEndNode(closestNode.key);
          setEndMarkerPos(new LatLng(closestNode.lat, closestNode.lon));
        }
      }
    }
  };

  const handleMarkerDragEnd =
    (
      markerRef: RefObject<LeafletMarker>,
      setNode: (nodeId: string) => void,
      setMarkerPos: (latlng: LatLng) => void
    ) =>
    () => {
      const marker = markerRef.current;
      if (marker != null) {
        const closest = findClosestNode(marker.getLatLng());
        if (closest) {
          setNode(closest.key);
          setMarkerPos(new LatLng(closest.lat, closest.lon));
          console.log("marker set to", closest);
        }
      }
    };

  const onStartMarkerDragEnd = handleMarkerDragEnd(
    startNodeMarker,
    setStartNode,
    setStartMarkerPos
  );

  const onEndMarkerDragEnd = handleMarkerDragEnd(
    endNodeMarker,
    setEndNode,
    setEndMarkerPos
  );

  function MapEventHandler() {
    useMapEvents({
      click: (e) => handleClick(e),
    });
    return null;
  }

  function SetCenter({ coords }) {
    const map = useMap();
    map.setView(coords, map.getZoom());
    return null;
  }

  const SetCenterMemoized = useMemo(() => {
    return <SetCenter coords={[lat, long]} />;
  }, [lat, long]);

  /* 
  This is function handles executing the pathfinding
  it dynamically imports the pathfindingModule, accesses the default function
  and calls the pathfinding function with the city, startNode, endnode as parameters
  finally it will log the path for now, later we will work on animating the path found
  */
  const runPathfinding = async () => {
    if (startNode !== null && endNode !== null && startNode != endNode) {
      console.log(city, algorithm, startNode, endNode);
      setPathFound(false);
      worker.postMessage(
        JSON.stringify({
          city: city,
          algorithm: algorithm,
          startNode: startNode,
          endNode: endNode,
        })
      );
    }
  };

  useEffect(() => {
    // on start, end node change, re-run pathfinding
    if (pathFound) {
      setPathCoordinates([]);
      runPathfinding();
    }
  }, [startNode, endNode]);

  // render the final path if it exists
  const animatedPolyline = useMemo(() => {
    if (pathFound && pathCoordinates.length > 0) {
      return <AnimatedPolyline positions={pathCoordinates} snakeSpeed={500} />;
    }
    return null;
  }, [pathFound, pathCoordinates]);

  const Statistics = () => {
    let executionTimeText;
    let pathLengthText;
    let pathDistanceText;
    let travelTimeText;

    const textColorClass = darkMode ? "text-white" : "text-black";
    if (executionTime >= 0) {
      if (pathFound) {
        executionTimeText = `Execution time: ${executionTime / 1000.0} seconds`;
        pathLengthText =
          path.length > 0 ? `Path length: ${path.length} nodes` : null;
        pathDistanceText =
          distance > 0
            ? `Path distance: ${distance.toFixed(2)} miles (${(
                distance * 1.609344
              ).toFixed(2)} km)`
            : null;
        if (travelTime > 0) {
          const hours = Math.floor(travelTime / 1);
          const minutes = Math.floor((travelTime * 60) % 60);
          travelTimeText =
            hours > 0
              ? `Travel time: ${hours} hr ${minutes} minutes`
              : `Travel time: ${(travelTime * 60).toFixed(2)} minutes`;
        } else {
          executionTimeText = "Finding the path...";
        }
      }
    }

    return (
      <div className={`text-lg ${textColorClass}`}>
        <p>{executionTimeText}</p>
        <p>{pathLengthText}</p>
        <p>{pathDistanceText}</p>
        <p>{travelTimeText}</p>
      </div>
    );
  };

  return (
    <div>
      <Settings>
        <Child className="justify-start">
          <div className="absolute flex flex-col items-center">
            <Select
              onChange={(e) => setAlgorithm(e.target.value)}
              value={algorithm}
              className="rounded-sm"
            >
              {algos.map((algo) => (
                <option key={algo.value} value={algo.value}>
                  {algo.label}
                </option>
              ))}
            </Select>
            <Statistics />
          </div>
        </Child>
        <Child className="justify-center">
          <Select
            onChange={(e) => setCity(e.target.value)}
            value={city}
            className="rounded-l-sm"
          >
            {cities.map((city) => (
              <option key={city.value} value={city.value}>
                {city.label}
              </option>
            ))}
          </Select>
          <Button onClick={runPathfinding} className="rounded-r-sm">
            Visualize
          </Button>
        </Child>
        <Child className="justify-end">
          <IconWrapper onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? (
              <SunIcon className="fill-white" size={24} />
            ) : (
              <MoonIcon className="fill-black" size={24} />
            )}
          </IconWrapper>
        </Child>
      </Settings>
      <MapContainer
        className="w-full h-lvh"
        center={[lat, long]}
        zoom={zoom}
        zoomControl={false}
      >
        {SetCenterMemoized}
        <MapEventHandler />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={layerTiles}
        />
        {startMarkerPos && (
          <Marker
            icon={markerA}
            position={startMarkerPos}
            ref={startNodeMarker}
            draggable
            eventHandlers={{
              dragend: onStartMarkerDragEnd,
            }}
          >
            <Popup>Start</Popup>
          </Marker>
        )}
        {endMarkerPos && (
          <Marker
            icon={markerB}
            position={endMarkerPos}
            ref={endNodeMarker}
            draggable
            eventHandlers={{
              dragend: onEndMarkerDragEnd,
            }}
          >
            <Popup>End</Popup>
          </Marker>
        )}
        <ZoomControl position={"bottomleft"} />
        {animatedPolyline}
      </MapContainer>
    </div>
  );
}
