import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

import luck from "./_luck.ts";

// ----- CONSTANTS -----
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001;
const INTERACT_RANGE = 3;
const WIN_VALUE = 16;

const playerLat = 0;
const playerLng = 0;

// ----- PLAYER STATE -----
let heldToken: number | null = null;

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
  center: [playerLat, playerLng],
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

// ----- UTILITY FUNCTIONS -----
function latLngToCell(lat: number, lng: number): [number, number] {
  return [Math.floor(lat / CELL_SIZE), Math.floor(lng / CELL_SIZE)];
}

function cellToCenter(i: number, j: number): [number, number] {
  return [(i + 0.5) * CELL_SIZE, (j + 0.5) * CELL_SIZE];
}

function cellToBounds(i: number, j: number): leaflet.LatLngBoundsExpression {
  const southWest = leaflet.latLng(i * CELL_SIZE, j * CELL_SIZE);
  const northEast = leaflet.latLng((i + 1) * CELL_SIZE, (j + 1) * CELL_SIZE);
  return leaflet.latLngBounds(southWest, northEast);
}

function tokenValue(i: number, j: number): number | null {
  const r = luck(`${i},${j}`);
  if (r < 0.75) return null; // 75% empty
  if (r < 0.9) return 1;
  if (r < 0.97) return 2;
  return 4;
}

function withinRange(i: number, j: number): boolean {
  const [pi, pj] = latLngToCell(playerLat, playerLng);
  return Math.abs(i - pi) <= INTERACT_RANGE &&
    Math.abs(j - pj) <= INTERACT_RANGE;
}

// ----- GAMEPLAY -----
function onCellClick(i: number, j: number, marker: L.Marker) {
  if (!withinRange(i, j)) {
    alert("Too far away!");
    return;
  }

  const value = tokenValue(i, j);
  if (value === null) {
    alert("Nothing here!");
    return;
  }

  // --- LOGIC ---
  if (heldToken === null) {
    heldToken = value;
    marker.remove();
  } else if (heldToken === value) {
    const newValue = value * 2;
    heldToken = newValue;
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
  const [iCenter, jCenter] = latLngToCell(playerLat, playerLng);
  const range = 12;

  for (let di = 0; di <= range; di++) {
    for (let dj = 0; dj <= range; dj++) {
      const i = iCenter + di;
      const j = jCenter + dj;

      const bounds = cellToBounds(i, j);
      leaflet.rectangle(bounds, {
        color: "#cc6600",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);

      const val = tokenValue(i, j);
      if (val === null) continue;

      const [lat, lng] = cellToCenter(i, j);
      const marker = leaflet.marker([lat, lng], { icon: makeTokenIcon(val) })
        .addTo(map)
        .on("click", () => onCellClick(i, j, marker));
    }
  }
}
map.on("moveend", renderGrid);

// ----- INIT -----
updateHUD();
renderGrid();
