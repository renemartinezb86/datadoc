define(['./module'], function (directives) {
    'use strict';
    directives.directive('onlyNumeric', [function () {
        return function(scope, element, attrs) {
            $(element[0]).numericInput({ allowFloat: true });
        };
    }]);
});