// main application data; stores json drawing (geometry, features, metaData); stack for undo/redo

'use strict';

app.factory('bGraphicFactory', [function () {
   var TOLERANCE = 1e-12;
   var RAD_RESOLUTION = 0.209438;

   // Do not set alpha to 0, it will result in 1
   var types = {
      chuck: {
         diffuseColor: BABYLON.Color3.FromHexString('#bbbbbb')
      },
      chuckJaws: {
         diffuseColor: BABYLON.Color3.FromHexString('#bbbbbb')
      },
      contourFinish: {
         alpha: 1,
         diffuseColor: BABYLON.Color3.Gray(),
         lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
      },
      contourRaw: {
         alpha: 0.2,
         diffuseColor: BABYLON.Color3.Blue(),
         lineColor: new BABYLON.Color4(0.3, 0.3, 0.3, 1)
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
      selectable: {
         diffuseColor: BABYLON.Color3.Blue(),
         lineColor: BABYLON.Color4(0, 0, 1, 1)
      },
      selected: {
         diffuseColor: BABYLON.Color3.Red(),
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
         color: BABYLON.Color3.White()
      },
      toolingFast: {
         color: BABYLON.Color3.Red()
      }
   };


   var groups = {};

   var Services = {
      basicOffsetAdd: _basicOffsetAdd,
      getRadiusPoints: _getRadiusPoints,
      offsetPaths: _offsetPaths,
      offsetShape: _offsetShape,
      paintView: _paintView,
      sliceView: _sliceView,
      showAxis: _showAxis
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

   function _getShape (elements, offset, split) {
      var path = [];
      var paths = [];
      var points = [];
      var mode = 'default';
      var startElemSet = false;
      var subTypes = ['default'];
      var dX = offset[0];
      var dZ = offset[2];

      if (!elements) return {path: path, paths: paths, points: points};

      elements.forEach(function (elem) {
         if (elem.L && !startElemSet) {
            startElemSet = true;
            path.push(new BABYLON.Vector3(elem.L.X + dX, elem.L.Z + dZ, 0));

         } else if (startElemSet) {
            var prev = path.length - 1;
            var x, y, z;

            if (elem.L) {
               x = (typeof elem.L.X === 'number') ? elem.L.X + dX : path[prev].x;
               y = (typeof elem.L.Z === 'number') ? elem.L.Z + dZ : path[prev].y;
               z = 0;

               path.push(new BABYLON.Vector3(x, y, z));
            }

            if (elem.C) {
               x = (typeof elem.C.X === 'number') ? elem.C.X + dX : path[prev].x;
               y = (typeof elem.C.Z === 'number') ? elem.C.Z + dZ : path[prev].y;
               z = 0;

               var end = {x: x, y: y, z: 0};
               var start = {x: path[prev].x, y: path[prev].y, z: 0};
               var center = {x: elem.CC.X, y: elem.CC.Z, z: 0};
               var clockwise = elem.C.DR === '+';

               path = path.concat(_getRadiusPoints(start, end, center, clockwise));
            }

            if (elem.PATH) {
               var item0 = (elem.PATH[0].L ? elem.PATH[0].L : elem.PATH[0].C);
               var item1 = (elem.PATH[1].L ? elem.PATH[1].L : elem.PATH[1].C);

               points.push(new BABYLON.Vector3(
                  (typeof item1.X === 'number' ? item1.X : item0.X),
                  (typeof item1.Y === 'number' ? item1.Y : item0.Y),
                  (typeof item1.Z === 'number' ? item1.Z : item0.Z)
               ));
            }

            if (elem.FORWARD === null) {
               if (subTypes.indexOf('toolingFast') === -1) subTypes.push('toolingFast');
               mode = 'toolingFast';
               paths.push({path: path, subType: 'toolingFast'});
               path = [new BABYLON.Vector3(x, y, z)];

            } else if (elem.KNR && mode !== 'knurling') {
               if (subTypes.indexOf('knurling') === -1) subTypes.push('knurling');
               mode = 'knurling';
               paths.push({path: path, subType: 'knurling'});
               path = [new BABYLON.Vector3(x, y, z)];

            } else if (elem.TRD && mode !== 'threading') {
               if (subTypes.indexOf('threading') === -1) subTypes.push('threading');
               mode = 'threading';
               paths.push({path: path, subType: 'threading'});
               path = [new BABYLON.Vector3(x, y, z)];

            } else if (!elem.PATH) {
               mode = 'default';
               if (split) {
                  paths.push({path: path});
                  path = [new BABYLON.Vector3(x, y, z)];
               }
            }
         }
      });

      if (!split) paths.push({path: path});

      return {paths: paths, points: points, subTypes: subTypes};
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
   function _basicOffsetAdd (basicOffset, offset) {
      basicOffset[0] += offset[0];
      basicOffset[1] += offset[1];
      basicOffset[2] += offset[2];

      return basicOffset;
   }

   function _getRadiusPoints (start, end, center, clockwise) {
      var coordinates = [];
      var startAngle, endAngle, steps, dAngle, radius;

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

      steps = Math.ceil(Math.abs((startAngle - endAngle) / RAD_RESOLUTION));
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

   function _offsetPaths (paths, offset) {
      paths.forEach(function (path) {
         path.forEach(function (element) {
            if ('L' in element) {
               if ('X' in element.L) element.L.X += offset[0];
               if ('Y' in element.L) element.L.Y += offset[1];
               if ('Z' in element.L) element.L.Z += offset[2];
            }

            if ('C' in element) {
               if ('X' in element.C) element.C.X += offset[0];
               if ('Y' in element.C) element.C.Y += offset[1];
               if ('Z' in element.C) element.C.Z += offset[2];
            }

            if ('CC' in element) {
               if ('X' in element.CC) element.CC.X += offset[0];
               if ('Y' in element.CC) element.CC.Y += offset[1];
               if ('Z' in element.CC) element.CC.Z += offset[2];
            }
         });
      });

      return paths;
   }

   function _offsetShape (shape, vector3offset, clone) {
      if (clone) {
         var newShape = [];

         shape.forEach(function (vector3) {
            newShape.push(vector3.clone().add(vector3offset));
         });

         return newShape;

      } else {
         shape.forEach(function (vector3) {
            vector3.add(vector3offset);
         });
      }
   }

   function _paintView (engine, scene, data, click, ctrlClick) {
      if (!data) return;

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
            var originTranslation = _transformationMatrixToAxisAngle(item.transformation);

            _showAxis(group.id, CoT, originOffset, originTranslation, k, {size: 20}, scene);
         }

         groups['G' + group.id] = {node: CoT, meshes: {}};
      });

      var materialSelectable = new BABYLON.StandardMaterial('selectable', scene);
      materialSelectable.diffuseColor = types.selectable.diffuseColor;
      materialSelectable.color = types.selectable.diffuseColor;
      materialSelectable.alpha = types.selectable.alpha || 1;
      materialSelectable.backFaceCulling = true;

      var materialSelected = new BABYLON.StandardMaterial('selected', scene);
      materialSelected.diffuseColor = types.selected.diffuseColor;
      materialSelected.color = types.selected.diffuseColor;
      materialSelected.alpha = types.selected.alpha || 1;
      materialSelected.backFaceCulling = true;

      dataItems.forEach(function (item, $index) {
         item.group = item.group || 0;
         item.offset = item.offset || [0, 0, 0];
         item.transformation = item.transformation || [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

         var materialMulti = new BABYLON.MultiMaterial(item.type, scene);

         var addMeshes = [];
         var subtractMeshes = [];
         var addCSG, subtractCSG;
         var resultingMesh;
         var outlines = [];
         var lines = [];

         item.primitives.forEach(function (primitive, i) {
            var shape = _getShape(
               primitive.path,
               [0, 0, 0],
               primitive.shape !== 'extrusion'
            );

            var materialType = types[item.type];

            if (shape.subTypes.indexOf('default') !== -1) {
               var material = new BABYLON.StandardMaterial(i, scene);
               material.label = i;
               material.diffuseColor = materialType.diffuseColor;
               material.color = materialType.color;
               material.alpha = materialType.alpha || 1;
               material.backFaceCulling = true;

               materialMulti.subMaterials.push(material);
            }

            if (shape.subTypes.indexOf('toolingFast') !== -1) {
               var materialFast = new BABYLON.StandardMaterial(i + '_toolingFast', scene);
               materialFast.label = i;
               materialFast.diffuseColor = types.toolingFast.diffuseColor;
               materialFast.color = types.toolingFast.color;

               materialMulti.subMaterials.push(materialFast);
            }

            if (shape.subTypes.indexOf('knurling') !== -1) {
               var materialKnurling = new BABYLON.StandardMaterial(i + '_knurling', scene);
               materialKnurling.label = i;
               materialKnurling.diffuseColor = types.knurling.diffuseColor;
               materialKnurling.color = types.knurling.color;

               materialMulti.subMaterials.push(materialKnurling);
            }

            if (shape.subTypes.indexOf('threading') !== -1) {
               var materialThreading = new BABYLON.StandardMaterial(i + '_threading', scene);
               materialThreading.label = i;
               materialThreading.diffuseColor = types.threading.diffuseColor;
               materialThreading.color = types.threading.color;

               materialMulti.subMaterials.push(materialThreading);
            }

            if (primitive.shape === 'rotational') {
               shape.points.forEach(function (point) {
                  var path = [];
                  for (var theta = 0; theta < 2 * Math.PI; theta += RAD_RESOLUTION) {
                     path.push(new BABYLON.Vector3(
                        point.x * Math.cos(theta),
                        point.x * Math.sin(theta),
                        point.z
                     ));
                  }

                  var line = BABYLON.Mesh.CreateLines(
                     (item.id === undefined ? 'Path_' + $index : item.id),
                     path,
                     scene
                  );

                  line.enableEdgesRendering();
                  line.edgesWidth = 10;
                  line.edgesColor = materialType.lineColor;
                  // if (material.color) line.color = material.color;

                  if (primitive.transformation) {
                     var transformation = _transformationMatrixToAxisAngle(primitive.transformation);
                     line.rotate(transformation.vector, transformation.angle, BABYLON.Space.WORLD);
                  }

                  if (primitive.offset) {
                     line.translate(
                        new BABYLON.Vector3.FromArray(primitive.offset),
                        1,
                        BABYLON.Space.WORLD
                     );
                  }

                  outlines.push(line);
               });
            }

            shape.paths.forEach(function (path) {
               if (path.length < 2) return;

               var primitiveMesh, offset, transformation;

               if (primitive.shape === 'rotational') {
                  primitiveMesh = BABYLON.MeshBuilder.CreateLathe(
                     'Rotation_' + $index,
                     {shape: path.path, tessellation: 30}
                  );

               } else if (primitive.shape === 'extrusion') {
                  primitiveMesh = BABYLON.MeshBuilder.ExtrudeShape(
                     'Extrusion_' + $index,
                     {
                        shape: path.path,
                        path: [
                           new BABYLON.Vector3(0, 0, 0),
                           new BABYLON.Vector3(0, 0, primitive.extrusion)
                        ],
                        cap: BABYLON.Mesh.CAP_ALL
                     }
                  );

               } else {
                  var line = BABYLON.Mesh.CreateLines(
                     (item.id === undefined ? 'Path_' + $index : item.id),
                     path.path,
                     scene
                  );
                  line.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2);

                  if (path.subType === 'toolingFast') {
                     line.color = materialFast.color;

                  } else {
                     if (material.color) line.color = material.color;
                  }

                  if (primitive.transformation) {
                     transformation = _transformationMatrixToAxisAngle(primitive.transformation);
                     line.rotate(transformation.vector, transformation.angle, BABYLON.Space.WORLD);
                  }

                  if (primitive.offset) {
                     offset = new BABYLON.Vector3.FromArray(primitive.offset);
                     line.translate(offset, 1, BABYLON.Space.WORLD);
                  }

                  lines.push(line);
               }

               if (!primitiveMesh) return;

               if (primitive.boolean === 'add' || !primitive.boolean) {
                  addMeshes.push(primitiveMesh);

               } else if (primitive.boolean === 'subtract') {
                  subtractMeshes.push(primitiveMesh);
               }

               if (path.subType === 'knurling') {
                  primitiveMesh.material = materialKnurling;

               } else if (path.subType === 'threading') {
                  primitiveMesh.material = materialThreading;

               } else {
                  primitiveMesh.material = material;
               }

               // primitiveMesh.material = material;
               primitiveMesh.parent = groups['G' + item.group].node;
               primitiveMesh.rotate(new BABYLON.Vector3(1, 0, 0), Math.PI / 2);

               if (primitive.transformation) {
                  transformation = _transformationMatrixToAxisAngle(primitive.transformation);
                  primitiveMesh.rotate(transformation.vector, transformation.angle, BABYLON.Space.WORLD);
               }

               if (primitive.offset) {
                  offset = new BABYLON.Vector3.FromArray(primitive.offset);
                  primitiveMesh.translate(offset, 1, BABYLON.Space.WORLD);
               }
            });
         });

         materialMulti.subMaterials.push(materialSelectable);
         materialMulti.subMaterials.push(materialSelected);

         if (addMeshes.length > 0) {
            var addMesh = BABYLON.Mesh.MergeMeshes(addMeshes,
               true,
               true,
               undefined,
               true,
               true
            );

            addCSG = BABYLON.CSG.FromMesh(addMesh);
            addMesh.dispose();
         }

         if (subtractMeshes.length > 0) {
            var subtractMesh = BABYLON.Mesh.MergeMeshes(subtractMeshes,
               true,
               true,
               undefined,
               true,
               true
            );

            subtractCSG = BABYLON.CSG.FromMesh(subtractMesh);
            subtractMesh.dispose();
         }

         if (addCSG && subtractCSG) {
            addCSG.subtractInPlace(subtractCSG);

            resultingMesh = addCSG.toMesh('Item' + $index, materialMulti, scene, true);

         } else if (addCSG) {
            resultingMesh = addCSG.toMesh('Item' + $index, materialMulti, scene, true);
         }

         var itemTransformation = _transformationMatrixToAxisAngle(item.transformation);
         var itemOffset = new BABYLON.Vector3.FromArray(item.offset);

         if (resultingMesh) {
            var materialsNumber = materialMulti.subMaterials.length;

            resultingMesh.subMeshes.forEach(function (subMesh) {
               var index = subMesh.materialIndex;
               var material = materialMulti.getSubMaterial(index);
               var primitive = item.primitives[material.label];

               if (primitive.selectable) {
                  subMesh.selectable = true;
                  subMesh.camAttributes = primitive.attributes;
                  subMesh.materialDefault = subMesh.materialIndex;

                  _setSelected(data.selected, subMesh, materialsNumber);
               }
            });

            // resultingMesh.forceSharedVertices();
            resultingMesh.parent = groups['G' + item.group].node;
            resultingMesh.renderingGroupId = 0;

            resultingMesh.rotate(
               itemTransformation.vector,
               itemTransformation.angle,
               BABYLON.Space.WORLD
            );

            resultingMesh.translate(itemOffset, 1, BABYLON.Space.WORLD);

            outlines.forEach(function (outline) {
               outline.parent = groups['G' + item.group].node;
               outline.rotate(
                  itemTransformation.vector,
                  itemTransformation.angle,
                  BABYLON.Space.WORLD
               );

               outline.translate(itemOffset, 1, BABYLON.Space.WORLD);
            });

            groups['G' + item.group].meshes[resultingMesh.id] = resultingMesh;
         }

         lines.forEach(function (line) {
            line.parent = groups['G' + item.group].node;
            line.renderingGroupId = 3;

            line.rotate(
               itemTransformation.vector,
               itemTransformation.angle,
               BABYLON.Space.WORLD
            );

            line.translate(itemOffset, 1, BABYLON.Space.WORLD);

            groups['G' + item.group].meshes['Item' + $index] = line;
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
            stencilPlane.rotate(new BABYLON.Vector3(1, 0, 0), -Math.PI / 2);
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

      var size = options.size || 5;
      var axis = options.axis || 'xyz';

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
         axisX.renderingGroupId = 3;
         axisX.parent = node;
         axisX.translate(translation, 1, BABYLON.Space.LOCAL);

         var xChar = makeTextPlane('X', 'red');
         xChar.position = new BABYLON.Vector3(0.9 * size, -0.05 * size, 0);
         xChar.renderingGroupId = 3;
         xChar.parent = node;
         xChar.translate(translation, 1, BABYLON.Space.LOCAL);
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
         axisY.renderingGroupId = 3;
         axisY.parent = node;
         axisY.translate(translation, 1, BABYLON.Space.LOCAL);

         var yChar = makeTextPlane('Y', 'green');
         yChar.position = new BABYLON.Vector3(0, 0.9 * size, -0.05 * size);
         yChar.renderingGroupId = 3;
         yChar.parent = node;
         yChar.translate(translation, 1, BABYLON.Space.LOCAL);
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
         axisZ.renderingGroupId = 3;
         axisZ.parent = node;
         axisZ.translate(translation, 1, BABYLON.Space.LOCAL);

         var zChar = makeTextPlane('Z', 'blue');
         zChar.position = new BABYLON.Vector3(0, 0.05 * size, 0.9 * size);
         zChar.renderingGroupId = 3;
         zChar.parent = node;
         zChar.translate(translation, 1, BABYLON.Space.LOCAL);
      }
   }

   return Services;
}]);
