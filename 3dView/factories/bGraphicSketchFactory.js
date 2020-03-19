// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

'use strict';

app.factory('bGraphicSketchFactory', ['bGraphicFactory', function (bGraphicFactory) {
   var Services = {
      showGrid: _showGrid,
      addDimensionToGrid: _addDimensionToGrid,
      addPointToGrid: _addPointToGrid,
      addRadiusToGrid: _addRadiusToGrid,
      addStraightToGrid: _addStraightToGrid,
      updateBasicElement: _updateBasicElement,
      updatePoint: _updatePoint
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
      gridMaterial.gridRatio = options.gridRatio || 0.01;
      gridMaterial.backFaceCulling = options.backFaceCulling || false;
      gridMaterial.mainColor = options.mainColor || new BABYLON.Color3(1, 1, 1);
      gridMaterial.lineColor = options.lineColor || new BABYLON.Color3(1.0, 1.0, 1.0);
      gridMaterial.opacity = options.opacity || 0.8;
      gridMaterial.zOffset = options.zOffset || 1.0;

      gridMesh.material = gridMaterial;

      return gridMesh;
   }

   function _addDimensionToGrid (grid, axis, dimension, start, end, position, name, options, scene) {
      function dLength (angle, x, y) {
         return (y * Math.sin(angle) + x * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      function eLength (angle, x, y, d) {
         return (x * Math.sin(angle) - y * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      var dStart, dEnd, eEnd, eStart, vStart, vEnd, dimAngle;
      var axisColor = options.axisColor || new BABYLON.Color3(0, 0, 1);
      var textColorDefault = options.textColor || new BABYLON.Color3(0, 0, 0);
      var textColorMouseOver = options.textColorMouseOver || new BABYLON.Color3(1, 0, 0);

      if (axis === 'x') {
         dimAngle = 0;

      } else if (axis === 'y') {
         dimAngle = Math.PI / 2;

      } else if (axis === 'radius') {
         var dimDirection = end.subtract(start).normalizeToNew();
         dimAngle = Math.atan2(dimDirection.x, dimDirection.y);
      }

      vStart = start.subtract(position);
      vEnd = end.subtract(position);

      dStart = dLength(dimAngle, vStart.x, vStart.y);
      dEnd = dLength(dimAngle, vEnd.x, vEnd.y);

      eStart = eLength(dimAngle, vStart.x, vStart.y, dStart);
      eEnd = eLength(dimAngle, vEnd.x, vEnd.y, dEnd);

      var dimensionNode = new BABYLON.TransformNode('Dimension_' + name, scene);

      var dimensionLine = BABYLON.Mesh.CreateLines(
         'Dimension_arrow_' + name,
         [
            // Line start
            new BABYLON.Vector3(dStart, -eStart + Math.sign(eStart) * 0.3, 0),
            new BABYLON.Vector3(dStart, Math.sign(eStart) * 0.1, 0),
            // Arrow start
            new BABYLON.Vector3(dStart, 0, 0),
            new BABYLON.Vector3(dStart + 0.2, 0.1, 0),
            new BABYLON.Vector3(dStart, 0, 0),
            new BABYLON.Vector3(dStart + 0.2, -0.1, 0),
            new BABYLON.Vector3(dStart, 0, 0),
            // DimensionLine
            new BABYLON.Vector3(dEnd, 0, 0),
            // Arrow end
            new BABYLON.Vector3(dEnd - 0.2, 0.1, 0),
            new BABYLON.Vector3(dEnd, 0, 0),
            new BABYLON.Vector3(dEnd - 0.2, -0.1, 0),
            new BABYLON.Vector3(dEnd, 0, 0),
            // Line end
            new BABYLON.Vector3(dEnd, Math.sign(eEnd) * 0.1, 0),
            new BABYLON.Vector3(dEnd, -eEnd + Math.sign(eEnd) * 0.3, 0)
         ],
         scene
      );
      dimensionLine.parent = dimensionNode;
      dimensionLine.color = axisColor;
      dimensionLine.renderingGroupId = 3;

      var dimValue = dimension.value;
      var tolValue = dimension.tolerance.value || '';
      var tolType = dimension.tolerance.type || '';

      // Set height for plane
      var planeHeight = 1;
      var fontSize = 72;

      // Set height for dynamic texture
      var DTHeight = 1.2 * fontSize; // or set as wished

      // Calcultae ratio
      var ratio = planeHeight / DTHeight;
      // Set font
      var font = 'bold ' + fontSize + 'px Arial';
      var text = '' + dimValue + tolType + tolValue;
      var temp = new BABYLON.DynamicTexture('DynamicTexture', 64, scene);
      var tmpctx = temp.getContext();
      tmpctx.font = font;
      var DTWidth = tmpctx.measureText(text).width + 8;

      // Calculate width the plane has to be
      var planeWidth = DTWidth * ratio;

      // Create dynamic texture and write the text
      var dynamicTexture = new BABYLON.DynamicTexture('Dimension_label_' + name, {width: DTWidth, height: DTHeight}, scene, false);
      dynamicTexture.hasAlpha = true;
      dynamicTexture.drawText(text, null, null, font, 'white', 'transparent', true);

      // Create plane and set dynamic texture as material
      var plane = BABYLON.MeshBuilder.CreatePlane('Dimension_plane_' + name, {width: planeWidth, height: planeHeight}, scene);
      plane.material = new BABYLON.StandardMaterial('mat', scene);
      plane.material.diffuseColor = textColorDefault;
      plane.material.emissiveColor = textColorDefault;
      plane.material.diffuseTexture = dynamicTexture;
      plane.material.backFaceCulling = false;

      plane.parent = dimensionNode;
      plane.translate(new BABYLON.Vector3(0, 1, 0), 0.6, BABYLON.Space.LOCAL);

      plane.actionManager = new BABYLON.ActionManager(scene);
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'diffuseColor', plane.material.diffuseColor));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'emissiveColor', plane.material.emissiveColor));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'diffuseColor', textColorMouseOver));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'emissiveColor', textColorMouseOver));

      if (grid) {
         plane.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         plane.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      dimensionNode.position = position;
      dimensionNode.rotate(new BABYLON.Vector3(0, 0, 1), dimAngle);


      return dimensionNode;
   }

   function _addPointToGrid (grid, position, name, options, scene) {
      var colorDefault = options.color || new BABYLON.Color3.Black();
      var colorMouseOver = options.colorMouseOver || new BABYLON.Color3.Red();

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
      item.isPickable = options.isPickable;
      item.renderingGroupId = 1;

      var material = new BABYLON.StandardMaterial('point', scene);
      material.diffuseColor = colorDefault;
      material.emissiveColor = colorDefault;

      item.material = material;

      item.actionManager = new BABYLON.ActionManager(scene);
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, item.material, 'diffuseColor', item.material.diffuseColor));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, item.material, 'emissiveColor', item.material.emissiveColor));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, item.material, 'diffuseColor', colorMouseOver));
      item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, item.material, 'emissiveColor', colorMouseOver));

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

   function _addRadiusToGrid (grid, start, end, center, clockwise, name, options, scene) {
      var coordinates = bGraphicFactory.getRadiusPoints(start, end, center, clockwise, {nodes: 72, addStart: true});
      var radius;

      var colorDefault = options.color || new BABYLON.Color4(0.3, 0.3, 0.3, 1);
      var colorMouseOver = options.colorMouseOver || new BABYLON.Color4(1, 0, 0, 1);

      if (options.registerActions) {
         if (options.replacement) options.replacement.dispose();
         radius = BABYLON.Mesh.CreateLines(
            (options.replacement ? options.replacement.name : 'Radius_' + name),
            coordinates,
            scene,
            true
         );

      } else {
         radius = BABYLON.Mesh.CreateLines(
            'Radius_' + name,
            coordinates,
            scene,
            !options.replacement,
            options.replacement
         );
      }

      radius.enableEdgesRendering();
      radius.edgesWidth = 10;
      radius.edgesColor = colorDefault;

      if (options.dragAndDrop) {
         radius.addBehavior(
            _getDragAndDropBehavior(
               options.dragStartFunction,
               options.dragFunction,
               options.dragEndFunction
            )
         );
      }

      if (!options.registerActions) return radius;

      radius.actionManager = new BABYLON.ActionManager(scene);
      radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, radius, 'edgesColor', radius.edgesColor));
      radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, radius, 'edgesColor', colorMouseOver));

      if (grid) {
         radius.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         radius.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      return radius;
   }

   function _addStraightToGrid (grid, start, end, name, options, scene) {
      var line;

      var colorDefault = options.color || new BABYLON.Color4(0.3, 0.3, 0.3, 1);
      var colorMouseOver = options.colorMouseOver || new BABYLON.Color4(1, 0, 0, 1);
      if (options.registerActions) {
         if (options.replacement) options.replacement.dispose();
         line = BABYLON.Mesh.CreateLines(
            (options.replacement ? options.replacement.name : 'Straight_' + name),
            [start, end],
            scene,
            true
         );

      } else {
         line = BABYLON.Mesh.CreateLines(
            'Straight_' + name,
            [start, end],
            scene,
            !options.replacement,
            options.replacement
         );
      }

      line.enableEdgesRendering();
      line.edgesWidth = 10;
      line.edgesColor = colorDefault;

      if (options.dragAndDrop) {
         line.addBehavior(
            _getDragAndDropBehavior(
               options.dragStartFunction,
               options.dragFunction,
               options.dragEndFunction
            )
         );
      }

      if (!options.registerActions) return line;

      line.actionManager = new BABYLON.ActionManager(scene);
      line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, line, 'edgesColor', line.edgesColor));
      line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, line, 'edgesColor', colorMouseOver));

      if (grid) {
         line.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         line.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      return line;
   }

   function _updateBasicElement (basicElement, options) {
      if (options.color) {
         basicElement.edgesColor = options.color;
         basicElement.actionManager.actions[0].value = options.color;
      }
   }

   function _updatePoint (point, options) {
      if (options.color) {
         point.material.diffuseColor = options.color;
         point.material.emissiveColor = options.color;

         point.actionManager.actions[0].value = options.color;
         point.actionManager.actions[1].value = options.color;
      }
   }

   return Services;
}]);
