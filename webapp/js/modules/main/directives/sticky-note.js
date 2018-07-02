define(['./module', 'jquery'], function (directives, $) {
    'use strict';
    directives.directive('stickyNote', ['$rootScope', function($rootScope){
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/popover/sticky-note.html',
            scope: {
                snTemplate: '@',
                snOpen: '=',
                snPlacement: '=',
                snClass: '@',
                snOnClose: '&'
            },
            link: function($scope, $elm, $attrs) {
                if(!$scope.snTemplate){
                    $scope.snOpen = false;
                    return;
                }
                $scope.close = function(e){
                    $scope.snOpen = false;
                    $scope.snOnClose();
                }
            }
        };
    }]);
});
