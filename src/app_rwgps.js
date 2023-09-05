var rwgpsAuthToken = null;
var rwgpsRouteId = null;

function rwgpsInit() {
    // default route option
    rwgpsSetRoutes([]);

    // check we have a token
    if(!rwgpsAuthToken) { return; }

    // fetch user detail

    var url = rwgpsGetApiUrl('/users/current.json', {auth_token: rwgpsAuthToken});

    fetchJsonp(url).then((response) => {
        return response.json()
    }).then((data) => {
        // if success, load routes
        if(data['user']) {
            rwgpsLoadRoutes(data.user.id);
        }
        else {
            console.log("Token auto-login fail: no user", data);
        }
    }).catch((ex) => {
        console.log('rwgps login', ex)
    });
}

function rwgpsLogin() {
    var username = $('#rwgps input[name="rwgps_username"]').val();
    var password = $('#rwgps input[name="rwgps_password"]').val();

    // fetch token

    var url = rwgpsGetApiUrl('/users/current.json', {email: username, password: password});

    fetchJsonp(url).then((response) => {
        return response.json()
    }).then((data) => {
        // clear password
        $('#rwgps input[name="rwgps_password"]').val('');

        // if success, save username, token and load routes
        if(data['user'] && data.user['auth_token']) {
            rwgpsAuthToken = data.user.auth_token;
            saveDefaultSetting('rwgps', 'auth_token', data.user.auth_token);
            saveDefaultSetting('rwgps', 'username', username);

            rwgpsLoadRoutes(data.user.id);
        }
        else {
            console.log("Login fail: no user / auth token", data);
        }
    }).catch((err) => {
        console.log("Login error", err);
        toastError("Rejected", "Login failed");
    });
}

function rwgpsLogout() {
    // erase token

    rwgpsAuthToken = null;
    saveDefaultSetting('rwgps', 'auth_token', null);
    document.location.hash = "";

    // switch ui to login

    rwgpsSetRoutes([]);
    $('#rwgps .toggle#routes').css('display', 'none');
    $('#rwgps .toggle#login').css('display', 'inline-block');
}

function rwgpsLoadRoutes(userId) {
    // check we have a token
    if(!rwgpsAuthToken) { return; }

    // switch ui to routes

    $('#rwgps .toggle#login').css('display', 'none');
    $('#rwgps .toggle#routes').css('display', 'inline-block');

    // load routes

    var url = rwgpsGetApiUrl('/users/'+userId+'/routes.json', {auth_token: rwgpsAuthToken, offset: '0', limit: '9999'});

    fetchJsonp(url).then((response) => {
        return response.json()
    }).then((data) => {
        // if success, load routes
        if(data['results']) {
            var sorter = (a,b) => {var ad = a['updated_at'], bd = b['updated_at']; return bd<ad?-1:(bd>ad?1:0)};
            rwgpsSetRoutes(data.results.sort(sorter));
        }
        else {
            console.log("Load routes fail: no routes", data);
        }
    }).catch((ex) => {
        console.log('rwgps load routes list', ex)
    });
}

function rwgpsSetRoutes(routes) {
    var $select = $('#rwgps .toggle#routes select[name="rwgps_route"]');

    $select
        .empty()
        .append($('<option/>').attr('value', '').text('Route..'));

    for(idx in routes) {
        var route = routes[idx];
        var $opt = $('<option/>').attr('value', route.id).text(route.name);
        if(rwgpsRouteId && rwgpsRouteId == route.id) {
            $opt.attr("selected", "selected");
        }
        $select.append($opt);
    }

}

function rwgpsLoadRoute(routeId) {
    // check we have a token
    if(!rwgpsAuthToken) { return; }

    console.log("Loading route", routeId);

    var url = rwgpsGetApiUrl('/routes/'+routeId+'.json', {auth_token: rwgpsAuthToken});

    fetchJsonp(url).then((response) => {
        return response.json()
    }).then((data) => {
        // if success, load routes
        if(data['route']) {
            //console.log('rwgps route', data)

            var cues = (data.route['course_points'] || []).map(p => {
                return {
                    lat: p.y,
                    lon: p.x,
                    name: p.t,
                    cmt: p.n,
                };
            });

            var gpx = makeGpx({
                url: 'https://ridewithgps.com/routes/' + data.route.id,
                author: 'RideWithGPS LLC',
                time: data.route.updated_at,
                name: data.route.name,
                points: data.route.track_points,
                cuesheet: cues,
            });
            setGpx(gpx, data.route.track_points);

            poiRemoveMarkers('rwgps');
            if(data.route['points_of_interest']) {
                data.route.points_of_interest.forEach(p => {
                    var ll = L.latLng(p.lat, p.lng);
                    //var icon = L.icon.glyph({prefix: 'mdi', glyph: 'help', glyphColor: 'black'});
                    var icon = L.icon.glyph({prefix: '', cssClass: 'text', glyph: 'R', glyphColor: 'orange'});
                    var marker = L.marker(ll, {icon: icon, opacity: 0.8, title: p.n + " (loaded)"});
                    marker.addTo(mymap);

                    var pdata = {
                        lat: p.lat,
                        lon: p.lng,
                        tags: {
                            name: p.n,
                            description: p['description'],
                            url: p['url']
                        }
                    };

                    poiRegisterMarker('rwgps', marker, pdata);
                });
                setExportLinks();
            }

            setUi('rwgps', {
                id: data.route.id,
                info: {
                    name: data.route.name,
                    distance: metresToMiles(data.route.distance) + " mi",
                    ascent: metresToFeet(data.route.elevation_gain) + " ft",
                },
            });

            document.location.hash = "rwgps/"+data.route.id;
            rwgpsRouteId = data.route.id;
        }
        else {
            console.log("Load route fail: no route", data);
        }
    }).catch((ex) => {
        console.log('rwgps load single route', ex)
    });
}

function rwgpsGetApiUrl(path, extraArgs) {
    extraArgs == extraArgs || {};

    var args = [];
    for(key in extraArgs) {
        args.push(escape(key)+'='+escape(extraArgs[key]));
    }

    // client side - works with jsonp
    args.push('version=2');
    args.push('apikey='+KEYS.RWGPS);
    return 'https://ridewithgps.com' + path + '?' + args.join('&');

    /*
    if(window.location.pathname == '/') {
        // server side
        return '/api/rwgps' + path + '?' + args.join('&');
    }
    else {
        // aws lambda
        args.push('_endpoint=rwgps')
        args.push('_path='+escape(path))
        return 'https://qnkjmjymr4.execute-api.us-west-1.amazonaws.com/prod' + '?' + args.join('&');
    }
    */
}