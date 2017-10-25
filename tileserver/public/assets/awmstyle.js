(function() {
  // COLORS
  const waterColor = '#b5d0d0';
  const landColor = '#f2efe9';
  const adminBoundaries = '#ac46ac';

  const countryLabels = '#ac46ac';
  const stateLabels = '#ac46ac';
  const placenames = '#222';

  const waterText = '#6699cc';
  const glacier = '#ddecec';
  const glacierLine = '#9cf';

  const motorwayLowZoom = '#e66e89';
  const motorwayLowZoomCasing = '#c24e6b';
  const motorwayCasing = '#dc2a67';
  const trunkLowZoom = '#f5977a';
  const trunkLowZoomCasing = '#cf6649';
  const trunkCasing = '#c84e2f';
  const primaryLowZoom = '#f3c380';
  const unimportantRoad = '#bbb';
  const haloColorForMinorRoad = 'white';
  const motorwayWidth = {
    5: 0.5,
    6: 0.5,
    7: 0.8,
    8: 1,
    9: 1.4,
    10: 1.9,
    11: 2.0,
    12: 3.5,
    13: 6,
    14: 5,
    15: 10,
    16: 10,
    17: 18,
    18: 21,
    19: 27
  };
  const trunkWidth = {
    5: 0.4,
    6: 0.4,
    7: 0.6,
    8: 1.0,
    9: 1.4,
    10: 1.9,
    11: 1.9,
    12: 3.5,
    13: 6,
    14: 6,
    15: 10,
    16: 10,
    17: 18,
    18: 21,
    19: 27
  };
  const primaryWidth = {
    8: 1,
    9: 1.4,
    10: 1.8
  };
  const secondaryWidth = {
    9: 1,
    10: 1
  };

  // Convert a string/hexcode into rgba with custom opacity
  var colorWithOpacity = function(color, opacity) {
    var c = Array.from(ol.color.asArray(color));
    c[3] = opacity;
    return c;
  }

  const emptyColor = colorWithOpacity('#FFF', 0);

  // Global text stroke style
  const textStroke = new ol.style.Stroke({
    color: '#FFF',
    opacity: 0.5,
    width: 1
  });

  
  // MASTER STYLESHEET
  var awmStyle = {
    background: waterColor,

    world: (z) => {
      if (z >= 0 && z < 10) {
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: landColor
          })
        });
      }
    },

    necountries: (z) => {
      if (z >= 1 && z < 3) {
        return new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: adminBoundaries,
            width: 0.2
          })
        });
      }
    },

    'coast-poly': (z) => {
      if (z >= 10) {
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: landColor
          })
        });
      }
    },

    'geographic-lines': (z) => {
      return new ol.style.Style({
        geometry: function(feature) {
          if (feature.get('name') === 'Arctic Circle') {
            return feature.getGeometry();  
          }
        },

        stroke: new ol.style.Stroke({
          color: colorWithOpacity('#116688', 0.5),
          width: 1
        }),

        text: new ol.style.Text({
          placement: 'line',
          text: 'Arctic Circle',
          stroke: textStroke
        })
      });
    },

    'graticule-lines': (z) => {
      return new ol.style.Style({
        geometry: function(feature) {
          if (feature.get('display') === '45 N') {
            return feature.getGeometry();  
          }
        },

        stroke: new ol.style.Stroke({
          color: colorWithOpacity('#116688', 0.5),
          width: 1
        }),

        text: new ol.style.Text({
          placement: 'line',
          text: '45 N',
          stroke: textStroke
        })
      });
    },

    'contours20': (z, f) => {
      var stroke = {
        color: emptyColor
      };

      if (z >= 12 && z <= 14) {
        stroke.width = 0.5;
        stroke.color = colorWithOpacity('#96733c', 0.5);
      }

      if (z >= 14) {
        stroke.width = 0.6;
        stroke.color = colorWithOpacity('#96733c', 0.5);
      }

      return new ol.style.Style({
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'contours100': (z, f) => {
      var stroke = {
        color: emptyColor
      };

      if (z >= 10 && z <= 13) {
        stroke.width = 0.7;
        stroke.color = colorWithOpacity('#db6d46', 0.5);
      }

      if (z >= 13) {
        stroke.width = 0.8;
        stroke.color = colorWithOpacity('#db6d46', 0.5);
      }

      return new ol.style.Style({
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'country': (z, f) => {
      var text = {
        placement: 'point'
      };

      if (z >= 3) {
        text.text = f.get('name');
        text.fill = new ol.style.Fill({
          color: countryLabels
        });
      }

      return new ol.style.Style({
        text: new ol.style.Text(text)
      });
    },

    'state': (z, f) => {
      var text = {
        placement: 'point'
      };

      if (z >= 5) {
        text.text = f.get('name');
        text.fill = new ol.style.Fill({
          color: stateLabels
        });
      }

      return new ol.style.Style({
        text: new ol.style.Text(text)
      });
    },

    'capital-names': (z, f) => {
      var text = {
        placement: 'point'
      };

      if (z >= 4) {
        text.text = f.get('name');
        text.fill = new ol.style.Fill({
          color: stateLabels,
          stroke: textStroke
        });
      }

      return new ol.style.Style({
        text: new ol.style.Text(text)
      });
    },

    'placenames-medium': (z, f) => {
      var text = {
        placement: 'point'
      };

      if (z >= 5) {
        text.text = f.get('name');
        text.fill = new ol.style.Fill({
          color: placenames,
          stroke: textStroke
        });
      }

      return new ol.style.Style({
        text: new ol.style.Text(text)
      });
    },


    'lakes-low': (z) => {
      if (z >= 4 && z < 6) {
        return new ol.style.Style({
          fill: new ol.style.Fill({
            color: waterColor
          })
        });
      }
    },

    

    'water-areas': (z, f) => {
      var fill = {
        color: emptyColor
      };
      var stroke = {
        color: emptyColor
      };

      if (f.get('natural') === 'glacier' && z >= 6) {
        stroke.width = 0.75;
        stroke.color = glacierLine;
        fill.color = glacier;
        if (z >=8) {
          stroke.width = 1.0;
        }
        if (z >= 10) {
          stroke.lineDash = [4,2];
          stroke.width = 1.5;
        }
      } else if (f.get('landuse') === 'basin' && z >= 7) {
        fill.color = waterColor;
      } else if (f.get('natural') === 'water' || f.get('landuse') === 'reservoir' || f.get('waterway') === 'riverbank') {
        if (z >= 6) {
          fill.color = waterColor;
        }
      }

      return new ol.style.Style({
        fill: new ol.style.Fill(fill),
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'water-lines-low-zoom': (z, f) => {
      var stroke = {
        color: emptyColor
      };

      if (f.get('waterway') === 'river' && z >= 8 && z <= 12) {
        if (f.get('intermittent') === 'yes') {
          stroke.lineDash = [8,4];
        }
        stroke.color = waterColor;
        stroke.width = 0.7;
        if (z >= 9) {
          stroke.width = 1.2;
        }
        if (z >= 10) {
          stroke.width = 1.6;
        }
      }

      return new ol.style.Style({
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'admin-low-zoom': (z, f) => {
      var adminLevel = f.get('admin_level');
      var stroke = {
        color: colorWithOpacity(adminBoundaries, 0.4),
        lineJoin: 'bevel'
      };

      if (z < 11) {
        if (adminLevel === '2') {
          stroke.width = 1.2;
        } else if (adminLevel === '3') {
          stroke.width = 0.6;
        } else if (adminLevel === '4') {
          stroke.lineDash = [4,3];
          stroke.width = 0.4;
        }

        return new ol.style.Style({
          stroke: new ol.style.Stroke(stroke)
        });
      }
    },

    'admin-mid-zoom': (z, f) => {
      var adminLevel = f.get('admin_level');
      var stroke = {
        color: colorWithOpacity(adminBoundaries, 0.5),
        lineJoin: 'bevel'
      };

      if (z >= 11 && z < 13) {
        if (adminLevel === '2') {
          stroke.width = 6;
        } else if (adminLevel === '3') {
          stroke.lineDash = [4,2];
          stroke.width = 4;
        } else if (adminLevel === '4') {
          stroke.lineDash = [4,3];
          stroke.width = 2.5;
        } else if (adminLevel === '5') {
          stroke.lineDash = [6,3,2,3,2,3];
          stroke.width = 2;
        } else if (adminLevel === '6') {
          stroke.lineDash = [6,3,2,3];
          stroke.width = 2;
        } else if (adminLevel === '7' || adminLevel === '8') {
          stroke.lineDash = [5,2];
          stroke.width = 1.5;
        }

        return new ol.style.Style({
          stroke: new ol.style.Stroke(stroke)
        });
      }
    },

    'admin-high-zoom': (z, f) => {
      var adminLevel = f.get('admin_level');
      var stroke = {
        color: colorWithOpacity(adminBoundaries, 0.5),
        lineJoin: 'bevel'
      };

      if (z >= 13) {
        if (adminLevel === '2') {
          stroke.width = 6;
        } else if (adminLevel === '3') {
          stroke.lineDash = [4,2];
          stroke.width = 4;
        } else if (adminLevel === '4') {
          stroke.width = 2.5;
          stroke.lineDash = [4,3];
        } else if (adminLevel === '5') {
          stroke.width = 2;
          stroke.lineDash = [6,3,2,3,2,3];
        } else if (adminLevel === '6') {
          stroke.width = 2;
          stroke.lineDash = [6,3,2,3];
        } else if (adminLevel === '7' || adminLevel === '8') {
          stroke.width = 1.5;
          stroke.lineDash = [5,2];
        } else if (adminLevel === '9' || adminLevel === '10') {
          stroke.width = 2;
          stroke.lineDash = [2,3];
        }

        return new ol.style.Style({
          stroke: new ol.style.Stroke(stroke)
        });
      }
    },

    'admin-text': (z, f) => {
      if (z >= 16) {
        return new ol.style.Style({
          text: new ol.style.Text({
            offsetY: -10,
            placement: 'line',
            text: f.get('name'),
            fill: new ol.style.Fill({
              color: adminBoundaries
            }),
            stroke: textStroke
          })
        });
      }
    },

    'nature-reserve-boundaries': (z) => {
      var fill = {
        color: emptyColor,
      };
      var stroke = {
        color: colorWithOpacity('green', 0.15),
        lineJoin: 'round'
      };
      if (z >= 7) {
        if (z < 10) {
          fill.color = colorWithOpacity('green', 0.05);
          stroke.width = 1;
        } else if (z >= 10) {
          stroke.width = 2;
        } else if (z >= 14) {
          stroke.width = 6;
        }

        return new ol.style.Style({
          fill: new ol.style.Fill(fill),
          stroke: new ol.style.Stroke(stroke)
        });
      }
    },

    'roads-low-zoom': (z, f) => {
      var fill = {};
      var stroke = {
        color: emptyColor,
        lineJoin: 'round'
      };

      if (z < 10) {
        if (f.get('feature') === 'highway_motorway') {
          stroke.color = motorwayLowZoom;
          stroke.width = motorwayWidth[z];
        } else if (f.get('feature') === 'highway_trunk') {
          if (z >= 5) {
            stroke.color = trunkLowZoom;
          }
          stroke.width = trunkWidth[z];
        } else if (f.get('feature') === 'highway_primary') {
          if (z >= 8) {
            stroke.color = primaryLowZoom;
          }
          stroke.width = primaryWidth[z];
        } else if (f.get('feature') === 'highway_secondary') {
          if (z >= 9) {
            stroke.color = unimportantRoad;
          }
          stroke.width = secondaryWidth[z];
        }
      } 

      return new ol.style.Style({
        fill: new ol.style.Fill(fill),
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'roads-casing': (z, f) => {
      var fill = {};
      var stroke = {
        color: emptyColor,
        lineJoin: 'round'
      };

      if (z === 9 && f.get('feature') === 'highway_secondary') {
        stroke.color = colorWithOpacity(haloColorForMinorRoad, 0.4);
        stroke.width = 2.2;
      }

      if ((z === 10 || z === 11) && f.get('feature') === 'highway_secondary') {
        stroke.color = colorWithOpacity(haloColorForMinorRoad, 0.4);
        stroke.width = 2.7;
      }

      if (
        ((z === 10 || z === 11) && f.get('feature') === 'highway_tertiary') ||
        (z === 12 && f.get('feature') === 'highway_unclassified')
      ) {
        stroke.color = colorWithOpacity(haloColorForMinorRoad, 0.3);
        stroke.width = 2.2;
      }

      if (z >= 12) {
        if (f.get('feature') === 'highway_motorway') {
          stroke.width = motorwayWidth[z];
          stroke.color = motorwayLowZoomCasing;

          if (z >= 13) {
            stroke.color = motorwayCasing;
          }
        }

        if (f.get('feature') === 'highway_trunk') {
          stroke.width = trunkWidth[z];
          stroke.color = trunkLowZoomCasing;

          if (z >= 13) {
            stroke.color = trunkCasing;
          }
        }
      }

      return new ol.style.Style({
        fill: new ol.style.Fill(fill),
        stroke: new ol.style.Stroke(stroke)
      });
    },

    'roads-fill': (z, f) => {
      var fill = {
        color: emptyColor,
      };
      var stroke = {
        color: emptyColor,
        lineJoin: 'round'
      };

      if (z >= 10) {
        if (f.get('feature') === 'highway_motorway') {
          stroke.color = motorwayLowZoom;
          stroke.width = motorwayWidth[z];
        } else if (f.get('feature') === 'highway_trunk') {
          stroke.color = trunkLowZoom;
          stroke.width = trunkWidth[z];
        } else if (f.get('feature') === 'highway_primary') {
          stroke.color = primaryLowZoom;
          stroke.width = primaryWidth[z];
        } else if (f.get('feature') === 'highway_secondary') {
          stroke.color = unimportantRoad;
          stroke.width = secondaryWidth[z];
        } else if (f.get('feature') === 'highway_tertiary') {
          stroke.color = unimportantRoad;
          stroke.width = 0.55;
        } else if (f.get('feature') === 'highway_residential' || f.get('feature') === 'highway_unclassified') {
          stroke.color = unimportantRoad;
          stroke.width = 1;
        }
      }

      return new ol.style.Style({
        fill: new ol.style.Fill(fill),
        stroke: new ol.style.Stroke(stroke)
      });
    },

    
  };

  window.AWMStyle = awmStyle;
})();