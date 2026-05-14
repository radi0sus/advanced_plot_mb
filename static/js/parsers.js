(function () {
  "use strict";

  var MB = window.AdvancedPlotMB;
  var C = MB.Constants;

  function makeResult() {
    return {
      kind: "unknown",
      rows: [],
      warnings: [],
      messages: []
    };
  }

  function parseNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function cleanNucleusName(name) {
    return String(name || "")
      .replace(/:$/, "")
      .trim();
  }

  function isFeName(name) {
    return C.SUPPORTED_NUCLEI.namePattern.test(cleanNucleusName(name));
  }

  function extOf(filename) {
    var match = String(filename || "").toLowerCase().match(/\.([^.]+)$/);
    return match ? "." + match[1] : "";
  }

  function looksLikeOrcaOutput(text) {
    /*
      Content-based ORCA detection.

      Important:
      ORCA detection must happen before direct TXT/TSV detection,
      because ORCA coordinate lines may look like simple parameter rows:

        Fe  -0.161865  0.125773  -0.040520

      which would otherwise be misread as:
        Name δ ΔEQ FWHM
    */

    return (
      /O\s+R\s+C\s+A/i.test(text) ||
      /Program Version\s+\d+\.\d+(?:\.\d+)?/i.test(text) ||
      /ORCA\s+EPR\/NMR\s+CALCULATION/i.test(text) ||
      /ELECTRIC AND MAGNETIC HYPERFINE STRUCTURE/i.test(text) ||
      /Moessbauer quadrupole splitting parameter/i.test(text) ||
      /ORCA TERMINATED NORMALLY/i.test(text) ||
      (/Delta-EQ/i.test(text) && /RHO\s*\(\s*0\s*\)/i.test(text)) ||
      (/^\s*Nucleus:\s*\S+/mi.test(text) && /RHO\s*\(\s*0\s*\)/i.test(text))
    );
  }

  function looksLikeDirectParameterTable(text) {
    /*
      Direct parameter table:
        Name δ ΔEQ [FWHM] [Ratio]

      We only inspect the first non-empty, non-comment line.
    */

    var lines = text.split(/\r?\n/);

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i].trim();

      if (!line || line.startsWith("#")) continue;

      var parts = line.split(/\s+/);

      if (parts.length < 3) {
        return false;
      }

      var delta = Number(parts[1]);
      var deltaEq = Number(parts[2]);

      return Number.isFinite(delta) && Number.isFinite(deltaEq);
    }

    return false;
  }

  function detectFileKind(text, filename, hint) {
    var ext = extOf(filename);

    /*
      Priority:
      1. ORCA content
      2. Direct parameter table content
      3. User hint from button
      4. File extension fallback
      5. unknown
    */

    if (looksLikeOrcaOutput(text)) {
      return "orca";
    }

    if (looksLikeDirectParameterTable(text)) {
      return "txt";
    }

    if (hint === "orca" || hint === "txt") {
      return hint;
    }

    if (ext === ".out" || ext === ".log") {
      return "orca";
    }

    if (ext === ".txt" || ext === ".tsv" || ext === ".dat") {
      return "txt";
    }

    return "unknown";
  }

  function parseDeltaEqLine(line) {
    if (line.indexOf("Delta-EQ") === -1) return null;
    if (line.indexOf("mm/s") === -1) return null;

    /*
      ORCA 5 example:

      Delta-EQ=(1/2{e**2qQ}*sqrt(1+1/3*eta**2) =    35.544823 MHz =     3.064209 mm/s

      We want the last number before "mm/s".
    */

    var beforeUnit = line.split("mm/s")[0];
    var matches = beforeUnit.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/g);

    if (!matches || !matches.length) return null;

    return parseNumber(matches[matches.length - 1]);
  }

  function parseRhoLine(line) {
    /*
      ORCA examples:
  
        RHO(0)=  11815.532668228 a.u.**-3
        RHO(0) = 11815.532668228 a.u.**-3
  
      Important:
      Do not parse the "0" from RHO(0).
      Parse the first number after "=".
    */
  
    if (!/RHO\s*\(\s*0\s*\)/i.test(line)) {
      return null;
    }
  
    var normalized = String(line).replace(/\u00a0/g, " ");
  
    var match = normalized.match(
      /RHO\s*\(\s*0\s*\)\s*=\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)/i
    );
  
    if (match) {
      return parseNumber(match[1]);
    }

  /*
    Extra fallback:
    If weird spacing/formatting prevents the direct regex,
    split at "=" and parse the first number on the right side.
  */
  var parts = normalized.split("=");

  if (parts.length >= 2) {
    var rightSide = parts.slice(1).join("=");
    var numberMatch = rightSide.match(
      /[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?/
    );

    if (numberMatch) {
      return parseNumber(numberMatch[0]);
    }
  }

  return null;
}

  function finalizeOrcaCenter(result, center, filename) {
    if (!center) return;

    center.name = cleanNucleusName(center.name);

    if (!isFeName(center.name)) {
      result.warnings.push(
        filename + ": ignored nucleus " + center.name + ". Only Fe/57Fe is supported."
      );
      return;
    }

    if (
      center.isotope !== null &&
      center.isotope !== undefined &&
      Number(center.isotope) !== 57
    ) {
      result.warnings.push(
        filename + ": skipped " + center.name + " because isotope " + center.isotope + " is not 57."
      );
      return;
    }

    if (center.deltaEq === null || center.deltaEq === undefined) {
      result.warnings.push(
        filename + ": Fe center " + center.name + " skipped because Delta-EQ was not found."
      );
      return;
    }

    if (center.rho0 === null || center.rho0 === undefined) {
      result.warnings.push(
        filename + ": Fe center " + center.name + " skipped because RHO(0) was not found."
      );
      return;
    }

    if (center.isotope === null || center.isotope === undefined) {
      center.isotope = 57;
      result.warnings.push(
        filename + ": Fe center " + center.name + " imported, but isotope could not be verified. Assuming 57Fe."
      );
    }

    result.rows.push({
      name: center.name,
      isotope: center.isotope,
      deltaEq: center.deltaEq,
      rho0: center.rho0
    });
  }

  function parseOrcaDetailedHyperfineBlocks(text, filename) {
    var result = makeResult();
    result.kind = "orca";

    var lines = text.split(/\r?\n/);

    /*
      Strict ORCA hyperfine block start.

      ORCA 5 example:

        Nucleus   0Fe: A:ISTP=   57 I=  0.5 P= 17.2798 MHz/au**3

      This intentionally does NOT match:
        Atom   0Fe   basis set group => 1
        0 Fes
        geometry Fe lines
        Mulliken/Löwdin population lines
    */

    var nucleusBlockStartRe =
      /^\s*Nucleus\s+([A-Za-z0-9]+):\s+A:ISTP=\s*(\d+)/i;

    var current = null;
    var detailedBlockWasSeen = false;

    lines.forEach(function (line) {
      var startMatch = line.match(nucleusBlockStartRe);

      if (startMatch) {
        detailedBlockWasSeen = true;

        finalizeOrcaCenter(result, current, filename);

        current = {
          name: cleanNucleusName(startMatch[1]),
          isotope: Number(startMatch[2]),
          deltaEq: null,
          rho0: null
        };

        return;
      }

      if (!current) return;

      var deltaEq = parseDeltaEqLine(line);
      if (deltaEq !== null) {
        current.deltaEq = deltaEq;
      }

      var rho0 = parseRhoLine(line);
      if (rho0 !== null) {
        current.rho0 = rho0;
      }
    });

    finalizeOrcaCenter(result, current, filename);

    result.detailedBlockWasSeen = detailedBlockWasSeen;

    return result;
  }

  function parseOrcaFallbackEprNmrList(text, filename) {
    /*
      Fallback parser for older or slightly different ORCA outputs.

      It only uses:
        Nucleus:
        Delta-EQ
        RHO(0)

      It does NOT scan arbitrary Fe occurrences.
    */

    var result = makeResult();
    result.kind = "orca";

    var lines = text.split(/\r?\n/);

    var nuclei = [];
    var isotopes = [];
    var deltaEqs = [];
    var rho0s = [];

    var nucleusListRe = /^\s*Nucleus:\s*([A-Za-z0-9]+)/i;
    var isotopeRe = /Isotope\s*=\s*(\d+)/i;

    lines.forEach(function (line) {
      var nucleusMatch = line.match(nucleusListRe);

      if (nucleusMatch) {
        nuclei.push(cleanNucleusName(nucleusMatch[1]));
        isotopes.push(null);
        return;
      }

      if (nuclei.length > 0) {
        var isotopeMatch = line.match(isotopeRe);

        if (isotopeMatch && isotopes[isotopes.length - 1] === null) {
          isotopes[isotopes.length - 1] = Number(isotopeMatch[1]);
        }
      }

      var deltaEq = parseDeltaEqLine(line);
      if (deltaEq !== null) {
        deltaEqs.push(deltaEq);
      }

      var rho0 = parseRhoLine(line);
      if (rho0 !== null) {
        rho0s.push(rho0);
      }
    });

    if (!nuclei.length && !deltaEqs.length && !rho0s.length) {
      return result;
    }

    if (nuclei.length !== deltaEqs.length || nuclei.length !== rho0s.length) {
      result.warnings.push(
        filename + ": uncertain ORCA fallback parsing. Found " +
        nuclei.length + " nuclei, " +
        deltaEqs.length + " Delta-EQ values, " +
        rho0s.length + " RHO(0) values."
      );
    }

    var n = Math.min(nuclei.length, deltaEqs.length, rho0s.length);

    for (var i = 0; i < n; i += 1) {
      finalizeOrcaCenter(result, {
        name: nuclei[i],
        isotope: isotopes[i],
        deltaEq: deltaEqs[i],
        rho0: rho0s[i]
      }, filename);
    }

    return result;
  }

  function parseOrcaOutput(text, filename) {
    var detailed = parseOrcaDetailedHyperfineBlocks(text, filename);

    /*
      If detailed ORCA hyperfine blocks were seen, trust only them.
      Do not additionally run fallback, because long ORCA outputs contain
      many Fe-like occurrences outside the Mößbauer-relevant section.
    */

    if (detailed.detailedBlockWasSeen) {
      if (detailed.rows.length > 0) {
        detailed.messages.push(
          filename + " imported: " +
          detailed.rows.length +
          " Fe/57Fe Mößbauer center(s) found."
        );
      } else {
        detailed.warnings.push(
          filename + ": ORCA hyperfine section was found, but no complete Fe/57Fe Mößbauer center could be parsed."
        );
      }

      delete detailed.detailedBlockWasSeen;
      return detailed;
    }

    var fallback = parseOrcaFallbackEprNmrList(text, filename);

    if (fallback.rows.length > 0) {
      fallback.messages.push(
        filename + " imported via fallback parser: " +
        fallback.rows.length +
        " Fe/57Fe Mößbauer center(s) found."
      );
    } else {
      fallback.warnings.push(
        filename + ": no supported Fe/57Fe Mößbauer centers found."
      );
    }

    return fallback;
  }

  function parseParameterTable(text, filename) {
    var result = makeResult();
    result.kind = "txt";

    var lines = text.split(/\r?\n/);

    lines.forEach(function (rawLine, index) {
      var line = rawLine.trim();

      if (!line || line.startsWith("#")) return;

      var parts = line.split(/\s+/);

      if (parts.length < 3) {
        result.warnings.push(
          filename + ": line " + (index + 1) +
          " skipped. Expected at least: Name δ ΔEQ."
        );
        return;
      }

      var name = parts[0];
      var delta = parseNumber(parts[1]);
      var deltaEq = parseNumber(parts[2]);
      var fwhm = parts.length >= 4 ? parseNumber(parts[3]) : C.DEFAULTS.fwhm;
      var ratio = parts.length >= 5 ? parseNumber(parts[4]) : C.DEFAULTS.ratio;

      if (
        delta === null ||
        deltaEq === null ||
        fwhm === null ||
        ratio === null
      ) {
        result.warnings.push(
          filename + ": line " + (index + 1) +
          " skipped. Numerical value expected."
        );
        return;
      }

      result.rows.push({
        name: name,
        delta: delta,
        deltaEq: deltaEq,
        fwhm: fwhm,
        ratio: ratio
      });
    });

    result.messages.push(
      filename + " imported: " +
      result.rows.length +
      " direct parameter row(s) found."
    );

    return result;
  }

  MB.Parsers = {
    isFeName: isFeName,

    detectFileKind: detectFileKind,

    looksLikeOrcaOutput: looksLikeOrcaOutput,

    looksLikeDirectParameterTable: looksLikeDirectParameterTable,

    parseOrcaOutput: parseOrcaOutput,

    parseParameterTable: parseParameterTable,

    parseFile: function (text, filename, hint) {
      var kind = detectFileKind(text, filename, hint);

      if (kind === "orca") {
        return parseOrcaOutput(text, filename);
      }

      if (kind === "txt") {
        return parseParameterTable(text, filename);
      }

      return {
        kind: "unknown",
        rows: [],
        messages: [],
        warnings: [
          filename + ": unsupported or ambiguous file content. Expected ORCA output or TXT/TSV parameter table."
        ]
      };
    }
  };
})();