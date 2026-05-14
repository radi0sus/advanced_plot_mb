(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  /*
    Palette ist nur Fallback, falls eine Row noch keine Farbe hat.
    Normalerweise kommt die Farbe aus dem Colorpicker: row.color.
  */
  var PALETTE = [
    "#d62728", "#1f77b4", "#2ca02c", "#9467bd",
    "#ff7f0e", "#17becf", "#8c564b", "#e377c2"
  ];

  function rowColor(row, index) {
    if (!row.color) {
      row.color = PALETTE[index % PALETTE.length];
    }

    return row.color;
  }

  function hexToRgba(hex, alpha) {
    /*
      Erwartet Farben aus <input type="color">, also #rrggbb.
      Falls doch etwas anderes kommt, fallback auf schwarz.
    */
    if (!/^#[0-9a-f]{6}$/i.test(String(hex || ""))) {
      return "rgba(0,0,0," + alpha + ")";
    }

    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);

    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();

    return value || fallback;
  }

  function isDarkMode() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function plotTheme() {
    var dark = isDarkMode();

    return {
      bg: cssVar("--plot-bg", dark ? "#1a222b" : "#ffffff"),
      paper: cssVar("--panel", dark ? "#1a222b" : "#ffffff"),
      text: cssVar("--text", dark ? "#e6edf3" : "#1f2a33"),
      muted: cssVar("--muted", dark ? "#9fb0bf" : "#64748b"),
      border: cssVar("--border", dark ? "#2d3945" : "#d9e0e6"),

      grid: dark ? "rgba(159,176,191,0.18)" : "rgba(100,116,139,0.18)",
      axis: dark ? "rgba(230,237,243,0.70)" : "rgba(31,42,51,0.75)",

      legendBg: dark ? "rgba(20,27,34,0.88)" : "rgba(255,255,255,0.88)",
      annotationBg: dark ? "rgba(20,27,34,0.72)" : "rgba(255,255,255,0.65)",

      /*
        Summenkurve:
        Light Mode schwarz,
        Dark Mode hell.
      */
      totalColor: dark ? "#f8fafc" : C.PLOT.totalColor,

      /*
        Komponenten bleiben Colorpicker-Farben.
        Im Dark Mode nur etwas sichtbarer.
      */
      componentOpacity: dark ? 0.72 : 0.50,
      markerOpacity: dark ? 0.85 : 0.70
    };
  }

  function getPlotData() {
    return MB.Math.computeSpectrum(
      MB.State.rows,
      MB.State.velocityMin,
      MB.State.velocityMax,
      MB.State.resolution
    );
  }

  /*
    Füllung zwischen Komponentenkurve und Baseline y = 1.
    Wird nur für Einzelkomponenten benutzt, nie für das Gesamtspektrum.
  */
  function filledTrace(x, y, color, extraProps) {
    var xClosed = x.concat(x.slice().reverse());
    var yClosed = y.concat(x.map(function () { return 1; }).reverse());

    var base = {
      x: xClosed,
      y: yClosed,
      type: "scatter",
      mode: "none",
      fill: "toself",
      fillcolor: hexToRgba(color, 0.10),
      showlegend: false,
      hoverinfo: "skip"
    };

    Object.keys(extraProps || {}).forEach(function (key) {
      base[key] = extraProps[key];
    });

    return base;
  }

  function componentLegendName(row) {
    return row.name +
      "  δ = " + Number(row.delta).toFixed(2) +
      " mm s⁻¹, ΔEQ = " + Number(row.deltaEq).toFixed(2) +
      " mm s⁻¹";
  }

  function makeTraces(spectrum) {
    var traces = [];
    var fill = MB.State.fillSpectra;
    var theme = plotTheme();

    /*
      Komponenten:
      - Farbe kommt aus row.color / Colorpicker.
      - Fill nur für Komponenten.
      - Gesamtspektrum wird nie gefüllt.
    */
    if (MB.State.showComponents) {
      spectrum.components.forEach(function (component, index) {
        var color = rowColor(component.row, index);

        if (fill) {
          traces.push(
            filledTrace(
              component.x,
              component.transmissionContribution,
              color
            )
          );
        }

        traces.push({
          x: component.x,
          y: component.transmissionContribution,
          type: "scatter",
          mode: "lines",
          name: componentLegendName(component.row),
          line: {
            color: color,
            width: 1.2
          },
          opacity: theme.componentOpacity,
          hovertemplate:
            component.row.name +
            "<br>v = %{x:.2f} mm s⁻¹" +
            "<br>relative transmission = %{y:.4f}" +
            "<extra></extra>"
        });
      });
    }

    /*
      Gesamtspektrum:
      - Light Mode schwarz
      - Dark Mode hell
      - keine Füllung
      - etwas stärker als Komponenten
    */
    traces.push({
      x: spectrum.x,
      y: spectrum.totalTransmission,
      type: "scatter",
      mode: "lines",
      name: "∑",
      line: {
        color: theme.totalColor,
        width: 1.9
      },
      hovertemplate:
        "total" +
        "<br>v = %{x:.2f} mm s⁻¹" +
        "<br>relative transmission = %{y:.4f}" +
        "<extra></extra>"
    });

    return traces;
  }

  /*
    Marker zeigen δ, also die Mitte des Dubletts.
    Nicht die beiden Dublettlinien.
  */
  function makeShapes() {
    if (!MB.State.showLineMarkers) return [];

    var shapes = [];
    var theme = plotTheme();

    MB.Store.getActiveRows().forEach(function (row, index) {
      var color = rowColor(row, index);

      shapes.push({
        type: "line",
        xref: "x",
        yref: "paper",
        x0: row.delta,
        x1: row.delta,
        y0: 0,
        y1: 1,
        line: {
          color: color,
          width: 1.3,
          dash: "dot"
        },
        opacity: theme.markerOpacity
      });
    });

    return shapes;
  }

  /*
    δ-Wert als gedrehte Zahl nahe der x-Achse.
    Dafür bekommt die y-Achse unten etwas Zusatzraum.
    Negative Ticklabels werden aber nicht angezeigt.
  */
  function makeMarkerAnnotations() {
    if (!MB.State.showLineMarkers) return [];

    var theme = plotTheme();
    var annotations = [];

    MB.Store.getActiveRows().forEach(function (row, index) {
      var color = rowColor(row, index);

      annotations.push({
        xref: "x",
        yref: "y",

        x: row.delta,
        y: -0.025,

        text: Number(row.delta).toFixed(2),

        showarrow: false,
        textangle: -90,

        xanchor: "center",
        yanchor: "middle",

        xshift: -6,
        yshift: 0,

        font: {
          size: 11,
          color: color
        },

        bgcolor: theme.annotationBg,
        bordercolor: theme.border,
        borderwidth: 0,
        borderpad: 1
      });
    });

    return annotations;
  }

  MB.Plot = {
    render: function () {
      var plotDiv = document.getElementById("plot");

      if (!window.Plotly) {
        plotDiv.innerHTML =
          "<p style='padding:1rem;color:red'>Plotly not found. Please add vendor/plotly/plotly.min.js.</p>";
        return;
      }

      var spectrum = getPlotData();
      var traces = makeTraces(spectrum);
      var theme = plotTheme();

      var layout = {
        title: {
          text: C.PLOT.title,
          font: {
            color: theme.text
          }
        },

        xaxis: {
          title: {
            text: C.PLOT.xLabel,
            font: { color: theme.text }
          },
          tickfont: { color: theme.text },
          range: [MB.State.velocityMin, MB.State.velocityMax],
          zeroline: false,
          showgrid: false,
          gridcolor: theme.grid,
          showline: true,
          linecolor: theme.axis,
          tickcolor: theme.axis,
          ticks: "outside",
          ticklen: 5,
          tickwidth: 1
        },

        yaxis: {
          title: {
            text: C.PLOT.yLabel,
            font: { color: theme.text }
          },
          tickfont: { color: theme.text },

          range: [-0.14, 1.08],
          zeroline: false,

          tickmode: "array",
          tickvals: [0, 0.25, 0.5, 0.75, 1.0],
          ticktext: ["0", "0.25", "0.50", "0.75", "1.00"],

          showticklabels: true,
          ticks: "outside",
          ticklen: 5,
          tickwidth: 1,
          tickcolor: theme.axis,

          showgrid: false,
          gridcolor: theme.grid,
          showline: true,
          linecolor: theme.axis
        },

        margin: {
          l: 65,
          r: 25,
          t: 55,
          b: 105
        },

        showlegend: true,

        legend: {
          orientation: "h",
          x: 0.5,
          xanchor: "center",
          y: -0.18,
          yanchor: "top",

          bgcolor: theme.legendBg,
          bordercolor: theme.border,
          borderwidth: 1,

          font: {
            size: 11,
            color: theme.text
          }
        },

        shapes: makeShapes(),
        annotations: makeMarkerAnnotations(),

        paper_bgcolor: theme.paper,
        plot_bgcolor: theme.bg,

        font: {
          color: theme.text
        }
      };

      var config = {
        responsive: C.PLOT.responsive,
        displaylogo: C.PLOT.displaylogo
      };

      Plotly.react(plotDiv, traces, layout, config);
    },

    resetView: function () {
      if (!window.Plotly) return;

      Plotly.relayout("plot", {
        "xaxis.range": [MB.State.velocityMin, MB.State.velocityMax],
        "yaxis.range": [-0.14, 1.08]
      });
    },

    downloadPng: function () {
      if (!window.Plotly) return;

      Plotly.downloadImage("plot", {
        format: "png",
        filename: C.EXPORT.pngFilename.replace(/\.png$/i, ""),
        height: 900,
        width: 1400,
        scale: 2
      });
    }
  };
})();