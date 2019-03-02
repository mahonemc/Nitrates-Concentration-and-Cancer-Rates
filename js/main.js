//layer groups
var tracts = L.featureGroup(),
	wells = L.layerGroup(),
	nitrateRatesIDWLayerGroup = L.layerGroup(),
	joinedGroup = L.layerGroup(),
	regressionResidualsLayerGroup = L.layerGroup();

//json points
var wellPts,
	cTracts,
	layerList,
    wellPointsArray = [],
	interpolatedNitrateRatesArray = [],
    interpolatedNitrateAndCancerRatesArray = [],
	interpolatedNCRArray = [],
    observedNitrateAndCancerRatesArray = [];


//IDW input variable, set to a default 
var distDecayCoeff = 2,
	hexbinArea = 10; // 10 sq mi

// global variables for the feature collections
var tractsCentroids,
	censusTractsFeatures,
	regressionFeaturesHexbins,
    wellsFeatureCollection,
    cancerGridPts,
	collectFeatHexbins;

	//add OSM base tilelayer
var OSMLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    });
    
//add black and white base tilelayer
var blackAndWhite = L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
	attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
    
//add stamen map
var topo = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}', {
	attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> — Map data © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: 'abcd',
    minZoom: 0,
    maxZoom: 20,
    ext: 'png'
});
	
	    
//create basemap layer group for layer control
var baseMaps = {
    "OpenStreetMap": OSMLayer,
    "Black and White": blackAndWhite,
    "Stamen Tiles": topo
};

var overlays = {
	"Census Tracts": tracts,
	"Wells": wells,
	};

//create map
var mapOpt = {
    center: [44.669778, -90.311975],
    zoom: 6,
	minZoom: 6,
	maxZoom: 17,
	maxBounds: L.latLngBounds([40.822448, -80.120168], [48.628936, -100.325876]), // panning bounds so the user doesn't pan too far away from Wisconsin
	
    layers: [OSMLayer],
};

//create map
var map = L.map('map', mapOpt);
 

// cycle through geojson to get an array for census tracts
$.getJSON( "https://mahonemc.github.io/Nitrates-Concentration-and-Cancer-Rates/data/cancer_tracts.json", function(data){
	cTracts = L.geoJson(data, {
        // Create a style for the census tracts
		style: function (feature) {
			return {
                color: 'grey', // set stroke color
                weight: 0.25, // set stroke weight
                fillOpacity: 0.5, // override the default fill opacity
                opacity: 1 // border opacity
            };
		}
	}).addTo(tracts);
	
	addMyData();
});
	
// This function is run for every feature found in the geojson file. It adds the feature to the empty layer we created above
function addMyData(){
	var breaks = getCancerRateClassBreaks(cTracts);
	
	cTracts.eachLayer(function (layer) {
		layer.setStyle({
            fillColor: getCancerRateColor(layer.feature.properties.canrate, breaks)
		});
		// Build the popup for the well point
        var popup = "<b>Cancer Rate in Percent: </b>" + (layer.feature.properties.canrate *100).toLocaleString() + "%";

        // Bind the popup to the well point
        layer.bindPopup(popup);
	
})
	cTracts.bringToBack();
	createCanLegend(breaks);
	
}

// cycle through geojson to get an array
$.getJSON( "https://mahonemc.github.io/Nitrates-Concentration-and-Cancer-Rates/data/well_nitrate.json", function(data){
	wellPts = L.geoJSON(data, {
	// Create a style for the well points
		pointToLayer: function (feature, latlng) {
				return L.circleMarker(latlng, {
					fillColor: '#3d3d3d',
					fillOpacity: 1,
					color: '#3d3d3d',
					weight: 0.25,
					opacity: 1,
					radius: 2.5
				});
			}

    }).addTo(wells);
	drawWells();
		
	});

function drawWells() {
	// Loop through each feature, set its symbology, and build and bind its popup
	
	// Get the class breaks based on the ckmeans classification method
	var breaks = nitrateBreaks(wellPts);
    
	wellPts.eachLayer(function (layer) {
		
		// Set its color based on the nitrate concentration
        layer.setStyle({
            fillColor: nitrateColorBreaks(layer.feature.properties.nitr_ran, breaks)
        });
		// Build the popup for the well point
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the well point
        layer.bindPopup(popup);
	})
	
	createLegend(breaks);
	
	
} 

//create Layers on layercontrol
function createLayers(overlays) {

    // Add the layer control to the map
    layerList = L.control.layers(baseMaps, overlays, {
        collapsed: true, // Keep the layer list open
        // Assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off
        }).addTo(map);
}

//control layers
createLayers(overlays);
tracts.addTo(map);
tracts.bringToBack();
wells.addTo(map);



// class breaks for symbology
function nitrateBreaks(nitrateRatesDataSource) {

    // Create an empty array to store the nitrate concentrations
    var values = [];

    // Loop through each feature to get its nitrate concentration
    nitrateRatesDataSource.eachLayer(function (layer) {
        var value = layer.feature.properties.nitr_ran;

        // Push each nitrate concentration into the array
        values.push(value);
    });

    // Determine 5 clusters of statistically similar values, sorted in ascending order
    var clusters = ss.ckmeans(values, 5);

    // Create a 2-dimensional array of the break points (lowest and highest values) in each cluster. The lowest value in each cluster is cluster[0]; the highest value is cluster.pop().
    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    // Return the array of class breaks
    return breaks;

} 


// Set the color breaks
function nitrateColorBreaks(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0][1]) {
        return '#ffffd4';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1][1]) {
        return '#fed98e';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2][1]) {
        return '#fe9929';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3][1]) {
        return '#d95f0e';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d <= breaks[4][1]) {
        return '#993404';

    }
} 



// Establish classification breaks for cancer rates
function getCancerRateClassBreaks(cancerRatesDataSource) {

    // Create an empty array to store the cancer rates
    var values = [];

    // Loop through each feature to get its cancer rate
    cancerRatesDataSource.eachLayer(function (layer) {
        var value = layer.feature.properties.canrate;

        // Push each cancer rate into the array
        values.push(value);
    });

    // Determine 5 clusters of statistically similar values, sorted in ascending order
    var clusters = ss.ckmeans(values, 5);

    // Create a 2-dimensional array of the break points (lowest and highest values) in each cluster. The lowest value in each cluster is cluster[0]; the highest value is cluster.pop().
    var breaks = clusters.map(function (cluster) {
        return [cluster[0], cluster.pop()];
    });

    // Return the array of class breaks
    return breaks;

}    


// Set the color of the features 
function getCancerRateColor(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0][1]) {
        return '#f2f0f7';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1][1]) {
        return '#cbc9e2';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2][1]) {
        return '#9e9ac8';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3][1]) {
        return '#756bb1';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d <= breaks[4][1]) {
        return '#54278f';

    }
} 



 
// Interpolate the nitrate concentrations from the well points into a hexbin surface
function interpolateNitrateRates(distDecayCoeff, hexbinArea) {

    // Remove any previous features from the layer group    
    if (nitrateRatesIDWLayerGroup !== undefined) {
        nitrateRatesIDWLayerGroup.clearLayers();
    }

    // Loop through each feature
    wellPts.eachLayer(function (layer) {

        // Build a Turf feature collection from the well points

        // Create shorthand variables to access the layer properties and coordinates
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        // Create a Turf point feature for the well point, with its coordinates and attributes
        wellPointsFeature = turf.point(coordinates, props);

        // Push the current well point feature into an array
        wellPointsArray.push(wellPointsFeature);

    });

    // Create a Turf feature collection from the array of well point features
   wellsFeatureCollection = turf.featureCollection(wellPointsArray);

    // Set options for the well point interpolation
    var options = {
        gridType: 'hex', // use hexbins as the grid type
        property: 'nitr_ran', // interpolate values from the nitrate concentrations
        units: 'miles', // hexbin size units
        weight: distDecayCoeff // distance decay coefficient, q
    };

    // Interpolate the well point features using the grid size from the hexbinArea variable, the submitted distance decay coefficient, and the options just specified
    nitrateRatesHexbinsTurf = turf.interpolate(wellsFeatureCollection, hexbinArea, options);

    // Loop through each hexbin and get its interpolated nitrate concentration
    for (var hexbin in nitrateRatesHexbinsTurf.features) {
        var interpolatedNitrateRate = nitrateRatesHexbinsTurf.features[hexbin].properties.nitr_ran;
        interpolatedNitrateRatesArray.push(interpolatedNitrateRate);
    }

    // Convert the hexbins to a Leaflet GeoJson layer and add it to the Nitrate Concentrations layer group
    nitrateRatesHexbins = L.geoJson(nitrateRatesHexbinsTurf, {

        // Style the nitrate concentration hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.6, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(nitrateRatesIDWLayerGroup);

    // Get the class breaks based on the ckmeans classification method
    var breaks = nitrateBreaks(nitrateRatesHexbins);

    // Loop through each feature, set its symbology, and build and bind its popup
    nitrateRatesHexbins.eachLayer(function (layer) {

        // Set its color based on the nitrate concentration
        layer.setStyle({
            fillColor: nitrateColorBreaks(layer.feature.properties.nitr_ran, breaks)
        });

        // Build the popup for the feature
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm";

        // Bind the popup to the feature
        layer.bindPopup(popup);

    });

    // Move the nitrate concentration hexbins to the front
    nitrateRatesHexbins.bringToFront();
	
	    
} 

//join interpolation
function joinNitrateCancerValue(distDecayCoeff, hexbinArea) {

    // Remove any previous features from the joined hexbins layer group    
    if (joinedGroup !== undefined) {
        joinedGroup.clearLayers();
    }

    // Loop through each census tract feature and build a Turf feature collection from its centroid
    cTracts.eachLayer(function (layer) {

        // Create shorthand variables 
        var props = layer.feature.properties;
        var coordinates = layer.feature.geometry.coordinates;

        // Create a Turf polygon feature for the census tract, with its coordinates and attributes
        censusTractsFeatures = turf.polygon(coordinates, props);

        // Get the centroid of the census tract
        var censusTractsCentroidFeature = turf.centroid(censusTractsFeatures, props);

        // Push the current census tract centroid into an array
        interpolatedNitrateAndCancerRatesArray.push(censusTractsCentroidFeature);

    });

    // Create a Turf feature collection from the array of census tract centroid features
    tractsCentroids = turf.featureCollection(interpolatedNitrateAndCancerRatesArray);

    // Set options for the cancer rate interpolation by grid points
    var gridOptions = {
        gridType: 'point', // use points as the grid type, required to use the collect function
        property: 'canrate', // interpolate values from the cancer rates
        units: 'miles', // hexbin size units
        weight: distDecayCoeff // distance decay coefficient, q
    };

    // Interpolate the cancer rate centroids
    cancerGridPts = turf.interpolate(tractsCentroids, hexbinArea, gridOptions);

    // Use the collect function to join the cancer rates to the nitrate concentration 
    collectFeatHexbins = turf.collect(nitrateRatesHexbinsTurf, cancerGridPts, 'canrate', 'values');

    // Loop through each of the collected hexbins
    for (var i in collectFeatHexbins.features) {

        // The collect function builds an array of cancer rates for features intersecting the current hexbin
        // Get the array of cancer rates for the current hexbin
        var canrateArray = collectFeatHexbins.features[i].properties.values;

        // Loop through each feature in the cancer rates array and sum them
        var canrateArraySum = 0;
        for (var j in canrateArray) {

            if (canrateArray.length > 0) {
                canrateArraySum += parseFloat(canrateArray[j]);
            }

        }

        // Get the average cancer rate
        var canrateArrayAvg = canrateArraySum / canrateArray.length;

        // Add the average cancer rate to the canrate property of the current hexbin
        if (canrateArrayAvg !== undefined) {
            collectFeatHexbins.features[i].properties.canrate = canrateArrayAvg;
        } else {
            collectFeatHexbins.features[i].properties.canrate = "";
        }

    }

    // Convert the collected hexbins to a Leaflet GeoJson layer
    collectedFeaturesHexbins = L.geoJson(collectFeatHexbins, {

        // Set a default style for the collected hexbins
        style: function (feature) {
            return {
                color: '#585858', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.6, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(joinedGroup);

    // Get the class breaks based on the ckmeans classification method
    var breaks = getCancerRateClassBreaks(collectedFeaturesHexbins);

    // Loop through each feature, set its symbology, and build and bind its popup
    collectedFeaturesHexbins.eachLayer(function (layer) {

        // Set its color based on the cancer rate
        layer.setStyle({
            fillColor: getCancerRateColor(layer.feature.properties.canrate, breaks)
        });

        // Build the popup for the feature
        var popup = "<b>Interpolated Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "%";

        // Bind the popup to the feature
        layer.bindPopup(popup);

    });
	
	// Call the function to calculate linear regression using the joined hexbins
    linearRegression2(collectFeatHexbins);
	




} 

function linearRegression2 (collectFeatHexbins) {
	     // Remove any previous features from the layer group    
    if (regressionResidualsLayerGroup !== undefined) {
        regressionResidualsLayerGroup.clearLayers();
    }

    // Loop through the hexbin layer with nitrate concentrations and cancer rates
    // Create a two-dimensional array of [x, y] pairs where x is the nitrate concentration and y is the cancer rate

    // Loop through each of the collected hexbins
    for (var i in collectFeatHexbins.features) {

        // Create a shorthand variable to access the layer properties
        var props = collectFeatHexbins.features[i].properties;

        // Create variables to store the interpolated nitrate concentration and cancer rate
        var interpolatedNitrateConcentration = props.nitr_ran;
        var interpolatedCancerRate = props.canrate;

        // Create an array for the current feature of [nitrate concentration, cancer rate]
        var currentNitrateAndCancerRates = [parseFloat(interpolatedNitrateConcentration), parseFloat(interpolatedCancerRate)];

        // Push the array of the current feature's nitrate concentration and cancer rate into an array
        interpolatedNCRArray.push(currentNitrateAndCancerRates);
		
    }

    // Run the linearRegression method from the Simple Statistics library to return an object containing the slope and intercept of the linear regression line
    // where nitrate concentration is the independent variable (x) and cancer rate is the dependent variable (y)
    // The object returns m (slope) and b (y-intercept) that can be used to predict cancer rates (y) using the equation, y = mx + b
    var regressionEquation = ss.linearRegression(interpolatedNCRArray);
	
	// Create variables for the slope and y-intercept
    var m = regressionEquation.m;
    var b = regressionEquation.b;
    
    var regressionEquationFormatted = "y = " + parseFloat(m).toFixed(5) + "x + " + parseFloat(b).toFixed(5);
   

    // Loop through each of the collected hexbins
    for (var j in collectFeatHexbins.features) {

        // Create a shorthand variable to access the layer properties
        var collectedFeatureHexbinProps = collectFeatHexbins.features[j].properties;
        
        // Create variables to store the interpolated nitrate concentration and cancer rate
        var collectedHexbinInterpolatedNitrateConcentration = collectedFeatureHexbinProps.nitr_ran;
        var collectedHexbinInterpolatedCancerRate = collectedFeatureHexbinProps.canrate;

        // Use the slope and y-intercept from the regression equation to calculate the predicted cancer rate from the interpolated nitrate concentration
        var predictedCancerRate = m * (parseFloat(collectedHexbinInterpolatedNitrateConcentration)) + b;

        // Calculate the residual (predictedCancerRate - interpolatedCancerRate)
        var residual = predictedCancerRate - collectedHexbinInterpolatedCancerRate;

        // Add the predicted cancer rate and residual to the collected hexbin
        collectFeatHexbins.features[j].properties.predictedCancerRate = predictedCancerRate;
        collectFeatHexbins.features[j].properties.residual = residual;
        
        // Build an array of the observed nitrate concentration and cancer rate for the current feature
        var observedNitrateAndCancerRatesPair = [collectedHexbinInterpolatedNitrateConcentration, collectedHexbinInterpolatedCancerRate];
        
        // Push the current nitrate concentration and cancer rate pair into an array
        observedNitrateAndCancerRatesArray.push(observedNitrateAndCancerRatesPair);

}
	     
    // Build the linear regression line from the regression equation
    var regressionLine = ss.linearRegressionLine(regressionEquation);
    
    // Calculate the r-squared
    var rSquared = parseFloat(ss.rSquared(observedNitrateAndCancerRatesArray, regressionLine)).toFixed(5); // 1 is a perfect fit, 0 indicates no correlation
  	
	      
    // dispaley regression data
    var regressionEquationDiv = $('#equation');
    regressionEquationDiv.html(regressionEquationFormatted);
    
    var rSquaredDiv = $('#r2');
	rSquaredDiv.html(rSquared);
    
    // Convert hexbins to a Leaflet GeoJson layer 
    regressionFeaturesHexbins = L.geoJson(collectFeatHexbins, {

        // Set a default style for the collected hexbins
        style: function (feature) {
            return {
                color: '#999999', // Stroke Color
                weight: 0.5, // Stroke Weight
                fillOpacity: 0.5, // Override the default fill opacity
                opacity: 0.5 // Border opacity
            };
        }

    }).addTo(regressionResidualsLayerGroup);

    // Get the class breaks
    var breaks = regResidBreaks(regressionFeaturesHexbins);

    // Loop through each feature,symbology, popup
    regressionFeaturesHexbins.eachLayer(function (layer) {
		layer.setStyle({
            fillColor: regResidColor(layer.feature.properties.residual, breaks)
        });
		
		if (regResidColor(layer.feature.properties.residual, breaks) == '#f7f7f7') {
            layer.setStyle({
                fillOpacity: 0.1
            });
        }

        // Build popup
        var popup = "<b>Nitrate Concentration: </b>" + layer.feature.properties.nitr_ran.toFixed(2) + " ppm" + "<br/>" +
            "<b>Observed Cancer Rate: </b>" + (layer.feature.properties.canrate * 100).toFixed(2).toLocaleString() + "% of census tract population" + "<br/>" +
            "<b>Predicted Cancer Rate: </b>" + (layer.feature.properties.predictedCancerRate * 100).toFixed(2).toLocaleString() + "% of census tract population";
        layer.bindPopup(popup);

    });

    // Move the regression residuals to the front
    regressionFeaturesHexbins.bringToFront();

    // Turn off the interpolation layers and get layer
    map.removeLayer(nitrateRatesIDWLayerGroup);
    map.removeLayer(joinedGroup);
	createIntLegend(breaks);
	    
} 


//class breaks for regression residuals (std. dev)
function regResidBreaks(regressionFeaturesHexbins) {

    // Create an empty array to store the residuals
    var values = [];

    // Loop through each feature to get its residual
    regressionFeaturesHexbins.eachLayer(function (layer) {
        var value = layer.feature.properties.residual;

        // Push each residual into the array
        values.push(value);
    });

    // get the standard deviation of the residuals
    var standardDeviation = ss.sampleStandardDeviation(values);

    // Create an array of the break points for -2, -1, 0, 1, and 2 standard deviations
    var breaks = [-2 * standardDeviation, -1 * standardDeviation, standardDeviation, 2 * standardDeviation];

   // Return the array of class breaks
    return breaks;

}  


// Set the color of the features depending on which cluster the value falls in
function regResidColor(d, breaks) {

    // If the data value <= the upper value of the first cluster
    if (d <= breaks[0]) {
        return '#d7191c';

        // If the data value <= the upper value of the second cluster    
    } else if (d <= breaks[1]) {
        return '#fdae61';

        // If the data value <= the upper value of the third cluster   
    } else if (d <= breaks[2]) {
        return '#ffffbf';

        // If the data value <= the upper value of the fourth cluster   
    } else if (d <= breaks[3]) {
        return '#abdda4';

        // If the data value <= the upper value of the fifth cluster  
    } else if (d > breaks[3]) {
        return '#2b83ba';

    }
} 

//create legend for Nitrate information
function createLegend(breaks){
	var legendControl = L.control({
		position: 'bottomright'
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend');

        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h3><b>Nitrate Concentration (parts per million)</b></h3>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {

            // Determine the color associated with each break value, including the lower range value
            var color = nitrateColorBreaks(breaks[i][0], breaks);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' +
                '<label>' + parseFloat(breaks[i][0]).toFixed(2).toLocaleString() + ' &mdash; ' +
                parseFloat(breaks[i][1]).toFixed(2).toLocaleString() + ' ppm' + '</label>';

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
legendControl.addTo(map);
}

//cancer rate legend
function createCanLegend(breaks){
	var legendControl = L.control({
		position: 'bottomright'
		
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // Create a new HTML <div> element and give it a class name of "legend"
        var div = L.DomUtil.create('div', 'legend2');

        // First append an <h3> heading tag to the div holding the current attribute
        div.innerHTML = "<h3><b>Cancer Rate (in %)</b></h3>";

        // For each of our breaks
        for (var i = 0; i < breaks.length; i++) {

            // Determine the color associated with each break value, including the lower range value
            var color = getCancerRateColor(breaks[i][0], breaks);

            // Concatenate a <span> tag styled with the color and the range values of that class and include a label with the low and high ends of that class range
            div.innerHTML +=
                '<span style="background:' + color + '"></span> ' +
                '<label>' + parseFloat(breaks[i][0]*100).toFixed(0).toLocaleString() + '-' +
                parseFloat(breaks[i][1]*100).toFixed(0).toLocaleString() + '%' + '</label>';

        }

        // Return the populated legend div to be added to the map   
        return div;

    }; // end onAdd method

    // Add the legend to the map
legendControl.addTo(map);
}

//regression legend
function createIntLegend(breaks){
	var legendControl = L.control({
		position: 'bottomright'
    });

    // When the legend is added to the map
    legendControl.onAdd = function () {

        // legend div
        var div = L.DomUtil.create('div', 'legend3');

        // <h3> heading 
        div.innerHTML = "<h3><b>Standard Deviation of Regression</b></h3>";

        // For breaks
        for (var i = 0; i < breaks.length; i++) {

         //color ranges
        var color = regResidColor(breaks[i][0], breaks);

        var colorLess2StdDev = regResidColor(breaks[0], breaks);
        var colorbetles21StdDev = regResidColor(breaks[1], breaks);
        var colorbetless11StdDev = regResidColor(breaks[2], breaks);
        var color12StdDev = regResidColor(breaks[3], breaks);
        var colorMore2StdDev = '#0571b0';

        div.innerHTML +=
            '<span style="background:' + colorLess2StdDev + '"></span> ' +
            '<label><-2 Std. Dev. (Underprediction)</label>';

        div.innerHTML +=
            '<span style="background:' + colorbetles21StdDev + '"></span> ' +
            '<label>-2 Std. Dev. &mdash; -1 Std. Dev.</label>';

        div.innerHTML +=
            '<span style="background:' + colorbetless11StdDev + '"></span> ' +
            '<label>-1 Std. Dev. &mdash; 1 Std. Dev.</label>';

        div.innerHTML +=
            '<span style="background:' + color12StdDev + '"></span> ' +
            '<label>1 Std. Dev. &mdash; 2 Std. Dev.</label>';

        div.innerHTML +=
            '<span style="background:' + colorMore2StdDev + '"></span> ' +
            '<label>> 2 Std. Dev. (Overprediction)</label>';

        // Return the populated legend div to be added to the map   
        return div;
		
		}; // end onAdd method
	}

    // Add the legend to the map
legendControl.addTo(map);
}



/* Set the width of the sidebar to 250px (show it) */
function openNav() {
  document.getElementById("mySidepanel").style.width = "250px";
}

/* Set the width of the sidebar to 0 (hide it) */
function closeNav() {
  document.getElementById("mySidepanel").style.width = "0";
}

 $('.enter_link').click(function() { 
        $(this).parent().fadeOut(500);
 });
$.fn.center = function () {
  this.css("position","absolute");
  this.css("top", Math.max(0, (
    ($(window).height() - $(this).outerHeight()) / 2) + 
     $(window).scrollTop()) + "px"
  );
  this.css("left", Math.max(0, (
    ($(window).width() - $(this).outerWidth()) / 2) + 
     $(window).scrollLeft()) + "px"
  );
  return this;
}

$("#overlay").show();
$("#overlay-content").show().center();


function enterParams(event) {
    event.preventDefault(); // stop form from submitting normally
	
	
    // Remove the current layers from the map

       
   if (joinedGroup !== undefined) {
        joinedGroup.remove();
    }

    if (nitrateRatesIDWLayerGroup !== undefined) {
        nitrateRatesIDWLayerGroup.remove();
	}
	
	 if (regressionResidualsLayerGroup !== undefined) {
        regressionResidualsLayerGroup.remove();
	}
	
	distDecayCoeff = $("#decay").val();
	distDecayCoeff = parseFloat(distDecayCoeff);
	hexbinArea = $("#hex").val(); // 10 sq mi
	hexbinArea = parseFloat(hexbinArea);
	
	 // Remove the current layer list
	layerList.remove();

	 // Set the overlays to include in the updated layer list
    overlays = {
	"Well Points": wells,
    "Census Tracts": tracts,
    "Nitrate Interpolation":nitrateRatesIDWLayerGroup,
	"Cancer Interpolation":joinedGroup,
	"Regression":regressionResidualsLayerGroup

    };
	//create the layers
	createLayers(overlays);
	
	//error handling - ensure the user enters valid variables
	if (isNaN(hexbinArea) || hexbinArea < 6 || hexbinArea > 90) {
        window.alert("Enter a hexbin size between 6 and 90");
        $('#hex').val();
        resetForm();
        return;
		
		// Show an error popup and reset the map to the original layers and parameter values if the distance decay coefficient is not a number or not between 0 and 100
	} else if (isNaN(distDecayCoeff) || distDecayCoeff < 0 || distDecayCoeff > 100) {
        window.alert("Enter a distance decay coefficient between 0 and 100");
        $('#decay').val();
        resetForm();
        return;
	}
	else {
		$.ajax({
			success: function(reports) {
				alert("Success! The regression layer will be added to the map. Click the layers button on the top left portion of the map to view and toggle the other created layers."),
					interpolateNitrateRates(distDecayCoeff, hexbinArea);
				joinNitrateCancerValue(distDecayCoeff, hexbinArea);
				document.getElementById("calcform").reset();

        },
        error: function (xhr, status, error) {
            alert("Status: " + status + "\nError: " + error);
        }
    });
	}
	//remove wells to focus on regression
	wells.remove();
	tracts.remove();
	$('.legend2').hide();
	$('.legend').hide();
	
	regressionResidualsLayerGroup.addTo(map);
	
}

function resetForm(event) {
	// Redraw the map, layer list, and legend with the original well points and census tracts
    // Hide the current legend
    $('.legend3').hide();
	
	 // Remove the current layers from the map

    if (wells !== undefined) {
        wells.remove();
    }

    if (tracts !== undefined) {
        tracts.remove();
    }
	
    if (joinedGroup !== undefined) {
        joinedGroup.remove();
    }

    if (nitrateRatesIDWLayerGroup !== undefined) {
        nitrateRatesIDWLayerGroup.remove();
	}
	
	 if (regressionResidualsLayerGroup !== undefined) {
        regressionResidualsLayerGroup.remove();
	}
	
	// Remove the current layer list
	layerList.remove();
	
	//reset the regression results div
	var regressionEquationDiv = $('#equation');
    regressionEquationDiv.html(" ");
	var rSquaredDiv = $('#r2');
	rSquaredDiv.html(" ");
	
		
    // Add census tracts and well points back to the map
    tracts.addTo(map);
    wells.addTo(map);

    // Call the function to redraw the well points/tracts
    drawWells();
	addMyData();

    // Set the overlays to include in the layer list
    overlays= {
        "Well Points": wells,
        "Census Tracts": tracts
	};
	
	createLayers(overlays);
}

$("#report_submit_btn").on("click" , enterParams);
$("#reset_btn").on("click", resetForm);

	







