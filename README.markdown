# Mapnik Tiles with Custom Projections

In this guide I will show you how to deploy a small web map tile server on a virtual machine. It will serve up tiles in projections that are not the default Web Mercator projection. An OpenLayers client will be used to view the final result.

Here is a preview of the region we will set up in this tutorial:

(Image of Nunavut here)

## Background

A majority of the web map providers online all provide tiles in the same map projection: [Web Mercator]. This projection flattens the ellipsoidal Earth into a flat plane, which is then sliced up into tiles for map clients. Web Mercator uses some simplification of formulas to generate its coordinates compared to the standard Mercator projection. The simplification is easier to code and process, but causes significant distortion and inaccuracy as the coordinates move away from the equator. The distortion is so great that the top and bottom of Web Mercator are cut off at 85.05 degrees.

For many users, these inaccuracies and distortions make Mercator and Web Mercator projections a poor choice. Fortunately there are [thousands of standardized map projections][epsg.io] covering the entire planet, allowing you to choose one for your region of interest.

If custom projections are better suited for specialized areas of interest, why wouldn't you always use them? First of all is that Web Mercator has very broad server and client library support. If you want to integrate multiple libraries, Web Mercator is something you can rely on both libraries supporting. Secondly is that for a large proportion of people, Web Mercator is good enough for understanding generally where places are located.

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
$ sudo apt install -y zip unzip
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

Mapnik is the rendering library that takes stylesheet files and determines how to draw the data into tiles.

```sh
$ sudo apt install  libboost-filesystem-dev libboost-program-options-dev \
  libboost-program-options1.58-dev libboost-program-options1.58.0 \
  libboost-regex1.58-dev libboost-regex1.58.0 libboost-system-dev \
  libbz2-dev libcairo2-dev \
  libfreetype6-dev libgeos++-dev libharfbuzz-bin \
  libharfbuzz-dev libharfbuzz-icu0 liblua5.2-dev \
  lua5.2 libmapnik3.0 libmapnik-dev mapnik-utils
$ mapnik-config --version
3.0.13
```

Next we need to install the Mapnik vector tile library.

```sh
$ sudo add-apt-repository ppa:jonathonf/gcc
$ sudo apt-get update
$ sudo apt install -y g++-7 gcc-7 libprotoc-dev libprotoc9v5 libprotobuf-dev protobuf-compiler mapnik-vector-tile
```

### Install Node.js and Tilestrata

For serving our raster and vector tiles, we will use [Tilestrata] which runs on Node.js. We can install version 8 for Ubuntu:

```sh
$ curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
$ sudo apt install -y nodejs
$ node --version
v8.7.0
$ sudo chown -R $USER:$(id -gn $USER) /home/vagrant/.config
$ sudo npm install --unsafe-perm -g tilestrata tilestrata-mapnik tilestrata-disk tilestrata-vtile tilestrata-headers mapnik
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
```

[GeoFabrik]: https://download.geofabrik.de
[Natural Earth Data]: http://www.naturalearthdata.com/
[Nunavut]: https://download.geofabrik.de/north-america/canada/nunavut.html
[OSM Planet]: https://planet.osm.org

### Importing OSM Data

This import uses the local socket for Postgres, creates a NEW database import on the "osm" database, uses 500 MB for the import cache, uses 2 import processes (don't use too many as it might require too much RAM), imports only the columns set in the default osm2pgsql style file while additional tag data is stored in Postgres hstore, use multi-geometry postgres features, and print verbose status during the import.

```sh
$ sudo osm2pgsql --host /var/run/postgresql --create --database osm \
  --username import -C 500 --number-processes 2 \
  --style /usr/share/osm2pgsql/default.style --hstore -E 4326 -G -v \
  ~/data/nunavut-latest.osm.pbf
Osm2pgsql took 7s overall
```

This is a small dataset so it will take under a minute to import.

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

I have created a fork of the openstreetmap-carto stylesheet in this repository that is optimized for this tutorial. As this tutorial focuses on a different region than the general OSM site, I cut out some unused stuff.

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
$ sudo npm install -g carto
$ carto project.mml > project.xml
```

TODO: Update this with a EPSG:3573 MML file

### Process the Shapefiles

## Starting the Tile Server

## Previewing Tiles

