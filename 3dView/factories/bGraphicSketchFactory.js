// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

'use strict';

app.factory('bGraphicSketchFactory', ['bGraphicFactory', function (bGraphicFactory) {
   var Services = {
      showGrid: _showGrid,
      addRadiusToGrid: _addRadiusToGrid,
      addPathToGrid: _addPathToGrid,
      addPointToGrid: _addPointToGrid
   };

   /* ----------- internal functions --------- */
   function _getDragAndDropBehavior (dragStartFunction, dragFunction, dragEndFunction) {
      dragEndFunction = dragEndFunction || function () {};
      dragFunction = dragFunction || function () {};
      dragStartFunction = dragStartFunction || function () {};

      var behavior = new BABYLON.PointerDragBehavior({dragPlaneNormal: new BABYLON.Vector3(0, 0, 1)});

      // Disable acceleration
      behavior.dragDeltaRatio = 1;

      // Use drag plane in world space
      behavior.useObjectOrienationForDragging = false;

      // Listen to drag events
      behavior.onDragStartObservable.add(function () { dragStartFunction(); });
      behavior.onDragObservable.add(function () { dragFunction(); });
      behavior.onDragEndObservable.add(function () { dragEndFunction(); });

      return behavior;
   }

   /* ----------- external functions --------- */
   function _showGrid (groupId, node, translation, rotation, plane, name, options, scene) {
      var gridMesh = BABYLON.Mesh.CreateGround(name, 1.0, 0.0, 1, scene);
      gridMesh.translate(translation, 1, BABYLON.Space.LOCAL);
      gridMesh.parent = node;
      gridMesh.scaling.x = options.sizeAxis1 || 100;
      gridMesh.scaling.z = options.sizeAxis2 || 100;
      gridMesh.isPickable = options.pickable || false;
      gridMesh.plane = plane;

      if (plane === 'xy') gridMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2);
      if (plane === 'yz') gridMesh.rotate(new BABYLON.Vector3(0, 0, 1), Math.PI / 2);

      var gridMaterial = new BABYLON.GridMaterial(name + 'Material', scene);
      gridMaterial.majorUnitFrequency = options.majorUnitFrequency || 10;
      gridMaterial.minorUnitVisibility = options.minorUnitVisibility || 0.3;
      gridMaterial.gridRatio = options.gridRation || 0.01;
      gridMaterial.backFaceCulling = options.backFaceCulling || false;
      gridMaterial.mainColor = options.mainColor || new BABYLON.Color3(1, 1, 1);
      gridMaterial.lineColor = options.lineColor || new BABYLON.Color3(1.0, 1.0, 1.0);
      gridMaterial.opacity = options.opacity || 0.8;
      gridMaterial.zOffset = options.zOffset || 1.0;

      gridMesh.material = gridMaterial;

      return gridMesh;
   }

   function _addRadiusToGrid (grid, start, end, center, clockwise, name, options, scene) {
      var coordinates = bGraphicFactory.getRadiusPoints(start, end, center, clockwise, {nodes: 72, addStart: true});

      var radius = BABYLON.Mesh.CreateLines('Radius_' + name, coordinates, scene, !options.replacement, options.replacement);

      radius.enableEdgesRendering();
      radius.edgesWidth = 10;
      radius.edgesColor = options.color || new BABYLON.Color4(0.3, 0.3, 0.3, 1);

      radius.actionManager = new BABYLON.ActionManager(scene);
      radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, radius, 'edgesColor', radius.edgesColor));
      radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, radius, 'edgesColor', new BABYLON.Color4(1, 0, 0, 1)));

      if (options.dragAndDrop) {
         radius.addBehavior(
            _getDragAndDropBehavior(
               options.dragStartFunction,
               options.dragFunction,
               options.dragEndFunction
            )
         );
      }

      if (grid) {
         radius.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         radius.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      return radius;
   }

   function _addPathToGrid (grid, start, end, name, options, scene) {
      var line = BABYLON.Mesh.CreateLines('Path_' + name, [start, end], scene, !options.replacement, options.replacement);

      line.enableEdgesRendering();
      line.edgesWidth = 10;
      line.edgesColor = options.color || new BABYLON.Color4(0.3, 0.3, 0.3, 1);

      line.actionManager = new BABYLON.ActionManager(scene);
      line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, line, 'edgesColor', line.edgesColor));
      line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, line, 'edgesColor', new BABYLON.Color4(1, 0, 0, 1)));

      if (options.dragAndDrop) {
         line.addBehavior(
            _getDragAndDropBehavior(
               options.dragStartFunction,
               options.dragFunction,
               options.dragEndFunction
            )
         );
      }

      if (grid) {
         line.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         line.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      return line;
   }

   function _addPointToGrid (grid, position, name, options, scene) {
      var item = BABYLON.MeshBuilder.CreateGround(
         'Point_' + name,
         {width: 0.3, height: 0.3},
         scene
      );
      // Set point in front for accurate visibility and selection
      // min. 0.01 due to interaction radius of line
      position.z -= 0.01;
      item.position = position;
      item.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);

      var material = new BABYLON.StandardMaterial('point', scene);
      material.diffuseColor = options.color || new BABYLON.Color3.Black();
      material.emissiveColor = options.color || new BABYLON.Color3.Black();

      item.material = material;

      item.actionManager = new BABYLON.ActionManager(scene);
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, item.material, 'diffuseColor', item.material.diffuseColor));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, item.material, 'emissiveColor', item.material.emissiveColor));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, item.material, 'diffuseColor', BABYLON.Color3.Red()));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, item.material, 'emissiveColor', BABYLON.Color3.Red()));

      if (options.dragAndDrop) {
         item.addBehavior(
            _getDragAndDropBehavior(
               options.dragStartFunction,
               options.dragFunction,
               options.dragEndFunction
            )
         );
      }

      if (grid) {
         item.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         item.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      return item;
   }

   return Services;
}]);
