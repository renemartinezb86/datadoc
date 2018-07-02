define(['./module', 'angular', 'common', 'lodash'], function (directives, angular, common, _) {
    'use strict';
    directives.directive('contextMenu', ['$timeout', function ($timeout) {

        return function ($scope, element, attrs) {
            let contextMenuOpenEvent = attrs.contextMenuOpenEvent || 'contextmenu';

            let scrolling = false;
            element.on(contextMenuOpenEvent, function (event) {
                $scope.contextMenuOptions = {};
                if (attrs.contextMenuOptions) {
                    $scope.contextMenuOptions = $scope.$eval(attrs.contextMenuOptions);
                }

                const enabled = $scope.contextMenuOptions.enabled;

                if ('ontouchstart' in document.documentElement
                    && event.originalEvent instanceof TouchEvent) {
                    switch (event.type) {
                        case 'touchstart':
                            scrolling = false;
                            break;
                        case 'touchmove':
                            scrolling = true;
                            break;
                        case 'touchend':
                            if (scrolling) { return }
                            enabled(event);
                            break;
                    }
                    return;
                }

                if(enabled && !enabled(event)){
                    return;
                }
                event.stopPropagation();
                $scope.$apply(function () {
                    event.preventDefault();
                    let options = $scope.$eval(attrs.contextMenu, {$event: event});
                    let model = $scope.$eval(attrs.model);
                    if (options instanceof Array) {
                        if (options.length === 0) {
                            return;
                        }
                        common.renderContextMenu($scope, event, options, model);
                    } else {
                        throw '"' + attrs.contextMenu + '" not an array';
                    }
                });
            });
        };
    }]);
});