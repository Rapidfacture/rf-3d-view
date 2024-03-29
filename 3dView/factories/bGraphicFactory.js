// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

app.factory('bGraphicFactory', ['bGraphicGeneralFactory', function (bGraphicGeneralFactory) {
   var TOLERANCE = 1e-12;
   var staticMeshNames = ['draw'];
   var types = {};

   var Services = {
      data: {},
      itemNodes: [],
      groups: {},
      meshes: {},
      planes: {},
      selectMode: false,

      defaultOnPointerDown: _onPointerDown,
      paintView: _paintView,
      sliceView: _sliceView,
      showAxis: _showAxis,
      showPlane: _showPlane,
      setNodeTransformation: _setNodeTransformation,
      getMeshesByType: _getMeshesByType,
      getSelectedMeshes: _getSelectedMeshes,
      start: function (scene) {
         types = {
            chuck: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourFinish', scene);
                  mat.diffuseColor = BABYLON.Color3.FromHexString('#bbbbbb');
                  mat.backFaceCulling = true;
                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            chuckJaws: {
               diffuseColor: BABYLON.Color3.FromHexString('#bbbbbb')
            },
            contourFinish: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourFinish', scene);
                  mat.diffuseColor = BABYLON.Color3.Gray();
                  mat.backFaceCulling = true;
                  // mat.wireframe = true;

                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            contourProcessing: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourProcessing', scene);
                  mat.diffuseColor = BABYLON.Color3.Green();
                  mat.alpha = 0.2;
                  mat.backFaceCulling = true;

                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 5
            },
            contourRaw: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourRaw', scene);
                  mat.diffuseColor = BABYLON.Color3.Blue();
                  mat.alpha = 0.2;
                  mat.backFaceCulling = true;
                  // mat.wireframe = true;

                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            knurling: {
               diffuseColor: BABYLON.Color3.Green(),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
            },
            plane: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('plane', scene);
                  mat.diffuseColor = BABYLON.Color3.Yellow();

                  return mat;
               }()),
               materialMouseOver: (function () {
                  var mat = new BABYLON.StandardMaterial('planeMouseOver', scene);
                  mat.diffuseColor = BABYLON.Color3.Red();

                  return mat;
               }())
            },
            planeSelected: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('plane', scene);
                  mat.diffuseColor = BABYLON.Color3(1, 0, 0);

                  return mat;
               }())
            },
            revolvingCenter: {
               diffuseColor: BABYLON.Color3.Gray()
            },
            selected: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('selected', scene);
                  mat.diffuseColor = BABYLON.Color3.Red();
                  mat.color = BABYLON.Color3.Red();
                  mat.alpha = 1;
                  mat.backFaceCulling = true;

                  return mat;
               }()),
               lineColor: BABYLON.Color4(0, 1, 0, 1)
            },
            threading: {
               diffuseColor: BABYLON.Color3.Red(),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
            },
            tailStock: {
               color: BABYLON.Color3.Gray(),
               diffuseColor: BABYLON.Color3.Gray()
            },
            tool: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourFinish', scene);
                  mat.diffuseColor = BABYLON.Color3.FromHexString('#f47721');
                  mat.backFaceCulling = true;
                  // mat.wireframe = true;

                  return mat;

               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            toolUndefined: {
               diffuseColor: BABYLON.Color3.Red()
            },
            tooling: {
               hideEdge: true,
               lineColor: new BABYLON.Color4(1, 1, 1, 1),
               toolingFast: {
                  lineColor: new BABYLON.Color4(1, 0, 0, 1)
               }
            }
         };

      },
      transformationMatrixToAxisAngle: _transformationMatrixToAxisAngle
   };


   /* ----------- internal functions --------- */
   function _transformationMatrixToAxisAngle (matrix) {
      // https://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToAngle/index.htm

      var m = matrix;
      var angle, x, y, z;
      var epsilon = 0.01; // margin to allow for rounding errors
      var epsilon2 = 0.1; // margin to distinguish between 0 and 180 degrees

      var middle = Math.sin(Math.PI / 4);

      if ((Math.abs(m[0][1] - m[1][0]) < epsilon) &&
         (Math.abs(m[0][2] - m[2][0]) < epsilon) &&
         (Math.abs(m[1][2] - m[2][1]) < epsilon)) {
         // singularity found
         // first check for identity matrix which must have +1 for all terms
         //  in leading diagonaland zero in other terms
         if ((Math.abs(m[0][1] + m[1][0]) < epsilon2) &&
           (Math.abs(m[0][2] + m[2][0]) < epsilon2) &&
           (Math.abs(m[1][2] + m[2][1]) < epsilon2) &&
           (Math.abs(m[0][0] + m[1][1] + m[2][2] - 3) < epsilon2)) {
            // this singularity is identity matrix so angle = 0
            return {vector: new BABYLON.Vector3(1, 0, 0), angle: 0}; // zero angle, arbitrary axis
         }
         // otherwise this singularity is angle = 180
         angle = Math.PI;
         var xx = (m[0][0] + 1) / 2;
         var yy = (m[1][1] + 1) / 2;
         var zz = (m[2][2] + 1) / 2;
         var xy = (m[0][1] + m[1][0]) / 4;
         var xz = (m[0][2] + m[2][0]) / 4;
         var yz = (m[1][2] + m[2][1]) / 4;
         if ((xx > yy) && (xx > zz)) { // m[0][0] is the largest diagonal term
            if (xx < epsilon) {
               x = 0;
               y = middle;
               z = middle;
            } else {
               x = Math.sqrt(xx);
               y = xy / x;
               z = xz / x;
            }
         } else if (yy > zz) { // m[1][1] is the largest diagonal term
            if (yy < epsilon) {
               x = middle;
               y = 0;
               z = middle;
            } else {
               y = Math.sqrt(yy);
               x = xy / y;
               z = yz / y;
            }
         } else { // m[2][2] is the largest diagonal term so base result on this
            if (zz < epsilon) {
               x = middle;
               y = middle;
               z = 0;
            } else {
               z = Math.sqrt(zz);
               x = xz / z;
               y = yz / z;
            }
         }

         return {vector: new BABYLON.Vector3(x, y, z), angle: angle}; // return 180 deg rotation
      }
      // as we have reached here there are no singularities so we can handle normally
      var s = Math.sqrt((m[2][1] - m[1][2]) * (m[2][1] - m[1][2]) +
         (m[0][2] - m[2][0]) * (m[0][2] - m[2][0]) +
         (m[1][0] - m[0][1]) * (m[1][0] - m[0][1])); // used to normalise
      if (Math.abs(s) < 0.001) s = 1;

      // prevent divide by zero, should not happen if matrix is orthogonal and should be
      // caught by singularity test above, but I've left it in just in case
      angle = Math.acos((m[0][0] + m[1][1] + m[2][2] - 1) / 2);
      x = (m[2][1] - m[1][2]) / s;
      y = (m[0][2] - m[2][0]) / s;
      z = (m[1][0] - m[0][1]) / s;

      return {vector: new BABYLON.Vector3(x, y, z), angle: angle};
   }

   /* ----------- external functions --------- */
   function _getMeshesByType (type) {
      var meshes = Services.meshes;
      var result = [];

      for (var k in Services.meshes) {
         if (meshes[k].material && meshes[k].material.name === type) result.push(meshes[k]);
      }

      return result;
   }

   function _onPointerDown (event, result) {
      if (!Services.selectMode || !result.pickedMesh) return;

      var mesh = result.pickedMesh;
      mesh.selected = !mesh.selected;
      mesh.material = (mesh.selected ? types.selected.material : types[mesh.type].material);

      if (!mesh.selected) return;

      if (event.ctrlKey) {
         Services.data.selected[mesh.partType] = Services.data.selected[mesh.partType] || [];
         Services.data.selected[mesh.partType].push(mesh.sketchName);

      } else {
         Services.data.selected[mesh.partType] = [mesh.sketchName];
      }
   }

   function _paintView (engine, scene, data) {
      if (!data || !data.items) return;

      data.items = JSON.parse(JSON.stringify(data.items));
      data.selected = data.selected || {};
      data.selectable = data.selectable || {};

      Services.selectMode = false;
      Services.data = data;
      Services.itemNodes.length = 0;
      Services.meshes = {};
      Services.planes = {};
      Services.groups = {};

      scene.onPointerDown = _onPointerDown;

      // remove old meshes
      for (var k = scene.meshes.length - 1; k >= 0; k--) {
         if (staticMeshNames.indexOf(scene.meshes[k].name) === -1 && scene.meshes[k].deleteOnRedraw !== false) {
            scene.meshes[k].dispose();
         }
      }

      scene.setRenderingAutoClearDepthStencil(0, false);
      scene.setRenderingAutoClearDepthStencil(1, false);
      scene.setRenderingAutoClearDepthStencil(2, false);

      scene.onBeforeRenderObservable.add(function () {
         // clear depth
         engine.clear(undefined, false, true, false);
      });

      // append new group where everything is added
      var dataItems = data.items || [];
      var dataGroups = data.groups || [{id: 0}];
      var dataPlanes = data.planes || [];

      dataGroups.forEach(function (group) {
         group.offset = group.offset || [0, 0, 0];
         group.transformation = group.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

         var groupNode = new BABYLON.TransformNode(group.id, scene);

         // Check det=-1 of transformation matrix for mirroring
         var mergedArray = [];
         mergedArray = mergedArray.concat(group.transformation[0]);
         mergedArray.push(0);
         mergedArray = mergedArray.concat(group.transformation[1]);
         mergedArray.push(0);
         mergedArray = mergedArray.concat(group.transformation[2]);
         mergedArray.push(0, 0, 0, 0, 1);

         var bMatrix = new BABYLON.Matrix.FromArray(mergedArray);
         if (Math.abs(bMatrix.determinant() + 1) < TOLERANCE) {
            groupNode.scaling = new BABYLON.Vector3.FromArray([1, 1, -1]);
            group.transformation[2][2] = -group.transformation[2][2];
         }

         var offset = new BABYLON.Vector3.FromArray(group.offset);
         groupNode.translate(offset, 1);

         var transformation = _transformationMatrixToAxisAngle(group.transformation);
         groupNode.rotate(transformation.vector, transformation.angle);

         _showAxis(group.id, groupNode, BABYLON.Vector3.Zero(), transformation, 'machine', {size: 20}, scene);

         for (var k in group.origin) {
            var item = group.origin[k];

            var originOffset = new BABYLON.Vector3.FromArray(item.offset);
            var originTransformation = _transformationMatrixToAxisAngle(item.transformation);

            _showAxis(group.id, groupNode, originOffset, originTransformation, k, {size: 20, label: item.label}, scene);
         }

         Services.groups['G' + group.id] = {node: groupNode, meshes: {}};
      });

      dataItems.forEach(function (item, $index) {
         item.group = item.group || 0;
         item.offset = item.offset || [0, 0, 0];
         item.transformation = item.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

         var itemTransformation = _transformationMatrixToAxisAngle(item.transformation);
         var itemOffset = new BABYLON.Vector3.FromArray(item.offset);

         var itemSelected = data.selected[item.partType] || [];
         var itemSelectable = data.selectable[item.partType] || [];

         var itemNode = new BABYLON.TransformNode('Item_' + $index, scene);
         itemNode.parent = Services.groups['G' + item.group].node;
         itemNode.translate(itemOffset, 1);
         itemNode.rotate(itemTransformation.vector, itemTransformation.angle);
         itemNode.partType = item.partType;

         Services.itemNodes.push(itemNode);

         item.primitives.forEach(function (primitive, i) {
            primitive.offset = primitive.offset || [0, 0, 0];
            primitive.transformation = primitive.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

            var primitiveTransformation = _transformationMatrixToAxisAngle(primitive.transformation);
            var primitiveOffset = new BABYLON.Vector3.FromArray(primitive.offset);
            var materialType = types[item.type];
            var mesh;

            var selected = itemSelected.indexOf(primitive.name) !== -1;

            if (primitive.shape === 'freeForm') {
               var normals = [];
               BABYLON.VertexData.ComputeNormals(
                  primitive.positions,
                  primitive.indices,
                  normals
               );

               var vertexData = new BABYLON.VertexData();
               vertexData.positions = primitive.positions;
               vertexData.indices = primitive.indices;
               vertexData.normals = normals;
               vertexData.uvs = [];

               mesh = new BABYLON.Mesh('FreeForm_' + $index + '_' + i, scene);
               vertexData.applyToMesh(mesh, true);

               mesh.material = (selected ? types.selected.material : types[item.type].material);
               mesh.isPickable = itemSelectable === 'freeForm' || itemSelectable.indexOf(primitive.name) !== -1;
               mesh.sketchName = primitive.name;
               mesh.type = item.type;
               mesh.partType = item.partType;

               mesh.parent = itemNode;
               mesh.renderingGroupId = 0;

               mesh.rotate(primitiveTransformation.vector, primitiveTransformation.angle, BABYLON.Space.WORLD);
               mesh.translate(primitiveOffset, 1, BABYLON.Space.WORLD);

               Services.groups['G' + item.group].meshes[mesh.name] = mesh;
               Services.meshes[primitive.name] = mesh;

            } else if (primitive.shape === 'freeFormOutline') {
               if (!primitive.positions.length) return;

               primitive.lines.forEach(function (line, $primitiveIndex) {
                  if (!line.indices.length) return;

                  var points = [];
                  var colors = [];

                  line.indices.forEach(function (index) {
                     var color = materialType.lineColor;

                     if (isNaN(index)) {
                        color = materialType[index.type].lineColor;
                        index = index.index;
                     }

                     points.push(new BABYLON.Vector3(
                        primitive.positions[3 * index],
                        primitive.positions[3 * index + 1],
                        primitive.positions[3 * index + 2]
                     ));

                     colors.push(color);
                  });

                  mesh = BABYLON.MeshBuilder.CreateLines(
                     'FreeFormOutline_' + $index + '_' + i + '_' + $primitiveIndex,
                     {
                        points: points,
                        colors: colors,
                        useVertexAlpha: false
                     },
                     scene
                  );

                  if (!materialType.hideEdge) {
                     var tmpType = (line.type ? materialType[line.type] : materialType);
                     mesh.enableEdgesRendering();
                     mesh.edgesWidth = tmpType.lineWidth;
                     mesh.edgesColor = tmpType.lineColor;
                  }

                  mesh.parent = itemNode;
                  mesh.renderingGroupId = 0;

                  mesh.rotate(primitiveTransformation.vector, primitiveTransformation.angle, BABYLON.Space.WORLD);
                  mesh.translate(primitiveOffset, 1, BABYLON.Space.WORLD);

                  Services.groups['G' + item.group].meshes[mesh.name] = mesh;
                  Services.meshes[primitive.name] = mesh;
               });
            }
         });
      });

      dataPlanes.forEach(function (plane) {
         var itemTransformation = _transformationMatrixToAxisAngle(plane.transformation);
         var itemOffset = new BABYLON.Vector3.FromArray(plane.offset);

         _showPlane(plane.groupId, null, itemOffset, itemTransformation, plane.name, {}, scene);
      });

      return Services.groups;
   }

   function _sliceView (engine, scene, groups, clipPlane) {
      var keys = ['contourRaw', 'contourFinish'];

      keys.forEach(function (key) {
         var meshes = Services.getMeshesByType(key);
         var materialType = types[key];

         if (!materialType) return;

         var meshInsideMaterial = new BABYLON.CustomMaterial(key + '_inside', scene);
         meshInsideMaterial.diffuseColor = materialType.material.diffuseColor;
         meshInsideMaterial.backFaceCulling = false;
         meshInsideMaterial.color = materialType.material.diffuseColor;
         meshInsideMaterial.alpha = materialType.material.alpha || 1;
         meshInsideMaterial.Fragment_Before_FragColor('if(gl_FrontFacing) discard;');

         var stencilMask = engine.getStencilMask();
         var stencilFunction = engine.getStencilFunction();

         meshes.forEach(function (mesh) {
            var meshInside = mesh.clone(mesh.id + 'Inner');
            meshInside.material = meshInsideMaterial;
            meshInside.renderingGroupId = 1;
            meshInside.isPickable = false;

            // mesh observables
            mesh.onBeforeRenderObservable.add(function () {
               scene.clipPlane = clipPlane;
            });
            mesh.onAfterRenderObservable.add(function () {
               scene.clipPlane = null;
            });

            // mesh inside observables
            meshInside.onBeforeRenderObservable.add(function () {
               scene.clipPlane = clipPlane;
               engine.setStencilBuffer(true);
            });
            meshInside.onAfterRenderObservable.add(function () {
               scene.clipPlane = null;
               engine.setStencilBuffer(false);
            });

            var stencilPlaneMaterial = mesh.material.clone('stencilPlaneMaterial');
            stencilPlaneMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            stencilPlaneMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
            stencilPlaneMaterial.ambientColor = new BABYLON.Color3(0, 0, 0);
            // var boundingBox = mesh.getBoundingInfo().boundingBox;
            // var dx = boundingBox.maximumWorld.x - boundingBox.minimumWorld.x;
            // var dy = boundingBox.maximumWorld.y - boundingBox.minimumWorld.y;

            var stencilPlane = BABYLON.MeshBuilder.CreatePlane('stencilPlane', {width: 400, height: 600}, scene);
            stencilPlane.parent = mesh.parent;
            stencilPlane.material = stencilPlaneMaterial;
            stencilPlane.rotate(BABYLON.Axis.Y, Math.PI, BABYLON.Space.LOCAL);
            // stencilPlane.position.set(0, 0, 0);

            // stencilPlane.rotationQuaternion = new BABYLON.Quaternion(0, -1, 0, 0);
            stencilPlane.isPickable = false;
            stencilPlane.renderingGroupId = (key === 'contourRaw' ? 2 : 1);
            stencilPlane.onBeforeRenderObservable.add(function () {
               engine.setStencilBuffer(true);
               engine.setStencilMask(0x00);
               engine.setStencilFunction(BABYLON.Engine.EQUAL);
            });

            stencilPlane.onAfterRenderObservable.add(function () {
               engine.setStencilBuffer(false);
               engine.setStencilMask(stencilMask);
               engine.setStencilFunction(stencilFunction);
            });
         });
      });
   }

   function _getSelectedMeshes () {
      var result = {};

      for (var k in Services.data.selected) {
         result[k] = [];
         Services.data.items.forEach(function (item) {
            if (item.partType !== k) return;

            item.primitives.forEach(function (primitive) {
               if (Services.data.selected[k].indexOf(primitive.name) !== -1) {
                  result[k].push(primitive);
               }
            });
         });
      }

      return result;
   }

   function _showAxis (groupId, node, translation, rotation, name, options, scene) {
      options = options || {};

      // rotation not jet in use
      var makeTextPlane = function (label, color) {
         var text = bGraphicGeneralFactory.getTextPlaneProperties(label);

         var plane = BABYLON.MeshBuilder.CreateGround(
            'TextPlane',
            {width: 1, height: 1, updateable: true},
            scene,
            true
         );
         plane.scaling.x = text.width;
         plane.scaling.z = text.height;
         plane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);

         var dynamicTexture = new BABYLON.DynamicTexture(
            'DynamicTexture',
            {width: text.dtWidth, height: text.dtHeight},
            scene
         );
         dynamicTexture.hasAlpha = true;
         dynamicTexture.drawText(text.text, null, null, text.font, 'white', 'transparent', true);

         plane.material = new BABYLON.StandardMaterial('TextPlaneMaterial', scene);
         plane.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
         plane.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
         plane.material.diffuseTexture = dynamicTexture;
         plane.material.backFaceCulling = false;

         return plane;
      };

      var CoT = new BABYLON.TransformNode(groupId + '_' + name, scene);
      CoT.parent = node;
      CoT.translate(translation, 1);
      CoT.deleteOnRedraw = options.deleteOnRedraw;

      if (rotation) CoT.rotate(rotation.vector, rotation.angle);

      var isPickable = (options.isPickable === undefined ? true : options.isPickable);
      var size = options.size || 5;
      var axis = options.axis || 'xyz';
      var planes = options.planes || [];
      var result = {};

      if (axis.includes('x')) {
         var axisX = BABYLON.Mesh.CreateLines(
            groupId + '_' + name + '_axisX',
            [
               new BABYLON.Vector3.Zero(),
               new BABYLON.Vector3(size, 0, 0),
               new BABYLON.Vector3(size * 0.95, 0.05 * size, 0),
               new BABYLON.Vector3(size, 0, 0),
               new BABYLON.Vector3(size * 0.95, -0.05 * size, 0)
            ],
            scene
         );
         axisX.color = new BABYLON.Color3(1, 0, 0);
         axisX.isPickable = isPickable;
         axisX.renderingGroupId = 3;
         axisX.parent = CoT;
         axisX.deleteOnRedraw = options.deleteOnRedraw;

         var xChar = makeTextPlane('X', 'red');
         xChar.isPickable = false;
         xChar.position = new BABYLON.Vector3(0.9 * size, -0.05 * size, 0);
         xChar.renderingGroupId = 3;
         xChar.parent = CoT;
         xChar.deleteOnRedraw = options.deleteOnRedraw;

         result.xAxis = axisX;
         result.xChar = xChar;
      }

      if (axis.includes('y')) {
         var axisY = BABYLON.Mesh.CreateLines(
            groupId + '_' + name + '_axisY',
            [
               new BABYLON.Vector3.Zero(),
               new BABYLON.Vector3(0, size, 0),
               new BABYLON.Vector3(-0.05 * size, size * 0.95, 0),
               new BABYLON.Vector3(0, size, 0),
               new BABYLON.Vector3(0.05 * size, size * 0.95, 0)
            ],
            scene
         );
         axisY.color = new BABYLON.Color3(0, 1, 0);
         axisY.isPickable = isPickable;
         axisY.renderingGroupId = 3;
         axisY.parent = CoT;
         axisY.deleteOnRedraw = options.deleteOnRedraw;

         var yChar = makeTextPlane('Y', 'green');
         yChar.isPickable = false;
         yChar.position = new BABYLON.Vector3(0, 0.9 * size, -0.05 * size);
         yChar.renderingGroupId = 3;
         yChar.parent = CoT;
         yChar.deleteOnRedraw = options.deleteOnRedraw;

         result.yAxis = axisY;
         result.yChar = yChar;
      }

      if (axis.includes('z')) {
         var axisZ = BABYLON.Mesh.CreateLines(
            groupId + '_' + name + '_axisZ',
            [
               new BABYLON.Vector3.Zero(),
               new BABYLON.Vector3(0, 0, size),
               new BABYLON.Vector3(0, -0.05 * size, size * 0.95),
               new BABYLON.Vector3(0, 0, size),
               new BABYLON.Vector3(0, 0.05 * size, size * 0.95)
            ],
            scene
         );
         axisZ.color = new BABYLON.Color3(0, 0, 1);
         axisZ.isPickable = isPickable;
         axisZ.renderingGroupId = 3;
         axisZ.parent = CoT;
         axisZ.deleteOnRedraw = options.deleteOnRedraw;

         var zChar = makeTextPlane('Z', 'blue');
         zChar.isPickable = false;
         zChar.position = new BABYLON.Vector3(0, 0.05 * size, 0.9 * size);
         zChar.renderingGroupId = 3;
         zChar.parent = CoT;
         zChar.deleteOnRedraw = options.deleteOnRedraw;

         result.zAxis = axisZ;
         result.zChar = zChar;
      }

      if (planes.includes('xy')) {
         var planeXY = BABYLON.MeshBuilder.CreatePlane(
            'XY',
            { width: size * 0.8, height: size * 0.8 },
            scene
         );
         planeXY.position = new BABYLON.Vector3(size / 2, size / 2, 0);
         planeXY.material = types.plane.material;
         planeXY.actionManager = new BABYLON.ActionManager(scene);
         planeXY.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, planeXY, 'material', planeXY.material));
         planeXY.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, planeXY, 'material', types.plane.materialMouseOver));

         result.planeXY = planeXY;
      }

      if (planes.includes('xz')) {
         var planeXZ = BABYLON.MeshBuilder.CreatePlane(
            'XZ',
            { width: size * 0.8, height: size * 0.8 },
            scene
         );
         planeXZ.position = new BABYLON.Vector3(size / 2, 0, size / 2);
         planeXZ.rotation = new BABYLON.Vector3(-Math.PI / 2, 0, 0);
         planeXZ.material = types.plane.material;
         planeXZ.actionManager = new BABYLON.ActionManager(scene);
         planeXZ.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, planeXZ, 'material', planeXZ.material));
         planeXZ.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, planeXZ, 'material', types.plane.materialMouseOver));

         result.planeXZ = planeXZ;
      }

      if (planes.includes('yz')) {
         var planeYZ = BABYLON.MeshBuilder.CreatePlane(
            'YZ',
            { width: size * 0.8, height: size * 0.8 },
            scene
         );
         planeYZ.position = new BABYLON.Vector3(0, size / 2, size / 2);
         planeYZ.rotation = new BABYLON.Vector3(0, Math.PI / 2, 0);
         planeYZ.material = types.plane.material;
         planeYZ.actionManager = new BABYLON.ActionManager(scene);
         planeYZ.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOutTrigger, planeYZ, 'material', planeYZ.material));
         planeYZ.actionManager.registerAction(new BABYLON.SetValueAction(BABYLON.ActionManager.OnPointerOverTrigger, planeYZ, 'material', types.plane.materialMouseOver));

         result.planeYZ = planeYZ;
      }

      if (options.label) {
         var label = makeTextPlane(options.label, 'black');
         label.isPickable = false;
         label.renderingGroupId = 3;
         label.parent = CoT;
         label.deleteOnRedraw = options.deleteOnRedraw;

         result.label = label;
      }

      return result;
   }

   function _showPlane (groupId, node, translation, rotation, name, options, scene) {
      var CoT = new BABYLON.TransformNode(groupId + '_' + name, scene);
      CoT.parent = node;
      CoT.translate(translation, 1);
      CoT.deleteOnRedraw = options.deleteOnRedraw;

      if (rotation) CoT.rotate(rotation.vector, rotation.angle);

      var size = 10;
      var planeXY = BABYLON.MeshBuilder.CreatePlane(
         'XY',
         { width: size, height: size, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
         scene
      );
      planeXY.position = new BABYLON.Vector3(size / 2, size / 2, 0);
      planeXY.material = types.plane.material;
      planeXY.parent = CoT;

      Services.planes[name] = planeXY;

      return planeXY;
   }

   function _setNodeTransformation (node, offset, transformation) {
      node.position = new BABYLON.Vector3.FromArray(offset);
      node.rotation = new BABYLON.Vector3.Zero();

      var rotation = _transformationMatrixToAxisAngle(transformation);
      if (rotation) node.rotate(rotation.vector, rotation.angle);
   }

   return Services;
}]);
