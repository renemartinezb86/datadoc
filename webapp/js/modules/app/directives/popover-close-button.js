define(['./module'], function (directives) {
    'use strict';
    directives.directive('popoverCloseButton', function($timeout) {
        return {
            scope: true,
            link: function(scope, element) {
                scope.togglePopover = () => {
                    $timeout(() => {
                        element.triggerHandler('close');
                    });
                };

                return element.on('click', scope.togglePopover);
            }
        };
    });
});
