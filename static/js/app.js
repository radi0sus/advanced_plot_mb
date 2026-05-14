(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function byId(id) {
    return document.getElementById(id);
  }

  function readFile(file, callback) {
    var reader = new FileReader();

    reader.onload = function () {
      callback(String(reader.result || ""), file.name);
    };

    reader.onerror = function () {
      MB.Store.addLog(file.name + ": could not read file.");
      MB.App.renderAll();
    };

    reader.readAsText(file);
  }

  function logParserResult(parsed) {
    parsed.messages.forEach(function (message) {
      MB.Store.addLog(message);
    });

    parsed.warnings.forEach(function (warning) {
      MB.Store.addLog("Warning: " + warning);
    });
  }

  function applyParsedFile(parsed, filename) {
    if (parsed.kind === "orca") {
      MB.Store.addOrcaRows(parsed.rows, filename);
      logParserResult(parsed);

      if (parsed.rows.length > 0) {
        MB.Store.addLog("Calibration preset applied: B3LYP / CP(PPP).");
        MB.Store.addLog("Please verify preset, α, β and C.");
      }

      MB.App.renderAll();
      return;
    }

    if (parsed.kind === "txt") {
      MB.Store.addDirectRows(parsed.rows, filename);
      logParserResult(parsed);
      MB.App.renderAll();
      return;
    }

    logParserResult(parsed);
    MB.App.renderAll();
  }

  function handleFiles(files, hint) {
    /*
      hint:
        "orca" from Add ORCA button
        "txt"  from Add TXT/TSV button
        null   from drag & drop

      The parser still decides by content first.
    */

    Array.prototype.forEach.call(files, function (file) {
      readFile(file, function (text, filename) {
        var parsed = MB.Parsers.parseFile(text, filename, hint);
        applyParsedFile(parsed, filename);
      });
    });
  }

  function updateInfo() {
    var rows = MB.State.rows;
    var active = MB.Store.getActiveRows();

    var orcaRows = rows.filter(function (row) {
      return row.type === "orca";
    }).length;

    var txtRows = rows.filter(function (row) {
      return row.type === "txt";
    }).length;

    var manualRows = rows.filter(function (row) {
      return row.type === "manual";
    }).length;

    byId("infoBox").textContent =
      "App: " + C.APP.name + " " + C.APP.version + "\n" +
      "Supported nucleus: " + C.SUPPORTED_NUCLEI.label + "\n\n" +

      "Rows: " + rows.length + "\n" +
      "Active rows: " + active.length + "\n" +
      "ORCA rows: " + orcaRows + "\n" +
      "TXT/direct rows: " + txtRows + "\n" +
      "Manual rows: " + manualRows + "\n\n" +

      "Velocity range:\n" +
      Number(MB.State.velocityMin).toFixed(2) +
      " to " +
      Number(MB.State.velocityMax).toFixed(2) +
      " mm/s\n" +

      "Resolution:\n" +
      MB.State.resolution.toFixed(2) +
      " mm/s\n\n" +

      "ORCA import:\n" +
      "Only Fe/57Fe centers are converted to rows.\n" +
      "File type is detected from content, not only from extension.\n" +
      "Default calibration: B3LYP / CP(PPP).\n\n" +

      "TXT/TSV import:\n" +
      "Direct parameter rows are assumed to describe 57Fe Mößbauer components.\n\n" +

      "Spectrum CSV:\n" +
      "velocity_mm_s,total_relative_transmission,components\n" +
      "Full velocity range, active rows only.\n\n" +

      "Table TXT:\n" +
      "Fixed-width space-separated table.\n" +
      "Name, δ, ΔEQ, FWHM, Ratio\n" +
      "Active rows only.\n\n" +

      "ρ(0) to δ conversion parameters from:\n" +
      "M. Römelt, S. Ye, F. Neese,\n" +
      "Inorg. Chem. 2009, 48, 784–785.\n" +
      "DOI: 10.1021/ic801535v";
  }

  function updateLog() {
    byId("logBox").textContent = MB.State.importLog.join("\n");
  }

  function applyAutoRangeIfEnabled() {
    if (!MB.State.autoRange) return;

    var range = MB.Math.computeAutoRange(MB.State.rows);

    MB.State.velocityMin = range.min;
    MB.State.velocityMax = range.max;
  }

  function syncVelocityInputsFromState() {
    byId("velocityMin").value = MB.State.velocityMin;
    byId("velocityMax").value = MB.State.velocityMax;
  }

  function syncInputsFromState() {
    syncVelocityInputsFromState();

    byId("autoRangeToggle").checked = MB.State.autoRange;

    byId("showComponents").checked = MB.State.showComponents;
    byId("showLineMarkers").checked = MB.State.showLineMarkers;
    byId("linkFwhm").checked = MB.State.fwhmLinked;
    byId("fillSpectra").checked = MB.State.fillSpectra;
  }

  function setVelocityFromInputs() {
    var vMin = Number(byId("velocityMin").value);
    var vMax = Number(byId("velocityMax").value);

    if (!Number.isFinite(vMin) || !Number.isFinite(vMax)) {
      MB.Store.addLog("Warning: invalid velocity range.");
      MB.App.renderAll();
      return;
    }

    if (vMin >= vMax) {
      MB.Store.addLog("Warning: v min must be smaller than v max.");
      MB.App.renderAll();
      return;
    }

    MB.State.velocityMin = vMin;
    MB.State.velocityMax = vMax;

    if (MB.State.autoRange) {
      MB.State.autoRange = false;
      MB.Store.addLog("Auto range disabled because velocity range was edited manually.");
    }

    MB.App.renderAll();
  }

  function bindColorSchemeChange() {
    if (!window.matchMedia) return;
  
    var media = window.matchMedia("(prefers-color-scheme: dark)");
  
    function rerenderPlotForThemeChange() {
      /*
        CSS-Variablen sind nach dem Theme-Wechsel nicht immer im selben
        Event-Tick vollständig aktualisiert, daher minimal verzögern.
      */
      setTimeout(function () {
        MB.App.renderPlot();
      }, 50);
    }
  
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", rerenderPlotForThemeChange);
    } else if (typeof media.addListener === "function") {
      /*
        Safari/ältere Browser.
      */
      media.addListener(rerenderPlotForThemeChange);
    }
  }

  function bindUi() {
    byId("addOrcaBtn").addEventListener("click", function () {
      byId("orcaFileInput").click();
    });

    byId("addTxtBtn").addEventListener("click", function () {
      byId("txtFileInput").click();
    });

    byId("orcaFileInput").addEventListener("change", function (event) {
      handleFiles(event.target.files, "orca");
      event.target.value = "";
    });

    byId("txtFileInput").addEventListener("change", function (event) {
      handleFiles(event.target.files, "txt");
      event.target.value = "";
    });

    byId("addManualRowBtn").addEventListener("click", function () {
      MB.Store.addManualRow();
      MB.App.renderAll();
    });

    byId("velocityMin").addEventListener("change", setVelocityFromInputs);
    byId("velocityMax").addEventListener("change", setVelocityFromInputs);

    byId("autoRangeToggle").addEventListener("change", function (event) {
      MB.State.autoRange = event.target.checked;

      if (MB.State.autoRange) {
        applyAutoRangeIfEnabled();

        MB.Store.addLog(
          "Auto range enabled: " +
          MB.State.velocityMin +
          " to " +
          MB.State.velocityMax +
          " mm/s."
        );
      } else {
        MB.Store.addLog("Auto range disabled.");
      }

      MB.App.renderAll();
    });

    byId("resetRangeBtn").addEventListener("click", function () {
      MB.State.autoRange = false;

      MB.State.velocityMin = C.DEFAULTS.velocityMin;
      MB.State.velocityMax = C.DEFAULTS.velocityMax;

      MB.Store.addLog("Auto range disabled.");
      MB.Store.addLog("Velocity range reset to -6 to +6 mm/s.");

      MB.App.renderAll();
    });

    byId("showComponents").addEventListener("change", function (event) {
      MB.State.showComponents = event.target.checked;
      MB.App.renderAll();
    });

    byId("showLineMarkers").addEventListener("change", function (event) {
      MB.State.showLineMarkers = event.target.checked;
      MB.App.renderAll();
    });

    byId("fillSpectra").addEventListener("change", function (event) {
      MB.State.fillSpectra = event.target.checked;
      MB.App.renderPlot();
    });

    byId("linkFwhm").addEventListener("change", function (event) {
      MB.State.fwhmLinked = event.target.checked;

      if (MB.State.fwhmLinked) {
        MB.Store.getActiveRows().forEach(function (row) {
          row.fwhm = MB.State.lastChangedFwhm;
        });

        MB.Store.addLog(
          "FWHM linked enabled. Active rows set to " +
          MB.State.lastChangedFwhm.toFixed(3) +
          " mm/s."
        );
      } else {
        MB.Store.addLog("FWHM linked disabled. Current values are kept.");
      }

      MB.App.renderAll();
    });

    byId("exportPngBtn").addEventListener("click", function () {
      MB.Plot.downloadPng();
    });

    byId("exportSpectrumCsvBtn").addEventListener("click", function () {
      MB.Exports.exportSpectrumCsv();
    });

    byId("exportTableTsvBtn").addEventListener("click", function () {
      MB.Exports.exportTableTsv();
    });

    var dropZone = byId("dropZone");

    dropZone.addEventListener("dragover", function (event) {
      event.preventDefault();
      dropZone.classList.add("dragover");
    });

    dropZone.addEventListener("dragleave", function () {
      dropZone.classList.remove("dragover");
    });

    dropZone.addEventListener("drop", function (event) {
      event.preventDefault();
      dropZone.classList.remove("dragover");

      handleFiles(event.dataTransfer.files, null);
    });

    MB.Table.bind();
  }

  MB.App = {
    /*
      renderPlot:
      Nur Plot neu zeichnen – kein DOM-Neubau der Tabelle.
      Wird von Slider-input-Events aufgerufen.
    */
    renderPlot: function () {
      applyAutoRangeIfEnabled();
      syncVelocityInputsFromState();
      MB.Plot.render();
    },

    /*
      renderAll:
      Kompletter Neuaufbau.
      Nur bei strukturellen Änderungen oder finalen Eingaben.
    */
    renderAll: function () {
      applyAutoRangeIfEnabled();
      syncInputsFromState();
      MB.Table.render();
      MB.Plot.render();
      updateInfo();
      updateLog();
    },

    init: function () {
      if (MB.State.autoRange === undefined) MB.State.autoRange = true;
      if (MB.State.fillSpectra === undefined) MB.State.fillSpectra = false;

      MB.Store.addLog("advanced-plot-mb initialized.");
      MB.Store.addLog("Drop ORCA .out or TXT/TSV parameter files, or add manual rows.");

      bindUi();
      bindColorSchemeChange();
      MB.App.renderAll();
    }
  };

  document.addEventListener("DOMContentLoaded", MB.App.init);
})();