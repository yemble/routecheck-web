
var STRAVA_TILE_BASE = (function() {
    var r = Math.floor(Math.random() * 3);
    var l = ['a','b','c'][r];
    return 'https://heatmap-external-'+l+'.strava.com';
})();

function initStravaTileAuth() {
    fetchJsonp(STRAVA_TILE_BASE+'/auth', {referrerPolicy: 'no-referrer'})
        .catch(function(x) { console.log("Strava tile auth failed", x); })
        .finally(function(x) { console.log("Strava tile auth done"); });
}

// initialize strava
// initStravaTileAuth();
