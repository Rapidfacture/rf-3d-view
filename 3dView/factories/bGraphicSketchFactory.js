// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

app.factory('bGraphicSketchFactory', ['bGraphicFactory', function (bGraphicFactory) {
   var Services = {
      addDimensionToGrid: _addDimensionToGrid,
      addPlaneToGrid: _addPlaneToGrid,
      addPointToGrid: _addPointToGrid,
      addRadiusToGrid: _addRadiusToGrid,
      addStraightToGrid: _addStraightToGrid,
      generatePaths: _generatePaths,
      showGrid: _showGrid,
      setPathDirection: _setPathDirection,
      start: _start,
      updateBasicElement: _updateBasicElement,
      updateConstraint: _updateConstraint,
      updateDimension: _updateDimension,
      updateGrid: _updateGrid,
      updatePoint: _updatePoint
   };

   var basicElementProperties = {
      lineWidth: 10,
      offsetZ: 0
   };
   var basicElementColors = {
      default: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
      fix: new BABYLON.Color4(0, 1, 0, 1),
      mouseOver: new BABYLON.Color4(1, 0, 0, 1),
      selected: new BABYLON.Color4(1, 0, 0, 1)
   };
   var dimensionColors = {
      defaultAxis: new BABYLON.Color3.Blue(),
      defaultPoint: new BABYLON.Color3.Gray(),
      defaultText: new BABYLON.Color3.Black(),
      mouseOverText: new BABYLON.Color3.Red(),
      mouseOverPoint: new BABYLON.Color3.Red()
   };
   var gridProperties = {
      offsetZ: 0
   };
   var planeColors = {
      default: new BABYLON.Color3(0.6, 0.6, 1),
      fix: new BABYLON.Color3(0, 1, 0),
      mouseOver: new BABYLON.Color3(0, 0, 1),
      selected: new BABYLON.Color3(0.3, 0.3, 1),
      snap: new BABYLON.Color3(0.6, 0.6, 0.6)
   };
   var planeProperties = {
      offsetZ: 0
   };
   var pointColors = {
      default: new BABYLON.Color3.Gray(),
      fix: new BABYLON.Color3.Green(),
      mouseOver: new BABYLON.Color3.Red(),
      selected: new BABYLON.Color3.Red(),
      snap: new BABYLON.Color3.Black()
   };
   var pointProperties = {
      offsetZ: -0.02
   };

   /* ----------- internal functions --------- */
   function _getGridRatio (groundSize, gridSize) {
      return gridSize / groundSize;
   }

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
   function _addDimensionToGrid (grid, axis, dimension, start, end, position, name, options, scene) {
      function dLength (angle, x, y) {
         return (y * Math.sin(angle) + x * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      function eLength (angle, x, y, d) {
         return (x * Math.sin(angle) - y * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      var dStart, dEnd, eEnd, eStart, vStart, vEnd, dimAngle, dimensionLine, plane, point, dynamicTexture;
      var axisColor = dimensionColors[options.status + 'Axis'];
      var scaleFactor = options.scaleFactor || 1;
      var textColorDefault = dimensionColors[options.status + 'Text'];
      var textColorMouseOver = dimensionColors.mouseOverText;
      var pointColorMouseOver = dimensionColors.mouseOverPoint;
      var pointColorStandard = dimensionColors[options.status + 'Point'];

      if (axis === 'x') {
         dimAngle = 0;

      } else if (axis === 'y') {
         dimAngle = Math.PI / 2;

      } else if (axis === 'radius') {
         var dimDirection = end.subtract(start).normalizeToNew();
         dimAngle = Math.atan2(dimDirection.y, dimDirection.x);
      }

      vStart = start.subtract(position);
      vEnd = end.subtract(position);

      dStart = dLength(dimAngle, vStart.x, vStart.y);
      dEnd = dLength(dimAngle, vEnd.x, vEnd.y);

      eStart = eLength(dimAngle, vStart.x, vStart.y, dStart);
      eEnd = eLength(dimAngle, vEnd.x, vEnd.y, dEnd);

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

      if (options.registerActions) {
         if (options.replacement) options.replacement.dispose();

         dimensionLine = BABYLON.Mesh.CreateLines(
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

         plane = BABYLON.MeshBuilder.CreatePlane(
            'Dimension_plane_' + name,
            {width: planeWidth, height: planeHeight},
            scene
         );

         point = BABYLON.MeshBuilder.CreateGround(
            'Dimension_point_' + name,
            {width: 0.2, height: 0.2, updateable: true},
            scene
         );

         dynamicTexture = new BABYLON.DynamicTexture(
            'Dimension_label_' + name,
            {width: DTWidth, height: DTHeight},
            scene
         );
         // Create dynamic texture and write the text
         dynamicTexture.hasAlpha = true;
         dynamicTexture.drawText(text, null, null, font, 'white', 'transparent', true);

      } else {
         var existingMeshes = options.replacement.getChildMeshes();

         dimensionLine = BABYLON.Mesh.CreateLines(
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
            scene,
            !options.replacement,
            existingMeshes[0]
         );

         plane = BABYLON.MeshBuilder.CreatePlane(
            'Dimension_plane_' + name,
            {width: planeWidth, height: planeHeight},
            scene,
            !options.replacement,
            existingMeshes[1]
         );

         point = BABYLON.MeshBuilder.CreateGround(
            'Dimension_point_' + name,
            {width: 0.2, height: 0.2, updateable: true},
            scene,
            !options.replacement,
            existingMeshes[2]
         );
      }

      dimensionLine.color = axisColor;

      point.position.z = -0.01;
      point.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
      point.isPickable = (options.isPickable === undefined ? true : options.isPickable);
      point.renderingGroupId = 1;
      point.scaling.x = scaleFactor;
      point.scaling.z = scaleFactor;

      var pointMaterial = new BABYLON.StandardMaterial('point', scene);
      pointMaterial.diffuseColor = pointColorStandard;
      pointMaterial.emissiveColor = pointColorStandard;

      point.material = pointMaterial;

      // Create plane and set dynamic texture as material
      plane.material = new BABYLON.StandardMaterial('mat', scene);
      plane.material.diffuseColor = textColorDefault;
      plane.material.emissiveColor = textColorDefault;
      if (dynamicTexture) plane.material.diffuseTexture = dynamicTexture;
      plane.material.backFaceCulling = false;

      plane.translate(new BABYLON.Vector3(0, 1, 0), 0.6, BABYLON.Space.LOCAL);

      plane.actionManager = new BABYLON.ActionManager(scene);
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'diffuseColor', plane.material.diffuseColor));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'emissiveColor', plane.material.emissiveColor));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'diffuseColor', textColorMouseOver));
      plane.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'emissiveColor', textColorMouseOver));

      point.actionManager = new BABYLON.ActionManager(scene);
      point.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, point.material, 'diffuseColor', point.material.diffuseColor));
      point.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, point.material, 'emissiveColor', point.material.emissiveColor));
      point.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, point.material, 'diffuseColor', pointColorMouseOver));
      point.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, point.material, 'emissiveColor', pointColorMouseOver));

      if (grid) {
         plane.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable'));
         plane.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
         point.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
         point.actionManager.registerAction(new BABYLON.SwitchBooleanAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable'));
      }

      var dimensionNode = new BABYLON.TransformNode('Dimension_' + name, scene);

      dimensionLine.parent = dimensionNode;
      plane.parent = dimensionNode;
      point.parent = dimensionNode;

      dimensionNode.position = position;
      dimensionNode.rotate(new BABYLON.Vector3(0, 0, 1), dimAngle);

      return dimensionNode;
   }

   function _addPlaneToGrid (grid, mainShape, holes, name, options, scene) {
      var colorStandard = planeColors[options.status];

      var plane = BABYLON.MeshBuilder.CreatePolygon(
         'plane',
         {
            depth: 5,
            holes: holes,
            shape: mainShape,
            sideOrientation: 2
         },
         scene
      );

      plane.position.z = planeProperties.offsetZ;
      plane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);

      var material = new BABYLON.StandardMaterial('plane', scene);
      material.diffuseColor = colorStandard;
      material.emissiveColor = colorStandard;

      plane.material = material;

      return plane;
   }

   function _addPointToGrid (grid, position, name, options, scene) {
      var scaleFactor = options.scaleFactor || 1;
      var colorStandard = pointColors[options.status];
      var colorMouseOver = pointColors.mouseOver;

      var item = BABYLON.MeshBuilder.CreateGround(
         'Point_' + name,
         {width: 0.3, height: 0.3, updateable: true},
         scene
      );

      // Set point in front for accurate visibility and selection
      // min. 0.01 due to interaction radius of line
      item.position.z = pointProperties.offsetZ;
      item.position = position;
      item.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
      item.isPickable = options.isPickable;
      item.isVisible = options.isVisible || true;
      item.renderingGroupId = 1;
      item.scaling.x = scaleFactor;
      item.scaling.z = scaleFactor;

      var material = new BABYLON.StandardMaterial('point', scene);
      material.diffuseColor = colorStandard;
      material.emissiveColor = colorStandard;

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
      var scaleFactor = options.scaleFactor || 1;

      var colorDefault = basicElementColors[options.status];
      var colorMouseOver = basicElementColors.mouseOver;

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

      radius.position.z = basicElementProperties.offsetZ;
      radius.enableEdgesRendering();
      radius.edgesWidth = basicElementProperties.lineWidth * scaleFactor;
      radius.edgesColor = colorDefault;
      radius.isPickable = (options.isPickable === undefined ? true : options.isPickable);

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
      var scaleFactor = options.scaleFactor || 1;

      var colorDefault = basicElementColors[options.status];
      var colorMouseOver = basicElementColors.mouseOver;
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

      line.position.z = basicElementProperties.offsetZ;
      line.enableEdgesRendering();
      line.edgesWidth = basicElementProperties.lineWidth * scaleFactor;
      line.edgesColor = colorDefault;
      line.isPickable = (options.isPickable === undefined ? true : options.isPickable);

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

   function _generatePaths (items) {
      var proceeded = [];
      var paths = [];

      for (var k in items) {
         if (items[k].class === 'basicElement' && proceeded.indexOf(items[k]) === -1) {
            var newPath = true;
            var partnerPoint = items[k].end;
            var partnerElement = partnerPoint.getPartnerElement();
            var path = [partnerElement];

            proceeded.push(partnerElement);

            while (newPath || proceeded.indexOf(partnerElement) === -1) {
               newPath = false;

               if (!partnerElement) break;
               proceeded.push(partnerElement);
               partnerPoint = partnerElement.getPartnerPoint(partnerPoint);
               partnerElement = partnerPoint.getPartnerElement(partnerElement);

               if (!partnerElement || proceeded.indexOf(partnerElement) !== -1) break;
               path.push(partnerElement);
            }

            paths.push(path);
         }
      }

      return paths;
   }

   function _setPathDirection (path, direction) {
      if (!path) return [];

      // sort items
      var newPath = [];
      var length = path.length;
      var pointPrev = path[0].getSharedPoint(path[length - 1]);

      if (!pointPrev) return [];

      path.forEach(function (element) {
         newPath.push(element.clone(element.start !== pointPrev));
         pointPrev = element.getPartnerPoint(pointPrev);
      });

      // get current direction (cw / ccw)
      var directionCurrent;
      var directionValue = 0;
      var points = newPath.map(function (element) { return element.start; });
      points.push(newPath[length - 1].end);

      for (var i = 0; i < points.length - 2; i++) {
         var this_ = points[i].coordinates;
         var next_ = points[i + 1].coordinates;

         directionValue += (next_.x - this_.x) * (next_.y - this_.y);
      }

      if (directionValue < 0) directionCurrent = 'ccw';
      if (directionValue > 0) directionCurrent = 'cw';
      if (directionValue === 0 && newPath.length === 1) directionCurrent = (newPath[0].clockwise ? 'cw' : 'ccw');

      // revert stack if required
      if (directionCurrent !== direction) {
         newPath.reverse();
         for (var j = 0; j < newPath.length; j++) {
            newPath[j] = newPath[j].clone(true);
         }
      }

      return newPath;
   }

   function _showGrid (groupId, node, translation, rotation, plane, name, options, scene) {
      var sizeAxis = options.sizeAxis || 100;
      var gridWidth = options.gridWidth || 1;

      var gridRatio = _getGridRatio(sizeAxis, gridWidth);
      var gridMesh = BABYLON.Mesh.CreateGround(name, 1.0, 0.0, 1, scene);

      gridMesh.position.z = gridProperties.offsetZ;
      gridMesh.translate(translation, 1, BABYLON.Space.LOCAL);
      gridMesh.parent = node;
      gridMesh.scaling.x = sizeAxis;
      gridMesh.scaling.z = sizeAxis;
      gridMesh.isPickable = options.pickable || false;
      gridMesh.plane = plane;

      if (plane === 'xy') gridMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2);
      if (plane === 'yz') gridMesh.rotate(new BABYLON.Vector3(0, 0, 1), Math.PI / 2);

      var gridMaterial = new BABYLON.GridMaterial(name + 'Material', scene);
      gridMaterial.majorUnitFrequency = options.majorUnitFrequency || 10;
      gridMaterial.minorUnitVisibility = options.minorUnitVisibility || 0.3;
      gridMaterial.gridRatio = gridRatio;
      gridMaterial.backFaceCulling = options.backFaceCulling || false;
      gridMaterial.mainColor = options.mainColor || new BABYLON.Color3(1, 1, 1);
      gridMaterial.lineColor = options.lineColor || new BABYLON.Color3(1.0, 1.0, 1.0);
      gridMaterial.opacity = options.opacity || 0.8;
      gridMaterial.zOffset = options.zOffset || 1.0;

      gridMesh.material = gridMaterial;

      return gridMesh;
   }

   function _start (settings) {
      if (settings.colorsPoint) pointColors = settings.colorsPoint;
      if (settings.colorsBasicElement) basicElementColors = settings.colorsBasicElement;
      if (settings.colorsDimension) dimensionColors = settings.colorsDimension;
      // if (settings.grid) grid = settings.grid;
   }

   function _updateBasicElement (basicElement, options) {
      if (options.status) {
         var color = basicElementColors[options.status];

         basicElement.edgesColor = color;
         basicElement.actionManager.actions[0].value = color;

      }
      if (options.scaling !== undefined) {
         basicElement.edgesWidth = basicElementProperties.lineWidth * options.scaling;
      }
   }

   function _updateConstraint (constraint, options) {
      console.log('update constraint');
      if (options.status) {
         // var color = ;
      }
   }

   function _updateDimension (dimension, options) {
      if (options.status) {
         // var colorAxis = dimensionColors[options.status + 'Axis'];
         // var colorText = dimensionColors[options.status + 'Text'];
      }
   }

   function _updateGrid (grid, options) {
      var sizeAxis = options.sizeAxis || 100;
      var gridWidth = options.gridWidth || 1;

      var gridRatio = _getGridRatio(sizeAxis, gridWidth);
      grid.material.gridRatio = gridRatio;
   }

   function _updatePoint (point, options) {
      if (options.status) {
         var color = pointColors[options.status];

         point.material.diffuseColor = color;
         point.material.emissiveColor = color;

         point.actionManager.actions[0].value = color;
         point.actionManager.actions[1].value = color;
      }

      if (options.scaling) {
         point.scaling.x = options.scaling;
         point.scaling.z = options.scaling;
      }
   }

   return Services;
}]);
