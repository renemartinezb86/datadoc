define(['./module', 'angular', 'lodash'], function (directives, angular, _) {
    'use strict';
    directives.directive('clickOut', ['$window', '$parse', '$timeout', function ($window, $parse, $timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                var clickOutHandler = $parse(attrs.clickOut);
                var excludingClasses = scope.$eval(attrs["clickOutExcludingClasses"]);

                function mouseDownListener(event) {
                    $timeout(function () {

                        if(!_.some(event.originalEvent.path, function (el) {
                            if (excludingClasses) {
                                return element[0] == el || _.some(excludingClasses, function(c) {
                                    return $(el).hasClass(c);
                                });
                            } else {
                                return element[0] == el;
                            }})) {
                            clickOutHandler(scope, {$event: event});
                        }
                    });
                }

                angular.element($window).on('mousedown', mouseDownListener);

                scope.$on('$destroy', function () {
                    angular.element($window).off('mousedown', mouseDownListener);
                });
            }
        };
    }])
});
