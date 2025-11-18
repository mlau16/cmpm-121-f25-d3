import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import playerImg from "./banana_slug.webp";
import "./style.css";

// ===== CONSTANTS =====
const GAMEPLAY_ZOOM_LEVEL = 19;
const CELL_SIZE = 0.0001;
const INTERACT_RANGE = 3;
const WIN_VALUE = 2048;
const SAVE_KEY = "d3_game_state_v1";

// ===== PLAYER STATE =====
let playerLat = 0;
let playerLng = 0;
let heldToken: number | null = null;

// ===== MEMENTO STORAGE =====
const cellMemo = new Map<string, number | null>();

function cellKey(i: number, j: number): string {
  return `${i},${j}`;
}

// ===== UI SETUP =====
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

// ===== MAP SETUP =====
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

// ===== UTILITY FUNCTIONS =====
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

// ===== FLYWEIGHT TOKEN GENERATOR =====

function tokenValue(i: number, j: number): number | null {
  const r = luck(`${i},${j}`);
  if (r < 0.75) return null;
  if (r < 0.85) return 1;
  if (r < 0.93) return 2;
  if (r < 0.97) return 4;
  if (r < 0.995) return 8;
  return 16;
}

function flyCell(i: number, j: number): number | null {
  const key = cellKey(i, j);
  if (cellMemo.has(key)) {
    return cellMemo.get(key)!;
  }
  return tokenValue(i, j);
}

function withinRange(i: number, j: number): boolean {
  const [pi, pj] = latLngToCell(playerLat, playerLng);
  return Math.abs(i - pi) <= INTERACT_RANGE &&
    Math.abs(j - pj) <= INTERACT_RANGE;
}

// ===== LOCAL STORAGE FUNCTIONS =====
function saveGameState() {
  const data = {
    lat: playerLat,
    lng: playerLng,
    held: heldToken,
    cells: Array.from(cellMemo.entries()),
    mode: movement.mode,
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    console.warn("Could not save to localStorage.");
  }
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);

    playerLat = data.lat ?? 0;
    playerLng = data.lng ?? 0;
    heldToken = data.held ?? null;

    cellMemo.clear();
    for (const [key, val] of data.cells ?? []) cellMemo.set(key, val);

    if (data.mode === "geo") {
      movement.setDriver(new GeoDriver(), "geo");
    } else {
      movement.setDriver(new ButtonsDriver(), "buttons");
    }
  } catch {
    console.warn("Could not load game state.");
  }
}

function newGame() {
  movement.getDriver().cleanup?.();

  localStorage.removeItem(SAVE_KEY);
  cellMemo.clear();
  heldToken = null;
  playerLat = 0;
  playerLng = 0;

  movement.setDriver(new ButtonsDriver(), "buttons");

  const switchBtn = document.getElementById("movementSwitchBtn");
  if (switchBtn) switchBtn.textContent = "Mode: Buttons";

  map.setView([playerLat, playerLng]);

  saveGameState();
  renderGrid();
  updateHUD();
}

// ===== GAMEPLAY LOGIC =====
function onCellClick(i: number, j: number, marker: L.Marker) {
  if (!withinRange(i, j)) {
    alert("Too far away!");
    return;
  }

  const key = cellKey(i, j);
  const cellValue = flyCell(i, j);

  if (cellValue === null && heldToken !== null) {
    cellMemo.set(key, heldToken);
    marker.setIcon(makeTokenIcon(heldToken));
    marker.bindTooltip(`${heldToken}`);
    heldToken = null;
    updateHUD();
    saveGameState();
    return;
  }

  if (cellValue === null) {
    alert("Nothing here!");
    return;
  }

  if (heldToken === null) {
    heldToken = cellValue;
    cellMemo.set(key, null);
    marker.setIcon(makeEmptyIcon());
    marker.unbindTooltip();
    updateHUD();
    saveGameState();
    return;
  }

  if (heldToken === cellValue) {
    const newValue = cellValue * 2;

    cellMemo.set(key, null);

    heldToken = newValue;

    marker.setIcon(makeEmptyIcon());
    marker.unbindTooltip();

    alert(`✨ Merged into ${newValue}!`);

    if (newValue >= WIN_VALUE) {
      alert("🎉 You win! 🎉");
    }

    updateHUD();
    saveGameState();
    return;
  }
  alert("Different token value. Cannot merge!");
}

// ===== TOKEN RENDERING =====
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
      background: transparent;
    ">
      <svg width = "32" height="32"></svg>
    </div>`,
    className: "",
  });
}

// ===== GRID RENDERING =====
function renderGrid() {
  map.eachLayer((layer) => {
    if (!(layer instanceof leaflet.TileLayer)) map.removeLayer(layer);
  });

  const playerIcon = leaflet.icon({
    iconUrl: playerImg,
    iconSize: [40, 40],
    iconAnchor: [5, 5],
  });
  leaflet.marker([playerLat, playerLng], {
    icon: playerIcon,
    zIndexOffset: 9999,
  }).addTo(map);

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

      const val = flyCell(i, j);
      const [lat, lng] = cellToCenter(i, j);

      let marker: leaflet.Marker;

      if (val === null) {
        marker = leaflet.marker([lat, lng], { icon: makeEmptyIcon() });
      } else {
        marker = leaflet.marker([lat, lng], { icon: makeTokenIcon(val) });
      }

      marker
        .addTo(map)
        .on("click", () => onCellClick(i, j, marker));
    }
  }
}

// ===== MOVEMENT (FACADE PATTERN) =====
interface MovementDriver {
  moveBy(di: number, dj: number): void;
  cleanup?(): void;
}

class ButtonsDriver implements MovementDriver {
  cleanup() {}
  moveBy(di: number, dj: number) {
    movePlayer(di, dj);
  }
}

class GeoDriver implements MovementDriver {
  watchId: number | null = null;

  constructor() {
    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          playerLat = lat;
          playerLng = lng;
          map.setView([playerLat, playerLng]);
          renderGrid();
        },
        (err) => console.error("Geo error:", err),
        { enableHighAccuracy: true },
      );
    } else {
      alert("Geolocation not supported on this device.");
    }
  }

  cleanup() {
    if (this.watchId != null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
  moveBy(_di: number, _dj: number) {
    console.warn("moveBy ignored: GeoDriver controls movement automatically.");
  }
}

class MovementFacade {
  private driver: MovementDriver;
  public mode: "buttons" | "geo";

  constructor(initialDriver: MovementDriver, mode: "buttons" | "geo") {
    this.driver = initialDriver;
    this.mode = mode;
  }

  getDriver(): MovementDriver {
    return this.driver;
  }

  setDriver(d: MovementDriver, mode: "buttons" | "geo") {
    this.driver.cleanup?.();
    this.driver = d;
    this.mode = mode;
  }

  moveBy(di: number, dj: number) {
    this.driver.moveBy(di, dj);
  }
}

const movement = new MovementFacade(new ButtonsDriver(), "buttons");

// ===== PLAYER MOVEMENT =====
function movePlayer(dI: number, dJ: number) {
  const [i, j] = latLngToCell(playerLat, playerLng);
  const newI = i + dI;
  const newJ = j + dJ;
  [playerLat, playerLng] = cellToCenter(newI, newJ);
  map.setView([playerLat, playerLng]);
  renderGrid();
  saveGameState();
}

// ===== BUTTONS =====
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

function createMovementSwitch() {
  const btn = document.createElement("button");
  btn.id = "movementSwitchBtn";
  btn.textContent = "Mode: Buttons";

  Object.assign(btn.style, {
    position: "absolute",
    top: "10px",
    right: "10px",
    padding: "10px 14px",
    borderRadius: " 8px",
    background: "#ffffffaa",
    border: "1px solid #444",
    cursor: "pointer",
  });

  btn.onclick = () => {
    if (movement instanceof MovementFacade) {
      if (movement["driver"] instanceof ButtonsDriver) {
        movement.setDriver(new GeoDriver(), "geo");
        btn.textContent = "Mode: Geolocation";
      } else {
        movement.setDriver(new ButtonsDriver(), "buttons");
        btn.textContent = "Mode: Buttons";
      }
    }
  };

  document.body.append(btn);
}

function createResetButton() {
  const btn = document.createElement("button");
  btn.style.cssText = `
    position:absolute; top:60px; right:10px;
    padding:10px 14px; background:#fff9;
    border:1px solid #444; border-radius:8px;
    cursor:pointer;
  `;
  btn.textContent = "New Game";

  btn.onclick = () => {
    if (confirm("Start a new game?")) newGame();
  };

  document.body.append(btn);
}
// ===== BUTTON STYLE =====
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

// ===== MOVEMENT LOGIC =====
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
      () => movement.moveBy(dI, dJ),
    );
  }
}
map.on("moveend", renderGrid);

// ===== INIT =====

loadGameState();
updateHUD();
createPanel();
createMovementSwitch();
createResetButton();
renderGrid();
