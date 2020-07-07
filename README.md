# webscene-features-remover
This project availables users of ArcGIS to quickly and easily hide features from their WebScenes.  
This Web App modifies the definitionExpression attribute of the SceneLayers and FeatureLayers from the WebScene. This attribute applies a filter on the layer it is associated with.

## Usage
The Web App is avalaible online with this link: 
1. Enter your WebScene id (you need the rights to modify it)
2. Choose your parameters (bottom-right): 
- check which layer you want to modify
- choose if you want to remove the features inside ("binnenkant") or the outside ("buitenkant") your selection
- choose with which sketch to select your features (point, polyline, polygon)
3. Draw your sketch
4. Repeat these steps as many time as you want
5. If you have made a mistake, you can come back to the start by clicking "Opnieuw"
6. Once you have finish you can save your work as another layer ("Opslaan") or overwright an existing layer ("Overschrijven")
7. Click on "Selecteer een nieuwe Webscene" to change the current WebScene