# Uncharted — A Seafarer’s Tale

A browser sailing adventure on real geographic coastlines. Chart a passage from Lisbon around Africa to the Banda Islands in the Moluccas, recover four lost treasures, and learn historical navigation along the way.

## Run locally

Requires Node.js 18 or later.

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if script execution is disabled. Open the local URL printed by Vite.

```sh
npm run build
npm run preview
```

The production website is generated in `dist/` and can be deployed to any static host.

## Controls

- **Click or tap the sea:** Set an automatic course; the helmsman tacks upwind and avoids nearby shorelines.
- **A / D or left / right arrows:** Steer manually and raise anchor.
- **W / S or up / down arrows:** Increase or decrease sail.
- **Space or anchor button:** Lower or raise anchor.
- **Mouse wheel or + / −:** Zoom the chart.
- **Camera:** Zoom above 1× to automatically follow the ship. At 1× or below, the map stays in place and can be freely panned. Zooming back in reacquires the vessel.
- **Drag the map:** Pan across the globe (mouse or touch).
- **World chart:** View the geographic region and plot long-distance, water-only courses.
- **Crosshair / Follow ship button:** Recenter on your vessel.
- **H:** Open the navigator’s handbook.
- **After hitting an obstacle:** The ship stops, anchors, and cancels its course. Turn with A / D, then press W when facing open water, or click a safe sea course.
- **Straits:** Click beyond a narrow passage to engage the automatic slow-speed channel pilot. Major straits have visibly widened water corridors and a dotted guide line; the map and collision mask share the same channel geometry.
- **Read the stars:** Anchor and inspect Polaris in the Northern Hemisphere or Crux in the Southern Hemisphere.

## Features

- Natural Earth 1:10m coastlines rendered in Canvas 2D, layered beaches and surf, small port settlements, ship wakes, and unexplored cloud cover. See `src/data/README.md` for attribution and projection details.
- Dolphin pods, surfacing whales, circling coastal birds, shimmering local waves, dawn/dusk light, moonlit water, and passing rain. Atmospheric effects are decorative; reduced-motion settings suppress movement.
- Simplified lateen-sail physics with points of sail, a no-go zone, gradual acceleration, hull drag, currents, and coastline collisions.
- Seven geographic destinations, four treasures, a persistent voyage journal, and a Spice Lands arrival ending.
- Historical lessons on tacking, latitude, dead reckoning, coastal birds, and shallow-water signs.
- Browser-local autosave, optional synthesized ocean ambience, reduced-motion settings, responsive layout, and touch navigation.

Coordinates use real latitude and longitude on a whole-world, north-up equirectangular chart (180°W–180°E, 90°N–90°S). Sailing east or west across the dateline continues seamlessly. Land, rocks, and visible polar sea ice stop the entire hull using swept collision detection. The ship is 10% of its original map size (55% smaller than the previous version), with a matching collision radius, fine coastline outlines, and a separate locator label. Compass headings account for latitude; distances and the zoom-aware scale use geographic nautical miles, with three nautical miles per sea league. Ship size, travel time, wind, rocks, and sea ice are stylized. The star view is an educational illustration rather than an astronomical simulation.

Voyage progress is saved to `uncharted-globe-v3` in browser local storage. Existing geographic v2 saves are migrated by their latitude/longitude, including the explored trail. Earlier save keys remain available. Settings include an expedition reset.

## Navigation checks

With Vite running, execute `await import('/tests/navigation.test.js').then(m => m.runNavigationTests())` in the browser console. This checks geographic coverage, both dateline crossings, swept rock/land collisions, sea-ice stops, and water-only routes to the Spice Lands.

Channel checks additionally simulate completed passages through Malacca/Singapore, Gibraltar, Sunda, Lombok, Bab el-Mandeb, Hormuz, the English Channel, and the Bosporus/Dardanelles. These straits are widened for gameplay. The local pilot uses simplified assisted towing/warping to avoid upwind tacks inside the channel.

Built with vanilla JavaScript and Vite. All map artwork is drawn in code; fonts are loaded from Google Fonts with local fallbacks.
