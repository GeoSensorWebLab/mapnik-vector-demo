var express = require('express');
var cors = require('cors');
var tilestrata = require('tilestrata');
var headers = require('tilestrata-headers');
var disk = require('tilestrata-disk');
var mapnik = require('tilestrata-mapnik');
var vtile = require('tilestrata-vtile');

var app = express();
var strata = tilestrata();

// Define Layers
// OSM Data on EPSG:3573
strata.layer('3573')
    .route('*.png')
        .use(disk.cache({ dir: 'tilecache/3573' }))
        .use(mapnik({
            pathname: '/home/vagrant/carto-style/3573.xml'
        }))
    .route('*.pbf')
        .use(headers({ 'Content-Encoding': 'gzip' }))
        .use(disk.cache({ dir: 'tilecache/3573' }))
        .use(vtile({
            bufferSize: 512,
            xml: '/home/vagrant/carto-style/3573.xml'
        }));

app.use(cors());
app.use(tilestrata.middleware({
    server: strata,
    prefix: '/'
}));


app.listen(8080);