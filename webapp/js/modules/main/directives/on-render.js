define(['./module'], function (directives) {
    'use strict';
    directives.directive('onRender', ['ScopeService', function (ScopeService) {
        return {
            restrict: 'A',
            link: function (scope, element, attr) {
                scope.$eval(attr.onRender);
            }
        }
    }])
});
