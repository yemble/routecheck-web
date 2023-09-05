var orsAvoidValues = ['pavedroads','unpavedroads','hills'];
var orsMode = null; // null | "waypoints"
var orsWaypoints = [];
var orsMarkers = [];
var orsRouteData = null;

function orsAddEvents() {
    var $waypointButton = $('button#ors_waypoints');
    var $routeButton = $('button#ors_route');

    for(idx in orsAvoidValues) {
        var val = orsAvoidValues[idx];
        $('#builder input[name="ors_avoid_'+val+'"]').on('click', (e) => {
            var target = e.target || e.srcElement;
            var name = $(target).attr('name');
            var key = name.substring('ors_avoid_'.length);
            saveDefaultSetting('ors', key, target.checked ? 'on' : 'off');
        });
    }

    $waypointButton.on('click', (e) => {
        if(orsMode == "waypoints") {
            console.log("Exiting ORS waypoint mode")
            orsMode = null;
            orsUpdate();
        }
        else {
            console.log("Beginning new ORS waypoint mode")
            orsClearWaypointMarkers();
            orsMarkers = [];
            orsWaypoints = [];
            orsMode = "waypoints";
            orsUpdate();
        }
    });

    $routeButton.on('click', (e) => {
        console.log("Fetching ORS directions", orsWaypoints);
        orsMode = null;
        orsUpdate();
        orsDirections();
    });

    $('#builder select[name="ors_difficulty"]').on('change', (e) => {
        saveDefaultSetting('ors', 'difficulty', $(e.target).val());
    });
    $('#builder select[name="ors_method"]').on('change', (e) => {
        saveDefaultSetting('ors', 'method', $(e.target).val());
    });

    orsUpdate();
}

function orsDirections() {
    var coords = orsWaypoints.map(pt => [pt.lng,pt.lat]);

    var avoids = [];
    for(idx in orsAvoidValues) {
        var val = orsAvoidValues[idx];
        if($('#builder input[name="ors_avoid_'+val+'"]:checked').val()) {
            avoids.push(val);
        }
    }

    var apiBody = {
        "coordinates": coords,
        "preference": "recommended",
        "units": "m",
        "geometry": true,
        "instructions": false,
        "elevation": true,
        "extra_info": ['steepness','suitability','surface'],
        "options": {
            'avoid_features': avoids,
            'profile_params': {
                'weightings': {
                    'steepness_difficulty': $('#builder select[name="ors_difficulty"]').val(),
                },
            },
        },
    };

    var apiUrl = 'https://api.openrouteservice.org/v2/directions/' + $('#builder select[name="ors_method"]').val() + '/geojson';
    var opts = {
        method: 'post',
        headers: {
            'content-type': 'application/json',
            'authorization': KEYS.ORS,
        },
        body: JSON.stringify(apiBody),
    };

    var $spinner = $('button#ors_route ~ img.spinner');
    $spinner.addClass('active');

    fetch(apiUrl, opts).then((response) => {
        return response.json();
    }).then((data) => {
        // if success, load route
        if(data['features'] && data['features'].length > 0) {
            orsRouteData = data.features[0];
            orsDrawRoute();
            $spinner.removeClass('active');
        }
        else {
            $spinner.removeClass('active');
            console.log("ORS routing fail", data);
            if(data.error) {
                toastError(data.error.message, "ORS routing failed (error " + data.error.code + ")");
            }
            else {
                toastError("ORS routing API failed.", "Boo-urns");
            }
        }
    }).catch((err) => {
        $spinner.removeClass('active');
        console.log("ORS API error", err);
    });;
}

function orsClearWaypointMarkers() {
    for(idx in orsMarkers) {
        orsMarkers[idx].remove();
    }
}

function orsDrawRoute() {
    clearGpxLayer();

    orsClearWaypointMarkers();

    console.log("Drawing ORS route", orsRouteData);

    var points = [];
    for(idx in orsRouteData.geometry.coordinates) {
        points.push({
            x: orsRouteData.geometry.coordinates[idx][0],
            y: orsRouteData.geometry.coordinates[idx][1],
            e: orsRouteData.geometry.coordinates[idx][2],
        });
    }

    var gpx = makeGpx({
        url: BASE_URL,
        author: "OpenRouteService",
        time: new Date().toISOString(),
        name: "Fresh new route",
        points: points,
    });
    setGpx(gpx, points);

    setUi('ors', {
        info: {
            name: "OpenRouteService",
            distance: metresToMiles(orsRouteData.summary.distance)+" mi",
            ascent: metresToFeet(orsRouteData.summary.ascent)+" ft",
        },
    });

    var newLoc = mymap.getCenter();
    saveDefaultSetting("map", "lastLocation", newLoc.lat+','+newLoc.lng+','+mymap.getZoom());

    $('#gpx input[name="enabled"]')
        .attr('checked', 'checked')
        .removeAttr('disabled');

    orsUpdate();
}

function orsMapClicked(e) {
    var icon = L.icon.glyph({
        prefix: '',
        cssClass:'text',
        glyph: orsMarkers.length+1,
    });
    var marker = L.marker(e.latlng, {icon: icon, title: 'ORS Waypoint'});
    marker.addTo(mymap);
    
    orsMarkers.push(marker);
    orsWaypoints.push( e.latlng );

    orsUpdate();
}

function orsUpdate() {
    var $waypointButton = $('button#ors_waypoints');
    var $routeButton = $('button#ors_route');
    var $waypointCount = $('span#ors_waypoint_count');

    if(orsWaypoints.length < 1) {
        orsClearWaypointMarkers();
    }

    if(orsMode == "waypoints") {
        $waypointButton.text("Choosing waypoints");
        $routeButton.removeAttr('disabled');
        $waypointCount.text(''+orsWaypoints.length);
    }
    else {
        $waypointButton.text("New route");
        if(orsWaypoints && orsWaypoints.length > 0) {
            $routeButton.removeAttr('disabled');
        }
        else {
            $routeButton.attr('disabled','disabled');
        }
    }
}