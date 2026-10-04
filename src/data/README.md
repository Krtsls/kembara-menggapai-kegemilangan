# Coastline data

`land.json` contains all 6,837 polygons from **Natural Earth, 1:10m physical land** (public domain), rounded to four decimal places. A 0.008-degree simplification removes sub-pixel vertices while retaining bays, headlands, polygon holes, and small islands. This replaces the previous 1:50m dataset.

Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_land.geojson

Natural Earth: https://www.naturalearthdata.com/about/terms-of-use/

To regenerate, download the source and run `node scripts/prepare-geography.mjs <path-to-ne_10m_land.geojson>`.

The game uses a global equirectangular chart from 180°W to 180°E, 90°N to 90°S. Real geographic coordinates are projected at 20 world units per degree. East/west movement, collision queries, route planning, and map rendering wrap across the dateline. Latitude affects geographic distance and compass heading; scenery symbols and sailing time are stylized for gameplay.

Coastal rocks and the visible polar sea-ice bands are gameplay obstacles, not surveyed geographic data. Sea ice stops a sailing caravel before the pole; there is no artificial ocean-edge bounce.

`src/straits.js` defines widened gameplay corridors along eight major sea passages. They are cut into both the rendered land and the collision mask, so the visible channel matches navigable water. These adjusted strait widths are not geographically exact; the base coastline dataset remains intact.
