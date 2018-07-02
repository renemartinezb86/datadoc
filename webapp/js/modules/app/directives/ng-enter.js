define(['./module'], function (directives) {
    'use strict';
    directives.directive('ngEnter', [function () {
        return function(scope, element, attrs) {
            element.bind("keydown keypress", function(event) {
                if(event.which === 13 && !event.isPropagationStopped()) {
                    scope.$apply(function(){
                        scope.$eval(attrs.ngEnter);
                    });

                    event.preventDefault();
                }
            });
        };
    }])
});
