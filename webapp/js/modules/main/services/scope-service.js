define(['./module'], function(module) {
    module.service('ScopeService', function () {
        return {
            safeApply: function ($scope, fn) {
                $scope.$evalAsync(fn)
            }
        };
    });
});