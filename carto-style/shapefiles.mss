#necountries {
  [zoom >= 1][zoom < 4] {
    line-width: 0.2;
    [zoom >= 2] {
      line-width: 0.3;
    }
    [zoom >= 3] {
      line-width: 0.4;
    }
    line-color: @admin-boundaries;
  }
}

#world {
  [zoom >= 0][zoom < 10] {
    polygon-fill: @land-color;
  }
}

#coast-poly {
  [zoom >= 10] {
    polygon-fill: @land-color;
  }
}

#icesheet-poly {
  [zoom >= 6] {
    polygon-fill: @glacier;
  }
}

#icesheet-outlines {
  [zoom >= 6] {
    [ice_edge = 'ice_ocean'],
    [ice_edge = 'ice_land'] {
      line-width: 0.375;
      line-color: @glacier-line;
      [zoom >= 8] {
        line-width: 0.5;
      }
      [zoom >= 10] {
        line-dasharray: 4,2;
        line-width: 0.75;
      }
    }
  }
}

#builtup {
  [zoom >= 8][zoom < 10] {
    polygon-fill: #ddd;
  }
}

/* For the bathymetry features */

#bathymetry-10km {
  polygon-fill: darken(@water-color, 38%);
}

#bathymetry-9km {
  polygon-fill: darken(@water-color, 35%);
}

#bathymetry-8km {
  polygon-fill: darken(@water-color, 32%);
}

#bathymetry-7km {
  polygon-fill: darken(@water-color, 29%);
}

#bathymetry-6km {
  polygon-fill: darken(@water-color, 26%);
}

#bathymetry-5km {
  polygon-fill: darken(@water-color, 23%);
}

#bathymetry-4km {
  polygon-fill: darken(@water-color, 20%);
}

#bathymetry-3km {
  polygon-fill: darken(@water-color, 17%);
}

#bathymetry-2km {
  polygon-fill: darken(@water-color, 14%);
}

#bathymetry-1km {
  polygon-fill: darken(@water-color, 11%);
}

#bathymetry-200m {
  polygon-fill: darken(@water-color, 8%);
}

#lakes-low [zoom >= 4][zoom < 6] {
  polygon-fill: @water-color;
}
