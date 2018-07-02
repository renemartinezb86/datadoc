define(['./module', 'angular', 'lodash'], function (directives, angular, _) {
    'use strict';
    directives.directive('pageLoader', ['$rootScope', function ($rootScope) {
        return {
            restrict: 'A',
            templateUrl: 'static/templates/app/page-loader.html',
            scope: {},
            link: function ($scope, element, attrs) {
                $scope.stateChange = true;
                $scope.showFullBackdrop = true;
                $scope.showCancelRequestButton = false;
                $scope.innerText = undefined;
                $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {
                    $scope.showCancelRequestButton = false;
                    $scope.stateChange = true;
                    $scope.showFullBackdrop = true;
                });
                $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState, fromParams) {
                    if(!toState.skipDefaultStateChangeBehavior) {
                        $scope.stateChange = false;
                        $scope.showFullBackdrop = false;
                    }
                });
                $rootScope.$on('togglePageLoader-' + attrs.id, function (e, options) {
                    options = _.merge({toggle: true, backdrop: true}, options);
                    $scope.showCancelRequestButton = false;
                    $scope.stateChange = options.toggle;
                    $scope.showFullBackdrop = options.backdrop;
                    $scope.innerText =  options.innerText;
                });
                $rootScope.$on('togglePageLoaderCancelButton-' + attrs.id, function(e, cancelCallback) {
                    $scope.showCancelRequestButton = true;
                    $scope.cancelRequest = cancelCallback;
                    $scope.innerText = undefined;
                });
            }
        }
    }])
});
