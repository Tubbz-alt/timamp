/*jshint unused: false, latedef: false */
/*jslint vars: true, plusplus: true, undef: true, continue: true */
/*global requirejs, require */

"use strict";

// -----------------------------------------------------------------------------
// Configuration settings that do not change:

/**
 * The radius around radars in km in which path anchors are considered.
 * @type {number}
 */
var radarAnchorRadius = 75;

/**
 * the interval between anchors in km
 * @type {number}
 */
var anchorInterval = 10;

/**
 * The number of birds each path represents.
 * @type {number}
 */
var pathBirdCount = 50000;

/**
 * The height of the template map divided by its width, used to obtain the actual
 * height of the map, given the actual width after resizing.
 * @type {number}
 */
var mapHeightFactor = 940 / 720;

/**
 * The template legend width divided by the template map width, used to obtain the
 * actual width of the legend, given the actual width after resizing.
 * @type {number}
 */
var legendWidthFactor = 200 / 720;

/**
 * The minimum value of the range of hues to pick from for strata colors.
 * @type {number}
 */
var altiHueMin = 0.5;

/**
 * The maximum value of the range of hues to pick from for strata colors.
 * @type {number}
 */
var altiHueMax = 1;

/**
 * The saturation for strata colors.
 * @type {number}
 */
var altiSaturation = 1;

/**
 * The brightness for strata colors.
 * @type {number}
 */
var altiBrightness = 0.7;


// -----------------------------------------------------------------------------
// System variables:

/** @type {number} */ var mapW = 0;
/** @type {number} */ var mapH = 0;
/** @type {number} */ var legendW = 0;
/** @type {number} */ var anchorArea = anchorInterval * anchorInterval;
/** @type {array}  */ var anchorLocations;
/** @type {Object} */ var svg;
/** @type {Object} */ var pathsSVGGroup;
/** @type {Object} */ var projection;
/** @type {Object} */ var projectionPath;
/** @type {Object} */ var caseStudy;
/** @type {Object} */ var currData;

// -----------------------------------------------------------------------------

var arty = false;

/**
 * Start the app. Call this function from a script element at the end of the html-doc.
 * @param {string} _caseStudy The initial case study object as initialized in the
 * init.js files for each case study.
 */
function startApp(_caseStudy) {
  // assert that SVG is supported by the browser:
  if (!document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1")) {
    alert('SVG is not supported in your browser. Please use a recent browser.');
    return;
  }

  d3.select("#path-bird-count").text(numeral(pathBirdCount).format('0,0'));
  d3.select("#radar-anchor-radius").text(radarAnchorRadius);

  caseStudy = _caseStudy;

  // load the case study data:
  dataService.initCaseStudy(caseStudy, function () {
    //console.log(caseStudy);

    // parse the url query:
    var urlQuery = {};
    location.search.replace('\?','').split('&').map(function (nvPair) {
      nvPair = nvPair.split('=');
      urlQuery[nvPair[0]] = nvPair[1];
    });
    //console.log(urlQuery);
    if (urlQuery.strataCount) { setStrataCount(urlQuery.strataCount); }
    else if (urlQuery.altBands) { setStrataCount(urlQuery.altBands); }  // legacy

    var busy = 3;

    // load the topography:
    d3.json(caseStudy.topoJsonUrl, function (error, json) {
      if (error) {
        console.error(error);
        return;
      }
      caseStudy.topoJson = json;
      if (--busy == 0) initDone();
    });

    // load the query template:
    dataService.loadQueryTemplate(caseStudy.queryTemplateUrl, function () {
      if (--busy == 0) initDone();
    });

    //updateAnchors();
    updateColors();

    if (--busy == 0) initDone();
  });
}

/** Initialize the anchors. */
function initAnchors() {
  var locTopLeft = projection.invert([0, 0]);  // the location at the top-left corner
  var locBotRight = projection.invert([mapW, mapH]);  // the loc. at the bottom-right
  var rra = util.geo.distAngle(radarAnchorRadius);  // radar radius as angel
  var dlon = util.geo.destination(caseStudy.mapCenter, 90, anchorInterval)[0]
    - caseStudy.mapCenter[0];  // longitude delta
  var dlat = util.geo.destination(caseStudy.mapCenter, 0, anchorInterval)[1]
    - caseStudy.mapCenter[1];  // latitude delta
  anchorLocations = [];
  for (var lon = locTopLeft[0]; lon < locBotRight[0]; lon += dlon) {
    for (var lat = locTopLeft[1]; lat > locBotRight[1]; lat -= dlat) {
      caseStudy.radars.forEach(function (radar) {
        if (util.degrees(d3.geo.distance(radar.coordinate, [lon, lat])) <= rra) {
          anchorLocations.push([lon, lat]);
        }
      });
    }
  }
}

/**
 * Prepare the hues for the altitude strata.
 */
function updateColors() {
  caseStudy.hues = [];
  caseStudy.altHexColors = [];
  var altn = caseStudy.strataCount;
  var hue;
  if (altn == 1) {
    hue = (altiHueMin + altiHueMax) / 2;
    caseStudy.hues.push(hue);
    caseStudy.altHexColors.push(util.hsvToHex(hue, altiSaturation, altiBrightness));
  }
  else {
    for (var alti = 0; alti < altn; alti++) {
      hue = util.mapRange(alti, 0, altn - 1, altiHueMin, altiHueMax);
      caseStudy.hues.push(hue);
      caseStudy.altHexColors.push(util.hsvToHex(hue, altiSaturation, altiBrightness));
    }
  }
}

/**
 * Use this function to update the strataCount value in the case study.
 * @param {number} newCount
 */
function setStrataCount(newCount) {
  // Assert that the strata count is a whole divisor of the number
  // of altitudes in the data.
  if (caseStudy.altitudes % newCount != 0) {
    console.error("The given strata count (" + newCount
      + ") should be a whole divisor of the number of altitudes in the data ("
      + caseStudy.altitudes + ").");
    return;
  }

  caseStudy.strataCount = newCount;
}

function initDone() {
  caseStudy.focusDuration = 8;

  var dayMin = caseStudy.minMoment.date();
  var dayMax = caseStudy.maxMoment.date();

  d3.select("#input-day")
    .property('value', caseStudy.focusMoment.date())
    .attr('min', caseStudy.minMoment.date())
    .attr('max', caseStudy.maxMoment.date())
    .on('change', function () {
      //console.log("change", d3.select(this).property('value'));
      var date = parseInt(d3.select(this).property('value'));
      caseStudy.focusMoment.date(date);
      updateMap(true, false);
    });

  d3.select("#input-hour")
    .property('value', caseStudy.focusMoment.hour())
    .on('change', function () {
      var inputDay = d3.select("#input-day");
      var date = parseInt(inputDay.property('value'));
      var inputHour = d3.select("#input-hour");
      var hour = parseInt(inputHour.property('value'));
      if (hour >= 24) {
        if (date >= dayMax) {
          date = dayMax;
          hour = 23;
        }
        else {
          date++;
          hour = 0;
        }
      }
      else if (hour < 0) {
        if (date <= dayMin) {
          date = dayMin;
          hour = 0;
        }
        else {
          date--;
          hour = 23;
        }
      }

      inputDay.property('value', date);
      inputHour.property('value', hour);

      var focusDirty = false;
      if (caseStudy.focusMoment.date() != date) {
        caseStudy.focusMoment.date(date);
        focusDirty = true;
      }
      if (caseStudy.focusMoment.hour() != hour) {
        caseStudy.focusMoment.hour(hour);
        focusDirty = true;
      }
      if (focusDirty) updateMap(true, false);
    });

  d3.select("#input-strata")
    .selectAll('option')
    .data(caseStudy.strataCounts)
    .enter().append("option")
    .property('value', util.id)
    .text(util.id);
  d3.select("#input-strata")
    .property('value', caseStudy.strataCount)
    .on('change', function () {
      //console.log("input-strata changed:", d3.select(this).property('value'));
      setStrataCount(d3.select(this).property('value'));
      //updateAnchors();
      updateColors();
      updateMap(true, true);
    });

  d3.select("#input-duration")
    .property('value', caseStudy.focusDuration)
    .on('change', function () {
      caseStudy.focusDuration = parseInt(d3.select("#input-duration").property('value'));
      updateMap(true, false);
    });

  d3.select(window)
    .on('resize', Foundation.utils.throttle(function(e) {
      if (d3.select("#map-container").node().getBoundingClientRect().width != mapW) {
        updateMap(false, true);
      }
    }, 25));

  // First update the map data and add the svg element to avoid miscalculation
  // of the actual size of the svg content (on Chrome).
  updateMapData();
  svg = d3.select("#map-container").append("svg")
    .style("width", mapW)
    .style("height", mapH);

  // Now update the map for real:
  updateMap(true, true);
}

function updateMap(dataDirty, mapDirty) {
  if (mapDirty) updateMapData();

  drawMap();

  if (dataDirty) {
    var data = {
      focusMoment: moment.utc(caseStudy.focusMoment),
      interval : 20 /* the duration of a window in minutes */,
      intervalCount: caseStudy.focusDuration * 3
    };
    dataService.loadData(caseStudy.queryBaseUrl, data, caseStudy, function () {
      currData = data;
      drawPaths(currData);
    });
  }
  else {
    drawPaths(currData);
  }
}

function updateMapData() {
  var svgRect = d3.select("#map-container").node().getBoundingClientRect();
  mapW = svgRect.width;
  //console.log("- mapW:", mapW);
  mapH = mapW * mapHeightFactor;
  legendW = mapW * legendWidthFactor;

  // specify the projection based of the size of the map:
  projection = caseStudy.getProjection(caseStudy, mapW, mapH);

  // initialize the d3 path with which to draw the geography:
  projectionPath = d3.geo.path().projection(projection);

  initAnchors();
}

function drawMap() {
  if (svg) { svg.remove(); }
  svg = d3.select("#map-container").append("svg")
    .attr("width", mapW)
    .attr("height", mapH)
    .classed("map", true);

  svg.append("defs")
    .append("clipPath")
    .attr("id", "clipRect")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", mapW)
    .attr("height", mapH);

  var svgGroup = svg.append("svg:g")
    .attr("style", "clip-path: url(#clipRect);");

  if (arty) {
    svg.attr("style", "background: #fff;");
  }
  else {
    var datum = topojson.feature(
      caseStudy.topoJson,
      caseStudy.topoJson.objects.countries
    );
    svgGroup.append("svg:path")
      .datum(datum)
      .classed("map-land", true)
      .attr("d", projectionPath);

    datum = topojson.mesh(
      caseStudy.topoJson,
      caseStudy.topoJson.objects.countries,
      function(a, b) { return a !== b; }
    );
    svgGroup.append("svg:path")
      .datum(datum)
      .classed("country-boundary", true)
      .attr("d", projectionPath);

    var graticule = d3.geo.graticule()
      .step([1, 1]);
    svgGroup.append("svg:path")
      .datum(graticule)
      .classed("graticule", true)
      .attr("d", projectionPath);

    // radar radius as angel:
    var rra = util.geo.distAngle(radarAnchorRadius);
    //console.log("rra:", rra);

    // draw radars:
    var radarGroup = svgGroup.append("svg:g");
    var circle;
    caseStudy.radars.forEach(function (radar, radi) {
      //rp = projection(radar.coordinate);
      //radarGroup.append('svg:circle')
      //  .attr('cx', rp[0])
      //  .attr('cy', rp[1])
      //  .attr('r', 2)
      //  .classed("radar-center", true);

      circle = d3.geo.circle()
        .origin(radar.coordinate)
        .angle(rra)
        .precision(0.1);
      radarGroup.append("svg:path")
        .datum(circle)
        .attr("d", projectionPath)
        .classed("radar-radius", true);

      // Draw series points around radar at the marker radius:
      //var n = 36;
      //for (var i = 0; i < n; i++) {
      //  var bearing = util.mapRange(i, 0, n, 0, 360);
      //  var dest = util.geo.destination(radar.coordinate, bearing, radarAnchorRadius);
      //  circle = d3.geo.circle().origin(dest).angle(.01);
      //  radarGroup.append("svg:path")
      //    .datum(circle)
      //    .attr("d", projectionPath)
      //    .classed("highlight3", true);
      //}
    });
  }

  // add the paths group:
  pathsSVGGroup = svgGroup.append("svg:g");

  if (!arty) {
    // draw legends:
    drawColorLegend(svgGroup.append("svg:g"));
    drawSizeLegend(svgGroup.append("svg:g"), caseStudy.scaleLegendMarkers);
  }
}

/**
 * Draw the paths.
 * @param {Object} data The data object.
 */
function drawPaths(data) {
  //console.log(">> drawPaths - wind: " + wind);
  Math.seedrandom('ENRAM');

  //var segi, segn = data.intervalCount;
  var half = Math.floor(data.intervalCount / 2);
  var rlons = caseStudy.radLons;
  var rlats = caseStudy.radLats;
  var idw = util.idw;

  // for each strata:
  var strn = caseStudy.strataCount;
  for (var stri = 0; stri < strn; stri++) {
    var densities = data.avDensities[stri];
    anchorLocations.forEach(function (anchorLoc) {
      var density = idw(anchorLoc[0], anchorLoc[1], densities, rlons, rlats, 2);
      if (Math.random() >= density * anchorArea / pathBirdCount) {
        return;
      }

      var pathData = buildPathData(data, stri, anchorLoc, half);

      //console.log(pathData.map(function (d) {
      //  return '[' + d[0] + ', ' + d[1] + ', ' + d[2] + ', ' + d[3] + ']';
      //}));

      drawPath2(data, pathData, stri);
    });
  }
}

function buildPathData(data, stri, anchorLoc, half) {
  var pathData = [];
  var segi, segn = data.intervalCount;
  var loc, lon, lat, dlon, dlat, pp, angl, dist, dens;
  var rlons = caseStudy.radLons;
  var rlats = caseStudy.radLats;
  var idw = util.idw;
  var tf1 = data.interval * 0.06;

  // tail half:
  loc = anchorLoc;
  pp = projection(loc);
  for (segi = half - 1; segi >= 0; segi--) {
    lon = loc[0];
    lat = loc[1];
    dlon = idw(lon, lat, data.uSpeeds[segi][stri], rlons, rlats, 2) * tf1;
    dlat = idw(lon, lat, data.vSpeeds[segi][stri], rlons, rlats, 2) * tf1;
    angl = Math.atan2(-dlon, -dlat);
    dist = util.vectorLength(dlon, dlat);
    loc = util.geo.destinationRad(loc, angl, dist);
    dens = idw(loc[0], loc[1], data.densities[segi][stri], rlons, rlats, 2);
    pp = projection(loc);
    pp.push(dens, angl + Math.PI);
    pathData.unshift(pp);
  }

  // front half:
  loc = anchorLoc;
  pp = projection(loc);
  for (segi = half; segi < segn; segi++) {
    pp = projection(loc);
    lon = loc[0];
    lat = loc[1];
    dens = idw(lon, lat, data.densities[segi][stri], rlons, rlats, 2);
    dlon = idw(lon, lat, data.uSpeeds[segi][stri], rlons, rlats, 2) * tf1;
    dlat = idw(lon, lat, data.vSpeeds[segi][stri], rlons, rlats, 2) * tf1;
    angl = Math.atan2(dlon, dlat);
    pp.push(dens, angl);
    pathData.push(pp);
    dist = util.vectorLength(dlon, dlat);
    loc = util.geo.destinationRad(loc, angl, dist);
  }

  pp = projection(loc);
  dens = idw(loc[0], loc[1], data.densities[half][stri], rlons, rlats, 2);
  pp.push(dens, 0); // density
  pathData.push(pp);
  return pathData;
}

var lineFn = d3.svg.line()
  .x(function (d) { return d[0]; })
  .y(function (d) { return d[1]; })
  .interpolate("basis-closed");

function drawPath1(caseData, pathData, stri) {
  var pathGr = pathsSVGGroup.append("svg:g");
  var lcolor = caseStudy.altHexColors[stri];
  var segi, segn = caseData.intervalCount;
  for (segi = 0; segi < segn; segi++) {
    var node1 = pathData[segi];
    var node2 = pathData[segi + 1];
    var dens = (node1[2] + node2[2]) / 2;
    var lwidth = util.mapRange(dens, 0, 100, 0, 10);
    //console.log(node1, node2, dens, lwidth, lcolor);
    pathGr.append("svg:line")
      .attr("x1", node1[0]).attr("y1", node1[1])
      .attr("x2", node2[0]).attr("y2", node2[1])
      .attr("style", "stroke:" + lcolor
      + ";stroke-width: " + lwidth
      + ";stroke-linecap: round"
      + ";opacity: 1");
  }
}

function drawPath2(caseData, pathData, stri) {
  //console.log(pathData);
  if (pathData.length != caseData.intervalCount + 1) {
    throw new Error("Unexpected pathData length: " + pathData.length
      + ", " + caseData.intervalCount);
  }
  var pathGr = pathsSVGGroup.append("svg:g");
  var lcolor = caseStudy.altHexColors[stri];
  var segi, segn = caseData.intervalCount;
  var lineData = [];
  var segd, angle, radius, dx, dy;
  var radiusFactor = 0.05;

  segd = pathData[0];
  radius = segd[2] * radiusFactor;
  angle = segd[3] + Math.PI * .5;
  dx = Math.sin(angle) * radius;
  dy = -Math.cos(angle) * radius;
  lineData.push([segd[0] + dx, segd[1] + dy]);
  lineData.unshift([segd[0] - dx, segd[1] - dy]);

  for (segi = 1; segi < segn; segi++) {
    segd = pathData[segi];
    angle = (pathData[segi - 1][3] + segd[3] + Math.PI) * .5;
    radius = segd[2] * radiusFactor;
    dx = Math.sin(angle) * radius;
    dy = -Math.cos(angle) * radius;
    lineData.push([segd[0] + dx, segd[1] + dy]);
    lineData.unshift([segd[0] - dx, segd[1] - dy]);
  }

  segd = pathData[segn];
  radius = segd[2] * radiusFactor;
  angle = segd[3] + Math.PI * .5;
  dx = Math.sin(angle) * radius;
  dy = -Math.cos(angle) * radius;
  lineData.push([segd[0] + dx, segd[1] + dy]);
  lineData.unshift([segd[0] - dx, segd[1] - dy]);

  //console.log(lineData.map(function (d) {
  //  return '[' + d[0] + ', ' + d[1] + ']';
  //}));

  // draw paths:
  var opacity = arty ? .6 : .6;
  pathGr.append("svg:path")
    .attr("d", lineFn(lineData))
    .attr("style", "fill: " + lcolor + "; fill-opacity: " + opacity + ";");

  // draw head dot:
  if (arty) {
    radius = 0;
    pathData.forEach(function (d) { radius += d[2]; });
    radius = Math.max(1, radius / pathData.length);
    opacity = .5;
  }
  else {
    radius = Math.max(1.5, pathData[segn][2] * radiusFactor + .5);
    opacity = .5;
  }
  pathGr.append('svg:circle')
    .attr('cx', pathData[segn][0])
    .attr('cy', pathData[segn][1])
    .attr('r', radius)
    .attr("style", "fill: " + lcolor + "; fill-opacity: " + opacity + ";");

}

/**
 * Draws the color legend in a horizontal layout.
 * @param svgGroup
 */
function drawColorLegend_hor(svgGroup) {
  var legendH = 12;
  var legendL = 25;
  //var tx0 = legendL;
  //var td = 6;
  var ty = mapH - 20 - legendH - 8;
  var markerGr = svgGroup.append("svg:g");
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", legendL)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("0");
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", legendL + legendW / 2)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("2");
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", legendL + legendW + 6)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("4 km");

  var lineH = 7;
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL)
    .attr("y2", mapH - 20);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL + legendW / 2)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL + legendW / 2)
    .attr("y2", mapH - 20);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL + legendW)
    .attr("y1", mapH - 20 - legendH - lineH)
    .attr("x2", legendL + legendW)
    .attr("y2", mapH - 20);

  var tx = legendL;
  ty = mapH - 20 - legendH;
  var alti, altn = caseStudy.strataCount;
  var dx = legendW / altn;
  for (alti = 0; alti < altn; alti++) {
    svgGroup.append("svg:rect")
      .attr("x", tx)
      .attr("y", ty)
      .attr("width", Math.ceil(dx))
      .attr("height", legendH)
      .attr("style", "fill:" + caseStudy.altHexColors[alti] + ";");
    tx += dx;
  }
}

/**
 * Draws the color legend in a vertical layout.
 * @param svgGroup
 */
function drawColorLegend(svgGroup) {
  var margin = 20;
  var legendW = 12;
  var legendH = 100;
  var legendT = margin;

  var ty = legendT;
  var alti, altn = caseStudy.strataCount;
  var dy = legendH / altn;
  var hue, hex;
  for (alti = altn - 1; alti >= 0; alti--) {
    svgGroup.append("svg:rect")
      .attr("x", margin)
      .attr("y", ty)
      .attr("width", legendW)
      .attr("height", Math.ceil(dy))
      .attr("style", "fill:" + caseStudy.altHexColors[alti] + ";");
    ty += dy;
  }

  var lineW = 7;
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", margin)
    .attr("y1", legendT)
    .attr("x2", margin + legendW + lineW)
    .attr("y2", legendT);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", margin + legendW)
    .attr("y1", legendT + legendH / 2)
    .attr("x2", margin + legendW + lineW)
    .attr("y2", legendT + legendH / 2);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", margin)
    .attr("y1", legendT + legendH)
    .attr("x2", 84)
    .attr("y2", legendT + legendH);

  svgGroup.append("svg:text")
    .classed("legend-label", true)
    .attr("x", margin + legendW + lineW + 4)
    .attr("y", legendT + 4)
    .text("4000 m");
  svgGroup.append("svg:text")
    .classed("legend-label", true)
    .attr("x", margin + legendW + lineW + 4)
    .attr("y", legendT + legendH / 2 + 4)
    .text("2000 m");

  svgGroup.append("svg:text")
    .classed("legend-label", true)
    .attr("x", margin + legendW + lineW + 2)
    .attr("y", legendT + legendH - 4)
    .text("altitude");
}

/**
 * Draws the size legend.
 * @param svgGroup
 * @param markers
 */
function drawSizeLegend(svgGroup, markers) {
  var totalKm = markers[2];
  var radar = caseStudy.radars[0];
  var destProj = projection(util.geo.destination(radar.coordinate, 90, totalKm));
  var legendW = destProj[0] - projection(radar.coordinate)[0];
  var marginR = 45;
  var legendL = mapW - marginR - legendW;
  var legendR = mapW - marginR;
  var lineH = 7;
  var ty = mapH - 20 - lineH - 4;

  var markerGr = svgGroup.append("svg:g");
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", legendL)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text("0");
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", (legendL + legendR) / 2)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text(markers[1]);
  markerGr.append("svg:text")
    .classed("legend-label", true)
    .attr("x", legendR + 8)
    .attr("y", ty)
    .attr("text-anchor", "middle")
    .text(markers[2] + " km");

  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20)
    .attr("x2", legendR)
    .attr("y2", mapH - 20);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendL)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", legendL)
    .attr("y2", mapH - 20);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", (legendL + legendR) / 2)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", (legendL + legendR) / 2)
    .attr("y2", mapH - 20);
  svgGroup.append("svg:line")
    .classed("scale-legend-line", true)
    .attr("x1", legendR)
    .attr("y1", mapH - 20 - lineH)
    .attr("x2", legendR)
    .attr("y2", mapH - 20);
}
