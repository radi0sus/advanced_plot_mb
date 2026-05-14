(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;

  MB.Constants = {
    APP: {
      name: "advanced-plot-mb",
      version: "0.1.0",
      title: "ORCA Mößbauer Viewer",
      supportedLabel: "⁵⁷Fe"
    },

    DEFAULTS: {
      velocityMin: -6,
      velocityMax: 6,
      resolution: 0.01,
      manualName: "Fe-new",
      delta: 0,
      deltaEq: 0,
      fwhm: 0.2,
      ratio: 1,
      defaultPresetKey: "B3LYP_CP(PPP)"
    },

    RANGES: {
      delta: { min: -5, max: 5, sliderStep: 0.01, numberStep: 0.001 },
      deltaEq: { min: -8, max: 8, sliderStep: 0.01, numberStep: 0.001 },
      fwhm: { min: 0.01, max: 2, sliderStep: 0.01, numberStep: 0.001 },
      ratio: { numberStep: 0.001 },
      velocity: { numberStep: 0.1 }
    },

    AUTO_RANGE: {
      paddingFwhmFactor: 5,
      paddingConstant: 1,
      roundTo: 0.1,
      fallbackMin: -6,
      fallbackMax: 6
    },

    SUPPORTED_NUCLEI: {
      element: "Fe",
      isotope: 57,
      label: "⁵⁷Fe",
      // accepts Fe, 0Fe, 12Fe, Fe1, Fe12
      namePattern: /^(\d+)?Fe(\d+)?$/i
    },

    EXPORT: {
      spectrumCsvFilename: "advanced-plot-mb-spectrum.csv",
      tableTsvFilename: "advanced-plot-mb-table.tsv",
      pngFilename: "advanced-plot-mb-spectrum.png",
      csvDelimiter: ",",
      tsvDelimiter: "\t",
      lineEnding: "\n"
    },

    PLOT: {
      title: "Mößbauer spectrum",
      xLabel: "velocity / mm s⁻¹",
      yLabel: "relative transmission",
      totalColor: "#000000",
      componentOpacity: 0.45,
      markerOpacity: 0.35,
      responsive: true,
      displaylogo: false
    },

    CALIBRATION_PRESETS: [
      { key: "BP86_CP(PPP)", label: "BP86 / CP(PPP)", functional: "BP86", basis: "CP(PPP)", alpha: -0.425, beta: 7.916, C: 11810 },
      { key: "BP86_TZVP", label: "BP86 / TZVP", functional: "BP86", basis: "TZVP", alpha: -0.340, beta: 1.034, C: 11580 },
      { key: "BP86_TZVPa", label: "BP86 / TZVPa", functional: "BP86", basis: "TZVPa", alpha: -0.362, beta: 4.957, C: 13800 },

      { key: "B3LYP_CP(PPP)", label: "B3LYP / CP(PPP)", functional: "B3LYP", basis: "CP(PPP)", alpha: -0.366, beta: 2.852, C: 11810 },
      { key: "B3LYP_TZVP", label: "B3LYP / TZVP", functional: "B3LYP", basis: "TZVP", alpha: -0.298, beta: 1.118, C: 11580 },
      { key: "B3LYP_TZVPa", label: "B3LYP / TZVPa", functional: "B3LYP", basis: "TZVPa", alpha: -0.307, beta: 4.045, C: 13770 },

      { key: "TPSS_CP(PPP)", label: "TPSS / CP(PPP)", functional: "TPSS", basis: "CP(PPP)", alpha: -0.421, beta: 5.154, C: 11810 },
      { key: "TPSS_TZVP", label: "TPSS / TZVP", functional: "TPSS", basis: "TZVP", alpha: -0.336, beta: 1.327, C: 11580 },
      { key: "TPSS_TZVPa", label: "TPSS / TZVPa", functional: "TPSS", basis: "TZVPa", alpha: -0.365, beta: 1.385, C: 13800 },

      { key: "TPSSh_CP(PPP)", label: "TPSSh / CP(PPP)", functional: "TPSSh", basis: "CP(PPP)", alpha: -0.376, beta: 4.130, C: 11810 },
      { key: "TPSSh_TZVP", label: "TPSSh / TZVP", functional: "TPSSh", basis: "TZVP", alpha: -0.321, beta: 1.466, C: 11580 },
      { key: "TPSSh_TZVPa", label: "TPSSh / TZVPa", functional: "TPSSh", basis: "TZVPa", alpha: -0.322, beta: 1.830, C: 13780 },

      { key: "B2PLYP_CP(PPP)", label: "B2PLYP / CP(PPP)", functional: "B2PLYP", basis: "CP(PPP)", alpha: -0.336, beta: 2.642, C: 11810 },
      { key: "B2PLYP_TZVP", label: "B2PLYP / TZVP", functional: "B2PLYP", basis: "TZVP", alpha: -0.261, beta: 1.483, C: 11580 },
      { key: "B2PLYP_TZVPa", label: "B2PLYP / TZVPa", functional: "B2PLYP", basis: "TZVPa", alpha: -0.311, beta: 2.256, C: 13790 },

      { key: "custom", label: "Custom", custom: true }
    ]
  };

  MB.Constants.PresetByKey = {};
  MB.Constants.CALIBRATION_PRESETS.forEach(function (preset) {
    MB.Constants.PresetByKey[preset.key] = preset;
  });
})();
