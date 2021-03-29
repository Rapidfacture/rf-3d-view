// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

app.factory('bGraphicSketchFactory', ['bGraphicGeneralFactory', function (bGraphicGeneralFactory) {
   var Services = {
      addConstraintToGrid: _addConstraintToGrid,
      addDimensionToGrid: _addDimensionToGrid,
      addDimensionRadiusToGrid: _addDimensionRadiusToGrid,
      addPlaneToGrid: _addPlaneToGrid,
      addPointToGrid: _addPointToGrid,
      addRadiusToGrid: _addRadiusToGrid,
      addStraightToGrid: _addStraightToGrid,
      addTextToGrid: _addTextToGrid,
      generatePaths: _generatePaths,
      getDimensionCoordinates: _getDimensionCoordinates,
      getDimensionRadiusCoordinates: _getDimensionRadiusCoordinates,
      getText: _getText,
      showGrid: _showGrid,
      setPathDirection: _setPathDirection,
      start: _start,
      updateBasicElement: _updateBasicElement,
      updateConstraint: _updateConstraint,
      updateDimension: _updateDimension,
      updateGrid: _updateGrid,
      updatePlane: _updatePlane,
      updatePoint: _updatePoint,
      updateText: _updateText
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
   var constraintColors = {
      default: new BABYLON.Color3.Gray(),
      mouseOver: new BABYLON.Color3.Red(),
      selected: new BABYLON.Color3.Red()
   };
   var dimensionProperties = {
      valRound: 1000
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
   var textColors = {
      defaultText: new BABYLON.Color3.Black(),
      mouseOverText: new BABYLON.Color3.Red()
   };

   /* ----------- internal functions --------- */
   function _getGridRatio (groundSize, gridSize) {
      return gridSize / groundSize;
   }

   function _getText (dimension) {
      dimension = dimension || {};
      dimension.tolerance = dimension.tolerance || {};

      var diameter = (dimension.diameter ? '⌀' : '');
      var dimValue = Math.round((dimension.value || 0) * dimensionProperties.valRound) / dimensionProperties.valRound;
      var tolValue = dimension.tolerance.value || '';
      var tolType = dimension.tolerance.type || '';

      return '' + diameter + dimValue + tolType + tolValue;
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

   function _uiDimension (grid, dimension, dimensionLinePoints, position, dimAngle, namePrefix, name, options, scene) {
      var dimensionLine, plane, point, dynamicTexture, dimensionNode;

      var axisColor = dimensionColors[options.status + 'Axis'];
      var scaleFactor = options.scaleFactor || 1;
      var textColorStandard = dimensionColors[options.status + 'Text'];
      var textColorMouseOver = dimensionColors.mouseOverText;
      var pointColorMouseOver = dimensionColors.mouseOverPoint;
      var pointColorStandard = dimensionColors[options.status + 'Point'];

      if (options.registerActions) {
         var text = bGraphicGeneralFactory.getTextPlaneProperties(_getText(dimension));

         var subMeshes = [];

         if (options.replacement) {
            subMeshes = options.replacement.getChildMeshes();
         }

         dimensionLine = BABYLON.Mesh.CreateLines(
            (subMeshes[0] ? subMeshes[0].name : namePrefix + 'arrow_' + name),
            dimensionLinePoints,
            scene,
            true
         );

         plane = BABYLON.MeshBuilder.CreateGround(
            (subMeshes[1] ? subMeshes[1].name : namePrefix + 'plane_' + name),
            {width: 1, height: 1, updateable: true},
            scene,
            true
         );

         plane.position.z = -0.01;
         plane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
         plane.renderingGroupId = 1;
         plane.scaling.x = text.width;
         plane.scaling.z = text.height;

         point = BABYLON.MeshBuilder.CreateGround(
            (subMeshes[2] ? subMeshes[2].name : namePrefix + 'point_' + name),
            {width: 0.2, height: 0.2, updateable: true},
            scene,
            true
         );

         dynamicTexture = new BABYLON.DynamicTexture(
            namePrefix + 'label_' + name,
            {width: text.dtWidth, height: text.dtHeight},
            scene
         );

         // Create dynamic texture and write the text
         dynamicTexture.hasAlpha = true;
         dynamicTexture.drawText(text.text, null, null, text.font, 'white', 'transparent', true);

         subMeshes.forEach(function (subMesh) {
            subMesh.dispose();
         });

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
         plane.material.diffuseColor = textColorStandard;
         plane.material.emissiveColor = textColorStandard;

         if (dynamicTexture) plane.material.diffuseTexture = dynamicTexture;
         plane.material.backFaceCulling = false;

         plane.position = new BABYLON.Vector3(0, 0.6, 0);

         var planeActions = [
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'diffuseColor', textColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'emissiveColor', textColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'diffuseColor', textColorMouseOver),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'emissiveColor', textColorMouseOver)
         ];

         var pointActions = [
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, point.material, 'diffuseColor', pointColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, point.material, 'emissiveColor', pointColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, point.material, 'diffuseColor', pointColorMouseOver),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, point.material, 'emissiveColor', pointColorMouseOver)
         ];

         if (grid) {
            planeActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
            planeActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));

            pointActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
            pointActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
         }

         plane.actionManager = new BABYLON.ActionManager(scene);
         planeActions.forEach(function (action) {
            plane.actionManager.registerAction(action);
         });

         point.actionManager = new BABYLON.ActionManager(scene);
         pointActions.forEach(function (action) {
            point.actionManager.registerAction(action);
         });

         if (options.replacement) {
            dimensionNode = options.replacement;

            dimensionNode.rotationQuaternion.x = 0;
            dimensionNode.rotationQuaternion.y = 0;
            dimensionNode.rotationQuaternion.z = 0;
            dimensionNode.rotationQuaternion.w = 1;

         } else {
            dimensionNode = new BABYLON.TransformNode(namePrefix + name, scene);
         }

         dimensionLine.parent = dimensionNode;
         plane.parent = dimensionNode;
         point.parent = dimensionNode;

         dimensionNode.position = position;
         dimensionNode.rotate(new BABYLON.Vector3(0, 0, 1), dimAngle);

         if (options.dragAndDrop) {
            dimensionNode.addBehavior(
               _getDragAndDropBehavior(
                  options.dragStartFunction,
                  options.dragFunction,
                  options.dragEndFunction
               )
            );
         }

         return dimensionNode;

      } else {
         var existingMeshes = options.replacement.getChildMeshes();

         BABYLON.Mesh.CreateLines(
            existingMeshes[0].name,
            dimensionLinePoints,
            scene,
            !options.replacement,
            existingMeshes[0]
         );

         BABYLON.MeshBuilder.CreateGround(
            existingMeshes[2].name,
            {width: 0.2, height: 0.2, updateable: true},
            scene,
            !options.replacement,
            existingMeshes[2]
         );

         options.replacement.rotationQuaternion.x = 0;
         options.replacement.rotationQuaternion.y = 0;
         options.replacement.rotationQuaternion.z = 0;
         options.replacement.rotationQuaternion.w = 1;
         options.replacement.position = position;
         options.replacement.rotate(new BABYLON.Vector3(0, 0, 1), dimAngle);

         return options.replacement;
      }
   }

   /* ----------- external functions --------- */
   function _addConstraintToGrid (grid, type, texture, position, name, options, scene) {
      var scaleFactor = options.scaleFactor || 1;
      var colorStandard = constraintColors[options.status];
      var colorMouseOver = constraintColors.mouseOver;

      var constraint = BABYLON.MeshBuilder.CreateGround(
         'Constraint_' + name,
         {width: 1, height: 1, updateable: true},
         scene
      );

      // Set point in front for accurate visibility and selection
      // min. 0.01 due to interaction radius of line
      constraint.position = position;
      constraint.position.z = pointProperties.offsetZ;
      constraint.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
      constraint.isPickable = options.isPickable;
      constraint.isVisible = (options.isVisible === undefined ? true : options.isVisible);
      constraint.renderingGroupId = 1;
      constraint.scaling.x = scaleFactor;
      constraint.scaling.z = scaleFactor;

      var material = new BABYLON.StandardMaterial('Constraint_' + type + '_' + name, scene);
      material.diffuseColor = colorStandard;
      material.emissiveColor = colorStandard;
      material.diffuseTexture = texture;

      constraint.material = material;

      constraint.actionManager = new BABYLON.ActionManager(scene);
      constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, constraint.material, 'diffuseColor', constraint.material.diffuseColor));
      constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, constraint.material, 'emissiveColor', constraint.material.emissiveColor));
      constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, constraint.material, 'diffuseColor', colorMouseOver));
      constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, constraint.material, 'emissiveColor', colorMouseOver));

      if (grid) {
         constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
         constraint.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
      }

      return constraint;
   }

   function _addDimensionRadiusToGrid (grid, dimension, center, end, position, style, name, options, scene) {
      var dimensionCoordinates = _getDimensionRadiusCoordinates(center, end, position, style, dimension);

      return _uiDimension(
         grid,
         dimension,
         dimensionCoordinates.coordinates,
         position,
         dimensionCoordinates.dimAngle,
         'Dimension_Radius_',
         name,
         options,
         scene
      );
   }

   function _addDimensionToGrid (grid, axis, dimension, start, end, position, name, options, scene) {
      var dimensionCoordinates = _getDimensionCoordinates(axis, start, end, position, dimension);

      return _uiDimension(
         grid,
         dimension,
         dimensionCoordinates.coordinates,
         position,
         dimensionCoordinates.dimAngle,
         'Dimension_',
         name,
         options,
         scene
      );
   }

   function _addPlaneToGrid (grid, mainShape, holes, name, options, scene) {
      var colorStandard = planeColors[options.status];

      var plane = BABYLON.MeshBuilder.CreatePolygon(
         'plane',
         {
            depth: 1,
            holes: holes,
            shape: mainShape,
            sideOrientation: 2
         },
         scene
      );

      plane.position.z = planeProperties.offsetZ;
      plane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
      plane.scaling.y = options.depth;

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
      item.metadata = {};
      item.position = position;
      item.position.z = pointProperties.offsetZ;
      item.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
      item.isPickable = options.isPickable;
      item.metadata.isPickableDefault = options.isPickable;
      item.isVisible = (options.isVisible === undefined ? true : options.isVisible);
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
         item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
         item.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
      }

      return item;
   }

   function _addRadiusToGrid (grid, start, end, center, clockwise, name, options, scene) {
      var coordinates = bGraphicGeneralFactory.getRadiusPoints(start, end, center, clockwise, {nodes: 72, addStart: true});
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
         radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
         radius.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
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
         line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
         line.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
      }

      return line;
   }

   function _addTextToGrid (grid, label, position, name, options, scene) {
      var plane, dynamicTexture, node;
      var textColorStandard = textColors[options.status + 'Text'];
      var textColorMouseOver = textColors.mouseOverText;

      if (options.registerActions) {
         var text = bGraphicGeneralFactory.getTextPlaneProperties(label);
         // console.log(text);

         var subMeshes = [];

         if (options.replacement) subMeshes = options.replacement.getChildMeshes();

         plane = BABYLON.MeshBuilder.CreateGround(
            (subMeshes[1] ? subMeshes[1].name : 'Text_plane_' + name),
            {width: 1, height: 1, updateable: true},
            scene,
            true
         );

         plane.position.z = -0.01;
         plane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
         plane.renderingGroupId = 1;
         plane.scaling.x = text.width;
         plane.scaling.z = text.height;

         dynamicTexture = new BABYLON.DynamicTexture(
            'Text_label_' + name,
            {width: text.dtWidth, height: text.dtHeight},
            scene
         );

         // Create dynamic texture and write the text
         dynamicTexture.hasAlpha = true;
         dynamicTexture.drawText(text.text, null, null, text.font, 'white', 'transparent', true);

         subMeshes.forEach(function (subMesh) {
            subMesh.dispose();
         });

         // Create plane and set dynamic texture as material
         plane.material = new BABYLON.StandardMaterial('mat', scene);
         plane.material.diffuseColor = textColorStandard;
         plane.material.emissiveColor = textColorStandard;
         plane.material.diffuseTexture = dynamicTexture;

         plane.material.backFaceCulling = false;

         var planeActions = [
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'diffuseColor', textColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, plane.material, 'emissiveColor', textColorStandard),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'diffuseColor', textColorMouseOver),
            new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, plane.material, 'emissiveColor', textColorMouseOver)
         ];

         if (grid) {
            planeActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, grid, 'isPickable', true));
            planeActions.push(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, grid, 'isPickable', false));
         }

         plane.actionManager = new BABYLON.ActionManager(scene);
         planeActions.forEach(function (action) {
            plane.actionManager.registerAction(action);
         });

         if (options.replacement) {
            node = options.replacement;

         } else {
            node = new BABYLON.TransformNode('Text_' + name, scene);
         }

         plane.parent = node;

         node.position = position;

         if (options.dragAndDrop) {
            node.addBehavior(
               _getDragAndDropBehavior(
                  options.dragStartFunction,
                  options.dragFunction,
                  options.dragEndFunction
               )
            );
         }

         return node;

      } else {
         var existingMeshes = options.replacement.getChildMeshes();

         BABYLON.MeshBuilder.CreateGround(
            existingMeshes[2].name,
            {width: 0.2, height: 0.2, updateable: true},
            scene,
            !options.replacement,
            existingMeshes[2]
         );

         options.replacement.position = position;

         return options.replacement;
      }
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

   function _getDimensionCoordinates (axis, start, end, position, dimension) {
      function dLength (angle, x, y) {
         return (y * Math.sin(angle) + x * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      function eLength (angle, x, y) {
         return (x * Math.sin(angle) - y * Math.cos(angle)) / (Math.pow(Math.sin(angle), 2) + Math.pow(Math.cos(angle), 2));
      }

      var dStart, dEnd, eEnd, eStart, vStart, vEnd, dimAngle;

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

      var coordinates = [
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
      ];

      return {
         coordinates: coordinates,
         dimAngle: dimAngle,
         dimension: dimension,
         position: position
      };
   }

   function _getDimensionRadiusCoordinates (center, end, position, style, dimension) {
      var dimensionLinePoints;
      var dimDirection = position.subtract(center).normalizeToNew();
      var dimAngle = Math.atan2(dimDirection.y, dimDirection.x);

      var radius = end.subtract(center).length();
      var radiusPosition = center.subtract(position).length();

      if (style === 'radius') {
         dimensionLinePoints = [
            new BABYLON.Vector3(-radiusPosition, 0, 0),
            new BABYLON.Vector3(-radiusPosition, 0, 0),
            new BABYLON.Vector3(-radiusPosition, 0, 0),
            new BABYLON.Vector3(-radiusPosition, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition - 0.2, 0.1, 0),
            new BABYLON.Vector3(radius - radiusPosition, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition - 0.2, -0.1, 0)
         ];

         dimension.diameter = false;

      } else if (style === 'diameter') {
         dimensionLinePoints = [
            new BABYLON.Vector3(-radiusPosition - radius + 0.2, 0.1, 0),
            new BABYLON.Vector3(-radiusPosition - radius, 0, 0),
            new BABYLON.Vector3(-radiusPosition - radius + 0.2, -0.1, 0),
            new BABYLON.Vector3(-radiusPosition - radius, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition - 0.2, 0.1, 0),
            new BABYLON.Vector3(radius - radiusPosition, 0, 0),
            new BABYLON.Vector3(radius - radiusPosition - 0.2, -0.1, 0)
         ];

         dimension.diameter = true;
      }

      return {
         coordinates: dimensionLinePoints,
         diameter: dimension.diameter,
         dimAngle: dimAngle,
         dimension: dimension,
         position: position
      };
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
      if (settings.colorsBasicElement) basicElementColors = settings.colorsBasicElement;
      if (settings.colorsConstraint) constraintColors = settings.colorsConstraint;
      if (settings.colorsDimension) dimensionColors = settings.colorsDimension;
      if (settings.colorsPoint) pointColors = settings.colorsPoint;
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
      if (options.status) {
         var color = constraintColors[options.status];

         constraint.material.diffuseColor = color;
         constraint.material.emissiveColor = color;

         if (constraint.actionManager) {
            constraint.actionManager.actions[0].value = color;
            constraint.actionManager.actions[1].value = color;
         }
      }

      if (options.scaling) {
         constraint.scaling.x = options.scaling;
         constraint.scaling.z = options.scaling;
      }
   }

   function _updateDimension (dimension, options) {
      if (!dimension) return;

      var elements = dimension.getChildren();

      if (options.status) {
         var colorAxis = dimensionColors[options.status + 'Axis'];
         var colorText = dimensionColors[options.status + 'Text'];
         var colorPoint = dimensionColors[options.status + 'Point'];

         elements[0].color = colorAxis;

         elements[1].material.diffuseColor = colorText;
         elements[1].material.emissiveColor = colorText;

         if (elements[1].actionManager) {
            elements[1].actionManager.actions[0].value = colorText;
            elements[1].actionManager.actions[1].value = colorText;
         }

         elements[2].material.diffuseColor = colorPoint;
         elements[2].material.emissiveColor = colorPoint;

         if (elements[2].actionManager) {
            elements[2].actionManager.actions[0].value = colorText;
            elements[2].actionManager.actions[1].value = colorText;
         }
      }

      if (options.textIsPickable !== undefined) {
         elements[1].isPickable = options.textIsPickable;
      }

      if (options.label) {
         var text = bGraphicGeneralFactory.getTextPlaneProperties(_getText(options.label));

         var texture = new BABYLON.DynamicTexture(
            elements[1].material.diffuseTexture.name,
            {width: text.dtWidth, height: text.dtHeight},
            dimension.scene
         );

         elements[1].scaling.x = text.width;
         elements[1].scaling.z = text.height;

         // Create dynamic texture and write the text
         texture.hasAlpha = true;
         texture.drawText(text.text, null, null, text.font, 'white', 'transparent', true);

         elements[1].material.diffuseTexture = texture;
      }
   }

   function _updateGrid (grid, options) {
      var sizeAxis = options.sizeAxis || 100;
      var gridWidth = options.gridWidth || 1;

      grid.grid.material.gridRatio = _getGridRatio(sizeAxis, gridWidth);
   }

   function _updatePlane (plane, options) {
      if (options.depth) {
         plane.scaling.y = options.depth;
      }
   }

   function _updatePoint (point, options) {
      if (options.status) {
         var color = pointColors[options.status];

         point.material.diffuseColor = color;
         point.material.emissiveColor = color;

         if (point.actionManager) {
            point.actionManager.actions[0].value = color;
            point.actionManager.actions[1].value = color;
         }
      }

      if (options.scaling) {
         point.scaling.x = options.scaling;
         point.scaling.z = options.scaling;
      }

      if (typeof options.dragAndDrop === 'boolean') {
         if (point.behaviors.length === 1) point.behaviors[0].enabled = options.dragAndDrop;
      }
   }

   function _updateText (text, options) {
      if (!text) return;

      var elements = text.getChildren();

      if (options.status) {
         var colorText = dimensionColors[options.status + 'Text'];

         elements[0].material.diffuseColor = colorText;
         elements[0].material.emissiveColor = colorText;

         if (elements[0].actionManager) {
            elements[0].actionManager.actions[0].value = colorText;
            elements[0].actionManager.actions[1].value = colorText;
         }
      }

      if (options.textIsPickable !== undefined) {
         elements[1].isPickable = options.textIsPickable;
      }

      if (options.label) {
         var label = bGraphicGeneralFactory.getTextPlaneProperties(options.label);

         var texture = new BABYLON.DynamicTexture(
            elements[0].material.diffuseTexture.name,
            {width: label.dtWidth, height: label.dtHeight},
            text.scene
         );

         elements[0].scaling.x = label.width;
         elements[0].scaling.z = label.height;

         // Create dynamic texture and write the text
         texture.hasAlpha = true;
         texture.drawText(label.text, null, null, label.font, 'white', 'transparent', true);

         elements[0].material.diffuseTexture = texture;
      }
   }

   return Services;
}]);
