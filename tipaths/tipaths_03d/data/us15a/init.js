/**
 * Created by wouter on 22/09/2015.
 */

function dataServiceInitializer(caseStudy) {
  var checkData = true;

  var dataService = {
    data: null
  };

  dataService.initialize = function(handler) {
    d3.json(caseStudy.urlBase + "data.json", function (error, data) {
      //console.log(caseStudy);
      if (error) {
        console.error(error);
        //throw new Error("Error in dataService.loadCaseStudy. "
        //    + JSON.parse(error.responseText).error.join("; "));
        return;
      }

      if (checkData) dataService.checkData(data);
      dataService.data = data;
      handler();
    });
  };


  /** Check if the given data is OK:
   * - densities: data matrix with dimensions: [segments, strata, radars].
   * - uSpeeds: data matrix with dimensions: [segments, strata, radars].
   * - vSpeeds: data matrix with dimensions: [segments, strata, radars].
   * - speeds: data matrix with dimensions: [segments, strata, radars].
   * - avDensities: data matrix with dimensions: [strata, radars].
   */
  dataService.checkData = function (data) {
    var startTime = caseStudy.minMoment.valueOf();
    var endTime = caseStudy.maxMoment.valueOf();
    var dt = endTime - startTime;
    var itervalSec = caseStudy.segmentInterval * 60 * 1000;
    var segn = Math.floor(dt / itervalSec);
    var strn = Math.max.apply(null, caseStudy.strataCounts);
    var radn = caseStudy.radarCount;
    var segi, stri;

    if (data.densities.length != segn) { throw ("data.densities.length != segn"); }
    if (data.uSpeeds.length != segn) { throw ("data.uSpeeds.length != segn"); }
    if (data.vSpeeds.length != segn) { throw ("data.vSpeeds.length != segn"); }
    if (data.speeds.length != segn) { throw ("data.speeds.length != segn"); }

    for (segi = 0; segi < segn; segi++) {
      if (data.densities[segi].length != strn) {
        throw ("data.densities[segi].length != strn");
      }
      if (data.uSpeeds[segi].length != strn) {
        throw ("data.uSpeeds[segi].length != strn");
      }
      if (data.vSpeeds[segi].length != strn) {
        throw ("data.vSpeeds[segi].length != strn");
      }
      if (data.speeds[segi].length != strn) {
        throw ("data.speeds[segi].length != strn");
      }

      for (stri = 0; stri < strn; stri++) {
        if (data.densities[segi][stri].length != radn) {
          throw ("data.densities[segi][stri].length != radn");
        }
        if (data.uSpeeds[segi][stri].length != radn) {
          throw ("data.uSpeeds[segi][stri].length != radn");
        }
        if (data.vSpeeds[segi][stri].length != radn) {
          throw ("data.vSpeeds[segi][stri].length != radn");
        }
        if (data.speeds[segi][stri].length != radn) {
          throw ("data.speeds[segi][stri].length != radn");
        }
      }
    }

    if (data.avDensities.length != strn) {
      throw ("data.avDensities.length != strn");
    }
    for (stri = 0; stri < strn; stri++) {
      if (data.avDensities[stri].length != radn) {
        throw ("data.avDensities[stri].length != radn");
      }
    }
  };

  dataService.loadData = function (handler) {
    //console.log(">> dataService.loadData()");
    var data = initDataObject(caseStudy);
    var startTime = caseStudy.minMoment.valueOf();
    var dt = data.focusMoment.valueOf() - startTime;
    var intervalSec = caseStudy.segmentInterval * 60 * 1000;
    var iFrom = Math.floor(dt / intervalSec);
    var iTill = iFrom + data.intervalCount;
    //console.log(firstIntervalIdx, caseStudy.minMoment.toDate(), data.focusMoment.toDate());

    data.densities = this.data.densities.slice(iFrom, iTill);
    data.uSpeeds = this.data.uSpeeds.slice(iFrom, iTill);
    data.vSpeeds = this.data.vSpeeds.slice(iFrom, iTill);
    data.speeds = this.data.speeds.slice(iFrom, iTill);
    data.avDensities = this.data.avDensities;

    handler(data);
  };

  return dataService;
}

var us15a = function () {
  // case study constructor:

  var caseStudy = initCaseStudy("us15a", dataServiceInitializer);

  caseStudy.getProjection = function (caseStudy, mapWidth, mapHeight) {
    return d3.geo.mercator()
      .scale(caseStudy.mapScaleFactor * mapWidth)
      .translate([mapWidth / 2, mapHeight / 2])
      .center(caseStudy.mapCenter);
  };

  return caseStudy;
}();
