# Musuwo Mutare QGIS simulation

## A. Architecture summary

`run_musuwo_simulation.py` is a single, copy-paste-ready PyQGIS master script.
It validates and clips the supplied national data, creates a cached local road
graph, simulates population-weighted businesses/orders, routes each assigned
order, applies configurable fee/serviceability rules, produces planning layers,
exports a GeoPackage plus CSV/JSON summaries, organizes the QGIS layer tree,
and saves a `.qgz` project.

The OSM XYZ layer is visual only. The supplied vector road shapefile is the
local routing network. No raster basemap is used for routing.

## B. Required datasets and audited defaults

Already unpacked under `data/`:

- `admin/ZWE_adm2.shp`: WGS84 polygons. `NAME_2 = Mutare` selects the supplied
  Mutare District boundary.
- `roads/ZWE_roads.shp`: WGS84 line network.
- `population/zwe_pop.tif`: population weighting raster.
- `elevation/ZWE_alt.tif`: DEM.

Businesses are optional; blank `BUSINESS_PATH` activates simulation mode.

## C. Assumptions

- EPSG:32736 is used for all distance calculations.
- Speeds, vehicle limits, demand, fees, serviceability and pickup scores are
  configurable simulation assumptions—not measured Musuwo/Mutare performance.
- The supplied ADM2 polygon represents Mutare District, not a surveyed city
  operating boundary.
- The supplied roads are treated as the routing source. Their provenance must
  be checked against their archive licence; the script does not mislabel raster
  OSM tiles as a network.

## D. File structure

```text
qgis_musuwo/
  run_musuwo_simulation.py
  README_QGIS.md
  data/admin/
  data/roads/
  data/population/
  data/elevation/
  MUSUWO_MUTARE_SIMULATION_OUTPUT/   # created at run time
```

## E. Complete code

The complete implementation is `run_musuwo_simulation.py`; it contains no
external pip dependencies and uses QGIS/PyQGIS plus bundled Processing/GDAL.
All editable parameters are in the section at the top.

## F. Step-by-step QGIS run instructions

1. Install/open QGIS 3.28 or newer and enable the Processing plugin.
2. Keep this folder structure intact.
3. Review the configuration section, especially counts, vehicle, fees and road
   class field. The script prints detected road fields.
4. Open **Plugins > Python Console**, click **Show Editor**, then open
   `D:\DEV\BF_Mutare\qgis_musuwo\run_musuwo_simulation.py`.
5. Click **Run Script**. Alternatively paste this one line into the console:

   ```python
   exec(compile(open(r"D:\DEV\BF_Mutare\qgis_musuwo\run_musuwo_simulation.py", encoding="utf-8").read(), r"D:\DEV\BF_Mutare\qgis_musuwo\run_musuwo_simulation.py", "exec"))
   ```

6. Read console warnings/errors. Successful output is written beneath
   `MUSUWO_MUTARE_SIMULATION_OUTPUT`.
7. Change `NUM_ORDERS` to 100, 500 or 1000 and rerun. The cached-graph design
   avoids rebuilding the road graph per order.
8. Change `VEHICLE_MODE` to `bicycle`, `motorbike`, or `car` and rerun.
9. To use real businesses, set `BUSINESS_PATH`, then fill
   `BUSINESS_FIELD_MAP`. Required id/name/category fields fail clearly if absent.
10. To use newer OSM vectors, import a Zimbabwe/Mutare `.pbf` into a line
    GeoPackage in QGIS, point `ROAD_PATH` to it, and set `ROAD_TYPE_FIELD` and
    `ONEWAY_FIELD`. The run remains fully local afterward.

## G. Expected output layers

- `mutare_boundary`
- `osm_roads_clean`
- `musuwo_businesses`
- `musuwo_orders`
- `musuwo_routes` (actual graph path geometry where connected)
- `musuwo_service_zones` (circular screening buffers)
- `musuwo_demand_hotspots` (grid counts)
- `musuwo_pickup_candidates`
- clipped population/elevation GeoTIFFs
- OSM Standard XYZ visual basemap

CSV exports are `simulation_summary.csv`, `business_summary.csv`,
`order_summary.csv`, and `pickup_candidate_summary.csv`; reproducibility inputs
are captured in `simulation_config.json`.

## H. Validation checklist

- Confirm QGIS loads all four required inputs.
- Confirm the console reports exactly one Mutare ADM2 feature.
- Inspect the printed road fields and verify road-class/one-way mapping.
- Confirm the project CRS is EPSG:32736.
- Spot-check routes against roads and investigate `NO_NETWORK_ROUTE` results.
- Confirm raster layers overlap the boundary and contain plausible values.
- Treat all simulated outputs distinctly from the supplied real inputs.

## I. Known limitations

- ADM2 is broader than Mutare city; replace it with a local municipal boundary
  before operational analysis.
- Circular buffers are explicitly not road-network isochrones.
- Assignment uses nearest straight-line eligible merchant, followed by genuine
  road routing. It does not test every merchant for minimum network time.
- DEM enrichment provides endpoint elevation difference. Cumulative ascent,
  descent and slope require route densification/sampling and are deferred.
- Pickup terrain score is neutral in V1; candidate sites require field review.
- Speeds exclude congestion, junction delay and live closures. Snapping can
  connect a point to the nearest reachable segment; inspect outliers.
- A graph is cached, but Dijkstra is still calculated once per assigned
  business. A 1000-order run is practical; very large studies should use
  pgRouting/OSRM/Valhalla.

## J. Later connection to Musuwo/PostGIS

Load the GeoPackage layers with QGIS DB Manager or `ogr2ogr`. Store businesses,
orders and route results in separate schemas, preserve the simulation run ID
and configuration JSON, and use PostGIS `geometry(...,32736)` plus GiST indexes.
For production routing, import current OSM with `osm2pgrouting` or `imposm`, use
pgRouting for shortest paths/service areas, and expose versioned server-side
endpoints. Keep fee/serviceability policy in application tables rather than SQL
constants, distinguish simulated from observed records, and validate travel
models against real rider telemetry only with consent and retention controls.
