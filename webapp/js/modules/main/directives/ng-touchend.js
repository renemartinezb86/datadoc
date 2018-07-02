define(['./module'], function (directives) {
    'use strict';
    directives.directive('ngTouchend', [function () {
        return function ($scope, $element, $attrs) {

            const isTouchEventsAllowed = function (e) {
                return 'ontouchstart' in document.documentElement
                    && e.originalEvent instanceof TouchEvent;
            };

            $element.on('touchend', function (event) {
                if (isTouchEventsAllowed(event)) {
                    $scope.$apply(function () {
                        $scope.$eval($attrs.ngTouchend);
                    });
                }
            });
        };
    }]);
});