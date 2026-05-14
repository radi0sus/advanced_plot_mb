(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function makeGrid(vMin, vMax, step) {
    var values = [];
    var n = Math.floor((vMax - vMin) / step + 0.5);

    for (var i = 0; i <= n; i += 1) {
      values.push(Number((vMin + i * step).toFixed(10)));
    }

    return values;
  }

  /* Grid-Cache: wird nur neu gebaut wenn sich vMin/vMax/step ändern. */
  var _gridCache = { vMin: null, vMax: null, step: null, x: null };

  function getCachedGrid(vMin, vMax, step) {
    if (
      _gridCache.x !== null &&
      _gridCache.vMin === vMin &&
      _gridCache.vMax === vMax &&
      _gridCache.step === step
    ) {
      return _gridCache.x;
    }
    _gridCache.vMin = vMin;
    _gridCache.vMax = vMax;
    _gridCache.step = step;
    _gridCache.x = makeGrid(vMin, vMax, step);
    return _gridCache.x;
  }

  /*
    Lorentz-Kurve direkt in ein bestehendes Float64Array akkumulieren –
    keine Array-Allokation pro Punkt.
  */
  function addLorentzInPlace(out, x, center, half, ratio) {
    var piInv = 1 / Math.PI;
    var halfSq = half * half;
    var absRatio = Math.abs(ratio);
    for (var i = 0; i < x.length; i += 1) {
      var dx = x[i] - center;
      out[i] += piInv * half / (dx * dx + halfSq) * absRatio;
    }
  }

  MB.Math = {
    isFiniteNumber: isFiniteNumber,

    rhoToDelta: function (rho0, alpha, beta, cValue) {
      return alpha * (rho0 - cValue) + beta;
    },

    lorentz: function (amplitude, x, center, fwhm, ratio) {
      var half = fwhm / 2;
      var value = (amplitude / Math.PI) * (half / ((x - center) * (x - center) + half * half));
      return Math.abs(value) * Math.abs(ratio);
    },

    linePositions: function (row) {
      var half = Math.abs(row.deltaEq) / 2;
      return [row.delta - half, row.delta + half];
    },

    computeSpectrum: function (rows, vMin, vMax, step) {
      var activeRows = rows.filter(function (row) { return row.active; });

      /* x-Grid aus Cache – keine Neuberechnung wenn Range/Step gleich. */
      var x = getCachedGrid(vMin, vMax, step);
      var n = x.length;

      /* Float64Arrays statt normaler JS-Arrays: deutlich schnellere
         numerische Schleifen, kein GC-Druck durch Objekt-Allokation. */
      var totalAbs = new Float64Array(n);

      var components = activeRows.map(function (row) {
        var positions = MB.Math.linePositions(row);
        var half = row.fwhm / 2;
        var yAbs = new Float64Array(n);

        addLorentzInPlace(yAbs, x, positions[0], half, row.ratio);
        addLorentzInPlace(yAbs, x, positions[1], half, row.ratio);

        for (var i = 0; i < n; i += 1) {
          totalAbs[i] += yAbs[i];
        }

        return { rowId: row.id, name: row.name, row: row, x: x, absorption: yAbs };
      });

      var maxAbs = 0;
      for (var i = 0; i < n; i += 1) {
        if (totalAbs[i] > maxAbs) maxAbs = totalAbs[i];
      }

      var zeros = new Float64Array(n);
      var ones  = new Float64Array(n).fill(1);

      if (!maxAbs || !Number.isFinite(maxAbs)) {
        return {
          x: x,
          totalTransmission: Array.from(ones),
          totalAbsorptionNorm: Array.from(zeros),
          components: components.map(function (c) {
            c.transmissionContribution = Array.from(ones);
            c.absorptionNormToTotal    = Array.from(zeros);
            return c;
          }),
          maxAbsorption: 0
        };
      }

      var invMax = 1 / maxAbs;
      var totalTransmission    = new Float64Array(n);
      var totalAbsorptionNorm  = new Float64Array(n);

      for (var i = 0; i < n; i += 1) {
        totalAbsorptionNorm[i] = totalAbs[i] * invMax;
        totalTransmission[i]   = 1 - totalAbsorptionNorm[i];
      }

      components.forEach(function (component) {
        var abs = component.absorption;
        var absNorm  = new Float64Array(n);
        var transCon = new Float64Array(n);

        for (var i = 0; i < n; i += 1) {
          absNorm[i]  = abs[i] * invMax;
          transCon[i] = 1 - absNorm[i];
        }

        /* Plotly erwartet normale JS-Arrays. */
        component.absorptionNormToTotal    = Array.from(absNorm);
        component.transmissionContribution = Array.from(transCon);
        component.absorption               = Array.from(abs);
      });

      return {
        x: x,
        totalTransmission:   Array.from(totalTransmission),
        totalAbsorptionNorm: Array.from(totalAbsorptionNorm),
        components:          components,
        maxAbsorption:       maxAbs
      };
    },

    computeAutoRange: function (rows) {
      var activeRows = rows.filter(function (row) {
        return row.active &&
          isFiniteNumber(row.delta) &&
          isFiniteNumber(row.deltaEq) &&
          isFiniteNumber(row.fwhm);
      });

      if (!activeRows.length) {
        return {
          min: C.AUTO_RANGE.fallbackMin,
          max: C.AUTO_RANGE.fallbackMax
        };
      }

      var positions = [];
      var fwhmValues = [];

      activeRows.forEach(function (row) {
        var linePositions = MB.Math.linePositions(row);
        positions.push(linePositions[0]);
        positions.push(linePositions[1]);
        fwhmValues.push(row.fwhm);
      });

      var minPos = Math.min.apply(null, positions);
      var maxPos = Math.max.apply(null, positions);

      var meanFwhm = fwhmValues.reduce(function (sum, value) {
        return sum + value;
      }, 0) / fwhmValues.length;

      var padding = C.AUTO_RANGE.paddingFwhmFactor * meanFwhm + C.AUTO_RANGE.paddingConstant;
      var roundTo = C.AUTO_RANGE.roundTo;

      var min = Math.floor((minPos - padding) / roundTo) * roundTo;
      var max = Math.ceil((maxPos + padding) / roundTo) * roundTo;

      return {
        min: Number(min.toFixed(3)),
        max: Number(max.toFixed(3))
      };
    }
  };
})();