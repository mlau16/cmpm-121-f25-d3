import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";
import luck from "./_luck.ts";

// ----- CONSTANTS -----
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001;
const INTERACT_RANGE = 3;
const WIN_VALUE = 32;

// ----- PLAYER STATE -----
let playerLat = 0;
let playerLng = 0;
let heldToken: number | null = null;

const modifiedCells = new Map<string, number | null>();

function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

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
  return [(i + 0.82) * CELL_SIZE, (j + 0.18) * CELL_SIZE];
}

function cellToBounds(i: number, j: number): leaflet.LatLngBoundsExpression {
  const southWest = leaflet.latLng(i * CELL_SIZE, j * CELL_SIZE);
  const northEast = leaflet.latLng((i + 1) * CELL_SIZE, (j + 1) * CELL_SIZE);
  return leaflet.latLngBounds(southWest, northEast);
}

function tokenValue(i: number, j: number): number | null {
  const r = luck(`${i},${j}`);
  if (r < 0.75) return null;
  if (r < 0.85) return 1;
  if (r < 0.93) return 2;
  if (r < 0.97) return 4;
  if (r < 0.995) return 8;
  return 16;
}

function getCellValue(i: number, j: number): number | null {
  const key = cellKey(i, j);
  if (modifiedCells.has(key)) {
    return modifiedCells.get(key)!;
  }
  return tokenValue(i, j);
}

function withinRange(i: number, j: number): boolean {
  const [pi, pj] = latLngToCell(playerLat, playerLng);
  return Math.abs(i - pi) <= INTERACT_RANGE &&
    Math.abs(j - pj) <= INTERACT_RANGE;
}

// ----- GAMEPLAY LOGIC -----
function onCellClick(i: number, j: number, marker: L.Marker) {
  if (!withinRange(i, j)) {
    alert("Too far away!");
    return;
  }

  const value = getCellValue(i, j);
  if (value === null) {
  if (heldToken !== null) {
      const key = cellKey(i, j);
      modifiedCells.set(key, heldToken);  
      marker.setIcon(makeTokenIcon(heldToken)); 
      marker.bindTooltip(`${heldToken}`);
      heldToken = null;
      updateHUD();
      return;
    }

    alert("Nothing here!");
    return;
  }

  const key = cellKey(i, j);

  if (heldToken === null) {
    heldToken = value;
    modifiedCells.set(key, null);

    marker.setIcon(makeEmptyIcon());
    marker.unbindTooltip();
  } else if (heldToken === value) {
    const newValue = value * 2;
    heldToken = newValue;
    modifiedCells.set(key, null);
    marker.remove(); 
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

function makeEmptyIcon() {
  return leaflet.divIcon({
    html: `<div style="
      width: 32px;
      height: 32px;
      opacity: 0;
    "></div>`,
    className: ""
  });
}

// ----- GRID RENDERING -----
function renderGrid() {
  map.eachLayer((layer) => {
    if (!(layer instanceof leaflet.TileLayer)) map.removeLayer(layer);
  });

  const playerIcon = leaflet.divIcon({
    html: "🧍‍♀️",
    className: "",
    iconSize: [32, 32],
  });
  leaflet.marker([playerLat, playerLng], { icon: playerIcon }).addTo(map);

  const [iCenter, jCenter] = latLngToCell(playerLat, playerLng);
  const range = 24;

  for (let di = -range; di <= range; di++) {
    for (let dj = -range; dj <= range; dj++) {
      const i = iCenter + di;
      const j = jCenter + dj;

      const bounds = cellToBounds(i, j);
      leaflet.rectangle(bounds, {
        color: "#cc6600",
        weight: 1,
        fillOpacity: 0.05,
      }).addTo(map);

      const val = getCellValue(i, j);
      const [lat, lng] = cellToCenter(i, j);

      let marker;
      if (val === null) {
        marker = leaflet.marker([lat, lng], { icon: makeEmptyIcon() });
      } else {
        marker = leaflet.marker([lat, lng], { icon: makeTokenIcon(val) });
      }

      marker.addTo(map).on("click", () => onCellClick(i, j, marker));
    }
  }
}

// ----- PLAYER MOVEMENT -----
function movePlayer(dI: number, dJ: number) {
  const [i, j] = latLngToCell(playerLat, playerLng);
  const newI = i + dI;
  const newJ = j + dJ;
  [playerLat, playerLng] = cellToCenter(newI, newJ);
  map.setView([playerLat, playerLng]);
  renderGrid();
}

// ----- MOVEMENT BUTTONS -----
function createPanel() {
  const movePanel = document.createElement("div");
  movePanel.id = "movePanel";

  Object.assign(movePanel.style, {
    position: "absolute",
    bottom: "5px",
    right: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    background: "rgba(255, 255, 255, 0.8)",
    padding: "25px",
    borderRadius: "16px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  });

  movePanel.innerHTML = `
  <div>
    <button id="moveN" class="move-btn">⬆️</button>
  </div>
  <div style="display:flex; gap:6px;">
    <button id="moveW" class="move-btn">⬅️</button>
    <button id="moveS" class="move-btn">⬇️</button>
    <button id="moveE" class="move-btn">➡️</button>
  </div>
`;
  document.body.append(movePanel);
  styleButtons();
  moveHandler();
}

// ----- BUTTON STYLE -----
function styleButtons() {
  const moveButtons = document.querySelectorAll<HTMLButtonElement>(".move-btn");
  moveButtons.forEach((btn) => {
    Object.assign(btn.style, {
      all: "unset",
      fontSize: "18px",
      background: "#f4f4f4",
      border: "2px solid #aaa",
      borderRadius: "6px",
      padding: "8px 10px",
      cursor: "pointer",
      transition: "all 0.2s ease",
    });

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#e0e0e0";
      btn.style.borderColor = "#888";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "#f5f5f5";
      btn.style.borderColor = "#aaa";
    });
  });
}

// ----- MOVEMENT LOGIC -----
function moveHandler() {
  const moves: Record<string, [number, number]> = {
    moveN: [1, 0],
    moveS: [-1, 0],
    moveE: [0, 1],
    moveW: [0, -1],
  };

  for (const [id, [dI, dJ]] of Object.entries(moves)) {
    document.getElementById(id)?.addEventListener(
      "click",
      () => movePlayer(dI, dJ),
    );
  }
}
map.on("moveend", renderGrid);

// ----- INIT -----
updateHUD();
createPanel();
renderGrid();
