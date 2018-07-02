define(['./module'], function (directives) {
    'use strict';
    directives.directive('onFinishRender', ['$timeout', function ($timeout) {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                if (scope.$last === true) {
                    $timeout(function () {
                        scope.$apply(function() {
                            scope.$eval(attr.onFinishRender);
                        });
                    });
                }
            }
        }
    }])
});
