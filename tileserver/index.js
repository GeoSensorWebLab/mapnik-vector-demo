var express     = require('express');
var cors        = require('cors');
var tilestrata  = require('tilestrata');
var headers     = require('tilestrata-headers');
var disk        = require('tilestrata-disk');
var vtile       = require('tilestrata-vtile');
var vtileraster = require('tilestrata-vtile-raster');

var app    = express();
var strata = tilestrata();

// Define Layers
// OSM Data on EPSG:3573
strata.layer('3573')
    .route('*.pbf')
        .use(headers({ 'Content-Encoding': 'gzip' }))
        .use(disk.cache({ dir: 'tilecache/3573' }))
        .use(vtile({
            bufferSize: 128,
            xml: '/home/vagrant/carto-style/3573.xml'
        }))
    .route('*.png')
        .use(disk.cache({ dir: 'tilecache/3573' }))
        .use(vtileraster({
            bufferSize: 128,
            xml: '/home/vagrant/carto-style/3573.xml'
        }, {
            tilesource: ['3573', '*.pbf']
        }))
        
    ;

app.use(cors());
app.use(tilestrata.middleware({
    server: strata,
    prefix: '/'
}));
app.use('/', express.static('public'));

app.listen(8080);