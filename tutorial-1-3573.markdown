# Mapnik Vector Tiles with Custom Projections

In this guide I will show you how to deploy a small web map tile server on a virtual machine. It will serve up tiles in projections that are not Web Mercator projection. An OpenLayers client will be used to view the final result.

Here is a preview of the region we will set up in this tutorial:

![Nunavut, Canada](images/3573.jpg)

*Above: Northern Canada in EPSG:3573 projection. Data from [Natural Earth Data]. Drawn in [QGIS].*

[Natural Earth Data]: http://www.naturalearthdata.com
[QGIS]: http://qgis.org/en/site/

## Background

A majority of the web map providers online all provide tiles in the same map projection: [Web Mercator]. This projection flattens the ellipsoidal Earth into a flat plane, which is then sliced up into tiles for map clients. Web Mercator uses some simplification of formulas to generate its coordinates compared to the standard Mercator projection. The simplification is easier to code and process, but causes significant distortion and inaccuracy as the coordinates move away from the equator. The distortion is so great that the top and bottom of Web Mercator are cut off at 85.05 degrees.

![Web Mercator Comparison](images/3857-comparison.png)

*Above: A comparison of distortion in the Web Mercator projection. Pixel areas measured using Adobe Photoshop. Land area measurements are from Natural Earth Data polygons and are not the exact true areas of the regions.*

For many users, these inaccuracies and distortions make Mercator and Web Mercator projections a poor choice. Fortunately there are [thousands of standardized map projections][epsg.io] covering the entire planet, allowing you to choose one for your region of interest.

So if custom projections are better suited for specialized areas of interest, why wouldn't you always use them? First of all is that Web Mercator has very broad server and client library support. If you want to integrate multiple libraries, Web Mercator is something you can rely on both libraries supporting. Secondly is that for a large proportion of people, Web Mercator is good enough for understanding generally where places are located.

[Web Mercator]: https://en.wikipedia.org/wiki/Web_Mercator
[epsg.io]: https://epsg.io

## Getting Started

For this tutorial, I will be using a virtual machine running under [VirtualBox]. I will use [Vagrant] to set up the virtual machine with some standard settings, visible in the `Vagrantfile`.

To run this virtual machine I recommend having 8 GB of RAM or more available on your host machine. You will also need 40 GB of free disk space for the virtual machine drive. If you have an SSD it will provide much better performance than a spinning hard disk for this system.

The virtual machine will be running Ubuntu Server 16.04 LTS.

After installing VirtualBox and Vagrant, you can clone this repository using Git:

```sh
$ git clone <repo_url>
$ cd mapnik-vector-demo
```

And then start up the virtual machine. This will take a minute or two, and will require downloading the virtual machine template on its first run.

```sh
$ vagrant up
```

Now we can login to the virtual machine; the rest of the tutorial will be executed inside the virtual machine.

[VirtualBox]: https://www.virtualbox.org/
[Vagrant]: https://www.vagrantup.com/

## Installing Software

We need to install some software for our tile server stack. This includes a database ([PostgreSQL]), spatial file manipulation tools ([GDAL]), the map generation library ([Mapnik]), as well as Node.js.

Start by updating and upgrading the default libraries on the system.

```sh
$ sudo apt update
$ sudo apt upgrade -y
$ sudo apt install -y unzip
```

[PostgreSQL]: https://www.postgresql.org
[GDAL]: http://www.gdal.org
[Mapnik]: http://mapnik.org

### Installing PostgreSQL

For storing our OpenStreetMap data, we will use PostgreSQL and the [PostGIS] extension. We will use the PostgreSQL apt repository to get the latest version.

```sh
$ echo "deb http://apt.postgresql.org/pub/repos/apt/ xenial-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
$ wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
OK
$ sudo apt update
...
$ sudo apt install -y postgresql-10 postgresql-client-10 libpq5 libpq-dev
```

We won't install PostGIS yet, as we will need GDAL first. You can confirm that PostgreSQL is running:

```sh
$ pg_lsclusters
Ver Cluster Port Status Owner    Data directory               Log file
10 main    5432 online postgres /var/lib/postgresql/10/main /var/log/postgresql/postgresql-10-main.log
```

[PostGIS]: https://postgis.net

### Optimizing PostgreSQL

There are a few things we can do to improve the performance of PostgreSQL when working with OpenStreetMap data. We will add the configuration file `contrib/postgres-custom.conf` to modify some options:

```sh
$ sudo cp /vagrant/contrib/postgres-custom.conf /etc/postgresql/10/main/conf.d/custom.conf
$ sudo chown postgres:postgres /etc/postgresql/10/main/conf.d/custom.conf
```

Then restart the server to load the updated configuration:

```sh
$ sudo service postgresql restart
```

Some of these changes will improve loading of data into PostgreSQL, while others will help with reading data for rendering tiles. I added comments to the file to explain some of the reasoning behind the choices.

### Installing GDAL

GDAL is a toolkit of libraries and applications for manipulating geospatial data. We will use it to import data from files into PostgreSQL tables. We can get a newer version of GDAL from the [UbuntuGIS PPA].

```sh
$ sudo add-apt-repository ppa:ubuntugis/ubuntugis-unstable
$ sudo apt update
$ sudo apt install -y gdal-bin libgdal20 libgdal-dev
$ gdalinfo --version
GDAL 2.2.1, released 2017/06/23
```

Make sure GDAL 2.1 or newer is installed, as mis-matches between GDAL versions can cause weird issues across clients/hosts. Newer versions of GDAL also have some performance improvements and support more formats.

[UbuntuGIS PPA]: https://launchpad.net/~ubuntugis/+archive/ubuntu/ubuntugis-unstable

### Install PostGIS

Now we can install PostGIS, which will detect GDAL and use that for some calculations.

```sh
$ sudo apt install -y postgresql-10-postgis-2.4 postgresql-10-postgis-2.4-scripts
```

### Set Up Database and User

We will create a user for writing OSM data to PostgreSQL, and a user for read-only rendering access. To do this we will use `psql` to make changes to the database by loading in SQL scripts from the tutorial's `contrib` directory.

```sh
$ sudo -u postgres psql -f /vagrant/contrib/pg-01-user-setup.sql
CREATE ROLE
CREATE ROLE
CREATE ROLE
```

`geo` will be a group role that will own the database for OSM data. `import` will be used by `osm2pgsql` when we import the data later. `render` will be used by mapnik for reading data for tiles.

Next use two scripts to set up databases for OSM data, and to set access permissions for the `import` and `render` users:

```sh
$ sudo -u postgres psql -f /vagrant/contrib/pg-02-db-creation.sql
CREATE DATABASE
You are now connected to database "osm" as user "postgres".
CREATE EXTENSION
CREATE EXTENSION
ALTER TABLE

$ sudo -u postgres psql -f /vagrant/contrib/pg-03-db-permissions.sql
REVOKE
You are now connected to database "osm" as user "postgres".
REVOKE
REVOKE
REVOKE
GRANT
GRANT
ALTER DEFAULT PRIVILEGES
GRANT
GRANT
GRANT
```

Next we need to modify PostgreSQL's access configuration to allow access to the database for `import` and `render` db roles. Replace the `pg_hba.conf` with our custom copy:

```sh
$ sudo cp /vagrant/contrib/pg_hba.conf /etc/postgresql/10/main/pg_hba.conf
```

Then do the same with `pg_ident.conf`:

```sh
$ sudo cp /vagrant/contrib/pg_ident.conf /etc/postgresql/10/main/pg_ident.conf
```

This will allow the Linux `root` user to access `import` and `render`, which we need for data import. The `vagrant` user for `tilestrata` will be granted access to the `render` role.

Reload the database, and test out the connections:

```
$ sudo service postgresql reload
$ sudo psql -U import osm -c "CREATE TABLE public.test (); DROP TABLE public.test"
DROP TABLE

$ sudo psql -U render osm -c "CREATE TABLE public.test (); DROP TABLE public.test"
ERROR:  permission denied for schema public
LINE 1: CREATE TABLE public.test (); DROP TABLE public.test
```

This means `import` role can create DB objects, but `render` role cannot.

### Install OSM2PGSQL

[`osm2pgsql`] is one of the main tools for importing OpenStreetMap data into a PostgreSQL database.

```sh
$ sudo apt install -y osm2pgsql
$ osm2pgsql --version
osm2pgsql SVN version 0.88.1 (64bit id space)
```

For some reason, it also sets up PostgreSQL 9.6, so turn that DB off as we won't use it:

```
$ pg_lsclusters
Ver Cluster Port Status Owner    Data directory               Log file
9.6 main    5433 online postgres /var/lib/postgresql/9.6/main /var/log/postgresql/postgresql-9.6-main.log
10  main    5432 online postgres /var/lib/postgresql/10/main  /var/log/postgresql/postgresql-10-main.log
$ sudo pg_dropcluster 9.6 main --stop
```

[`osm2pgsql`]: https://github.com/openstreetmap/osm2pgsql

### Install Mapnik

Mapnik is the rendering library that takes stylesheet files and determines how to draw the data into tiles. We will install the package as well as its dependencies, as they are needed by node-mapnik in a later step.

```sh
$ sudo apt install -y libmapnik3.0 libmapnik-dev mapnik-utils
$ mapnik-config --version
3.0.13
```

### Install Node.js and Tilestrata

For serving our raster and vector tiles, we will use [Tilestrata] which runs on Node.js. We will install version 6 for Ubuntu, as node-mapnik has pre-built binaries for Node v6.

```sh
$ curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
$ sudo apt install -y nodejs
$ node --version
v6.11.5
```

[Tilestrata]: https://github.com/naturalatlas/tilestrata

## Loading Data

For our region of interest, Nunavut, we will download an OpenStreetMap database extract as well as shapefiles from [Natural Earth Data].

OpenStreetMap has an open database of all the data submitted by its users, and that data is available under the [Open Database License](https://opendatacommons.org/licenses/odbl/summary/) (ODbL). This means we can download and re-use the data for free, as long as we (a) attribute OpenStreetMap contributors, (b) make available our copy of the OpenStreetMap database, (c) always provide an un-encumbered copy of the database if we redistribute the database.

We will not be redistributing the database, and we can provide the extract files source to anyone that requests it. We will also keep our copy of the planet database extract in case the original source is not online. We will also ensure that our maps correctly attribute OpenStreetMap contributors.

The [entire planet database for OpenStreetMap][OSM Planet] is available in multiple formats, from a 37 GB Protocol-Buffer File (PBF) to a 60 GB XML file. We will instead use a small extract for our area of interest.

If you are thinking of trying the entire planet database with this tutorial, please reconsider as it will (a) take literal *days* to import, (b) require hundreds of GB of storage space for the database and indexes, and (c) be a huge waste of time if the import fails.

Our source for the extract will be [GeoFabrik], specifically [Nunavut].

```sh
$ mkdir ~/data
$ cd ~/data
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/physical/ne_10m_bathymetry_all.zip
15MB
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/physical/ne_10m_glaciated_areas.zip
1.6MB
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/physical/ne_10m_lakes.zip
1.7MB
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/physical/ne_10m_lakes_north_america.zip
200KB
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/110m/cultural/ne_110m_admin_0_boundary_lines_land.zip
44KB
$ wget http://www.naturalearthdata.com/http//www.naturalearthdata.com/download/10m/physical/ne_10m_land.zip
3.3MB

$ wget http://data.openstreetmapdata.com/land-polygons-split-4326.zip
466MB

$ wget http://download.geofabrik.de/north-america/canada/nunavut-latest.osm.pbf
91MB
```

Then we can extract the shapefiles. Note that some of the zip files aren't in folders, so we will extract into new folders to avoid a giant mess of files.

```sh
$ unzip ne_10m_bathymetry_all.zip
$ unzip -d ne_10m_glaciated_areas ne_10m_glaciated_areas.zip
$ unzip -d ne_10m_lakes ne_10m_lakes.zip
$ unzip -d ne_10m_lakes_north_america ne_10m_lakes_north_america.zip
$ unzip -d ne_110m_admin_0_boundary_lines_land ne_110m_admin_0_boundary_lines_land.zip
$ unzip -d ne_10m_land ne_10m_land.zip
$ unzip land-polygons-split-4326.zip
```

[GeoFabrik]: https://download.geofabrik.de
[Nunavut]: https://download.geofabrik.de/north-america/canada/nunavut.html
[OSM Planet]: https://planet.osm.org

### Importing OSM Data

This import uses the local socket for Postgres, creates a NEW database import on the "osm" database, uses 500 MB for the import cache, uses slim import mode to reduce RAM usage, uses 2 import processes (don't use too many as it might require too much RAM), imports only the columns set in the default osm2pgsql style file while additional tag data is stored in Postgres hstore, stores the coordinates as EPSG:4326 WGS84 longitude/latitude (instead of EPSG:3857 Web Mercator), use multi-geometry postgres features, and print verbose status during the import.

```sh
$ sudo osm2pgsql --host /var/run/postgresql --create --database osm \
  --username import --cache 500 --slim --number-processes 2 \
  --style /vagrant/carto-style/openstreetmap-carto.style --hstore \
  --proj 4326 --latlong -G -v \
  ~/data/nunavut-latest.osm.pbf
Osm2pgsql took 185s overall
```

This is a small dataset so it will take a few minutes to import.

### Add Indexes for Rendering

When the map rendering engine Mapnik gets a request for a set of tiles, it will iterate through the stylesheet layers and query PostgreSQL for the region and data on those layers. Some of these layers contain large and complex geometries, so PostgreSQL may use slower scans to find the information in the database. This is the source of most of the slow rendering performance with this rendering stack.

To help some of these rendering queries, we can add some partial indexes to the database:

```sh
$ cd ~
$ sudo psql -U import osm -f /vagrant/contrib/pg-04-indexes.sql
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
```

On a large OSM database the index creation can take hours or days to complete. Fortunately the small extract here only takes a few seconds. Next we will do some clean up in the database, to [remove dead rows][PostgreSQL Vacuum] and [update the statistics][PostgreSQL Statistics] for the PostgreSQL query planner:

```sh
$ sudo psql -U import osm -f "/vagrant/contrib/pg-05-vacuum.sql"
```

This will take a few seconds on this small extract, or for a planet file an entire day. Note that during this process the tables will be locked and any OSM database update processes will have to wait until the VACUUM is finished. In an actively updated OSM database, running a VACUUM will reclaim a noticeable amount of space every few months.

[PostgreSQL Vacuum]: https://www.postgresql.org/docs/9.6/static/sql-vacuum.html
[PostgreSQL Statistics]: https://www.postgresql.org/docs/9.6/static/sql-analyze.html

## Set Up the Stylesheet

I have created a fork of the [openstreetmap-carto] stylesheet in this repository that is optimized for this tutorial. As this tutorial focuses on a different region than the general OSM site, I cut out some unused stuff.

Start by copying the stylesheet to the home directory.

```sh
$ cp -r /vagrant/carto-style ~/carto-style
```

Now install the fonts needed for the stylesheet:

```sh
$ sudo apt install -y fonts-noto-cjk fonts-noto-hinted fonts-noto-unhinted \
  fonts-hanazono ttf-unifont
```

We will use a symlink to make the shapefile data available for the stylesheet.

```sh
$ cd ~/carto-style
$ ln -s /home/vagrant/data data
```

And then generate the Mapnik XML files for rendering:

```sh
$ sudo npm i -g npm
$ npm install
$ node_modules/carto/bin/carto 3573.mml > 3573.xml
```

This `3573.mml` file is a modification of the `openstreetmap-carto` stylesheet where the projection has been changed, some layers have been removed (e.g. Antarctica), and the shapefiles modified to versions that have been re-projected. We haven't done the reprojection yet, and that is the next step.

[openstreetmap-carto]: https://github.com/gravitystorm/openstreetmap-carto

### Process the Shapefiles

By default, the shapefiles for the `openstreetmap-carto` style are in either EPSG:3857 (Web Mercator) or EPSG:4326 (WGS84 CRS). It is possible to use these projections directly, and Mapnik will automatically re-project the files to the correct projection. This can cause some odd rendering errors.

This is caused by straight lines between two points being drawn differently in different projections. In EPSG:3857 two parallel lines of different lengths will line up, and there will be no gap. But in EPSG:3573 the parallel lines diverge in the polar projection, causing a gap between the lines to be visible.

To solve this, we will crop the shapefiles to remove unseen geography (Antarctica explodes in EPSG:3573), run a segmentization to add more points along lines (diminishes the gap effect), and then re-project into our target projection.

```sh
$ cd ~/data
$ /vagrant/contrib/process_shapefiles.sh .
```

## Starting the Tile Server

Tilestrata works by running a web server and serving the tiles from either a disk cache or generating them on-the-fly. It even integrates easily with [Express.js], a common web server for Node.js. With Express, we can also serve static files for our tile viewing client in the same process.

This repository includes a small tile server with client libraries, copy it into the VM to get it running.

```sh
$ cp -r /vagrant/tileserver ~/tileserver
$ cd ~/tileserver
$ npm install
```

Now we can start the server and try serving tiles:

```sh
$ node index.js
```

The server should now be accessible at [http://192.168.33.11:8080/](http://192.168.33.11:8080/). 

[Express.js]: http://expressjs.com/

## Previewing Tiles

Tilestrata will serve tiles using the typical OpenStreetMap XYZ style for URLs.

`http://192.168.33.11:8080/<style>/<zoom>/<x>/<y>.<format>`

In the `index.js` file we can see the style layer is `3573`. This name is arbitrary and doesn't have to correspond to the EPSG number.

Zoom/X/Y are the [standard tile coordinates][Slippy Map].

Format is either `png` for raster tiles, or `pbf` for vector tiles. PNG files can be previewed directly in your browser, but the PBF files need to be decoded by a client that supports [Mapnik Vector Tiles].

[Slippy Map]: http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
[Mapnik Vector Tiles]: https://github.com/mapbox/mapnik-vector-tile

### Raster Tiles

As we want to view the tiles as a client would, we will use a web map client. There are a few major choices available, but only one client that natively supports different tile projections as well as vector tiles in non-Web Mercator projection: OpenLayers.

We can preview the raster tiles in our browser: [http://192.168.33.11:8080/raster.html](http://192.168.33.11:8080/raster.html).

![EPSG:3573 Raster Preview](images/3573-raster-preview.jpg)

The rendering will look similar to `openstreetmap-carto`, with some modifications like [ArcticWebMap]. As you zoom in and pan, tilestrata will use Mapnik to render tiles on-the-fly and store the tiles in the `tilecache` directory; once rendered, the tiles will be re-used from the cache.

![EPSG:3573 Raster Preview of Iqaluit](images/3573-iqaluit-preview.jpg)

As the tiles are rendered using Mapnik directly, we get to use the nice features of the Mapnik renderer such as smart label placement, patterns, and line casings.

At this point, we have a raster tile server that is close to production ready. It could benefit from adding [ETag support][tilestrata-etag], Retina/high-DPI tiles, compressing assets, pre-rendering low-zoom tiles, supporting HTTPS, supporting OSM diffs and tile expiration, and even adding an HTTP caching server in front of the tile server.

[ArcticWebMap]: https://webmap.arcticconnect.org
[tilestrata-etag]: https://github.com/naturalatlas/tilestrata-etag

## Vector Tiles

The real neat part of this tutorial is next, but it is also going to be a lot of work. With vector tiles, the raw vector data specified in the Mapnik layer definitions (`3573.xml`) is sent to the client instead of a server-rendered image. The client is then responsible for rendering this data.

This means all the style information that Mapnik handles server-side for raster tiles must be ported into OpenLayers vector tile style definitions. And there is no [CartoCSS to OpenLayers converter][CartoCSS Parser], so it has to be done manually.

[CartoCSS Parser]: https://github.com/openlayers/openlayers/issues/826

I did some basic conversions of the `openstreetmap-carto` stylesheet, and it can be previewed with the Nunavut OSM data: [http://192.168.33.11:8080/vector.html](http://192.168.33.11:8080/vector.html).

![EPSG:3573 Vector Preview](images/3573-vector-preview.jpg)

![EPSG:3573 Vector Preview of Iqaluit](images/3573-vector-iqaluit.jpg)

As you can see, there are a lot of layers not drawn (even though the vector data is there for OpenLayers). I figure it could take a week or more to convert CartoCSS to OpenLayers style definitions manually, and at that point it would be better to write a converter.

There are some features that do not seem to be supported in the OpenLayers renderer, such as line casings and different line renderings for the two sides of a line. Text rendering and label placement is less flexible than Mapnik. This could potentially be added in the future.

You also may notice that vector tiles on their first load aren't any faster than raster tiles, and vector tiles don't even need to be rendered on the server! This reveals the real limitation of a tile server: **the database**. If you were to run a `top` or `iotop` command while the vector tiles are being created by `tilestrata`, you would see a pause while `postgres` queries the OSM data.

At this point you may be re-thinking whether vector tiles are worth it over raster tiles; here are some things worth considering.

* Can change the style on-the-fly in the client
    * This could be used to serve the same generic data and re-style it for different clients and purposes without having to generate different raster tiles for each purpose.
    * Could also be used to change the localization of labels dynamically
* When zooming to a new level, the previous zoom level geometry and labels can smoothly be scaled while the client is still downloading more detailed geometry from the tile server
* Vector tile PBFs are small, usually smaller than the PNGs

`tilestrata` has a profile page that lists the statistics for the tiles and routes, and it can be used to benchmark the performance in rendering times and sizes. I used that with a [split viewer](http://192.168.33.11:8080/split.html) to load the same regions (Iqaluit, NU for its urban geometries and Bylot Island, NU for its glacier geometries) as vector and raster tiles. Then I used the profile page info to compile the following tables.

#### Sample Tile Sizes

```
Zoom Level        PBF         PNG       % Change
1                5.97 kB     3.27 kB       83%
2               11.28 kB     3.57 kB      216%
3                7.50 kB     4.72 kB       59%
4               11.06 kB    12.29 kB      -10%
5                8.61 kB    16.94 kB      -49%
6                6.50 kB    14.07 kB      -54%
7                4.05 kB    11.97 kB      -66%
8                2.94 kB     8.71 kB      -66%
9                3.67 kB     7.70 kB      -52%
10               1.94 kB     8.49 kB      -77%
11               2.23 kB     9.31 kB      -76%
12               3.62 kB    11.41 kB      -68%
13               2.53 kB     9.54 kB      -73%
14               1.59 kB     9.10 kB      -83%
15               1.41 kB    10.60 kB      -87%
16               1.36 kB    11.87 kB      -89%
17               1.23 kB    13.03 kB      -91%
18                874 B     10.89 kB      -92%
19                712 B      8.31 kB      -91%
20                634 B      7.41 kB      -91%
21                489 B      5.00 kB      -90%
22                436 B      3.63 kB      -88%
```

#### Sample Max Tile Sizes

```
Zoom Level        PBF         PNG       % Change
1                7.99 kB    3.50 kB       128%
2               16.23 kB   14.06 kB        15%
3               32.89 kB   33.31 kB        -1%
4               31.82 kB   40.58 kB       -22%
5               21.00 kB   30.15 kB       -30%
6               18.64 kB   38.50 kB       -52%
7               14.45 kB   24.60 kB       -41%
8               23.50 kB   29.79 kB       -21%
9               42.71 kB   24.36 kB        75%
10              26.16 kB   30.36 kB       -14%
11              17.44 kB   27.24 kB       -36%
12              17.27 kB   26.06 kB       -34%
13              18.81 kB   42.22 kB       -55%
14              24.98 kB   45.56 kB       -45%
15              14.04 kB   57.00 kB       -75%
16               6.19 kB   41.67 kB       -85%
17               4.59 kB   50.30 kB       -91%
18               2.21 kB   31.36 kB       -93%
19               1.12 kB   18.05 kB       -94%
20                882 B    13.60 kB       -94%
21                658 B    11.19 kB       -94%
22                658 B    10.75 kB       -94%
```

From the above tables we can see that generally the vector tile are larger at low zoom levels and smaller at higher zoom levels. This is logical as large complex geometries such as coastlines and land cover will require more vector data to describe them than a rendered raster image, but for higher zoom levels the geometries become simpler and raster tiles have a minimum size that cannot beat the smaller vector tile sizes.

## Final Thoughts

Generating vector tiles for custom projections can be done, with a little extra work. The lack of client support for custom projections is disappointing and hopefully will improve in the future. The work required to write style files for vector clients hopefully will also be easier in the future, with either a simpler language or even an interactive editor.

There is potential for saving considerable database query time, as vector and raster layers have to query the database separately for the same PostGIS data in order to send/draw the tiles. It is possible to have the vector tiles query the database and store the geometries in the vector tile files, and then have the vector tile rasterizer re-use those stored tile files to draw the server-side raster tiles. I was able to get this working, but when drawing the raster tiles the Mapnik library would only use the context for a single tile and not the surrounding tiles to draw labels, meaning *every tile* had its own set of labels that were repeated across tiles or cut off at tile boundaries. This makes the map look broken and hard to read.

I tried adjusting the vector tile rasterizer buffer sizes but they did not seem to have any effect. I also adjusted the vector tile and vector tile rasterizer metatile settings, but this caused OpenLayers to draw repeated tiles. Hopefully in the future there is a solution, so the PostGIS queries could be re-used.

## License

MIT License
