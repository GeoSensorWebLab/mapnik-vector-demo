#!/bin/bash
set -e

CLIPSRC="-180 45 180 90"
SEGMENTIZE="0.5"
OGR_OPTS='-clipsrc -180 45 180 90 -segmentize 0.5 -t_srs EPSG:3573 -f "ESRI Shapefile"'
PROJ="3573"

DIR=$1
SFILES=$(find $1 -iname "*.shp" -not -path "./output" -print)
mkdir -p output

for file in $SFILES; do
	echo "Processing \"${file}\"..."
	dir=$(dirname $file)
	f=$(basename $file)

	mkdir -p output/${dir}

	# clip
	clip="output/${dir}/${f}.clip.shp"
	echo "ogr2ogr -clipsrc ${CLIPSRC} $clip $file"
	ogr2ogr -skipfailures -clipsrc ${CLIPSRC} $clip $file

	# segmentize
	segmented="output/${dir}/${f}.segmentize.shp"
	echo "ogr2ogr -segmentize $SEGMENTIZE $segmented $clip"
	ogr2ogr -segmentize $SEGMENTIZE $segmented $clip

	# reproject
	final="output/${dir}/${f}.${PROJ}.shp"
	echo "ogr2ogr -t_srs \"EPSG:${PROJ}\" $final $segmented"
	ogr2ogr -t_srs "EPSG:${PROJ}" $final $segmented

	# cleanup
	rm $clip
	rm $segmented
done
