'use strict';

// Dependencies:
var fs = require('fs');
var csv = require('csv');
var jsonfile = require('jsonfile');
var moment = require('moment');

// cofiguration:
var csv_path = "data.csv";
var data_path = "data.json";
var metadata_path = "metadata.json";
//var id = "us15a";
var si_radar_id = 0,
  si_interval_start_time = 1,
  si_altitude_band = 2,
  si_avg_u_speed = 3,
  si_avg_v_speed = 4,
  si_avg_bird_density = 5,
  si_vertical_integrated_density = 6,
  si_number_of_measurements = 7;

function start() {
  fs.readFile(metadata_path, 'utf8', function (err, json) {
    if (err) {
      console.error("! Failed to read '" + metadata_path + "'. " + err);
      throw err;
    }

    var metadata = JSON.parse(json);
    var startMoment = moment.utc(metadata.dateMin);
    var endMoment = moment.utc(metadata.dateMax);
    var startTime = startMoment.valueOf();
    var endTime = endMoment.valueOf();
    var intervalMs = metadata.segmentInterval * 60 * 1000;
    var radarIndices = {};
    metadata.radars.forEach(function (radar, i) {
      radarIndices[radar.id] = i;
    });
    var segn = Math.floor((endTime - startTime) / intervalMs);
    var strn = metadata.strataCount;
    var radn = metadata.radars.length;
    var data = {
      densities: [],
      uSpeeds: [],
      vSpeeds: [],
      speeds: [],
      avDensities: []
    };
    var parseConfig = { auto_parse: true, auto_parse_date: true };

    var parser = csv.parse(parseConfig, function (err, records) {
      if (err) {
        console.error("! Failed to read '" + csv_path + "'. " + err);
        throw err;
      }

      var headers = records.shift(); // remove headers
      var segi, stri, radi;

      // Check if the given dates are inside the min-max range given in
      // the metadata:
      var minDate = -1;
      var maxDate = -1;
      records.forEach(function (record) {
        var date = new Date(record[si_interval_start_time]);
        record[si_interval_start_time] = date;
        if (minDate == -1 || date < minDate) minDate = date;
        if (maxDate == -1 || date > maxDate) maxDate = date;
      });
      if (minDate < startMoment.toDate()) {
        throw new Error("minDate < startMoment, minDate: " + minDate
          + ", startMoment: " + startMoment.toDate());
      }
      if (maxDate > endMoment.toDate()) {
        throw new Error("maxDate > endMoment, maxDate: " + maxDate
          + ", endMoment: " + endMoment.toDate());
      }

      // Prepare the data structure which is constructed such that it efficiently facilitates
      // the interpolation operations needed when constructing the paths.
      for (segi = 0; segi < segn; segi++) {
        var densities = [];
        var uSpeeds = [];
        var vSpeeds = [];
        var speeds = [];
        for (stri = 0; stri < strn; stri++) {
          var densities2 = [];
          var uSpeeds2 = [];
          var vSpeeds2 = [];
          var speeds2 = [];
          for (radi = 0; radi < radn; radi++) {
            densities2.push([]);
            uSpeeds2.push([]);
            vSpeeds2.push([]);
            speeds2.push([]);
          }
          densities.push(densities2);
          uSpeeds.push(uSpeeds2);
          vSpeeds.push(vSpeeds2);
          speeds.push(speeds2);
        }
        data.densities.push(densities);
        data.uSpeeds.push(uSpeeds);
        data.vSpeeds.push(vSpeeds);
        data.speeds.push(speeds);
      }

      // Parse the records and put all values for each segment in lists:
      var uSpeed, vSpeed, speed;
      records.forEach(function (record) {
        try {
          var dt = record[si_interval_start_time].getTime() - startTime;
          segi = Math.floor(dt / intervalMs);
          stri = record[si_altitude_band] - 1;
          radi = radarIndices[record[si_radar_id]];
          //console.log(segi, segn, stri, strn, radi, radn);
          uSpeed = record[si_avg_u_speed];
          vSpeed = record[si_avg_v_speed];
          speed = Math.sqrt(uSpeed * uSpeed + vSpeed * vSpeed);
          data.densities[segi][stri][radi].push(record[si_avg_bird_density]);
          data.uSpeeds[segi][stri][radi].push(uSpeed);
          data.vSpeeds[segi][stri][radi].push(vSpeed);
          data.speeds[segi][stri][radi].push(speed);
        }
        catch(error) {
          console.log(segi, segn, stri, strn, radi, radn);
          console.log(data.densities[segi]);
          console.log(data.densities[segi][stri]);
          console.log(data.densities[segi][stri][radi]);
          throw error;
        }
      });
      console.log(2);

      // Calculate the averages for each segment:
      for (segi = 0; segi < segn; segi++) {
        for (stri = 0; stri < strn; stri++) {
          for (radi = 0; radi < radn; radi++) {
            data.densities[segi][stri][radi] = average(data.densities[segi][stri][radi]);
            data.uSpeeds[segi][stri][radi] = average(data.uSpeeds[segi][stri][radi]);
            data.vSpeeds[segi][stri][radi] = average(data.vSpeeds[segi][stri][radi]);
            data.speeds[segi][stri][radi] = average(data.speeds[segi][stri][radi]);
          }
        }
      }
      console.log(3);

      // The strata height in km:
      var strataHeight = metadata.maxAltitude / metadata.strataCount / 1000;

      // Calculate average densities per radar-altitude combination, integrated
      // over the strata height. These numbers thus represent the number of birds
      // per square km in a given strata.
      for (stri = 0; stri < strn; stri++) {
        var avds = [];
        for (radi = 0; radi < radn; radi++) {
          var dsum = 0;
          for (segi = 0; segi < segn; segi++) {
            dsum += data.densities[segi][stri][radi];
          }
          avds[radi] = dsum / segn * strataHeight;
        }
        data.avDensities.push(avds);
      }

      console.log("# Writing " + data_path);
      jsonfile.writeFile(data_path, data, function (err) {
        if (err) {
          console.error("Failed to write '" + data_path + "'. " + err);
        }
        else {
          console.error("# Done");
        }
      });
    });

    console.log('# Reading ' + csv_path);
    fs.createReadStream(csv_path).pipe(parser);
  });
}

/**
 * Returns the average of the values in the given array.
 * @param   {Array}            ary     An array with numbers.
 * @param   {*}                undefAv The return value when the array is empty.
 * @returns {Number|undefined} The average or undefined if the array is empty.
 */
function average(ary, undefAv) {
  if (arguments.length === 1) { undefAv = 0; }
  if (ary === undefined) { return undefAv; }
  var len = ary.length;
  if (len === 0) { return undefAv;  }
  var r = 0;
  for (var i = 0; i < len; i++) { r += ary[i]; }
  return r / len;
}

start();
