
var BASE_URL = 'https://routecheck.cc/'

var KEYS = {
    'GOOG': 'AIzaSyBA9IGHiEQBtIqHEgO929hFrkzK_IcSla4',
    'ORS': '58d904a497c67e00015b45fce269505b22bc46a9888bfd9547993ee0',
    'RWGPS': 'c45c7e0b',
    'TILES': {
        'Thunderforest.OpenCycleMap': {apikey: '7bfb4bf8fbcf431593f169c6306ba441'},
    },
};

var mapDefaultView = {latlng: [35,-105], zoom: 7};

var mymap = null;
var layers = {};
var clickPopup = null;

var routeName;
var gpxData = null;
var gpxPoints = null; // [{x,y,e}]
var gpxBounds = null;

function makeQueryString(map) {
    var params = [];
    for(key in map) {
        params.push( escape(key)+'='+escape(map[key]));
    }
    return params.join('&');
}

function setUi(routeSource, routeData) {
    routeData = routeData || {};

    var $fileInput = $('#upload input[type="file"]');
    var $rwgpsRoute = $('#rwgps select[name="rwgps_route"]');

    if(routeSource && routeData['id']) {
        document.location.hash = "rwgps/"+routeData.id;
    }
    else {
        document.location.hash = '';
    }

    if(routeSource == 'rwgps') {
        orsMode = null
        orsRouteData = null;
        orsWaypoints = [];
        orsUpdate();

        $fileInput.val('');
        routeName = routeData.info.name;
    }
    else if(routeSource == 'file') {
        orsMode = null
        orsRouteData = null;
        orsWaypoints = [];
        orsUpdate();

        $rwgpsRoute.val('');
        poiRemoveMarkers('rwgps');

        var filename = routeData.info.name;
        var name = filename.substring(0, filename.lastIndexOf('.'));
        routeName = name;
    }
    else if(routeSource == 'ors') {
        $fileInput.val('');
        $rwgpsRoute.val('');
        poiRemoveMarkers('rwgps');
        routeName = routeData.info.name;
    }
    else {
        routeName = null;
        gpxData = null;
        orsRouteData = null;
        clearGpxLayer();
        poiRemoveMarkers('rwgps');
        orsUpdate();
    }

    setRouteInfo(routeData['info']);
}

function setExportLinks() {
    $('.export_link').removeClass('active');
    if(poiHasMarkers()) {
        $('.export_link.features').addClass('active');
    }
    if(gpxData) {
        $('.export_link.route').addClass('active');
        if(poiHasMarkers()) {
            $('.export_link.all').addClass('active');
        }
    }
}


function clearGpxLayer() {
    if(layers['gpx']) {
        mymap.removeLayer(layers.gpx);
    }
    setRouteInfo(null);
}

function setRouteInfo(meta) {
    var $outer = $('#route-info');

    if(meta) {
        var fields = ['name', 'distance', 'ascent'];
        for(i in fields) {
            var f = fields[i];
            var $span = $outer.find('.'+f);
            if($span && meta[f]) {
                $span.css('display', 'inline').find('.value').text(meta[f]);
            }
            else {
                $span.css('display', 'none');
            }
        }
        $outer.css('display', 'block');
    }
    else {
        $outer.css('display', 'none');
    }
}


function setOsmLayer() {
    if(layers['osm']) {
        mymap.removeLayer(layers.osm);
    }
    var name = $('#osm select[name="tiles"]').val();
    var opts = KEYS.TILES[name] || {};

    if(name.startsWith('Google.')) {
        var subName = name.substring('Google.'.length);
        layers.osm = L.gridLayer.googleMutant({
            type: subName,
            styles: [],
            pane: 'osm',
        })
        mymap.addLayer(layers.osm);
    }
    else if(name.startsWith('ESRI.')) {
        var subName = name.substring('ESRI.'.length);
        layers.osm = L.esri.basemapLayer(subName, {
            pane: 'osm',
        });
        mymap.addLayer(layers.osm);
    }
    else {
        opts.pane = 'osm';
        layers.osm = L.tileLayer.provider(name, opts);
        mymap.addLayer(layers.osm);
    }
}

function setStravaLayer() {
    if(layers['heatmap']) {
        mymap.removeLayer(layers.heatmap);
    }

    var color = $('#strava select[name="color"]').val();
    var activity = $('#strava select[name="activity"]').val();

    var isRetina = window.devicePixelRatio > 1; // crude resolution check

    var heatmapUrl = null;

    if(color.indexOf('v2.') == 0) {
        // new heatmap
        var v2color = color.split('.')[1];
        var retinaSuffix = isRetina ? '@2x' : '';
        heatmapUrl = STRAVA_TILE_BASE+'/tiles-auth/'+activity+'/'+v2color+'/{z}/{x}/{y}'+retinaSuffix+'.png';
    }
    /*else {
        // old heatmap (obsolete, remove)
        var heatmapUrl='https://globalheat.strava.com/tiles/'+activity+'/'+color+'/{z}/{x}/{y}.png';
    }*/

    var heatmapAttrib='Heatmap © <a href="https://strava.com">Strava</a>';
    layers.heatmap = new L.TileLayer(heatmapUrl, {minNativeZoom: 4, maxNativeZoom: 14, attribution: heatmapAttrib, pane: 'heatmap'});
    mymap.addLayer(layers.heatmap);
}

function setGpx(data, points) {
    gpxData = data;
    gpxPoints = points || null;

    clearGpxLayer();

    var options = {
        async: true,
        marker_options: {
            startIconUrl: 'include/leaflet-gpx/pin-icon-start.png',
            endIconUrl: 'include/leaflet-gpx/pin-icon-end.png',
            shadowUrl: 'include/leaflet-gpx/pin-shadow.png',
        },
        polyline_options: {
            color: $('#gpx select[name="color"]').val(),
            weight: 8,
            opacity: 0.7,
            pane: 'gpx',
        },
    };

    var dmUnit = $('#distmarkers select[name="distance_unit_m"]').val();
    if(dmUnit != "") {
        options.polyline_options.distanceMarkers = {
            // showAll: 12,
            offset: parseFloat(dmUnit),
            cssClass: 'dist-marker',
            iconSize: [16, 16],
        };
    }

    layers.gpx = new L.GPX(gpxData, options).on('loaded', function(e) {
        gpxBounds = e.target.getBounds();

        mymap.fitBounds(gpxBounds);

        if(!gpxPoints) {
            var gpxLine = findGpxPolyline(e.target);

            if(gpxLine) {
                gpxPoints = $.map(gpxLine.getLatLngs(), (pt) => { return {x: pt.lng, y: pt.lat} });
            }
        }

        var newLoc = mymap.getCenter();
        saveDefaultSetting("map", "lastLocation", newLoc.lat+','+newLoc.lng+','+mymap.getZoom());

        $('#gpx input[name="enabled"]')
            .attr('checked', 'checked')
            .removeAttr('disabled');
    });

    mymap.addLayer(layers.gpx);

    setExportLinks();
}

function findGpxPolyline(parent) {
    var line = null;

    parent.eachLayer(layer => {
        if(line) {
            return;
        }
        if(layer['getLatLngs'] && layer.getLatLngs().length > 1) {
            line = layer;
        }
        else {
            line = findGpxPolyline(layer);
        }
    });

    return line;
}

function addEvents() {
    $('html').on('keydown', (e) => {
        if(e.target['nodeName'] != "INPUT") {
            if(e.key == 'g') {
                $('#gpx input[name="enabled"]').click();
            }
        }
    });

    $('#osm select[name="tiles"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        console.log("OSM tileset change: ", val);
        setOsmLayer();
        saveDefaultSetting('osm', 'tiles', val);
    });

    $('#strava input[name="enabled"]').on('change', (e) => {
        // prev state
        var target = e.target || e.srcElement;
        if(target.checked) {
            mymap.addLayer(layers.heatmap);
        }
        else {
            mymap.removeLayer(layers.heatmap);
        }
    });
    $('#strava select[name="color"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        console.log("Strava color change: ", val);
        setStravaLayer();
        saveDefaultSetting('strava', 'color', val);
    });
    $('#strava select[name="activity"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        console.log("Strava activity change: ", val);
        setStravaLayer();
        saveDefaultSetting('strava', 'activity', val);
    });
    $('#strava input[name="top"]').on('change', (e) => {
        var val = $(e.target).val();
        configureMapPanes();
        saveDefaultSetting('strava', 'top', e.target.checked ? 'on' : 'off');
    });

    $('#distmarkers select[name="distance_unit_m"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        if(gpxData) {
            setGpx(gpxData)
        }
        saveDefaultSetting('distmarkers', 'distance_unit_m', val);
    });


    $('#gpx input[name="enabled"]').on('change', (e) => {
        if(!layers['gpx']) { return; }
        // prev state
        var target = e.target || e.srcElement;
        if(target.checked) {
            mymap.addLayer(layers.gpx);
        }
        else {
            mymap.removeLayer(layers.gpx);
        }
    });
    $('#gpx select[name="color"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        console.log("GPX color change: ", val);
        if(gpxData) {
            setGpx(gpxData)
        }
        else if(orsRouteData) {
            orsDrawRoute();
        }
        saveDefaultSetting('gpx', 'color', val);
    });

    $('#upload input[type="file"]').on('click', (e) => {
        console.log("Clearing gpx file selection");
        var target = e.target || e.srcElement;
        $(target).val('');
    });
    $('#upload input[type="file"]').on('change', (e) => {
        console.log("GPX file selected", e);
        var target = e.target || e.srcElement;
        var files = target['files'];
        if(! files || files.length < 1) { return; }
        var file = files[0];

        var reader = new FileReader();
        // Closure to capture the file information.
        reader.onload = (function(theFile) {
            return function(e) {
                //console.log("Read file", e, theFile);
                setGpx(e.target.result);
                setUi('file', {info: {name: theFile.name}});
                $('#rwgps select[name="rwgps_route"]').val('');
            };
        })(file);

        // Read in the file as a data URL.
        reader.readAsText(file);
    });

    $('#rwgps #rwgps_login').on('click', (e) => {
        rwgpsLogin();
    });
    $('#rwgps select[name="rwgps_route"]').on('change', (e) => {
        var target = e.target || e.srcElement;
        var val = $(target).val();
        console.log("Rwgps route selected: ", val);
        if(val && val.length > 0) {
            rwgpsLoadRoute(val);
        }
        else {
            setUi(null);
        }
    });
    $('#rwgps a#rwgps_logout').on('click', (e) => {
        e.preventDefault();
        rwgpsLogout();
    });

    orsAddEvents();

    poiAddEvents();

    waysAddEvents();

    $('#export a.export_link').on('click', (e) => {
        // do nothing on in-active links
        if(!$(e.target).hasClass('active')) {
            e.preventDefault();
            return;
        }
        else {
            exportGpx($(e.target), $(e.target).data('content'));
            // fall through to click behavior
        }
    });

    $('nav#switcher a').on('click', (e) => {
        e.preventDefault();
        switchNav($(e.target), $(e.target).data('target'));
    });

    $('a#settings_toggle').on('click', (e) => {
        var $a = $(e.target);
        var $content = $('#switcher, #switched');

        if($a.hasClass('expanded')) {
            $a.removeClass('expanded').html('&#9660;');
            $content.css('display', 'none');
        } else {
            $a.addClass('expanded').html('&#9650;');
            $content.css('display', 'block');
        }
    });

    if (navigator.geolocation) {
        $('a#geolocate').on('click', e => showCurrentLocation());
    }
    else {
        $('a#geolocate').css('display', 'none');
    }

    mymap.on('click', mapClicked);
}

function restoreDefaultSettings() {
    if (typeof(Storage) == "undefined") { return; }

    var data = localStorage.getItem('settings');
    if(data) {
        var sets = JSON.parse(data);

        if(sets['map'] && sets['map']['lastLocation']) {
            var v = sets.map.lastLocation.split(',');
            mapDefaultView = {
                latlng: [v[0], v[1]],
                zoom: v[2],
            };
        }

        if(sets['osm']) {
            if(sets.osm['tiles']) {
                $('#osm select[name="tiles"]').val(sets.osm.tiles);
            }
        }
        if(sets['strava']) {
            if(sets.strava['color']) {
                $('#strava select[name="color"]').val(sets.strava.color);
            }
            if(sets.strava['activity']) {
                $('#strava select[name="activity"]').val(sets.strava.activity);
            }

            if(sets.strava['top'] == 'on') {
                $('#strava input#heatmap_top').attr("checked","checked");
            }
            else if(sets.strava['top'] == 'off') {
                $('#strava input#heatmap_top').removeAttr("checked");
            }
        }
        if(sets['distmarkers']) {
            if(sets.distmarkers['distance_unit_m']) {
                $('#distmarkers select[name="distance_unit_m"]').val(sets.distmarkers.distance_unit_m);
            }
        }
        if(sets['gpx']) {
            if(sets.gpx['color']) {
                $('#gpx select[name="color"]').val(sets.gpx.color);
            }
        }
        if(sets['rwgps']) {
            if(sets.rwgps['auth_token']) {
                // save the auth token
                rwgpsAuthToken = sets.rwgps.auth_token;
            }
            if(sets.rwgps['username']) {
                $('#rwgps input[name="rwgps_username"]').val(sets.rwgps.username);
            }
        }
        if(sets['ors']) {
            for(idx in orsAvoidValues) {
                var val = orsAvoidValues[idx];
                if(sets.ors['avoid_'+val] == 'on') {
                    $('#builder input[name="ors_avoid_'+val+'"]').attr("checked","checked");
                }
                else {
                    $('#builder input[name="ors_avoid_'+val+'"]').removeAttr("checked");
                }
            }
            if(sets.ors['difficulty']) {
                $('#builder select[name="ors_difficulty"]').val(sets.ors.difficulty);
            }
            if(sets.ors['method']) {
                $('#builder select[name="ors_method"]').val(sets.ors.method);
            }
        }
    }
}

function saveDefaultSetting(section, key, value) {
    if (typeof(Storage) == "undefined") { return; }

    console.log("Saving a default", section+'.'+key, value);

    var sets = {};
    var data = localStorage.getItem('settings');
    if(data) {
        sets = JSON.parse(data);
    }
    if(!sets[section]) {
        sets[section] = {};
    }
    sets[section][key] = value;
    localStorage.setItem('settings', JSON.stringify(sets));
}

function metresToMiles(m) {
    return (m * 0.621371 / 1000).toFixed(1);
}

function metresToFeet(m) {
    return parseInt(m * 3.28084);
}

function makeGpx(data) {
    var buf = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:gpxdata="http://www.cluetrust.com/XML/GPXDATA/1/0" xsi:schemaLocation="http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd http://www.cluetrust.com/XML/GPXDATA/1/0 http://www.cluetrust.com/Schemas/gpxdata10.xsd" version="1.0" creator="http://ridewithgps.com/">
  <author>${data.author.encodeHTML()}</author>
  <url>${data.url}</url>
  <time>${data.time}</time>`;

  buf += `
  <trk>
    <name>${data.name.encodeHTML()}</name>
    <trkseg>`;

    for(idx in data.points) {
        var pt = data.points[idx];
        buf += `<trkpt lat="${pt.y}" lon="${pt.x}"><ele>${pt.e}</ele></trkpt>`;
    }

    buf += '</trkseg></trk>';

    /*buf += `<rte><name>${data.name.encodeHTML()}</name>`;
    (data['cuesheet'] || []).forEach(p => {
        buf += `<rtept lat="${p.lat}" lon="${p.lon}">`
            +  `<name>${p.name.encodeHTML()}</name>`
            +  `<cmt>${p.cmt.encodeHTML()}</cmt>`
            +  '</rtept>';
    });
    buf += '</rte>';*/

    return buf + '</gpx>';
}

function makeFeatureWaypoints() {
    var buf = ''
    for(a in poiMarkers) {
        for(i in poiMarkers[a]) {
            var f = poiMarkers[a][i].data;
            var sym = null;

            if(f['group']) {
                var featureName = f.tags[f.group];
                sym = poiIcons[featureName].symbol;                
            }

            //console.log("Exporting wpt", a, i, poiMarkers[a][i], sym);

            var wpt = `<wpt lat="${f.lat}" lon="${f.lon}">`;
            wpt += "<type>"+a.encodeHTML()+"</type>";
            if(sym) { wpt += '<sym>'+sym.encodeHTML()+'</sym>'; }
            if(f.tags['name']) { wpt += '<name>'+f.tags.name.encodeHTML()+'</name>'; }
            if(f.tags['description']) { wpt += '<desc>'+f.tags.description.encodeHTML()+'</desc>'; }
            if(f.tags['url']) { wpt += '<url>'+f.tags.url.encodeHTML()+'</url>'; }
            wpt += "</wpt>";

            buf += wpt;
        }
    }
    return buf;
}

function makeGpxWithFeatures() {
    return '<?xml version="1.0" encoding="UTF-8"?>'+
    '<gpx xmlns="http://www.topografix.com/GPX/1/0">' + makeFeatureWaypoints()+'</gpx>';
}

function makeGpxWithFeaturesAndRoute() {
    return gpxData.replace('</gpx>', makeFeatureWaypoints()+'</gpx>');
}

function mapClicked(e) {
    // special modes:
    if(orsMode == "waypoints") {
        return orsMapClicked(e);
    }

    // default, streetview popup

    clickPopup = clickPopup || L.popup({maxWidth: 'auto', closeOnClick: false});

    if(clickPopup && clickPopup.isOpen()) {
        mymap.closePopup();
        return;
    }

    var $content = $('<div/>').attr('id', 'streetview-popup');

    for(var heading = 360; heading > 0; heading -= 120) {
        var imgUrl = 'https://maps.googleapis.com/maps/api/streetview?size=600x400'
            + '&location='+e.latlng.lat+','+e.latlng.lng
            + '&heading='+heading
            + '&fov=120&pitch=5'
            + '&key='+KEYS.GOOG;

        var $img = $('<img/>')
            .attr('src', imgUrl)
            .attr('title', 'Facing ' + (heading >= 360 ? heading-360 : heading) + '°')
            .on('load', () => {clickPopup.update();})
        $content.append( $img );
    }

    clickPopup
        .setLatLng(e.latlng)
        .setContent($content[0])
        .openOn(mymap);
}

function exportGpx($link, content) {
    console.log("Export request", content);

    var blob;
    var filename;

    if(content == 'route' && gpxData) {
        blob = new Blob([gpxData], {type: 'application/gpx+xml'});
    }
    else if(content == 'features' && poiHasMarkers()) {
        blob = new Blob([makeGpxWithFeatures()], {type: 'application/gpx+xml'});
    }
    else if(poiHasMarkers() && gpxData) {
        blob = new Blob([makeGpxWithFeaturesAndRoute()], {type: 'application/gpx+xml'});
    }
    else {
        return;
    }

    if(routeName != null) {
        filename = routeName+'-'+content+'.gpx';
    }
    else {
        filename = 'routecheckcc-'+content+'.gpx';
    }

    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else {
        $link[0].href = window.URL.createObjectURL(blob);
        $link[0].download = filename;
    }
}


function showCurrentLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        if(!position) return;

        var ll = L.latLng(position.coords.latitude, position.coords.longitude);

        var icon = L.icon.glyph({prefix: 'mdi', glyph: 'account-location', glyphColor: 'black', glyphSize: '1.2em'});
        var marker = L.marker(ll, {icon: icon, opacity: 0.6, title: "Geolocated point"});

        marker.addTo(mymap);
        mymap.flyTo(ll, 14);
    });
}


function toastError(message, title) {
    title = title || "Error"
    alert(title + ": " + message);
}

function fixProtocolAndHost() {
    var loc = document.location;

    if(loc.hostname.indexOf('localhost') >= 0) {
        return;
    }
    else if(loc.protocol.indexOf('https:') < 0) {

        document.location = 'https://' + loc.hostname.replace("www.", "") + loc.pathname + loc.hash;
    }
}

function switchNav($link, target) {
    $('#switched .switched-content').css('display', 'none')
    $('#switched .switched-content#'+target).css('display', 'inline-block')

    $('nav#switcher li').removeClass('active');
    $link.parent().addClass('active');
}

function configureMapPanes() {
    mymap.getPane('osm').style.zIndex =  0;
    mymap.getPane('ways').style.zIndex = 2;
    mymap.getPane('gpx').style.zIndex = 12;

    // var heatmapIndex = $('#heatmap_top')[0].checked ? 24 : 6;

    // mymap.getPane('heatmap').style.zIndex = heatmapIndex;
}

function app_init() {
    fixProtocolAndHost();

    $('body').append(
        $('<script></script>')
            .attr('src', 'https://maps.googleapis.com/maps/api/js?key='+KEYS.GOOG)
    );

    restoreDefaultSettings();

    mymap = L.map('mapobj', {
        doubleClickZoom: false,
        zoom: mapDefaultView.zoom,
        center: mapDefaultView.latlng,
        //zoomSnap: 0.5
    });

    mymap.createPane('osm');
    mymap.createPane('ways');
    mymap.createPane('heatmap');
    mymap.createPane('gpx');
    configureMapPanes();

    setOsmLayer();
    // setStravaLayer();

    // rwgpsInit();

    orsUpdate();

    if(document.location.hash.length > 1) {
        var hash = document.location.hash;
        var prefix = '#rwgps/';
        if(hash.substring(0, prefix.length) == prefix) {
            var routeId = hash.substring(prefix.length).replace(/[^0-9]/g, '');
            rwgpsLoadRoute(routeId);
        }
    }

    addEvents();
}


if (!String.prototype.encodeHTML) {
  String.prototype.encodeHTML = function () {
    return this.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;')
               .replace(/"/g, '&quot;')
               .replace(/'/g, '&apos;');
  };
}
