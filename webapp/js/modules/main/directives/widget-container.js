define(['./module', 'angular'], function (directives, angular) {
    'use strict';
    directives.directive('widgetContainer', ['$rootScope',function ($rootScope) {
        return {
            restrict: 'A',
            link: function preLink($scope, $elm) {

                function recalculateWidgetsSize(override) {
                    var widgets = $elm.find('.widget:visible');
                    var widgetHeight = $elm.height() / widgets.length;
                    _.forEach(widgets, function (w) {
                        var $w = $(w),
                            $resizable = $w.find('div[v-resizable]'),
                            restHeight = $w.outerHeight(true) - $resizable.outerHeight(true),
                            resizableHeight = widgetHeight - restHeight - 1;
                        if (resizableHeight < 0) {
                            resizableHeight = 0;
                        }
                        if ($resizable.attr("v-resizable-storage-attr")) {
                            if (override || !$scope.$storage[$resizable.attr("v-resizable-storage-attr")]) {
                                $scope.$storage[$resizable.attr("v-resizable-storage-attr")] = resizableHeight;
                            }
                        }
                    });
                    $rootScope.$emit('doWidgetResize');
                }

                recalculateWidgetsSize();
                $rootScope.$on('finishInitialization', function(){
                    recalculateWidgetsSize(true);
                });
            }
        }
    }])
});
