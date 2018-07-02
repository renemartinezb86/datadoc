define(['./module', 'jquery'], function (directives, $) {
    'use strict';
    directives.directive('uibModalWindow', [function () {
        return {
            restrict: 'EA',
            link: function($scope, $element) {
                if(!$element.hasClass('popup-window')) {
                    $element.find('.modal-content').draggable({
                        handle: '.modal-header',
                        containment: 'body',
                        stop: function() {
                            // fix transient background if height change after drag
                            this.style.height = "auto";
                        }
                    });
                }
            }
        }
    }]);
});
