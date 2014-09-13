(function(){
    var DATA_SERVICE_URL = "https://script.google.com/macros/s/AKfycbyxqfsV0zdCKFRxgYYWPVO1PMshyhiuvTbvuKkkHjEGimPcdlpd/exec?jsonp=?";
    var ICON_URL = "http://andreyh13.github.io/tfecampos/resources/soccerfield.png";
    
    var isMobile = {
        Android: function() {
            return navigator.userAgent.match(/Android/i);
        },
        BlackBerry: function() {
            return navigator.userAgent.match(/BlackBerry/i);
        },
        iOS: function() {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        },
        Opera: function() {
            return navigator.userAgent.match(/Opera Mini/i);
        },
        Windows: function() {
            return navigator.userAgent.match(/IEMobile/i);
        },
        any: function() {
            return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
        }
    };

    // DEFAULT_ZOOM is the default zoom level for the map.
    // AUTO_ZOOM is the level used when we automatically zoom into a place when
    // the user selects a marker or searches for a place.
    // userZoom holds the zoom value the user has chosen.
    var DEFAULT_ZOOM = 11;
    if (screen.width <= 960 || isMobile.any()){
        DEFAULT_ZOOM = 9;
    }
    var AUTO_ZOOM = 18;
    var userZoom = DEFAULT_ZOOM;
    var map;
    var checkboxes = {};
    var infoWindow = new google.maps.InfoWindow({
        pixelOffset: new google.maps.Size(0, -35),
        disableAutoPan: true
    });
    var directionsService = new google.maps.DirectionsService();
    var directionsDisplay;
    
    // The markerClicked flag indicates whether an info window is open because the
    // user clicked a marker. True means the user clicked a marker. False
    // means the user simply hovered over the marker, or the user has closed the
    // info window.
    var markerClicked = false;
    var previousName;
    
    // This function is called after the page has loaded, to set up the map.
    function initializeMap() {
        map = new google.maps.Map(document.getElementById("map-canvas"), {
            center: new google.maps.LatLng(28.2945288, -16.565290900000036),
            zoom: DEFAULT_ZOOM,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            panControl: false,
            streetViewControl: true,
            streetViewControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            },
            zoomControl: true,
            zoomControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        });
        directionsDisplay = new google.maps.DirectionsRenderer();
        
        setEventHandlers();
        // The techCommItemStyle() function computes how each item should be styled.
        // Register it here.
        map.data.setStyle(tfeCampItemStyle);

        // Add the search box and data type selectors to the UI.
        var input = /** @type {HTMLInputElement} */(
            document.getElementById('field-search'));

        var types = document.getElementById('type-selector');
        var branding = document.getElementById('branding');
        map.controls[google.maps.ControlPosition.TOP_LEFT].push(branding);
        map.controls[google.maps.ControlPosition.LEFT_TOP].push(types);
        map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
        
        var dirpanel = document.getElementById("directions-panel-wrapper");
        map.controls[google.maps.ControlPosition.RIGHT_TOP].push(dirpanel);


        // When the user searches for and selects a place, zoom in and add a marker.
        var searchMarker = new google.maps.Marker({
            map: map,
            visible: false,
        });

        // Get the data from the tech comm spreadsheet, using jQuery's ajax helper.
        var srchopts = [];
        var hashLatLng = {};
        $.ajax({
            url: DATA_SERVICE_URL,
            dataType: 'jsonp',
            success: function(data) {
                // Get the spreadsheet rows one by one.
                // First row contains headings, so start the index at 1 not 0.
                for (var i = 1; i < data.length; i++) {
                    map.data.add({
                      properties: {
                        municipality: data[i][0],
                        name: data[i][1],
                        address: data[i][2],
                        description: data[i][3],
                        phone: data[i][4],
                        type: data[i][7]
                      },
                      geometry: {
                        lat: data[i][5], 
                        lng: data[i][6]
                      }
                    });
                    srchopts.push({
                      label: data[i][1], 
                      category: data[i][0],
                    });
                    hashLatLng[data[i][1]] = new google.maps.LatLng(data[i][5],data[i][6]);
                }
            }
        });
        
        $( "#field-search" ).catcomplete({
            delay: 0,
            source: srchopts,
            select: function( event, ui ) {
                map.setCenter(hashLatLng[ui.item.value]);
                map.data.forEach(function(feature){
                    if(ui.item.value === feature.getProperty("name")){
                        handleFeatureClick({
                            feature: feature
                        });
                    }
                });
            }
        });
    }

    // Returns the style that should be used to display the given feature.
    function tfeCampItemStyle(feature) {
      var type = feature.getProperty("type");   
        
       
        
      var style = {
        icon: ICON_URL, 
        // Show the markers for this type if
        // the user has selected the corresponding checkbox.
        visible: (checkboxes[type] != false)
      };

      return style;
    }

    function setEventHandlers() {
      // Show an info window when the user clicks an item.
      map.data.addListener('click', handleFeatureClick);

      // Show an info window when the mouse hovers over an item.
      map.data.addListener('mouseover', function(event) {
        if(!markerClicked){  
            createInfoWindow(event.feature);
            infoWindow.open(map);
        }    
      });

      // Close the info window when the mouse leaves an item.
      map.data.addListener('mouseout', function() {
        if (!markerClicked) {
          infoWindow.close();
        }
      });

      // Reset the click flag when the user closes the info window.
      infoWindow.addListener('closeclick', function() {
        markerClicked = false;
      });
        
      google.maps.event.addListener(infoWindow, 'domready', function(){
            var input = document.getElementById('place-search');
            if(input){
                var autocomplete = new google.maps.places.Autocomplete(input);
                autocomplete.bindTo('bounds', map);
            }
          
            $("#place-search-btn").click(function(){
                var start = document.getElementById('place-search').value;
                if(start){
                    var request = {
                      origin: start,
                      destination: infoWindow.getPosition(),
                      travelMode: google.maps.TravelMode.DRIVING
                    };
                    directionsService.route(request, function(response, status) {
                        if (status == google.maps.DirectionsStatus.OK) {
                            directionsDisplay.setPanel(document.getElementById("directions-panel"));
                            directionsDisplay.setMap(map);
                            directionsDisplay.setDirections(response);
                            $("#directions-panel-wrapper").show();
                        }
                    });
                }
            }); 
      });       
    }

    // Create a popup window containing the tech comm info.
    function createInfoWindow(feature, showDirections) {
      infoWindow.setPosition(feature.getGeometry().get());
      infoWindow.setContent('No information found');

      var content = $('<div id="infowindow" class="infowindow">');

      content.append($('<h2>').text(feature.getProperty('name')));

      if(!(screen.width <= 960 || isMobile.any())){    
        var infoP = $('<p>');
        infoP.append($('<em>').text(feature.getProperty('municipality')));
        content.append(infoP);
        
        content.append($('<p>').text(feature.getProperty('address')));    

        if (feature.getProperty('description')) {
            content.append($('<p>').text(feature.getProperty('description')));
        }
        if (feature.getProperty('phone')) {
            content.append($('<p>').text('Teléfono: ' + feature.getProperty('phone')));
        }
      }
        
      if(showDirections || markerClicked){
          var srch_html = "Como llegar desde <input id='place-search' type='text' value='' placeholder='Introduzca su dirección' />";
          srch_html += '<input type="button" id="place-search-btn" value="Buscar" />';
          var dirs = $("<div id='directions-info-window'>");
          dirs.html(srch_html);
          
          content.append(dirs);
      }    

      infoWindow.setContent(content.html());
    }

    // On click of marker, show the popup window and zoom in.
    function handleFeatureClick(event) {
      // Check whether the marker has been clicked already,
      // because we want to zoom out on second click of same marker.
      var currentName = event.feature.getProperty('name');
      if (currentName == previousName) {
        // This is the second click, so zoom back to user's previous zoom level.
        map.setZoom(userZoom);
        // Reset flags ready for next time round.
        previousName = '';
        markerClicked = false;
      } else {
        previousName = event.feature.getProperty('name'); 
        // This is the first click, so show the popup window and zoom in.
        createInfoWindow(event.feature, true);

        // Zoom in before opening the info window.
        // If the user has already zoomed in beyond our automatic zoom,
        // leave their zoom setting untouched.
        if (map.getZoom() > AUTO_ZOOM) {
          userZoom = map.getZoom();
        } else {
          map.setZoom(AUTO_ZOOM);
          map.setCenter(event.feature.getGeometry().get());
          userZoom = DEFAULT_ZOOM;
        }

        // Open the info window and reset flag ready for next time round.
        infoWindow.open(map);
        markerClicked = true;
        directionsDisplay.setPanel(null);
        directionsDisplay.setMap(null);
        $("#directions-panel-wrapper").hide();  
      }
    }

    // Load the map.
    google.maps.event.addDomListener(window, 'load', initializeMap);
    
    $.widget( "custom.catcomplete", $.ui.autocomplete, {
        _create: function() {
            this._super();
            this.widget().menu( "option", "items", "> :not(.ui-autocomplete-category)" );
        },
        _renderMenu: function( ul, items ) {
            var that = this, currentCategory = "";
            $.each( items, function( index, item ) {
                var li;
                if ( item.category != currentCategory ) {
                    ul.append( "<li class='ui-autocomplete-category'>" + item.category + "</li>" );
                    currentCategory = item.category;
                }
                li = that._renderItemData( ul, item );
                if ( item.category ) {
                    li.attr( "aria-label", item.category + " : " + item.label );
                }
            });
        }
    });
    
    $(function(){
        $('#type-selector').details();
        
        $("#type-selector > .type-selector-details > input").change(function(){
            var type = $(this).attr("id").replace(/selecttype-/ig,'');
            checkboxes[type] = this.checked;
            // Tell the Data Layer to recompute the style, since checkboxes have changed.
            map.data.setStyle(tfeCampItemStyle);      
        });
        
        $("a#linktype-select-all").click(function(){
            $("#type-selector > .type-selector-details > input").each(function(){
                this.checked = true;
                var type = $(this).attr("id").replace(/selecttype-/ig,'');
                checkboxes[type] = this.checked;
            });
            map.data.setStyle(tfeCampItemStyle);
            return false;
        });
        $("a#linktype-unselect-all").click(function(){
            $("#type-selector > .type-selector-details > input").each(function(){
                this.checked = false;
                var type = $(this).attr("id").replace(/selecttype-/ig,'');
                checkboxes[type] = this.checked;
            });
            map.data.setStyle(tfeCampItemStyle);
            return false;
        });
        $("#directions-panel-switch").click(function(){
            $("#directions-panel-wrapper").hide();
            return false;
        });
    });
})();

