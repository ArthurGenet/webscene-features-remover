require([
  "esri/identity/OAuthInfo",
  "esri/identity/IdentityManager",
  "esri/views/SceneView",
  "esri/widgets/Editor",
  "esri/WebScene",
  "esri/layers/SceneLayer",
  "esri/tasks/support/Query",
  "esri/tasks/QueryTask",
  "esri/layers/GraphicsLayer",
  "esri/widgets/Sketch/SketchViewModel",
  "esri/widgets/Slider",
  "esri/geometry/geometryEngine",
  "esri/Graphic",
  "esri/widgets/Search",
  "esri/core/promiseUtils"
  ], function(
    OAuthInfo, 
    esriId, 
    SceneView, 
    Editor, 
    WebScene,
    SceneLayer,
    Query,
    QueryTask,
    GraphicsLayer,
    SketchViewModel,
    Slider,
    geometryEngine,
    Graphic,
    Search,
    promiseUtils
    ) {
    
      var webscene_id = prompt("Voer uw webscene id in");

      // Authentification information: allows us to connect to ArcGIS Online
      // Create a new Application in ArcGIS Online and linked it to your website
      // Then add the link you want the user to access
      var info = new OAuthInfo({
            appId: "PgVvZNHefms6xLZR", // The application id created in ArcGIS Online
            // Uncomment the next line to prevent the user's signed in state from being shared with other apps on the same domain with the same authNamespace value.
            // authNamespace: "portal_oauth_inline",
            popup: true
          });
      // If needed ask the user to register
      esriId.registerOAuthInfos([info]);

      // Load the webscene with the given portalItem
      var scene = new WebScene({
           portalItem: {
            // autocasts as new PortalItem()
            id: webscene_id
          }
        });

      // Create a view with the scene
      var view = new SceneView({
        map: scene,
        container: "viewDiv",
        padding: {
          top: 40
          }
        });
      
      const sketchLayer = new GraphicsLayer(); // add a GraphicsLayer for the sketches
      var objectIdsSelected = [];  // list of current selected object ids
      let layerView_array = []; // store the views of each layer
      var layer_array = []; // store the layers
      var definitionExpression_map = new Map(); // store the basic definitionExpression of each layer
      var layer_checked = []; // store which layer is checked in the checkbox
      let index = 0

      view.when(function () {
        // For all the layers in the WebScene : 
        scene.allLayers.forEach(layer => {
          // We only retrieve the FeatureLayer and the SceneLayer
          if (layer.type === "feature" || layer.type === "scene") {
	          objectIdsSelected.push([]); // add a new array in the list
	          layer_array.push(layer); //add the layer to the list of layers
	          definitionExpression_map.set(layer.title, layer.definitionExpression); //retrieve the definitionExpression
	          var layers_checkbox_div = document.getElementById("layers_checkbox");
	          layer_checked.push(true); // the layer is checked in the checkbox
	          var newcontent = document.createElement('div'); 
	          var layer_title_checkbox = layer.title; // add a title to the checkbox
            // If the title is too long, only keep the beginning
	          if (layer_title_checkbox.length > 63){
	            layer_title_checkbox = layer_title_checkbox.substring(0,62)+"...";
	          }
            newcontent.innerHTML = "<input id="+ index +" type='checkbox' checked />"+ layer_title_checkbox +"<br />";
            while (newcontent.firstChild) {
              layers_checkbox_div.appendChild(newcontent.firstChild); // add the new content to the checkbox
            }
            // Add an event when checkbox is clicked
            document
              .getElementById(index)
              .addEventListener("change", checkbox_clicked(index));

            view.whenLayerView(layer_array[index]).then(function(layerView) {
              layerView_array.push(layerView); // add the View to the list
            })

            queryDiv.style.display = "block";

            index+=1;
          }

        })
      });

      function checkbox_clicked(index) {
        // Change click
        return function() {

          if (layer_checked[index] == true){
            layer_checked[index] = false;
          }
          else{
            layer_checked[index] = true;
          }

        }
      }

      // Add the div to querry the element to the bottom right of the View
      view.ui.add([queryDiv], "bottom-right");
      // use SketchViewModel to draw polygons that are used as a query
      let sketchGeometry = null;

      // Ability to sketch on the View
      const sketchViewModel = new SketchViewModel({
        layer: sketchLayer,
        defaultUpdateOptions: {
          tool: "reshape",
          toggleToolOnClick: false
        },
        defaultCreateOptions: { hasZ: false }, // follow the elelevation profile
        view: view
      });

      // When a graphic is drawn for the first time
      sketchViewModel.on("create", function(event) {
        if (event.state === "complete") {
          sketchGeometry = event.graphic.geometry;
          runQuery();
        }
      });

      // When we draw another graphic
      sketchViewModel.on("update", function(event) {
        if (event.state !== "cancel" && event.graphics.length) {
          sketchGeometry = event.graphics[0].geometry;
        }
      });

      // Draw geometry buttons - use the selected geometry to sketch
      document
        .getElementById("point-geometry-button")
        .addEventListener("click", geometryButtonsClickHandler);
      document
        .getElementById("line-geometry-button")
        .addEventListener("click", geometryButtonsClickHandler);
      document
        .getElementById("polygon-geometry-button")
        .addEventListener("click", geometryButtonsClickHandler);

      function geometryButtonsClickHandler(event) {
        const geometryType = event.target.value;
        // Create geometry
        sketchViewModel.create(geometryType);
      }



      // Button "Opnieuw" : Clear the geometry and 
      document
        .getElementById("clearGeometry")
        .addEventListener("click", clearGeometry);
      // Clear the geometry and set the default renderer
      function clearGeometry() {
        objectIdsSelected=[]; //remove all the selected objectIds

        // Recreate the empty objectIds array
        for (let i =0; i < layer_array.length; i+=1){
          objectIdsSelected.push([]);
        }

        // Remove the sketch
        sketchGeometry = null; 
        sketchViewModel.cancel();
        sketchLayer.removeAll();

        // Retrieve the basic definitionExpression for each layer and apply it
        for (let i = 0; i< layer_array.length; i+=1){
          for (var [key, value] of definitionExpression_map) {
            if(String(layer_array[i].title) == key){
              layer_array[i].definitionExpression = value;	      			
            }
          }
        }
      }

      // Set the geometry query on the visible SceneLayerView
      var debouncedRunQuery = promiseUtils.debounce(function() {
        if (!sketchGeometry) {
          return;
        }

        // Retrieve the index of the layer and its associated layer view in the lists
        for (let i = 0; i<layerView_array.length; i+=1){
          if (layer_checked[i] == true){
            index_layer = i;
            var index_scene = null;

  		        for (let j = 0; j < layerView_array.length; j+=1){
                if (layer_array[i].title == layerView_array[j].layer.title){
                  index_scene = j;
                  break;
                }
              }
              updateSceneLayer(index_scene,index_layer,selectByDefinitionExpression)
            }
          }	
        });

      function runQuery() {

        debouncedRunQuery().catch((error) => {
          // If the request is aborted
          if (error.name === "AbortError") {
            return;
          }
          console.error(error);
        });
      }

      function selectByDefinitionExpression(objectIDs,index_selection,objectIDsField){

        var definitionExpression = "";

        if(selectedFilter == "inside"){	
          // If there is no objectIds, we can stop here
          if (objectIDs.length == 0){
            return;
          }	

          var test_objectIds = true;

          // Check if there is already selected objectIds
          if (objectIdsSelected[index_selection].length == 0){
            test_objectIds = false;
          }

          // Concat the existant and the new objectIds in the list
          objectIdsSelected[index_selection] = objectIdsSelected[index_selection].concat(objectIDs);
          
          // If this is a new definitionExpression
          if (test_objectIds == false && layer_array[index_selection].definitionExpression == null){

            for (let i = 0; i<objectIdsSelected[index_selection].length; i+=1){

              if (i == 0){
                definitionExpression += objectIDsField+" <> " + objectIdsSelected[index_selection][0]+" ";
              }

              else{
                definitionExpression += "AND "+objectIDsField+" <> " + objectIdsSelected[index_selection][i] + " ";
              }              
            }

            layer_array[index_selection].definitionExpression = definitionExpression;
          }

          // If there is already a definitionExpression
          else{

            for (let i = 0; i<objectIdsSelected[index_selection].length; i+=1){

              definitionExpression += "AND "+objectIDsField+" <> " + objectIdsSelected[index_selection][i] + " ";
            }

            layer_array[index_selection].definitionExpression = layer_array[index_selection].definitionExpression.concat(definitionExpression);
          }
        }

      // Outside
      else{

        // If nothing is selected, everything is hidden
        if (objectIDs.length == 0){
          definitionExpression = "0=1";
        }

        objectIdsSelected[index_selection] = []; // clear the previous objectIds already used in the definitionExpression
        objectIdsSelected[index_selection] = objectIDs;

        for (let i = 0; i<objectIdsSelected[index_selection].length; i+=1){

          if (i == 0){

            if (objectIdsSelected[index_selection].length > 1){
              definitionExpression += "(" + objectIDsField + " = " + objectIdsSelected[index_selection][i] + " ";
            }

            else{
              definitionExpression += objectIDsField + " = " + objectIdsSelected[index_selection][i] + " ";
            }
          }

          else{
            definitionExpression += "OR " + objectIDsField + " = " + objectIdsSelected[index_selection][i] + " ";
            if (i == objectIdsSelected[index_selection].length-1){
              definitionExpression += ")";
            }
          }
        }
        layer_array[index_selection].definitionExpression = definitionExpression;
        objectIdsSelected[index_selection] = [];
      }
    }

    function  updateSceneLayer(index_scene, index_layer, callback){
      // Create a new query on the sketch
      const query = layerView_array[index_scene].createQuery();
      query.geometry = sketchGeometry;

      // Query the objectIds of the sketch
      layerView_array[index_scene].queryObjectIds(query).then(function(results){
        //selectByDefinitionExpression
        callback(results,index_layer, layer_array[index_layer].objectIdField);
      });
    }    

    // Change the value between "inside" and "outside"
    let selectedFilter = "inside";
    document
      .getElementById("relationship-select")
      .addEventListener("change", function(event) {
        var select = event.target;
        selectedFilter = select.options[select.selectedIndex].value;
      });

    // Reload the Web App when click on this button
    var reload = document.getElementById("sidebarDiv").getElementsByTagName("input")[3];
    reload.addEventListener("click", function(){
      window.location.reload(false); 
    })

    view.when(function() {
      // when the scene and view resolve, display the scene's
      // new title in the Div
      var sidebar = document.getElementById("sidebarDiv");
      var title = sidebar.getElementsByTagName("input")[0];
      var save = sidebar.getElementsByTagName("input")[1];
      var overwrite = sidebar.getElementsByTagName("input")[2];

      title.value = "Mijn Nieuwe Webscene";
      // Enable the buttons
      save.disabled = false; 
      overwrite.disabled = false;

      var overlay = document.getElementById("overlayDiv");
      var ok = overlay.getElementsByTagName("input")[0];

      function statusMessage(head, info) {
        overlay.getElementsByClassName("head")[0].innerHTML = head;
        overlay.getElementsByClassName("info")[0].innerHTML = info;
        overlay.style.visibility = "visible";
      }

      ok.addEventListener("click", function() {
        overlay.style.visibility = "hidden";
      });

      save.addEventListener("click", function() {
        // item automatically casts to a PortalItem instance by saveAs
        var item = {
          title: title.value
        };

        // Update properties of the WebScene related to the view. This should be called just before saving a scene.
        scene.updateFrom(view);

        scene
          .saveAs(item)
          // Saved successfully

          .then(function(item) {
          // link to the newly-created web scene item
            var itemPageUrl = item.portal.url + "/home/item.html?id=" + item.id;
            var link = '<a target="_blank" href="' + itemPageUrl + '">' + title.value + "</a>";

            statusMessage(
              "Save Webscene",
              "<br> Succesvol opgeslagen als <i>" + link + "</i>"
              );
          })
              
          // Save didn't work correctly
          .catch(function(error) {
            statusMessage("Opslaan Webscene", "<br> Error " + error);
          });
        });


      overwrite.addEventListener("click", function() {
        // Update properties of the WebScene related to the view. This should be called just before saving a scene.
        scene.updateFrom(view);

        scene
          .save() // we only save the scene
          .then(function(item) {
            // link to the newly-created web scene item
            var itemPageUrl =
            item.portal.url + "/home/item.html?id=" + item.id;
            var link = '<a target="_blank" href="' + itemPageUrl + '">' + item.title + "</a>";

            statusMessage(
              "Opslaan Webscene",
              "<br> Succesvol opgeslagen als <i>" + link + "</i>"
            );
          })
          // Saved successfully
              
          // Save didn't work correctly
          .catch(function(error) {
            statusMessage("Opslaan Webscene", "<br> Error " + error);
          });
      });
    });
  });