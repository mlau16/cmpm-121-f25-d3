import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

import luck from "./_luck.ts";

// ----- CONSTANTS -----
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001;
const INTERACT_RANGE = 3;
const WIN_VALUE = 16;

const GRID_ORIGIN = {
  lat: CLASSROOM_LATLNG.lat - CELL_SIZE * 12,
  lng: CLASSROOM_LATLNG.lng - CELL_SIZE * 12,
};

// ----- PLAYER STATE -----
let heldToken: number | null = null;
const pickedCells = new Set<string>(
  JSON.parse(localStorage.getItem("pickedCells") || "[]"),
);

// ----- UI SETUP -----
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

function updateHUD() {
  statusPanelDiv.textContent = heldToken
    ? `🎒 Holding token: ${heldToken}`
    : "🎒 Empty hands";
}

// ----- MAP SETUP -----
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("You are here");
playerMarker.addTo(map);

// ----- UTILITY FUNCTIONS -----
function getCellKey(i: number, j: number): string {
  return `${i},${j}`;
}

function getCellCenter(i: number, j: number): [number, number] {
  const lat = GRID_ORIGIN.lat + (i - 0.25) * CELL_SIZE;
  const lng = GRID_ORIGIN.lng + (j - 0.82) * CELL_SIZE;
  return [lat, lng];
}

function tokenValue(i: number, j: number): number | null {
  const r = luck(`${i},${j}`);
  if (r < 0.75) return null; // 75% empty
  if (r < 0.9) return 1;
  if (r < 0.97) return 2;
  return 4;
}

function saveState() {
  localStorage.setItem("pickedCells", JSON.stringify([...pickedCells]));
}

function playerCell(): [number, number] {
  const i = Math.floor((CLASSROOM_LATLNG.lat - GRID_ORIGIN.lat) / CELL_SIZE);
  const j = Math.floor((CLASSROOM_LATLNG.lng - GRID_ORIGIN.lng) / CELL_SIZE);
  return [i, j];
}

function withinRange(i: number, j: number): boolean {
  const [pi, pj] = playerCell();
  const dI = Math.abs(i - pi);
  const dJ = Math.abs(j - pj);
  return dI <= INTERACT_RANGE && dJ <= INTERACT_RANGE;
}

// ----- GAMEPLAY -----
function onCellClick(i: number, j: number, marker: L.Marker) {
  if (!withinRange(i, j)) {
    alert("Too far away!");
    return;
  }

  const key = getCellKey(i, j);
  if (pickedCells.has(key)) {
    alert("This cell is empty now.");
    return;
  }

  const value = tokenValue(i, j);
  if (value === null) {
    alert("Nothing here!");
    return;
  }

  // --- LOGIC ---
  if (heldToken === null) {
    // pick up
    heldToken = value;
    pickedCells.add(key);
    saveState();
    marker.remove();
  } else if (heldToken === value) {
    const newValue = value * 2;
    heldToken = newValue;
    pickedCells.add(key);
    saveState();
    marker.setIcon(makeTokenIcon(newValue));
    marker.bindTooltip(`${newValue}`);
    alert(`✨ Merged into ${newValue}!`);
    if (newValue >= WIN_VALUE) {
      alert("🎉 You win! Congratulations!");
    }
  } else {
    alert("Different token value. Cannot merge!");
  }

  updateHUD();
}

// ----- TOKEN RENDERING -----
function makeTokenIcon(value: number) {
  const html = `<div style="
    background: #fff2a8;
    border: 2px solid #d87;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    line-height: 28px;
    text-align: center;
    font-weight: bold;
  ">${value}</div>`;
  return leaflet.divIcon({ html, className: "" });
}

function renderGrid() {
  const range = 24;

  for (let i = 0; i <= range; i++) {
    for (let j = 0; j <= range; j++) {
      const key = `${i},${j}`;
      if (pickedCells.has(key)) continue;

      const southWest = leaflet.latLng(
        GRID_ORIGIN.lat + i * CELL_SIZE,
        GRID_ORIGIN.lng + j * CELL_SIZE,
      );
      const northEast = leaflet.latLng(
        GRID_ORIGIN.lat + (i + 1) * CELL_SIZE,
        GRID_ORIGIN.lng + (j + 1) * CELL_SIZE,
      );

      const bounds = leaflet.latLngBounds(southWest, northEast);
      leaflet.rectangle(bounds, {
        color: "#cc6600",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);

      const [lat, lng] = getCellCenter(i, j);

      const val = tokenValue(i, j);
      if (val === null) continue;

      const marker = leaflet.marker([lat, lng], { icon: makeTokenIcon(val) })
        .addTo(map)
        .bindTooltip(`${val}`)
        .on("click", () => onCellClick(i, j, marker));
    }
  }
}

function drawGrid() {
  const range = 50;

  for (let i = -range; i <= range; i++) {
    for (let j = -range; j <= range; j++) {
      const southWest = leaflet.latLng(
        CLASSROOM_LATLNG.lat + i * CELL_SIZE,
        CLASSROOM_LATLNG.lng + j * CELL_SIZE,
      );
      const northEast = leaflet.latLng(
        CLASSROOM_LATLNG.lat + (i + 1) * CELL_SIZE,
        CLASSROOM_LATLNG.lng + (j + 1) * CELL_SIZE,
      );

      const bounds = leaflet.latLngBounds(southWest, northEast);

      leaflet.rectangle(bounds, {
        color: "#ff7800",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);
    }
  }
}

// ----- INIT -----
updateHUD();
renderGrid();
drawGrid();
