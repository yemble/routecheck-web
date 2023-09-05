
var waysUnpavedData = null;

function waysAddEvents() {
    $('input#unpaved_enabled').on('change', (e) => {
        // prev state
        if(e.target.checked) {
            waysUnpavedRefresh(false);
        }
        else {
            waysUnpavedRemove();
        }
    });

    $('a#unpaved_refresh').on('click', (e) => {
        waysUnpavedRefresh(true);
        $('input#unpaved_enabled').prop('checked', true);
    });
}

function waysUnpavedRefresh(forceFetch) {
    if(! waysUnpavedData || forceFetch) {

        var parts = [];
        parts.push('way[smoothness=bad](bbox);');
        parts.push('way[surface~"unpaved|gravel|ground|dirt|mud|pebblestone|sand"](bbox);');
        
        var qry = '[out:json];(' + parts.join('') + ');out body geom;';
        
        var bounds = mymap.getBounds();
        var bbox = [bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()].join(',');

        var url = 'https://overpass-api.de/api/interpreter/?data=' + escape(qry) + '&bbox=' + escape(bbox);
        
        var $spinner = $('#unpaved img.spinner');
        $spinner.addClass('active');

        fetch(url).then((response) => {
            return response.json();
        }).then((data) => {
            // if success, place markers
            if(data['elements']) {
                waysUnpavedData = data['elements'];
                waysUnpavedRender();
                $spinner.removeClass('active');
            }
            else {
                $spinner.removeClass('active');
                var err = "Sorry, can't fetch ways for this region. Try a zooming in."
                alert(err);
            }
        }).catch((err) => {
            $spinner.removeClass('active');
            console.log(err);
        });
    }
    else {
        waysUnpavedRender();
    }
}

function waysUnpavedRender() {
    if(! waysUnpavedData) return;

    waysUnpavedRemove();

    // create layer and add it to the map

    var lines = {}; // id : [ll]

    for(var i in waysUnpavedData) {
        var el = waysUnpavedData[i];
        
        if(lines[el.id]) continue;

        lines[el.id] = el.geometry.map(pt => [pt.lat, pt.lon]);
    }

    var opts = {
        color: 'brown',
        weight: 6,
        opacity: 0.6,
        pane: 'ways',
    };

    layers.ways_unpaved = L.polyline(Object.values(lines), opts);
    layers.ways_unpaved.addTo(mymap);
}

function waysUnpavedRemove() {
    if(layers.ways_unpaved) {
        mymap.removeLayer(layers.ways_unpaved);
    }
}