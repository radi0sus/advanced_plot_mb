(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function nextId() {
    MB.State._nextRowId += 1;
    return "row-" + MB.State._nextRowId;
  }

  function makeSnapshot(row) {
    return deepClone({
      type: row.type,
      sourceName: row.sourceName,
      active: row.active,
      detailsOpen: row.detailsOpen,
      name: row.name,
      delta: row.delta,
      deltaEq: row.deltaEq,
      fwhm: row.fwhm,
      ratio: row.ratio,
      presetKey: row.presetKey,
      alpha: row.alpha,
      beta: row.beta,
      C: row.C,
      rho0: row.rho0,
      isotope: row.isotope,
      color: row.color || null
    });
  }

  function applySnapshot(row, snapshot) {
    Object.keys(snapshot).forEach(function (key) {
      row[key] = deepClone(snapshot[key]);
    });
  }

  function getDefaultPreset() {
    return C.PresetByKey[C.DEFAULTS.defaultPresetKey];
  }

  MB.State = {
    rows: [],
    velocityMin: C.DEFAULTS.velocityMin,
    velocityMax: C.DEFAULTS.velocityMax,
    resolution: C.DEFAULTS.resolution,
    autoRange: true,
    showComponents: true,
    showLineMarkers: false,
    fillSpectra: false,
    fwhmLinked: false,
    lastChangedFwhm: C.DEFAULTS.fwhm,
    importLog: [],
    _nextRowId: 0
  };

  MB.Store = {
    addLog: function (message) {
      MB.State.importLog.push(message);
    },

    clearLog: function () {
      MB.State.importLog = [];
    },

    getRows: function () {
      return MB.State.rows;
    },

    getActiveRows: function () {
      return MB.State.rows.filter(function (row) {
        return row.active;
      });
    },

    addManualRow: function () {
      var row = {
        id: nextId(),
        type: "manual",
        sourceName: "manual",
        active: true,
        detailsOpen: false,
        name: C.DEFAULTS.manualName,
        delta: C.DEFAULTS.delta,
        deltaEq: C.DEFAULTS.deltaEq,
        fwhm: C.DEFAULTS.fwhm,
        ratio: C.DEFAULTS.ratio,
        presetKey: "direct",
        alpha: null,
        beta: null,
        C: null,
        rho0: null,
        isotope: null
      };

      row.loaded = makeSnapshot(row);
      MB.State.rows.push(row);
      MB.Store.addLog("Manual row added.");
      return row;
    },

    addDirectRows: function (items, filename) {
      items.forEach(function (item) {
        var row = {
          id: nextId(),
          type: "txt",
          sourceName: filename,
          active: true,
          detailsOpen: false,
          name: item.name,
          delta: item.delta,
          deltaEq: item.deltaEq,
          fwhm: item.fwhm,
          ratio: item.ratio,
          presetKey: "direct",
          alpha: null,
          beta: null,
          C: null,
          rho0: null,
          isotope: null
        };

        row.loaded = makeSnapshot(row);
        MB.State.rows.push(row);
      });
    },

    addOrcaRows: function (centers, filename) {
      var preset = getDefaultPreset();

      centers.forEach(function (center) {
        var delta = MB.Math.rhoToDelta(center.rho0, preset.alpha, preset.beta, preset.C);

        var row = {
          id: nextId(),
          type: "orca",
          sourceName: filename,
          active: true,
          detailsOpen: true,
          name: center.name,
          delta: delta,
          deltaEq: center.deltaEq,
          fwhm: C.DEFAULTS.fwhm,
          ratio: C.DEFAULTS.ratio,
          presetKey: preset.key,
          alpha: preset.alpha,
          beta: preset.beta,
          C: preset.C,
          rho0: center.rho0,
          isotope: center.isotope || 57
        };

        row.loaded = makeSnapshot(row);
        MB.State.rows.push(row);
      });
    },

    findRow: function (id) {
      return MB.State.rows.find(function (row) {
        return row.id === id;
      });
    },

    deleteRow: function (id) {
      MB.State.rows = MB.State.rows.filter(function (row) {
        return row.id !== id;
      });
    },

    duplicateRow: function (id) {
      var row = MB.Store.findRow(id);
      if (!row) return;

      var clone = deepClone(row);
      clone.id = nextId();
      clone.name = row.name + "_copy";
      clone.loaded = makeSnapshot(clone);
      MB.State.rows.push(clone);
    },

    resetRow: function (id) {
      var row = MB.Store.findRow(id);
      if (!row || !row.loaded) return;
      var savedColor = row.color;   /* Farbe ist Nutzerpräferenz, kein geladener Wert. */
      applySnapshot(row, row.loaded);
      if (savedColor) row.color = savedColor;
    },

    updateOrcaDelta: function (row) {
      if (row.type !== "orca") return;
      if (typeof row.rho0 !== "number") return;
      row.delta = MB.Math.rhoToDelta(row.rho0, row.alpha, row.beta, row.C);
    },

    setPreset: function (row, presetKey) {
      if (row.type !== "orca") return;

      row.presetKey = presetKey;

      var preset = C.PresetByKey[presetKey];
      if (!preset || preset.custom) return;

      row.alpha = preset.alpha;
      row.beta = preset.beta;
      row.C = preset.C;
      MB.Store.updateOrcaDelta(row);
    },

    setCustomCalibrationValue: function (row, field, value) {
      if (row.type !== "orca") return;

      row[field] = value;
      row.presetKey = "custom";
      MB.Store.updateOrcaDelta(row);
    }
  };
})();