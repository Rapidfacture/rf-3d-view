// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

app.factory('bGraphicFactory', [function () {
   var TOLERANCE = 1e-12;
   var RAD_RESOLUTION = 0.209438;

   var types = {};
   var groups = {};

   var Services = {
      getRadiusPoints: _getRadiusPoints,
      paintView: _paintView,
      sliceView: _sliceView,
      showAxis: _showAxis,
      start: function (scene) {
         types = {
            chuck: {
               diffuseColor: BABYLON.Color3.FromHexString('#bbbbbb')
            },
            chuckJaws: {
               diffuseColor: BABYLON.Color3.FromHexString('#bbbbbb')
            },
            contourFinish: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourFinish', scene);
                  mat.diffuseColor = BABYLON.Color3.Gray();
                  mat.alpha = 1;
                  mat.backFaceCulling = true;

                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            contourRaw: {
               material: (function () {
                  var mat = new BABYLON.StandardMaterial('contourFinish', scene);
                  mat.diffuseColor = BABYLON.Color3.Blue();
                  mat.alpha = 0.2;
                  mat.backFaceCulling = true;

                  return mat;
               }()),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1),
               lineWidth: 10
            },
            knurling: {
               diffuseColor: BABYLON.Color3.Green(),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
            },
            threading: {
               diffuseColor: BABYLON.Color3.Red(),
               lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
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
            tailStock: {
               color: BABYLON.Color3.Gray(),
               diffuseColor: BABYLON.Color3.Gray()
            },
            tool: {
               diffuseColor: BABYLON.Color3.FromHexString('#f47721')
            },
            toolUndefined: {
               diffuseColor: BABYLON.Color3.Red()
            },
            tooling: {
               lineColor: new BABYLON.Color4(1, 1, 1, 1),
               lineWidth: 1,
               toolingFast: {
                  lineColor: new BABYLON.Color4(1, 0, 0, 1),
                  lineWidth: 1
               }
            }
         };
      }
   };


   /* ----------- internal functions --------- */
   function _getAngle (center, point) {
      var a, b, c, factor, rawAngle;

      a = point.x - center.x;
      b = point.y - center.y;
      c = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));

      if (Math.abs(a) < Math.abs(b)) {
         if (a / c > 1 && a / c < 1 + TOLERANCE) {
            factor = 1;

         } else if (a / c < -1 && a / c > -1 - TOLERANCE) {
            factor = -1;

         } else {
            factor = a / c;
         }

         rawAngle = Math.asin(factor);

         if (b < 0) rawAngle = Math.PI - rawAngle;

      } else {
         if (b / c > 1 && b / c < 1 + TOLERANCE) {
            factor = 1;

         } else if (b / c < -1 && b / c > -1 - TOLERANCE) {
            factor = -1;

         } else {
            factor = b / c;
         }

         rawAngle = Math.acos(factor);

         if (a < 0) rawAngle = -rawAngle;
      }

      return {angle: rawAngle % (2 * Math.PI), radius: c};
   }

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

   function _setSelected (selected, item, materialsNumber) {
      if (!item.camAttributes || selected === undefined) return;

      var group = selected[item.camAttributes.group];
      var idOnPath = item.camAttributes.idOnPath;
      var position = item.camAttributes.position;

      if (group && group[position] && group[position].indexOf(idOnPath) !== -1) {
         item.materialIndex = materialsNumber - 1;

      } else {
         item.materialIndex = materialsNumber - 2;
      }
   }

   /* ----------- external functions --------- */
   function _getRadiusPoints (start, end, center, clockwise, options) {
      options = options || {};

      var coordinates = [];
      var startAngle, endAngle, steps, dAngle, radius;

      if (options.addStart) coordinates.push(new BABYLON.Vector3(start.x, start.y, start.z));

      end = _getAngle(center, end);
      start = _getAngle(center, start);

      startAngle = start.angle;
      endAngle = end.angle;

      radius = (start.radius + end.radius) / 2;

      if (clockwise) {
         while (endAngle < startAngle) endAngle += (2 * Math.PI);
      } else {
         while (startAngle < endAngle) startAngle += (2 * Math.PI);
      }

      if (Math.abs(startAngle - endAngle) < TOLERANCE) startAngle += Math.PI * 2;

      steps = options.nodes || Math.ceil(Math.abs((startAngle - endAngle) / RAD_RESOLUTION));
      dAngle = (startAngle - endAngle) / steps;

      for (var j = 0; j < steps; j++) {
         var angle = startAngle - (j + 1) * dAngle;

         coordinates.push(new BABYLON.Vector3(
            center.x + Math.sin(angle) * radius,
            center.y + Math.cos(angle) * radius,
            0
         ));
      }

      return coordinates;
   }

   function _paintView (engine, scene, data, click, ctrlClick) {
      if (!data || !data.items) return;

      data.items = JSON.parse(JSON.stringify(data.items));

      click = click || function () {};
      ctrlClick = ctrlClick || function () {};

      scene.onPointerDown = function (event, result) {
         if (result.pickedMesh && result.pickedMesh.material.subMaterials) {
            var selectedSubMesh = result.pickedMesh.subMeshes[result.subMeshId];
            var materialsNumber = result.pickedMesh.material.subMaterials.length;

            if (selectedSubMesh.selectable) {
               if (event.ctrlKey) {
                  ctrlClick(selectedSubMesh.camAttributes);

               } else {
                  click(selectedSubMesh.camAttributes);
               }

               result.pickedMesh.subMeshes.forEach(function (subMesh) {
                  _setSelected(data.selected, subMesh, materialsNumber);
               });
            }
         }
      };

      groups = {};

      // remove old meshes
      for (var k = scene.meshes.length - 1; k >= 0; k--) {
         scene.meshes[k].dispose();
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

      dataGroups.forEach(function (group) {
         group.offset = group.offset || [0, 0, 0];
         group.transformation = group.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

         var offset = new BABYLON.Vector3.FromArray(group.offset);
         var CoT = new BABYLON.TransformNode(group.id, scene);
         CoT.translate(offset, 1);

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
            CoT.scaling = new BABYLON.Vector3.FromArray([1, 1, -1]);
            group.transformation[2][2] = -group.transformation[2][2];
         }

         var transformation = _transformationMatrixToAxisAngle(group.transformation);
         CoT.rotate(transformation.vector, transformation.angle);

         _showAxis(group.id, CoT, BABYLON.Vector3.Zero(), transformation, 'machine', {size: 20}, scene);

         for (var k in group.origin) {
            var item = group.origin[k];

            var originOffset = new BABYLON.Vector3.FromArray(item.offset);
            var originTransformation = _transformationMatrixToAxisAngle(item.transformation);

            _showAxis(group.id, CoT, originOffset, originTransformation, k, {size: 20}, scene);
         }

         groups['G' + group.id] = {node: CoT, meshes: {}};
      });

      dataItems.forEach(function (item, $index) {
         item.group = item.group || 0;
         item.offset = item.offset || [0, 0, 0];
         item.transformation = item.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

         var itemTransformation = _transformationMatrixToAxisAngle(item.transformation);
         var itemOffset = new BABYLON.Vector3.FromArray(item.offset);

         item.primitives.forEach(function (primitive, i) {
            var materialType = types[item.type];
            var mesh;

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

               mesh = new BABYLON.Mesh('FreeForm_' + $index, scene);
               vertexData.applyToMesh(mesh, true);

               mesh.material = types[item.type].material;
               mesh.selectable = true;
               mesh.camAttributes = primitive.attributes;

               mesh.parent = groups['G' + item.group].node;
               mesh.renderingGroupId = 0;

               mesh.rotate(itemTransformation.vector, itemTransformation.angle, BABYLON.Space.WORLD);
               mesh.translate(itemOffset, 1, BABYLON.Space.WORLD);

               groups['G' + item.group].meshes[mesh.name] = mesh;

            } else if (primitive.shape === 'freeFormOutline') {
               primitive.lines.forEach(function (line, $primitiveIndex) {
                  var points = [];
                  line.indices.forEach(function (index) {
                     points.push(new BABYLON.Vector3(
                        primitive.positions[3 * index],
                        primitive.positions[3 * index + 1],
                        primitive.positions[3 * index + 2]
                     ));
                  });

                  var tmpType = (line.type ? materialType[line.type] : materialType);

                  mesh = BABYLON.MeshBuilder.CreateLines(
                     'FreeFormOutline_' + $index + '_' + $primitiveIndex,
                     {
                        points: points,
                        colors: Array(points.length).fill(tmpType.lineColor)
                     },
                     scene
                  );

                  mesh.enableEdgesRendering();
                  mesh.edgesWidth = tmpType.lineWidth;
                  mesh.edgesColor = tmpType.lineColor;

                  mesh.parent = groups['G' + item.group].node;
                  mesh.renderingGroupId = 3;

                  mesh.rotate(itemTransformation.vector, itemTransformation.angle, BABYLON.Space.WORLD);
                  mesh.translate(itemOffset, 1, BABYLON.Space.WORLD);

                  groups['G' + item.group].meshes[mesh.name] = mesh;
               });
            }
         });
      });

      return groups;
   }

   function _sliceView (engine, scene, groups, clipPlane) {
      for (var k in groups) {
         var group = groups[k];

         for (var l in group.meshes) {
            var mesh = group.meshes[l];
            var materialType = types[mesh.material.id];

            if (!materialType) continue;

            var meshInsideMaterial = new BABYLON.CustomMaterial('meshInsideMaterial', scene);
            meshInsideMaterial.diffuseColor = materialType.diffuseColor;
            meshInsideMaterial.backFaceCulling = false;
            meshInsideMaterial.color = materialType.diffuseColor;
            meshInsideMaterial.alpha = materialType.alpha || 1;
            meshInsideMaterial.Fragment_Before_FragColor('if(gl_FrontFacing) discard;');

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

            var previousStencilMask = engine.getStencilMask();
            var previousStencilFunction = engine.getStencilFunction();

            var stencilPlaneMaterial = mesh.material.clone('stencilPlaneMaterial');
            stencilPlaneMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
            stencilPlaneMaterial.emissiveColor = new BABYLON.Color3(0, 0, 0);
            stencilPlaneMaterial.ambientColor = new BABYLON.Color3(0, 0, 0);

            var boundingBox = mesh.getBoundingInfo().boundingBox;
            var dx = boundingBox.maximum.x - boundingBox.minimum.x;
            var dz = boundingBox.maximum.z - boundingBox.minimum.z;

            var stencilPlane = BABYLON.MeshBuilder.CreatePlane('stencilPlane', {width: dx, height: dz}, scene);
            stencilPlane.parent = group.node;
            // stencilPlane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
            stencilPlane.material = stencilPlaneMaterial;
            stencilPlane.position.set(mesh.position.x, mesh.position.y, boundingBox.maximum.z - dz / 2 + mesh.position.z);
            stencilPlane.isPickable = false;
            stencilPlane.renderingGroupId = (materialType === 'contourRaw' ? 2 : 1);
            stencilPlane.onBeforeRenderObservable.add(function () {
               engine.setStencilBuffer(true);
               engine.setStencilMask(0x00);
               engine.setStencilFunction(BABYLON.Engine.EQUAL);
            });

            stencilPlane.onAfterRenderObservable.add(function () {
               engine.setStencilBuffer(false);
               engine.setStencilMask(previousStencilMask);
               engine.setStencilFunction(previousStencilFunction);
            });
         }
      }
   }

   // show axis
   function _showAxis (groupId, node, translation, rotation, name, options, scene) {
      // rotation not jet in use
      var makeTextPlane = function (text, color) {
         var dynamicTexture = new BABYLON.DynamicTexture('DynamicTexture', 50, scene, true);
         dynamicTexture.hasAlpha = true;
         dynamicTexture.drawText(text, 5, 50, 'bold 72px Arial', color, 'transparent', true);

         var plane = new BABYLON.Mesh.CreatePlane('TextPlane', size / 10, scene, true);
         plane.material = new BABYLON.StandardMaterial('TextPlaneMaterial', scene);
         plane.material.backFaceCulling = false;
         plane.material.specularColor = new BABYLON.Color3(0, 0, 0);
         plane.material.diffuseTexture = dynamicTexture;

         return plane;
      };

      var CoT = new BABYLON.TransformNode(groupId, scene);
      CoT.parent = node;
      CoT.translate(translation, BABYLON.Space.LOCAL);
      CoT.rotate(rotation.vector, rotation.angle);

      var isPickable = (options.isPickable === undefined ? true : options.isPickable);
      var size = options.size || 5;
      var axis = options.axis || 'xyz';
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

         var xChar = makeTextPlane('X', 'red');
         xChar.isPickable = false;
         xChar.position = new BABYLON.Vector3(0.9 * size, -0.05 * size, 0);
         xChar.renderingGroupId = 3;
         xChar.parent = CoT;

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

         var yChar = makeTextPlane('Y', 'green');
         yChar.isPickable = false;
         yChar.position = new BABYLON.Vector3(0, 0.9 * size, -0.05 * size);
         yChar.renderingGroupId = 3;
         yChar.parent = CoT;

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

         var zChar = makeTextPlane('Z', 'blue');
         zChar.isPickable = false;
         zChar.position = new BABYLON.Vector3(0, 0.05 * size, 0.9 * size);
         zChar.renderingGroupId = 3;
         zChar.parent = CoT;

         result.zAxis = axisZ;
         result.zChar = zChar;
      }

      return result;
   }

   return Services;
}]);
