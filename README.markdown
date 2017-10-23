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

GDAL is a toolkit of libraries and applications for manipulating geospatial data. We will use it to import data from files into PostgreSQL tables. We can get a newer version of GDAL from the [UbuntuGIS PPA]:

```sh
$ sudo add-apt-repository ppa:ubuntugis/ppa
$ sudo apt update
$ sudo apt install -y gdal-bin libgdal20 libgdal-dev
$ gdalinfo --version
GDAL 2.1.3, released 2017/20/01
```

Make sure GDAL 2.1 or newer is installed, as mis-matches between GDAL versions can cause weird issues across clients/hosts. Newer versions of GDAL also have some performance improvements and support more formats.

[UbuntuGIS PPA]: https://launchpad.net/~ubuntugis/+archive/ubuntu/ppa

## Install PostGIS

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
