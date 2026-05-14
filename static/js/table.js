(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(value, digits) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "";
    }

    return Number(value).toFixed(digits);
  }

  function badgeForType(type) {
    if (type === "orca") return '<span class="badge orca">ORCA</span>';
    if (type === "txt") return '<span class="badge txt">TXT</span>';
    return '<span class="badge manual">Manual</span>';
  }

  function presetOptions(row) {
    if (row.type !== "orca") {
      return '<span class="badge">direct</span>';
    }

    return '<select class="select-preset" data-action="preset" data-row-id="' + esc(row.id) + '">' +
      C.CALIBRATION_PRESETS.map(function (preset) {
        return '<option value="' + esc(preset.key) + '"' +
          (preset.key === row.presetKey ? " selected" : "") + ">" +
          esc(preset.label) +
          "</option>";
      }).join("") +
      "</select>";
  }

  function sliderNumber(row, field, value, range, digits) {
    return '' +
      '<div class="slider-number-inline">' +
        '<input data-action="field" data-field="' + esc(field) + '" data-row-id="' + esc(row.id) + '" ' +
          'type="range" min="' + range.min + '" max="' + range.max + '" step="' + range.sliderStep + '" value="' + esc(value) + '" />' +
        '<input data-action="field" data-field="' + esc(field) + '" data-row-id="' + esc(row.id) + '" ' +
          'type="number" step="' + range.numberStep + '" value="' + esc(fmt(value, digits)) + '" />' +
      '</div>';
  }

  function renderDetailRow(row) {
    if (!row.detailsOpen) return "";

    if (row.type === "orca") {
      return '' +
        '<tr class="detail-row" data-detail-for="' + esc(row.id) + '">' +
          '<td colspan="12">' +
            '<div class="detail-grid">' +
              '<div class="control">' +
                '<label>ρ(0)</label>' +
                '<span class="readonly-value">' + esc(fmt(row.rho0, 9)) + '</span>' +
              '</div>' +

              '<div class="control">' +
                '<label>Isotope</label>' +
                '<span class="readonly-value">' + esc(row.isotope || "assumed 57") + '</span>' +
              '</div>' +

              '<div class="control">' +
                '<label>α</label>' +
                '<input data-action="calibration" data-field="alpha" data-row-id="' + esc(row.id) + '" type="number" step="0.001" value="' + esc(row.alpha) + '" />' +
              '</div>' +

              '<div class="control">' +
                '<label>β</label>' +
                '<input data-action="calibration" data-field="beta" data-row-id="' + esc(row.id) + '" type="number" step="0.001" value="' + esc(row.beta) + '" />' +
              '</div>' +

              '<div class="control">' +
                '<label>C</label>' +
                '<input data-action="calibration" data-field="C" data-row-id="' + esc(row.id) + '" type="number" step="1" value="' + esc(row.C) + '" />' +
              '</div>' +

              '<div class="control">' +
                '<label>Equation</label>' +
                '<small>δ = α · (ρ(0) − C) + β</small>' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
    }

    return '' +
      '<tr class="detail-row" data-detail-for="' + esc(row.id) + '">' +
        '<td colspan="12">' +
          '<small>Direct parameter row. No ORCA calibration applied. Assumed to describe a ⁵⁷Fe Mößbauer component.</small>' +
        '</td>' +
      '</tr>';
  }

  var PALETTE = [
    "#d62728", "#1f77b4", "#2ca02c", "#9467bd",
    "#ff7f0e", "#17becf", "#8c564b", "#e377c2"
  ];

  function ensureRowColor(row) {
    if (!row.color) {
      var index = MB.State.rows.indexOf(row);
      row.color = PALETTE[Math.max(index, 0) % PALETTE.length];
    }

    return row.color;
  }

  function renderRow(row) {
    var toggleSymbol = row.detailsOpen ? "▾" : "▸";
    var color = ensureRowColor(row);

    return '' +
      '<tr data-row-id="' + esc(row.id) + '" data-source-type="' + esc(row.type) + '">' +
        '<td class="details-toggle-cell">' +
          '<button type="button" class="details-toggle" data-action="toggle-details" data-row-id="' + esc(row.id) + '">' +
            toggleSymbol +
          '</button>' +
        '</td>' +

        '<td>' +
          '<label class="switch">' +
            '<input data-action="active" data-row-id="' + esc(row.id) + '" type="checkbox"' + (row.active ? " checked" : "") + ' />' +
            '<span class="slider"></span>' +
          '</label>' +
        '</td>' +

        '<td>' + badgeForType(row.type) + '</td>' +

        '<td class="source-cell" title="' + esc(row.sourceName) + '">' +
          '<span class="badge">' + esc(row.sourceName) + '</span>' +
        '</td>' +

        '<td>' +
          '<input class="name-input" data-action="field" data-field="name" data-row-id="' + esc(row.id) + '" type="text" value="' + esc(row.name) + '" />' +
        '</td>' +

        '<td class="slider-cell">' + sliderNumber(row, "delta", row.delta, C.RANGES.delta, 3) + '</td>' +
        '<td class="slider-cell">' + sliderNumber(row, "deltaEq", row.deltaEq, C.RANGES.deltaEq, 3) + '</td>' +
        '<td class="slider-cell">' + sliderNumber(row, "fwhm", row.fwhm, C.RANGES.fwhm, 3) + '</td>' +

        '<td>' +
          '<input class="ratio-input" data-action="field" data-field="ratio" data-row-id="' + esc(row.id) + '" type="number" step="' + C.RANGES.ratio.numberStep + '" value="' + esc(fmt(row.ratio, 3)) + '" />' +
        '</td>' +

        '<td>' + presetOptions(row) + '</td>' +

        '<td class="color-cell">' +
          '<input type="color" class="color-picker" data-action="color" data-row-id="' + esc(row.id) + '" value="' + esc(color) + '" title="Row color" />' +
        '</td>' +

        '<td>' +
          '<div class="row-actions">' +
            '<button type="button" class="btn icon" data-action="reset" data-row-id="' + esc(row.id) + '" title="Reset row to loaded values">↺</button>' +
            '<button type="button" class="btn icon" data-action="duplicate" data-row-id="' + esc(row.id) + '" title="Duplicate row">⧉</button>' +
            '<button type="button" class="btn icon danger" data-action="delete" data-row-id="' + esc(row.id) + '" title="Delete row">×</button>' +
          '</div>' +
        '</td>' +
      '</tr>' +
      renderDetailRow(row);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  function parseInputValue(input, field) {
    if (field === "name") {
      return input.value;
    }
  
    var value = Number(input.value);
  
    if (!Number.isFinite(value)) {
      return null;
    }
  
    /*
      Manuelle Number-Inputs dürfen nicht über den jeweiligen
      Sliderbereich hinausgehen.
      Die Bereiche kommen aus den bereits vorhandenen C.RANGES.
    */
    if (field === "delta") {
      return clamp(value, C.RANGES.delta.min, C.RANGES.delta.max);
    }
  
    if (field === "deltaEq") {
      return clamp(value, C.RANGES.deltaEq.min, C.RANGES.deltaEq.max);
    }
  
    if (field === "fwhm") {
      return clamp(value, C.RANGES.fwhm.min, C.RANGES.fwhm.max);
    }
  
    /*
      Ratio hat keinen Slider, daher nicht clampen.
    */
    return value;
  }
  
  function setControlDisplayValue(input, field, value) {
    if (field === "name") {
      input.value = value;
      return;
    }

    if (input.type === "number") {
      input.value = Number(value).toFixed(3);
      return;
    }

    input.value = value;
  }

  function syncVisibleFieldInputs(rowId, field, value, sourceEl) {
    var selector =
      '[data-action="field"]' +
      '[data-row-id="' + rowId + '"]' +
      '[data-field="' + field + '"]';

    document.querySelectorAll(selector).forEach(function (input) {
      if (input === sourceEl) return;
      setControlDisplayValue(input, field, value);
    });
  }

  function applyRangeInput(el) {
    var rowId = el.getAttribute("data-row-id");
    var row = MB.Store.findRow(rowId);
    if (!row) return false;

    var field = el.getAttribute("data-field");
    var value = parseInputValue(el, field);
    if (value === null) return false;

    row[field] = value;

    if (field === "fwhm") {
      MB.State.lastChangedFwhm = value;

      if (MB.State.fwhmLinked) {
        MB.State.rows.forEach(function (other) {
          if (other.active) {
            other.fwhm = value;
            syncVisibleFieldInputs(other.id, "fwhm", value, el);
          }
        });
      } else {
        syncVisibleFieldInputs(row.id, "fwhm", value, el);
      }
    } else {
      syncVisibleFieldInputs(row.id, field, value, el);
    }

    return true;
  }

  MB.Table = {
    render: function () {
      var tbody = document.getElementById("tableBody");
      tbody.innerHTML = MB.State.rows.map(renderRow).join("");
    },

    bind: function () {
      var tbody = document.getElementById("tableBody");

      /*
        input:
        Nur Range-Slider und Colorpicker live behandeln.

        Ganz wichtig:
        Text- und Number-Felder werden hier NICHT verarbeitet.
        Sonst stört man Cursor/Fokus beim Anklicken und Tippen.
      */
      tbody.addEventListener("input", function (event) {
        var el = event.target;
        var action = el.getAttribute("data-action");

        if (!action) return;

        if (action === "color") {
          var colorRowId = el.getAttribute("data-row-id");
          var colorRow = MB.Store.findRow(colorRowId);
          if (!colorRow) return;

          colorRow.color = el.value;
          MB.App.renderPlot();
          return;
        }

        if (action === "field" && el.type === "range") {
          if (applyRangeInput(el)) {
            MB.App.renderPlot();
          }

          return;
        }

        /*
          Alle anderen input-Events bewusst ignorieren:
          - Name
          - Number-Felder
          - Ratio
          - Kalibrierungsfelder

          Diese werden erst bei change verarbeitet.
        */
      });

      /*
        change:
        Finale Verarbeitung für Text-/Number-Felder, Checkboxen,
        Selects und Slider nach Loslassen.
      */
      tbody.addEventListener("change", function (event) {
        MB.Table.handleEvent(event);
      });

      /*
        click:
        Nur echte Button-Aktionen behandeln.
        Klicks auf inputs/selects dürfen KEIN renderAll() auslösen.
      */
      tbody.addEventListener("click", function (event) {
        var el = event.target.closest("[data-action]");
        if (!el || !tbody.contains(el)) return;

        var action = el.getAttribute("data-action");

        if (
          action === "toggle-details" ||
          action === "reset" ||
          action === "duplicate" ||
          action === "delete"
        ) {
          MB.Table.handleEvent({ target: el });
        }
      });
    },

    handleEvent: function (event) {
      var el = event.target;
      var action = el.getAttribute("data-action");

      if (!action) return;

      var rowId = el.getAttribute("data-row-id");
      var row = MB.Store.findRow(rowId);

      if (!row) return;

      if (action === "toggle-details") {
        row.detailsOpen = !row.detailsOpen;
        MB.App.renderAll();
        return;
      }

      if (action === "active") {
        row.active = el.checked;
        MB.App.renderAll();
        return;
      }

      if (action === "preset") {
        MB.Store.setPreset(row, el.value);
        MB.App.renderAll();
        return;
      }

      if (action === "calibration") {
        var calField = el.getAttribute("data-field");
        var calValue = Number(el.value);

        if (Number.isFinite(calValue)) {
          MB.Store.setCustomCalibrationValue(row, calField, calValue);
          MB.App.renderAll();
        }

        return;
      }

      if (action === "field") {
        var field = el.getAttribute("data-field");
        var value = parseInputValue(el, field);

        if (value === null) {
          /*
            Falls ein Number-Feld beim Blur leer/ungültig ist,
            einfach wieder den State rendern.
          */
          MB.App.renderAll();
          return;
        }

        row[field] = value;

        if (field === "fwhm") {
          MB.State.lastChangedFwhm = value;

          if (MB.State.fwhmLinked) {
            MB.State.rows.forEach(function (other) {
              if (other.active) {
                other.fwhm = value;
              }
            });
          }
        }

        MB.App.renderAll();
        return;
      }

      if (action === "color") {
        row.color = el.value;
        MB.App.renderPlot();
        return;
      }

      if (action === "reset") {
        MB.Store.resetRow(rowId);
        MB.App.renderAll();
        return;
      }

      if (action === "duplicate") {
        MB.Store.duplicateRow(rowId);
        MB.App.renderAll();
        return;
      }

      if (action === "delete") {
        MB.Store.deleteRow(rowId);
        MB.App.renderAll();
      }
    }
  };
})();