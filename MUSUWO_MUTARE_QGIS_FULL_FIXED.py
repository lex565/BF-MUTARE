"""Musuwo Mutare delivery/location-intelligence simulation.

Run inside QGIS (3.28+ recommended). All monetary, speed, demand and fee values
are simulation assumptions, not observed Musuwo performance.
"""
from qgis.PyQt.QtCore import QVariant, QDateTime, Qt
from qgis.PyQt.QtGui import QColor
from qgis.core import (
    QgsApplication, QgsCoordinateReferenceSystem, QgsCoordinateTransform,
    QgsFeature, QgsField, QgsFields, QgsGeometry, QgsMarkerSymbol,
    QgsLineSymbol, QgsFillSymbol, QgsProject, QgsRasterLayer, QgsRectangle,
    QgsRendererRange, QgsRendererCategory, QgsCategorizedSymbolRenderer,
    QgsGraduatedSymbolRenderer, QgsSingleSymbolRenderer, Qgis,
    QgsSpatialIndex, QgsVectorFileWriter, QgsVectorLayer, QgsWkbTypes,
)
from qgis.analysis import (
    QgsGraphAnalyzer, QgsGraphBuilder, QgsNetworkDistanceStrategy,
    QgsNetworkSpeedStrategy, QgsVectorLayerDirector,
)
import processing
import csv, json, math, os, random, statistics, traceback
from collections import Counter, defaultdict


# =============================================================================
# USER CONFIGURATION (edit only this section for a normal run)
# =============================================================================
# QGIS's Python editor executes unsaved/scratch buffers through a temporary
# file, so __file__ may incorrectly point into AppData\Local\Temp. Keep this
# explicit and change it only if the project folder is moved.
PROJECT_DIR = r"D:\DEV\BF_Mutare\qgis_musuwo"
SCRIPT_DIR = PROJECT_DIR
DATA_DIR = os.path.join(PROJECT_DIR, "data")
OUTPUT_DIR = os.path.join(PROJECT_DIR, "MUSUWO_MUTARE_SIMULATION_OUTPUT")
GPKG_PATH = os.path.join(OUTPUT_DIR, "musuwo_mutare_simulation.gpkg")
PROJECT_PATH = os.path.join(OUTPUT_DIR, "Musuwo_Mutare_Delivery_Simulation.qgz")

ADMIN_PATH = os.path.join(DATA_DIR, "admin", "ZWE_adm2.shp")
BOUNDARY_NAME_FIELD = "NAME_2"
BOUNDARY_NAME_VALUE = "Mutare"
ROAD_PATH = os.path.join(DATA_DIR, "mutare_osm_roads.gpkg")
POPULATION_PATH = os.path.join(DATA_DIR, "population", "zwe_pop.tif")
DEM_PATH = os.path.join(DATA_DIR, "elevation", "ZWE_alt.tif")
BUSINESS_PATH = ""                 # optional point vector; blank = simulate
BUSINESS_FIELD_MAP = {"id": "", "name": "", "category": "", "delivers": ""}

METRIC_CRS = "EPSG:32736"
ROAD_BUFFER_M = 3000
NUM_BUSINESSES = 24
NUM_ORDERS = 100
RANDOM_SEED = 20260821
VEHICLE_MODE = "motorbike"         # bicycle | motorbike | car
ASSIGNMENT_MODE = "category_then_nearest"  # nearest | category_then_nearest
DELIVERY_FEE_MODEL = "distance_band"       # distance_band | base_per_km
USE_POPULATION_WEIGHTING = True
POPULATION_BAND = 1
DEM_BAND = 1
SAMPLING_CANDIDATE_MULTIPLIER = 25
MAX_SNAP_DISTANCE_M = 1500
GRID_SIZE_M = 2000
NUM_PICKUP_CANDIDATES = 12
OVERWRITE_OUTPUTS = True
SAVE_PROJECT = True
USE_URBAN_OPERATING_AREA = True
# Explicit simulated operating envelope, fully covered by validated OSM tiles.
# Order is xmin, ymin, xmax, ymax in EPSG:4326; this is NOT an official boundary.
URBAN_BBOX_WGS84 = (32.55, -19.10, 32.675, -18.9125)
ANIMATION_FRAMES_PER_ROUTE = 31
ANIMATION_ORDER_STAGGER_SECONDS = 20

INCLUDE_ROAD_TYPES = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "residential", "unclassified", "service", "living_street", "track",
    "road", "other",
}
ROAD_TYPE_FIELD = "type"           # script also auto-detects common alternatives
ONEWAY_FIELD = "oneway"            # blank/missing safely means two-way
ROAD_SPEEDS = {                     # assumed uncongested simulation speeds, km/h
    "motorway": 80, "trunk": 70, "primary": 60, "secondary": 50,
    "tertiary": 40, "residential": 30, "unclassified": 30,
    "service": 20, "living_street": 15, "track": 15, "road": 25,
    "other": 25,
}
DELIVERY_MODES = {
    "bicycle": {"speed_multiplier": .55, "max_distance_km": 8,
                "max_time_min": 60, "base_fee": 1.0, "per_km": .35,
                "terrain_surcharge_per_100m": .20},
    "motorbike": {"speed_multiplier": .85, "max_distance_km": 15,
                  "max_time_min": 55, "base_fee": 1.5, "per_km": .45,
                  "terrain_surcharge_per_100m": .10},
    "car": {"speed_multiplier": .75, "max_distance_km": 20,
            "max_time_min": 65, "base_fee": 2.0, "per_km": .55,
            "terrain_surcharge_per_100m": .05},
}
DISTANCE_BANDS = [(2, 1.50), (5, 2.50), (10, 4.00), (15, 6.00), (9999, 8.00)]
CATEGORIES = ["Groceries", "Fashion", "Food", "Electronics", "Beauty", "Books", "Other"]


def log(message):
    print("[MUSUWO] " + str(message))


def warn(message):
    print("[MUSUWO WARNING] " + str(message))


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def vector(path, name):
    require(os.path.exists(path), "Missing file: " + path)
    layer = QgsVectorLayer(path, name, "ogr")
    require(layer.isValid(), "QGIS could not load vector: " + path)
    return layer


def raster(path, name):
    require(os.path.exists(path), "Missing file: " + path)
    layer = QgsRasterLayer(path, name)
    require(layer.isValid(), "QGIS could not load raster: " + path)
    return layer


def field_name(layer, preferred, candidates, required=False):
    names = layer.fields().names()
    lookup = {n.lower(): n for n in names}
    for value in [preferred] + candidates:
        if value and value.lower() in lookup:
            return lookup[value.lower()]
    if required:
        raise RuntimeError("Required field not found. Supply one of %s for %s; available: %s" %
                           (candidates, layer.name(), names))
    return ""


def save_layer(layer, layer_name):
    opts = QgsVectorFileWriter.SaveVectorOptions()
    opts.driverName = "GPKG"
    opts.layerName = layer_name
    opts.actionOnExistingFile = (QgsVectorFileWriter.CreateOrOverwriteLayer
                                 if os.path.exists(GPKG_PATH)
                                 else QgsVectorFileWriter.CreateOrOverwriteFile)
    result = QgsVectorFileWriter.writeAsVectorFormatV3(
        layer, GPKG_PATH, QgsProject.instance().transformContext(), opts)
    require(result[0] == QgsVectorFileWriter.NoError,
            "Could not save %s: %s" % (layer_name, result))
    saved = QgsVectorLayer(GPKG_PATH + "|layername=" + layer_name, layer_name, "ogr")
    require(saved.isValid(), "Saved layer did not reload: " + layer_name)
    return saved


def memory_layer(geometry_type, name, crs, field_specs):
    layer = QgsVectorLayer("%s?crs=%s" % (geometry_type, crs.authid()), name, "memory")
    fields = [QgsField(n, t, len=l, prec=p) for n, t, l, p in field_specs]
    layer.dataProvider().addAttributes(fields)
    layer.updateFields()
    return layer


def transform_geometry(geom, source_crs, target_crs):
    result = QgsGeometry(geom)
    if source_crs != target_crs:
        result.transform(QgsCoordinateTransform(source_crs, target_crs, QgsProject.instance()))
    return result


def export_csv(path, headers, rows):
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def numeric_or_none(value):
    """Convert a QGIS value to float, treating NULL QVariant as missing."""
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def validate_inputs():
    require(VEHICLE_MODE in DELIVERY_MODES, "Unknown VEHICLE_MODE: " + VEHICLE_MODE)
    require(ASSIGNMENT_MODE in ("nearest", "category_then_nearest"), "Invalid ASSIGNMENT_MODE")
    require(DELIVERY_FEE_MODEL in ("distance_band", "base_per_km"), "Invalid DELIVERY_FEE_MODEL")
    for path in (ADMIN_PATH, ROAD_PATH, POPULATION_PATH, DEM_PATH):
        require(os.path.exists(path), "Required input does not exist: " + path)
    admin = vector(ADMIN_PATH, "Zimbabwe ADM2 source")
    require(QgsWkbTypes.geometryType(admin.wkbType()) == QgsWkbTypes.PolygonGeometry,
            "ADMIN_PATH must be a polygon layer")
    boundary_field = field_name(admin, BOUNDARY_NAME_FIELD, ["NAME_2", "name", "district"], True)
    matches = [f for f in admin.getFeatures() if str(f[boundary_field]).strip().lower() == BOUNDARY_NAME_VALUE.lower()]
    require(len(matches) == 1, "Expected exactly one boundary where %s=%s; found %d" %
            (boundary_field, BOUNDARY_NAME_VALUE, len(matches)))
    roads = vector(ROAD_PATH, "Zimbabwe roads source")
    require(QgsWkbTypes.geometryType(roads.wkbType()) == QgsWkbTypes.LineGeometry,
            "ROAD_PATH must be a line layer")
    pop = raster(POPULATION_PATH, "Zimbabwe population source")
    dem = raster(DEM_PATH, "Zimbabwe elevation source")
    log("Input audit: ADM CRS=%s; roads CRS=%s; population=%dx%d; DEM=%dx%d" %
        (admin.crs().authid(), roads.crs().authid(), pop.width(), pop.height(), dem.width(), dem.height()))
    log("Road fields: " + ", ".join(roads.fields().names()))
    return admin, matches[0], roads, pop, dem


def prepare_boundary(admin, feature, metric):
    out = memory_layer("MultiPolygon", "Mutare boundary", metric,
                       [("name", QVariant.String, 80, 0), ("source", QVariant.String, 80, 0)])
    feat = QgsFeature(out.fields())
    feat["name"] = BOUNDARY_NAME_VALUE
    source_geom = QgsGeometry(feature.geometry())
    source_label = "GADM ADM2 supplied archive"
    if USE_URBAN_OPERATING_AREA:
        require(admin.crs().authid() == "EPSG:4326",
                "URBAN_BBOX_WGS84 requires the configured admin source to be EPSG:4326")
        xmin, ymin, xmax, ymax = URBAN_BBOX_WGS84
        source_geom = source_geom.intersection(QgsGeometry.fromRect(QgsRectangle(xmin, ymin, xmax, ymax)))
        require(not source_geom.isEmpty(), "Urban operating envelope does not overlap Mutare ADM2")
        source_label = "SIMULATED urban operating envelope clipped to supplied ADM2"
    feat["source"] = source_label
    feat.setGeometry(transform_geometry(source_geom, admin.crs(), metric))
    out.dataProvider().addFeature(feat)
    return save_layer(out, "mutare_boundary")


def prepare_roads(source, boundary, metric):
    log("Reprojecting, repairing, exploding and clipping roads...")
    reproj = processing.run("native:reprojectlayer", {
        "INPUT": source, "TARGET_CRS": metric, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    fixed = processing.run("native:fixgeometries", {
        "INPUT": reproj, "METHOD": 1, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    single = processing.run("native:multiparttosingleparts", {
        "INPUT": fixed, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    buffered = processing.run("native:buffer", {
        "INPUT": boundary, "DISTANCE": ROAD_BUFFER_M, "SEGMENTS": 8,
        "DISSOLVE": True, "END_CAP_STYLE": 0, "JOIN_STYLE": 0,
        "MITER_LIMIT": 2, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    clipped = processing.run("native:clip", {
        "INPUT": single, "OVERLAY": buffered, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    type_field = field_name(clipped, ROAD_TYPE_FIELD,
                            ["highway", "fclass", "type", "road_type", "RTT_DESCRI"])
    oneway_field = field_name(clipped, ONEWAY_FIELD, ["oneway", "one_way", "dir"])
    if not type_field:
        warn("No road-class field detected; all supplied roads use fallback class/speed 'other'.")
    specs = [(f.name(), f.type(), f.length(), f.precision()) for f in clipped.fields()]
    specs += [("road_class", QVariant.String, 30, 0), ("speed_kmh", QVariant.Double, 10, 2),
              ("direction", QVariant.String, 1, 0)]
    out = memory_layer("MultiLineString", "OSM/supplied roads clean", metric, specs)
    mode = DELIVERY_MODES[VEHICLE_MODE]
    seen = set()
    features = []
    for src in clipped.getFeatures():
        if not src.hasGeometry() or src.geometry().isNull() or src.geometry().length() < 1:
            continue
        raw = str(src[type_field]).lower().strip() if type_field else "other"
        road_class = next((k for k in ROAD_SPEEDS if k in raw), "other")
        if road_class not in INCLUDE_ROAD_TYPES:
            continue
        key = src.geometry().asWkb()
        if key in seen:
            continue
        seen.add(key)
        feat = QgsFeature(out.fields())
        for fld in clipped.fields():
            feat[fld.name()] = src[fld.name()]
        feat["road_class"] = road_class
        feat["speed_kmh"] = ROAD_SPEEDS[road_class] * mode["speed_multiplier"]
        raw_oneway = str(src[oneway_field]).lower().strip() if oneway_field else ""
        feat["direction"] = "F" if raw_oneway in ("yes", "1", "true", "ft") else ("T" if raw_oneway in ("-1", "tf") else "B")
        feat.setGeometry(src.geometry())
        features.append(feat)
    out.dataProvider().addFeatures(features)
    require(out.featureCount() > 0, "No usable roads remain after clipping/filtering")
    log("Clean road features: %d" % out.featureCount())
    return save_layer(out, "osm_roads_clean"), buffered


def clip_rasters(pop, dem, boundary):
    outputs = []
    for layer, name in ((pop, "population_mutare.tif"), (dem, "elevation_mutare.tif")):
        path = os.path.join(OUTPUT_DIR, name)
        try:
            # Preserve the raster's native CRS/resolution. QgsRasterDataProvider
            # handles CRS transformation when points are sampled later. Forcing
            # a degree-based source resolution into UTM can produce an empty or
            # impractically large raster on some GDAL/QGIS versions.
            result = processing.run("gdal:cliprasterbymasklayer", {
                "INPUT": layer, "MASK": boundary, "SOURCE_CRS": None, "TARGET_CRS": None,
                "TARGET_EXTENT": None, "NODATA": -9999, "ALPHA_BAND": False,
                "CROP_TO_CUTLINE": True, "KEEP_RESOLUTION": True, "SET_RESOLUTION": False,
                "X_RESOLUTION": None, "Y_RESOLUTION": None, "MULTITHREADING": True,
                "OPTIONS": "", "DATA_TYPE": 0, "EXTRA": "", "OUTPUT": path})["OUTPUT"]
            outputs.append(QgsRasterLayer(result, os.path.splitext(name)[0]))
        except Exception as exc:
            warn("Raster clip failed for %s; using source raster: %s" % (name, exc))
            outputs.append(layer)
    return outputs


def sample_raster(layer, point, point_crs, band=1):
    p = point
    if layer.crs() != point_crs:
        p = QgsCoordinateTransform(point_crs, layer.crs(), QgsProject.instance()).transform(point)
    value, ok = layer.dataProvider().sample(p, band)
    return float(value) if ok and value is not None and math.isfinite(float(value)) and float(value) != -9999 else None


def random_points_weighted(boundary, population, count, rng):
    geom = next(boundary.getFeatures()).geometry()
    extent = geom.boundingBox()
    candidate_count = max(count * SAMPLING_CANDIDATE_MULTIPLIER, 500)
    candidates, weights = [], []
    attempts = 0
    while len(candidates) < candidate_count and attempts < candidate_count * 30:
        attempts += 1
        p = type(extent.center())(rng.uniform(extent.xMinimum(), extent.xMaximum()),
                                  rng.uniform(extent.yMinimum(), extent.yMaximum()))
        if not geom.contains(QgsGeometry.fromPointXY(p)):
            continue
        value = sample_raster(population, p, boundary.crs(), POPULATION_BAND) if USE_POPULATION_WEIGHTING else None
        candidates.append(p)
        weights.append(max(0.0, value or 0.0))
    require(len(candidates) >= count, "Could not generate enough points inside boundary")
    if sum(weights) <= 0:
        warn("Population raster has no positive readable values in boundary; using uniform sampling.")
        return rng.sample(candidates, count), [1.0] * count
    chosen = rng.choices(range(len(candidates)), weights=weights, k=count)
    return [candidates[i] for i in chosen], [weights[i] for i in chosen]


def create_businesses(boundary, population, dem, rng):
    specs = [("business_id", QVariant.String, 20, 0), ("name", QVariant.String, 100, 0),
             ("category", QVariant.String, 40, 0), ("delivers", QVariant.Bool, 1, 0),
             ("elevation_m", QVariant.Double, 12, 2), ("data_source", QVariant.String, 20, 0)]
    out = memory_layer("Point", "Musuwo businesses", boundary.crs(), specs)
    feats = []
    if BUSINESS_PATH:
        source = vector(BUSINESS_PATH, "Real businesses")
        require(QgsWkbTypes.geometryType(source.wkbType()) == QgsWkbTypes.PointGeometry,
                "BUSINESS_PATH must contain points")
        mapping = {k: field_name(source, v, [k, "business_" + k], k in ("id", "name", "category"))
                   for k, v in BUSINESS_FIELD_MAP.items()}
        for i, src in enumerate(source.getFeatures(), 1):
            geom = transform_geometry(src.geometry(), source.crs(), boundary.crs())
            if not next(boundary.getFeatures()).geometry().contains(geom):
                continue
            p = geom.asPoint(); f = QgsFeature(out.fields())
            f["business_id"] = str(src[mapping["id"]]); f["name"] = str(src[mapping["name"]])
            f["category"] = str(src[mapping["category"]])
            f["delivers"] = bool(src[mapping["delivers"]]) if mapping["delivers"] else True
            f["elevation_m"] = sample_raster(dem, p, boundary.crs(), DEM_BAND)
            f["data_source"] = "REAL"; f.setGeometry(geom); feats.append(f)
    else:
        points, _ = random_points_weighted(boundary, population, NUM_BUSINESSES, rng)
        for i, p in enumerate(points, 1):
            f = QgsFeature(out.fields()); category = rng.choice(CATEGORIES)
            f["business_id"] = "B%04d" % i; f["name"] = "%s Merchant %02d" % (category, i)
            f["category"] = category; f["delivers"] = rng.random() > .08
            f["elevation_m"] = sample_raster(dem, p, boundary.crs(), DEM_BAND)
            f["data_source"] = "SIMULATED"; f.setGeometry(QgsGeometry.fromPointXY(p)); feats.append(f)
    out.dataProvider().addFeatures(feats)
    require(out.featureCount() > 0, "No businesses available inside Mutare boundary")
    return save_layer(out, "musuwo_businesses")


def create_orders(boundary, population, dem, businesses, rng):
    specs = [("customer_id", QVariant.String, 20, 0), ("order_id", QVariant.String, 20, 0),
             ("wanted_category", QVariant.String, 40, 0), ("business_id", QVariant.String, 20, 0),
             ("business_name", QVariant.String, 100, 0), ("straight_km", QVariant.Double, 12, 3),
             ("road_km", QVariant.Double, 12, 3), ("travel_min", QVariant.Double, 12, 2),
             ("delivery_fee", QVariant.Double, 12, 2), ("serviceable", QVariant.Bool, 1, 0),
             ("reason", QVariant.String, 40, 0), ("pop_zone", QVariant.String, 10, 0),
             ("elevation_m", QVariant.Double, 12, 2), ("elev_diff_m", QVariant.Double, 12, 2),
             ("demand_weight", QVariant.Double, 16, 4), ("vehicle", QVariant.String, 20, 0)]
    out = memory_layer("Point", "Musuwo customers/orders", boundary.crs(), specs)
    points, weights = random_points_weighted(boundary, population, NUM_ORDERS, rng)
    positive = sorted(w for w in weights if w > 0)
    q1 = positive[len(positive)//3] if positive else 0; q2 = positive[2*len(positive)//3] if positive else 0
    biz = [f for f in businesses.getFeatures()]
    feats = []
    for i, (p, weight) in enumerate(zip(points, weights), 1):
        wanted = rng.choice(CATEGORIES)
        eligible = [b for b in biz if bool(b["delivers"]) and
                    (ASSIGNMENT_MODE == "nearest" or str(b["category"]) == wanted)]
        f = QgsFeature(out.fields()); f["customer_id"] = "C%05d" % i; f["order_id"] = "O%05d" % i
        f["wanted_category"] = wanted; f["road_km"] = None; f["travel_min"] = None
        f["delivery_fee"] = None; f["serviceable"] = False; f["vehicle"] = VEHICLE_MODE
        f["demand_weight"] = weight; f["pop_zone"] = "HIGH" if weight >= q2 else ("MEDIUM" if weight >= q1 else "LOW")
        elev = sample_raster(dem, p, boundary.crs(), DEM_BAND); f["elevation_m"] = elev
        if eligible:
            nearest = min(eligible, key=lambda b: b.geometry().distance(QgsGeometry.fromPointXY(p)))
            f["business_id"] = nearest["business_id"]; f["business_name"] = nearest["name"]
            f["straight_km"] = nearest.geometry().distance(QgsGeometry.fromPointXY(p)) / 1000
            be = numeric_or_none(nearest["elevation_m"])
            ce = numeric_or_none(elev)
            f["elev_diff_m"] = abs(ce - be) if ce is not None and be is not None else None
            f["reason"] = "PENDING_ROUTE"
        else:
            f["business_id"] = ""; f["business_name"] = ""; f["straight_km"] = None
            f["elev_diff_m"] = None; f["reason"] = "NO_MATCHING_BUSINESS"
        f.setGeometry(QgsGeometry.fromPointXY(p)); feats.append(f)
    out.dataProvider().addFeatures(feats)
    return out


def route_orders(roads, businesses, orders):
    log("Building one cached routing graph for all businesses and orders...")
    direction_idx = roads.fields().indexOf("direction")
    speed_idx = roads.fields().indexOf("speed_kmh")
    director = QgsVectorLayerDirector(roads, direction_idx, "F", "T", "B",
                                      QgsVectorLayerDirector.DirectionBoth)
    director.addStrategy(QgsNetworkSpeedStrategy(speed_idx, 25.0, 1000.0 / 3600.0))
    # Fourth argument is an ellipsoid identifier in the QGIS 3 API, not a
    # QgsUnitTypes.DistanceUnit value.
    builder = QgsGraphBuilder(roads.crs(), True, 0.0, "WGS84")
    biz_by_id = {str(f["business_id"]): f for f in businesses.getFeatures()}
    assigned = [f for f in orders.getFeatures() if str(f["business_id"])]
    biz_ids = sorted(set(str(f["business_id"]) for f in assigned))
    tie_points = [biz_by_id[b].geometry().asPoint() for b in biz_ids] + [f.geometry().asPoint() for f in assigned]
    tied = director.makeGraph(builder, tie_points)
    graph = builder.graph()
    route_specs = [("order_id", QVariant.String, 20, 0), ("customer_id", QVariant.String, 20, 0),
                   ("business_id", QVariant.String, 20, 0), ("business_name", QVariant.String, 100, 0),
                   ("vehicle", QVariant.String, 20, 0), ("road_km", QVariant.Double, 12, 3),
                   ("travel_min", QVariant.Double, 12, 2), ("delivery_fee", QVariant.Double, 12, 2),
                   ("serviceable", QVariant.Bool, 1, 0), ("elev_diff_m", QVariant.Double, 12, 2),
                   ("route_status", QVariant.String, 40, 0)]
    routes = memory_layer("MultiLineString", "Musuwo delivery routes", roads.crs(), route_specs)
    tree_cache = {}
    order_updates = {}
    mode = DELIVERY_MODES[VEHICLE_MODE]
    for idx, order in enumerate(assigned):
        bid = str(order["business_id"]); source_i = biz_ids.index(bid)
        source_vertex = graph.findVertex(tied[source_i])
        target_vertex = graph.findVertex(tied[len(biz_ids) + idx])
        if bid not in tree_cache:
            tree_cache[bid] = QgsGraphAnalyzer.dijkstra(graph, source_vertex, 0)
        tree, costs = tree_cache[bid]
        status = "OK"; line_parts = []; road_km = travel_min = fee = None
        if target_vertex < 0 or source_vertex < 0 or tree[target_vertex] == -1:
            status = "NO_NETWORK_ROUTE"
        else:
            vertex = target_vertex; points = [graph.vertex(vertex).point()]
            while vertex != source_vertex:
                edge_id = tree[vertex]
                if edge_id < 0: break
                edge = graph.edge(edge_id); vertex = edge.fromVertex(); points.append(graph.vertex(vertex).point())
            points.reverse()
            geom = QgsGeometry.fromPolylineXY(points)
            road_km = geom.length() / 1000.0
            travel_min = float(costs[target_vertex]) / 60.0
            fee = delivery_fee(road_km, order["elev_diff_m"], mode)
            if road_km > mode["max_distance_km"]: status = "TOO_FAR"
            elif travel_min > mode["max_time_min"]: status = "TOO_SLOW"
            if geom and not geom.isEmpty(): line_parts = geom.asMultiPolyline() if geom.isMultipart() else [geom.asPolyline()]
        serviceable = status == "OK"
        order_updates[order.id()] = {"road_km": road_km, "travel_min": travel_min,
                                     "delivery_fee": fee, "serviceable": serviceable,
                                     "reason": "WITHIN_RANGE" if serviceable else status}
        if line_parts:
            rf = QgsFeature(routes.fields())
            for name in ("order_id", "customer_id", "business_id", "business_name", "elev_diff_m"):
                rf[name] = order[name]
            rf["vehicle"] = VEHICLE_MODE; rf["road_km"] = road_km; rf["travel_min"] = travel_min
            rf["delivery_fee"] = fee; rf["serviceable"] = serviceable; rf["route_status"] = status
            rf.setGeometry(QgsGeometry.fromMultiPolylineXY(line_parts)); routes.dataProvider().addFeature(rf)
    attribute_changes = {
        fid: {orders.fields().indexOf(k): v for k, v in values.items()}
        for fid, values in order_updates.items()
    }
    if attribute_changes:
        orders.dataProvider().changeAttributeValues(attribute_changes)
    return save_layer(orders, "musuwo_orders"), save_layer(routes, "musuwo_routes")


def delivery_fee(distance_km, elevation_difference, mode):
    if DELIVERY_FEE_MODEL == "distance_band":
        fee = next(value for upper, value in DISTANCE_BANDS if distance_km <= upper)
    else:
        fee = mode["base_fee"] + distance_km * mode["per_km"]
    if elevation_difference:
        fee += (float(elevation_difference) / 100.0) * mode["terrain_surcharge_per_100m"]
    return round(fee, 2)


def create_route_animation(routes):
    """Create time-stamped moving vehicle points along actual route geometry."""
    specs = [("frame_time", QVariant.DateTime, 0, 0), ("order_id", QVariant.String, 20, 0),
             ("business_id", QVariant.String, 20, 0), ("vehicle", QVariant.String, 20, 0),
             ("progress_pct", QVariant.Double, 10, 2), ("serviceable", QVariant.Bool, 1, 0)]
    out = memory_layer("Point", "Musuwo Animated Delivery Vehicles", routes.crs(), specs)
    base = QDateTime.fromString("2026-08-21T08:00:00Z", Qt.ISODate)
    feats = []
    for route_index, route in enumerate(routes.getFeatures()):
        geom = route.geometry()
        if not geom or geom.isEmpty() or geom.length() <= 0:
            continue
        travel_seconds = max(60, int(float(route["travel_min"] or 1) * 60))
        start = base.addSecs(route_index * ANIMATION_ORDER_STAGGER_SECONDS)
        for frame in range(ANIMATION_FRAMES_PER_ROUTE):
            fraction = frame / max(1, ANIMATION_FRAMES_PER_ROUTE - 1)
            point_geom = geom.interpolate(geom.length() * fraction)
            if point_geom.isEmpty():
                continue
            f = QgsFeature(out.fields())
            f["frame_time"] = start.addSecs(int(travel_seconds * fraction))
            f["order_id"] = route["order_id"]; f["business_id"] = route["business_id"]
            f["vehicle"] = route["vehicle"]; f["progress_pct"] = fraction * 100
            f["serviceable"] = route["serviceable"]; f.setGeometry(point_geom); feats.append(f)
    out.dataProvider().addFeatures(feats)
    saved = save_layer(out, "musuwo_delivery_animation")
    temporal = saved.temporalProperties()
    temporal.setIsActive(True)
    temporal.setMode(Qgis.VectorTemporalMode.FeatureDateTimeInstantFromField)
    temporal.setStartField("frame_time")
    return saved


def analysis_layers(boundary, roads, businesses, orders):
    zones = processing.run("native:buffer", {"INPUT": businesses,
        "DISTANCE": DELIVERY_MODES[VEHICLE_MODE]["max_distance_km"] * 1000,
        "SEGMENTS": 24, "DISSOLVE": False, "END_CAP_STYLE": 0, "JOIN_STYLE": 0,
        "MITER_LIMIT": 2, "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    zones.setName("Circular service zones (not isochrones)")
    zones = save_layer(zones, "musuwo_service_zones")
    grid = processing.run("native:creategrid", {"TYPE": 2, "EXTENT": boundary.extent(),
        "HSPACING": GRID_SIZE_M, "VSPACING": GRID_SIZE_M, "HOVERLAY": 0, "VOVERLAY": 0,
        "CRS": boundary.crs(), "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    grid = processing.run("native:clip", {"INPUT": grid, "OVERLAY": boundary,
                                          "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    hotspots = processing.run("native:countpointsinpolygon", {"POLYGONS": grid, "POINTS": orders,
        "WEIGHT": None, "CLASSFIELD": None, "FIELD": "order_count",
        "OUTPUT": "TEMPORARY_OUTPUT"})["OUTPUT"]
    hotspots.setName("Musuwo Demand Hotspots")
    hotspots = save_layer(hotspots, "musuwo_demand_hotspots")
    candidates = memory_layer("Point", "Musuwo Pickup Candidates", boundary.crs(),
        [("candidate_id", QVariant.String, 20, 0), ("demand_score", QVariant.Double, 10, 3),
         ("road_access_score", QVariant.Double, 10, 3), ("business_access_score", QVariant.Double, 10, 3),
         ("terrain_score", QVariant.Double, 10, 3), ("overall_score", QVariant.Double, 10, 3),
         ("planning_note", QVariant.String, 120, 0)])
    road_index = QgsSpatialIndex(roads.getFeatures()); biz_index = QgsSpatialIndex(businesses.getFeatures())
    cells = sorted(list(hotspots.getFeatures()), key=lambda f: float(f["order_count"] or 0), reverse=True)
    max_demand = max([float(f["order_count"] or 0) for f in cells] + [1])
    feats = []
    for i, cell in enumerate(cells[:NUM_PICKUP_CANDIDATES], 1):
        p = cell.geometry().pointOnSurface().asPoint(); pg = QgsGeometry.fromPointXY(p)
        rn = road_index.nearestNeighbor(p, 1, 3000); bn = biz_index.nearestNeighbor(p, 5, 5000)
        road_dist = roads.getFeature(rn[0]).geometry().distance(pg) if rn else 3000
        biz_dist = statistics.mean([businesses.getFeature(fid).geometry().distance(pg) for fid in bn]) if bn else 5000
        demand = float(cell["order_count"] or 0) / max_demand
        road_score = max(0, 1 - road_dist / 3000); biz_score = max(0, 1 - biz_dist / 5000)
        terrain_score = 1.0  # conservative V1: reported explicitly; no local slope raster derived
        overall = .55*demand + .25*road_score + .15*biz_score + .05*terrain_score
        f = QgsFeature(candidates.fields()); f["candidate_id"] = "P%03d" % i
        f["demand_score"] = demand; f["road_access_score"] = road_score
        f["business_access_score"] = biz_score; f["terrain_score"] = terrain_score
        f["overall_score"] = overall; f["planning_note"] = "Simulated screening candidate; field validation required"
        f.setGeometry(pg); feats.append(f)
    candidates.dataProvider().addFeatures(feats)
    return zones, hotspots, save_layer(candidates, "musuwo_pickup_candidates")


def write_summaries(businesses, orders, pickups):
    order_rows = []
    for f in orders.getFeatures():
        row = {name: f[name] for name in orders.fields().names()}
        row.update({"x": f.geometry().asPoint().x(), "y": f.geometry().asPoint().y()})
        order_rows.append(row)
    export_csv(os.path.join(OUTPUT_DIR, "order_summary.csv"),
               orders.fields().names() + ["x", "y"], order_rows)
    by_business = defaultdict(list)
    for row in order_rows:
        if row["business_id"]: by_business[str(row["business_id"])].append(row)
    business_rows = []
    for b in businesses.getFeatures():
        rows = by_business[str(b["business_id"])]
        serviced = [r for r in rows if bool(r["serviceable"])]
        distances = [v for r in serviced if (v := numeric_or_none(r["road_km"])) is not None]
        times = [v for r in serviced if (v := numeric_or_none(r["travel_min"])) is not None]
        fees = [v for r in serviced if (v := numeric_or_none(r["delivery_fee"])) is not None]
        business_rows.append({"business_id": b["business_id"], "business_name": b["name"],
            "category": b["category"], "assigned_orders": len(rows), "serviceable_orders": len(serviced),
            "average_delivery_distance_km": round(statistics.mean(distances), 3) if distances else "",
            "average_delivery_time_min": round(statistics.mean(times), 2) if times else "",
            "simulated_delivery_revenue": round(sum(fees), 2), "customer_catchment": len(rows),
            "demand_score": len(serviced)})
    headers = ["business_id", "business_name", "category", "assigned_orders", "serviceable_orders",
               "average_delivery_distance_km", "average_delivery_time_min", "simulated_delivery_revenue",
               "customer_catchment", "demand_score"]
    export_csv(os.path.join(OUTPUT_DIR, "business_summary.csv"), headers, business_rows)
    pickup_rows = [{name: f[name] for name in pickups.fields().names()} for f in pickups.getFeatures()]
    export_csv(os.path.join(OUTPUT_DIR, "pickup_candidate_summary.csv"), pickups.fields().names(), pickup_rows)
    routed = [r for r in order_rows if numeric_or_none(r["road_km"]) is not None]; serviced = [r for r in order_rows if bool(r["serviceable"])]
    distances = [numeric_or_none(r["road_km"]) for r in routed]
    times = [v for r in routed if (v := numeric_or_none(r["travel_min"])) is not None]
    fees = [v for r in serviced if (v := numeric_or_none(r["delivery_fee"])) is not None]
    summary = {
        "simulation_warning": "All demand, speeds, fees and performance values are simulated assumptions.",
        "businesses": businesses.featureCount(), "orders": len(order_rows), "serviceable_orders": len(serviced),
        "unserviceable_orders": len(order_rows)-len(serviced),
        "serviceability_percent": round(100*len(serviced)/max(1,len(order_rows)), 2),
        "average_road_distance_km": round(statistics.mean(distances),3) if distances else "",
        "median_road_distance_km": round(statistics.median(distances),3) if distances else "",
        "average_travel_time_min": round(statistics.mean(times),2) if times else "",
        "median_travel_time_min": round(statistics.median(times),2) if times else "",
        "average_delivery_fee": round(statistics.mean(fees),2) if fees else "",
        "total_simulated_delivery_revenue": round(sum(fees),2),
        "orders_by_category": json.dumps(dict(Counter(str(r["wanted_category"]) for r in order_rows))),
        "orders_by_population_zone": json.dumps(dict(Counter(str(r["pop_zone"]) for r in order_rows))),
        "unserviceable_reasons": json.dumps(dict(Counter(str(r["reason"]) for r in order_rows if not r["serviceable"])))
    }
    export_csv(os.path.join(OUTPUT_DIR, "simulation_summary.csv"), list(summary), [summary])
    return summary


def style_and_group(layers):
    project = QgsProject.instance(); root = project.layerTreeRoot()
    group_names = ["01_BASEMAP", "02_BOUNDARIES", "03_ROADS", "04_POPULATION", "05_ELEVATION",
                   "06_BUSINESSES", "07_CUSTOMERS_ORDERS", "08_ROUTES", "09_SERVICE_ZONES",
                   "10_DEMAND", "11_PICKUP_CANDIDATES"]
    # Insert each group at the top. Iterating 01..11 therefore leaves 11 at
    # the top and the opaque XYZ basemap safely at the bottom of the draw stack.
    groups = {n: (root.findGroup(n) or root.insertGroup(0, n)) for n in group_names}
    osm = QgsRasterLayer("type=xyz&url=https://tile.openstreetmap.org/{z}/{x}/{y}.png&zmax=19&zmin=0",
                         "OpenStreetMap Standard", "wms")
    if osm.isValid(): project.addMapLayer(osm, False); groups["01_BASEMAP"].addLayer(osm)
    else: warn("OSM XYZ basemap could not initialize; vector routing remains local and unaffected.")
    mapping = {
        "boundary": "02_BOUNDARIES", "roads": "03_ROADS", "population": "04_POPULATION",
        "elevation": "05_ELEVATION", "businesses": "06_BUSINESSES", "orders": "07_CUSTOMERS_ORDERS",
        "routes": "08_ROUTES", "animation": "08_ROUTES", "zones": "09_SERVICE_ZONES", "hotspots": "10_DEMAND", "pickups": "11_PICKUP_CANDIDATES"}
    for key, layer in layers.items():
        if layer and layer.isValid(): project.addMapLayer(layer, False); groups[mapping[key]].addLayer(layer)
    layers["businesses"].setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple(
        {"name":"circle", "color":"230,80,45", "size":"3"})))
    order_categories = [
        QgsRendererCategory(True, QgsMarkerSymbol.createSimple(
            {"name":"circle", "color":"35,175,85", "outline_color":"255,255,255", "size":"2.4"}),
            "Serviceable"),
        QgsRendererCategory(False, QgsMarkerSymbol.createSimple(
            {"name":"cross", "color":"220,45,45", "size":"2.8"}), "Unserviceable"),
    ]
    layers["orders"].setRenderer(QgsCategorizedSymbolRenderer("serviceable", order_categories))
    layers["routes"].setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple(
        {"color":"255,145,0", "width":"0.6"})))
    layers["animation"].setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple(
        {"name":"circle", "color":"255,30,30", "outline_color":"255,255,255", "size":"4"})))
    layers["zones"].setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple(
        {"color":"70,170,100,35", "outline_color":"70,170,100,120", "outline_width":"0.2"})))
    hotspot_ranges = [
        QgsRendererRange(0, 1, QgsFillSymbol.createSimple(
            {"color":"255,245,210,70", "outline_color":"180,180,180,80"}), "0–1 orders"),
        QgsRendererRange(1, 3, QgsFillSymbol.createSimple(
            {"color":"255,190,90,110", "outline_color":"180,120,50,100"}), "2–3 orders"),
        QgsRendererRange(3, 999999, QgsFillSymbol.createSimple(
            {"color":"210,35,35,150", "outline_color":"120,20,20,140"}), "4+ orders"),
    ]
    layers["hotspots"].setRenderer(QgsGraduatedSymbolRenderer("order_count", hotspot_ranges))
    layers["pickups"].setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple(
        {"name":"star", "color":"150,35,205", "outline_color":"255,255,255", "size":"5"})))
    layers["boundary"].setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple(
        {"color":"255,255,255,0", "outline_color":"20,20,20,220", "outline_width":"0.8"})))
    layers["roads"].setRenderer(QgsSingleSymbolRenderer(QgsLineSymbol.createSimple(
        {"color":"90,90,90,150", "width":"0.25"})))
    project.setCrs(QgsCoordinateReferenceSystem(METRIC_CRS))


def config_snapshot():
    return {"random_seed": RANDOM_SEED, "num_businesses": NUM_BUSINESSES, "num_orders": NUM_ORDERS,
        "vehicle_mode": VEHICLE_MODE, "assignment_mode": ASSIGNMENT_MODE,
        "delivery_fee_model": DELIVERY_FEE_MODEL, "metric_crs": METRIC_CRS,
        "road_buffer_m": ROAD_BUFFER_M, "grid_size_m": GRID_SIZE_M,
        "urban_operating_area": USE_URBAN_OPERATING_AREA,
        "urban_bbox_wgs84": URBAN_BBOX_WGS84,
        "input_paths": {"admin": ADMIN_PATH, "roads": ROAD_PATH, "population": POPULATION_PATH,
                        "dem": DEM_PATH, "businesses": BUSINESS_PATH or None},
        "road_speeds_assumed_kmh": ROAD_SPEEDS, "delivery_modes_assumed": DELIVERY_MODES,
        "distance_bands_assumed": DISTANCE_BANDS,
        "real_inputs": ["GADM administrative boundary", "supplied road vector", "population raster", "DEM"] + (["businesses"] if BUSINESS_PATH else []),
        "simulated_inputs": (["businesses"] if not BUSINESS_PATH else []) +
                            ["customers/orders", "fees", "speeds", "pickup candidates"]}


def main():
    rng = random.Random(RANDOM_SEED)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if os.path.exists(GPKG_PATH) and not OVERWRITE_OUTPUTS:
        raise RuntimeError("Output GeoPackage exists and OVERWRITE_OUTPUTS=False: " + GPKG_PATH)
    log("Starting reproducible run; seed=%s, orders=%s, mode=%s" % (RANDOM_SEED, NUM_ORDERS, VEHICLE_MODE))
    admin, boundary_feature, road_source, pop_source, dem_source = validate_inputs()
    metric = QgsCoordinateReferenceSystem(METRIC_CRS); require(metric.isValid(), "Invalid METRIC_CRS")
    boundary = prepare_boundary(admin, boundary_feature, metric)
    roads, _ = prepare_roads(road_source, boundary, metric)
    population, elevation = clip_rasters(pop_source, dem_source, boundary)
    businesses = create_businesses(boundary, population, elevation, rng)
    orders_mem = create_orders(boundary, population, elevation, businesses, rng)
    orders, routes = route_orders(roads, businesses, orders_mem)
    animation = create_route_animation(routes)
    zones, hotspots, pickups = analysis_layers(boundary, roads, businesses, orders)
    summary = write_summaries(businesses, orders, pickups)
    with open(os.path.join(OUTPUT_DIR, "simulation_config.json"), "w", encoding="utf-8") as handle:
        json.dump(config_snapshot(), handle, indent=2)
    style_and_group({"boundary": boundary, "roads": roads, "population": population,
        "elevation": elevation, "businesses": businesses, "orders": orders, "routes": routes,
        "animation": animation,
        "zones": zones, "hotspots": hotspots, "pickups": pickups})
    if SAVE_PROJECT:
        require(QgsProject.instance().write(PROJECT_PATH), "Could not save QGIS project: " + PROJECT_PATH)
    log("COMPLETE. Outputs: " + OUTPUT_DIR)
    log(json.dumps(summary, indent=2))
    return summary


try:
    MUSUWO_RESULT = main()
except Exception as exc:
    print("\n[MUSUWO ERROR] %s" % exc)
    print("Check the configuration section and input files. Automatic OSM download is not required: "
          "place a routable line dataset at ROAD_PATH. For Geofabrik PBF, import roads to GeoPackage "
          "with QGIS before rerunning.")
    traceback.print_exc()
    raise
