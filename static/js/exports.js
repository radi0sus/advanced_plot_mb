(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function sanitizeColumnName(name) {
    return String(name || "component")
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]+/g, "")
      .replace(/^_+|_+$/g, "");
  }

  function downloadText(filename, text, mimeType) {
    var blob = new Blob([text], { type: mimeType || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function cleanFixedCell(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/\s+/g, "_")
      .trim();
  }

  function padRight(value, width) {
    value = String(value).slice(0, width);
    return value.padEnd(width, " ");
  }

  function padLeft(value, width) {
    value = String(value);
    return value.padStart(width, " ");
  }

  function formatNumber(value) {
    var n = Number(value);

    if (!Number.isFinite(n)) {
      return "";
    }

    return n.toFixed(3);
  }

  function makeFixedWidthTable(rows) {
    /*
      Desired layout:
  
      Name           δ      ΔEQ     FWHM   Ratio
      0Fe        0.827    3.064    0.200   1.000
  
      Fixed-width, spaces only.
    */
  
    var NAME_W = 8;
    var NUM_W = 7;
  
    var GAP_AFTER_NAME = "   ";
    var GAP = "    ";
    var GAP_BEFORE_RATIO = "   ";
  
    function formatName(value) {
      return cleanFixedCell(value)
        .slice(0, NAME_W)
        .padEnd(NAME_W, " ");
    }
  
    function formatHeader(value) {
      return String(value).padStart(NUM_W, " ");
    }
  
    function formatNumber(value) {
      var n = Number(value);
  
      if (!Number.isFinite(n)) {
        return "".padStart(NUM_W, " ");
      }
  
      return n.toFixed(3).padStart(NUM_W, " ");
    }
  
    var lines = [];
  
    lines.push(
      formatName("Name") +
      GAP_AFTER_NAME +
      formatHeader("δ") +
      GAP +
      formatHeader("ΔEQ") +
      GAP +
      formatHeader("FWHM") +
      GAP_BEFORE_RATIO +
      formatHeader("Ratio")
    );
  
    rows.forEach(function (row) {
      lines.push(
        formatName(row.name) +
        GAP_AFTER_NAME +
        formatNumber(row.delta) +
        GAP +
        formatNumber(row.deltaEq) +
        GAP +
        formatNumber(row.fwhm) +
        GAP_BEFORE_RATIO +
        formatNumber(row.ratio)
      );
    });
  
    return lines.join(C.EXPORT.lineEnding);
  }

  MB.Exports = {
    exportSpectrumCsv: function () {
      var spectrum = MB.Math.computeSpectrum(
        MB.State.rows,
        MB.State.velocityMin,
        MB.State.velocityMax,
        MB.State.resolution
      );

      var headers = ["velocity_mm_s", "total_relative_transmission"];

      spectrum.components.forEach(function (component, index) {
        headers.push(
          "comp" +
          String(index + 1).padStart(2, "0") +
          "_" +
          sanitizeColumnName(component.name)
        );
      });

      var lines = [headers.join(C.EXPORT.csvDelimiter)];

      for (var i = 0; i < spectrum.x.length; i += 1) {
        var row = [
          spectrum.x[i].toFixed(2),
          spectrum.totalTransmission[i].toFixed(8)
        ];

        spectrum.components.forEach(function (component) {
          row.push(component.transmissionContribution[i].toFixed(8));
        });

        lines.push(row.join(C.EXPORT.csvDelimiter));
      }

      downloadText(
        C.EXPORT.spectrumCsvFilename,
        lines.join(C.EXPORT.lineEnding),
        "text/csv;charset=utf-8"
      );
    },

    exportTableTsv: function () {
      /*
        Name bleibt aus Kompatibilitätsgründen exportTableTsv,
        Inhalt ist aber jetzt fixed-width space-separated text.
      */

      var activeRows = MB.Store.getActiveRows();
      var text = makeFixedWidthTable(activeRows);

      downloadText(
        "advanced-plot-mb-table.txt",
        text + C.EXPORT.lineEnding,
        "text/plain;charset=utf-8"
      );
    },

    downloadText: downloadText
  };
})();