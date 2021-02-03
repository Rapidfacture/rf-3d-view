app.factory('bGraphicGeneralFactory', [function () {
   var TOLERANCE = 1e-12;
   var RAD_RESOLUTION = 0.209438;

   var Services = {
      getAngle: _getAngle,
      getRadiusPoints: _getRadiusPoints,
      getTextPlaneProperties: _getTextPlaneProperties,
      pathSortInPlace: _pathSortInPlace
   };

   function _getAngle (center, point) {
      var angle = Math.atan2(point.x - center.x, point.y - center.y);

      while (angle < 0) { angle += 2 * Math.PI; }
      while (angle >= 2 * Math.PI) { angle -= 2 * Math.PI; }

      return { angle: angle, radius: point.subtract(center).length() };
   }

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

   function _getTextPlaneProperties (text) {
      // Set height for plane
      var planeHeight = 1;
      var fontSize = 72;

      // Set height for dynamic texture
      var DTHeight = 1.2 * fontSize; // or set as wished

      // Calcultae ratio
      var ratio = planeHeight / DTHeight;
      // Set font
      var font = 'bold ' + fontSize + 'px Arial';
      var temp = new BABYLON.DynamicTexture('DynamicTexture', 64);
      var tmpctx = temp.getContext();
      temp.dispose();
      tmpctx.font = font;
      var DTWidth = tmpctx.measureText(text).width + 8;

      // Calculate width the plane has to be
      var planeWidth = DTWidth * ratio;

      return {
         dtHeight: DTHeight,
         dtWidth: DTWidth,
         font: font,
         fontSize: fontSize,
         height: planeHeight,
         text: text,
         width: planeWidth
      };
   }

   function _pathSortInPlace (path) {
      // Presort, not accounting direction
      var currentElement, nextElement;
      var elements = [];

      if (path.length > 1) {
         currentElement = path[0];
         nextElement = path[1];

         while (nextElement) {
            currentElement = nextElement;
            nextElement = currentElement.end.getPartnerElement(currentElement);

            if (currentElement.end !== nextElement.start) nextElement.changeDirection();

            if (elements.indexOf(nextElement) === -1) {
               elements.push(nextElement);

            } else {
               nextElement = null;
            }
         }
      }
   }

   return Services;
}]);
