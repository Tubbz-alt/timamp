# About this visualisation

The resulting static visualization is meant to provide a holistic picture of the spatial and temporal variation in migration activity during a period of one to eight hours. To this end it shows a number of pathlines on a geographic map. Each pathline represents the expected travel path of an imaginary swarm of average migrants during the selected time period. This visualization does thus not show the travel paths of actual migrants but rather describes average migration patterns based on the data detailed in the previous sections.





# Future work

The reconstruction of the full migration velocity vector field from the sparse scattered data is done using a naive interpolation technique that assumes a smooth continuous variation of the conditions that affect the migrant velocities in between these samples. This assumption can be expected to not correspond with reality due to the impact of geographical features such as mountain ranges or meteorological features such as weather fronts. Knowledge on the impact of such features on migration patterns is, however, currently rather limited. Indeed, large scale migration data collection efforts, such as the one from which the shown data was sourced, can help expand this knowledge, while tailored visualisation techniques, such as the ones discussed here, are meant to facilitate as well as profit from such progress.

The pathlines in the TIMAMP visualisation are numerically integrated using Euler's method with time increments of 20 minutes, given the temporal aggregation of the (irregular) samples in 20 minutes time windows. The consequent cumulative error should be considered in greater detail. The application of specialised spatio-temporal interpolation and higher order integration techniques, may have to be considered in order to improve fidelity.

The fidelity of the reconstructed migrant density scalar field might benefit from an interpolation approach that takes the correlation with the migrant velocity vector field into account (Streletz ea, 2012).

- Streletz, G. J., Gebbie, G., Spero, H. J., Kreylos, O., Kellogg, L. H. & Hamann, B. (2012) Interpolating Sparse Scattered Oceanographic Data Using Flow Information, dec 2012.
- Weiskopf, D. & Erlebacher, G. (2005) Overview of flow visualization. The Visualization Handbook (eds C. D. Hansen & C. R. Johnson), pp. 261-278. Elsevier Butterworth-Heinmann, Burlington.

# Case study metadata json format

For each case study a set of metadata is provided in a json file. This file contains a json 
object with the following properties:

* __label__ - Text label.
* __dateFrom__ - The first day for which data is available, expressed as an object that can be passed to the moment constructor.
* __dateTill__ - The last day for which data is available, expressed as an object that can be passed to the moment constructor.
* __defaultFocusFrom__ - The initial focus moment, expressed as an object that can be passed to the moment constructor.
* __altitudes__ - The number of altitudes for which data is available.
* __minAltitude__ - The lowest altitude for which data is available.
* __maxAltitude__ - The highest altitude for which data is available.
* __strataCounts__ - The strata count options. Each value in this list must be a whole divisor of the number of altitudes for which data is available (see the *altitudes* property above).
* __defaultStrataCount__ - The default strata count.
* __defaultMigrantsPerPath__ - The number of migrants each pathline represents.
* __segmentSize__ - The duration of each segment, in minutes.
* __anchorInterval__ - The interval between potential anchors in km.
* __mapCenter__ - A list with two elements, the longitude and latitude (in degrees) on which to center the map.
* __mapScaleFactor__ - The factor with which the map-width needs to be multiplied to get the map scaling.
* __queryBaseUrl__ - The base url for the CartoDB queries, relative to the app's base.
* __colorLegendMarkers__ - The markers to be shown in the color legend. (currently unused)
* __scaleLegendMarkers__ - The markers to be shown in the scale legend.
* __radars__ - Array with objects, one for each radar, containing the following properties:
    * __id__ - The unique id.
    * __name__ 
    * __country__ - country code (currently unused)
    * __type__ - type tag (currently unused)
    * __longitude__ - expressed as a decimal degrees value
    * __latitude__ - expressed as a decimal degrees value
* __altitudes__ - Array with objects, one for each altitude, containing the following properties:
    * __min__ - the minimum of the altitude range
    * __max__ - the maximum of the altitude range
    * __idx__ - the index

# 3rd-Party libraries

Most 3rd-party client libraries are managed through NPM, except for the Foundation library, which is a custom build. See below for more details.

## NPM components

* __modernizr__
* __fastclick__
* __moment__ - better date/time handling
* __d3__ - visualization
* __topojson__ - d3 plugin for drawing topography from topojson data
* __jquery__ - actually only needed for Foundation

## Foundation

This app uses Foundation for its responsiveness.
This Foundation is a custom build of v5.5.2 that includes:

* grid
* visibility

The js and css files are maintained in the ./vendor directory.

# References

- __[Darmofal_96a]__ – _An Analysis of 3D Particle Path Integration Algorithms._ D. L. Darmofal. Journal of Computanional Physics 123, 182–195 (1996).