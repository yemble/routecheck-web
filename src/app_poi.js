
// type : options
var poiIcons = {
    'pub': {
        options: {prefix: 'mdi', glyph: 'beer'},
        symbol: 'Bar',
    },
    'cafe': {
        options: {prefix: 'mdi', glyph: 'coffee'},
        symbol: 'Restaurant',
    },
    'fast_food': {
        options: {prefix: 'mdi', glyph: 'food'},
        symbol: 'Pizza',
    },
    'restaurant': {
        options: {prefix: 'mdi', glyph: 'silverware-variant'},
        symbol: 'Restaurant',
    },
    'fuel': {
        options: {prefix: 'mdi', glyph: 'gas-station'},
        symbol: 'Convenience Store',
    },
    'hostel': {
        options: {prefix: 'mdi', glyph: 'hotel'},
        symbol: 'Lodging',
    },
    'motel': {
        options: {prefix: 'mdi', glyph: 'hotel'},
        symbol: 'Lodging',
    },
    'hotel': {
        options: {prefix: 'mdi', glyph: 'hotel'},
        symbol: 'Lodging',
    },
    'bicycle': {
        options: {prefix: 'mdi', glyph: 'bike'},
        symbol: 'Bike Trail',
    },
    'supermarket': {
        options: {prefix: 'mdi', glyph: 'cart'},
        symbol: 'Shopping Center',
    },
    'pharmacy': {
        options: {prefix: 'mdi', glyph: 'pharmacy'},
        symbol: 'Pharmacy',
    },
    'camp_site': {
        options: {prefix: 'mdi', glyph: 'tent'},
        symbol: 'Camp site',
    },
};

var poiMarkers = {}; // name: [{marker, data}]

function poiHasMarkers() {
    for(n in poiMarkers) {
        if(poiMarkers[n].length > 0) {
            return true;
        }
    }
    return false;
}

function poiAddEvents() {
    $('#poi input[type="checkbox"]').on('change', (e) => {
        poiShow( $(e.target).data('featurename'), $(e.target).data('featuregroup'), $(e.target).data('featuretypes').split(','), e.target.checked );
    });
}

function poiGetOuterBounds() {
    var bb = {
        north: gpxBounds.getNorth(),
        south: gpxBounds.getSouth(),
        west: gpxBounds.getWest(),
        east: gpxBounds.getEast()
    };

    // add .1 degree (~7 miles) to get outside points
    var MARGIN = 0.1;
    if(bb.north > bb.south) {
        bb.north += MARGIN; bb.south -= MARGIN;
    } else {
        bb.north -= MARGIN; bb.south += MARGIN;
    }
    if(bb.east > bb.west) {
        bb.east += MARGIN; bb.west -= MARGIN;
    } else {
        bb.east -= MARGIN; bb.west += MARGIN;
    }

    return bb;
}

function poiSplitBounds(outer) {
    // noop
    return [outer];
}

function poiShow(name, group, types, visible) {
    // console.log("poiShow", name, visible, gpxBounds);

    if(visible) {
        if(!gpxPoints || !gpxBounds) {
            return;
        }

        var batches = poiSplitBounds( poiGetOuterBounds() );

        for(idx in batches) {
            var parts = [];
            for(ti in types) {
                parts.push(`node[${group}=${types[ti]}](bbox);`);
            }
            var qry = '[out:json];(' + parts.join('') + ');out body geom;';
            
            var bounds = batches[idx];
            var bbox = [bounds.west,bounds.south,bounds.east,bounds.north].join(',');

            var url = 'https://overpass-api.de/api/interpreter/?data=' + escape(qry) + '&bbox=' + escape(bbox);
            
            var $spinner = $('input#poi_'+name+' ~ img.spinner');
            $spinner.addClass('active');

            fetch(url).then((response) => {
                return response.json();
            }).then((data) => {
                // if success, place markers
                if(data['elements']) {
                    poiRemoveMarkers(name);
                    poiPlaceMarkers(name, group, data.elements);
                    setExportLinks();
                    $spinner.removeClass('active');
                }
                else {
                    $spinner.removeClass('active');
                    var err = data['detail_friendly'] ? "Sorry, can't fetch POIs: " + data.detail_friendly : "Sorry, can't fetch POIs :-("
                    alert(err);
                }
            }).catch((err) => {
                $spinner.removeClass('active');
                console.log(err);
            });
        }
    }
    else {
        poiRemoveMarkers(name);

        setExportLinks();
    }
}

function poiOnRoute(rangeMiles, poi) {
    // for each point in gpxPoints, if dist pt-ll < rangeMiles return true

    if(!gpxPoints) { return false; }

    for(i in gpxPoints) {
        var c1 = [poi[1]*Math.PI/180.0, poi[0]*Math.PI/180.0];
        var c2 = [gpxPoints[i].y*Math.PI/180.0, gpxPoints[i].x*Math.PI/180.0];

        var x = Math.cos((c2[0]+c1[0])/2) * (c2[1]-c1[1]);
        var y = c2[0]-c1[0];
        var miles = Math.sqrt(x*x + y*y) * 6371*0.621371;

        //if(i%100==0) { console.log("poi distance", i, c1, c2, miles, rangeMiles); }

        if(miles < rangeMiles) {
            return true;
        }
    }

    return false;
}

function poiRemoveMarkers(name) {
    if(poiMarkers[name]) {
        for(idx in poiMarkers[name]) {
            poiMarkers[name][idx].marker.remove();
        }
    }
    poiMarkers[name] = [];
}

function poiPlaceMarkers(name, group, features) {
    var rangeMiles = $('#features select[name="poi_range_miles"]').val();

    console.log("Found", features.length, name, "features")

    for(idx in features) {
        var f = features[idx];

        if(f['type'] != 'node' || ! f['lat'] || ! f['lon']) {
            continue;
        }

        if(! poiOnRoute(parseFloat(rangeMiles), [f.lon, f.lat])) {
            continue;
        }

        // console.log("Placing", name, f.tags.name, '@', [f.lat, f.lon]);

        var iconOpts = poiIcons[ f.tags[group] ].options;
        iconOpts.glyphSize = iconOpts.glyphSize || '1.2em';

        var icon = L.icon.glyph(iconOpts);
        var title = f.tags['name'] ? f.tags.name+" ("+f.tags[group]+")" : f.tags[group];
        var marker = L.marker(L.latLng(f.lat, f.lon), {icon: icon, opacity: 0.8, title: title});
        marker.addTo(mymap);

        f.group = group;
        poiRegisterMarker(name, marker, f);
    }
}

function poiRegisterMarker(name, marker, data) {
    if(!poiMarkers[name]) {
        poiMarkers[name] = [];
    }
    poiMarkers[name].push({marker: marker, data: data});
}
