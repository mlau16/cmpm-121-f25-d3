# D3: {game title goes here}

## Game Design Vision

{a few-sentence description of the game mechanics}

---

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

---

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?

Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps for D3.a

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] use luck function to generate tokens
- [x] Allow players to collect tokens within 3 cells away
- [x] implement other cell/merge logics

---

## D3.b: Globe-spanning Gameplay

Expand the game from a fixed location to a globe-spanning grid system.
Players can move around the world and generate new cells dynamically and interact with local ones.

### Steps for D3.b

- [] Add a Global coordinate system
- [] Add player movement buttons
- [] Create dynamic cell spawning so when player moves, cells generate to make the map always full
- [] Update interaction to use player's current location
- [] ...
