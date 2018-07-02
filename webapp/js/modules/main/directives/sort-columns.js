define(['./module', 'angular', 'lodash'], function (directives, angular, _) {
    'use strict';
    directives.directive('sortColumns', ['$window', '$parse', '$timeout', 'SortDirection',
        function ($window, $parse, $timeout, SortDirection) {

        return {
            restrict: 'EA',
            scope: true,
            templateUrl: 'static/templates/include/sort-columns.html',
            link: function (scope, element, attrs) {

                scope.SortDirection = SortDirection;

                var sortColumnsOptions = attrs["sortColumnsOptions"];

                if (sortColumnsOptions) {
                    scope.sortColumnsOptions = scope.$eval(sortColumnsOptions);
                }

                scope.$watch(attrs.sortColumnsOptions, function(newVal, oldVal){
                    scope.sortColumnsOptions = newVal;
                });

            }
        };
    }])
});
