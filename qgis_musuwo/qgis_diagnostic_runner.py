"""Standalone QGIS runtime for the full simulation, with persistent logging."""
import contextlib
import os
import sys
import traceback
from qgis.core import QgsApplication

script = r"D:\DEV\BF_Mutare\MUSUWO_MUTARE_QGIS_FULL_FIXED.py"
log_path = r"D:\DEV\BF_Mutare\qgis_musuwo\qgis_run.log"

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
qgis_plugins = r"C:\Program Files\QGIS 3.44.12\apps\qgis-ltr\python\plugins"
if qgis_plugins not in sys.path:
    sys.path.insert(0, qgis_plugins)
app = QgsApplication([], False)
app.initQgis()
try:
    from processing.core.Processing import Processing
    Processing.initialize()
    with open(log_path, "w", encoding="utf-8") as log:
        with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
            try:
                namespace = {"__file__": script, "__name__": "__main__"}
                exec(compile(open(script, encoding="utf-8").read(), script, "exec"), namespace)
                print("QGIS_RUNNER_SUCCESS")
            except BaseException:
                print("QGIS_RUNNER_FAILURE")
                traceback.print_exc()
            finally:
                log.flush()
finally:
    app.exitQgis()
