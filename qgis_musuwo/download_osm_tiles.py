"""Download four small complete Overpass OSM road tiles for Mutare urban area."""
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import time

out_dir = Path(r"D:\DEV\BF_Mutare\qgis_musuwo\data")
tiles = {
    "q1": (-19.10, 32.55, -18.975, 32.675),
    "q2": (-19.10, 32.675, -18.975, 32.80),
    "q3a": (-18.975, 32.55, -18.9125, 32.675),
    "q3b": (-18.9125, 32.55, -18.85, 32.675),
    "q4a": (-18.975, 32.675, -18.9125, 32.80),
    "q4b": (-18.9125, 32.675, -18.85, 32.80),
}
endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
for name, bbox in tiles.items():
    path = out_dir / ("mutare_osm_%s.osm" % name)
    if path.exists() and path.read_bytes().rstrip().endswith(b"</osm>"):
        print(name, path.stat().st_size, "existing validated file", flush=True)
        continue
    query = '[out:xml][timeout:120];way["highway"](%s,%s,%s,%s);(._;>;);out body;' % bbox
    error = None
    for endpoint in endpoints:
        try:
            request = Request(endpoint, data=urlencode({"data": query}).encode("ascii"),
                              headers={"User-Agent": "Musuwo-Mutare-QGIS-Simulation/1.0"})
            with urlopen(request, timeout=180) as response:
                payload = response.read()
            if not payload.rstrip().endswith(b"</osm>"):
                raise RuntimeError("incomplete XML response (%d bytes)" % len(payload))
            path.write_bytes(payload)
            print(name, len(payload), endpoint, flush=True)
            error = None
            break
        except Exception as exc:
            error = exc
            print(name, endpoint, "failed:", exc, flush=True)
            time.sleep(2)
    if error:
        raise RuntimeError("Could not download complete OSM tile %s: %s" % (name, error))
