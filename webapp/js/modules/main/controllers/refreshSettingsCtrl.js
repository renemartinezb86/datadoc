define(['./module', 'angular', 'common'], function (controllers, angular, common) {
    'use strict';

    controllers.controller('refreshSettingsCtrl', ['$scope', '$http', '$uibModalInstance', 'indexId', 'refreshSettings', 'onSuccess', function($scope, $http, $uibModalInstance, indexId, refreshSettings, onSuccess) {

        $scope.availableTypes = [
            {name: "None", code: "NONE"},
            {name: "Full", code: "FULL"},
            // {name: "Incremental", code: "INCREMENTAL"}
        ];

        if(refreshSettings == null){
            refreshSettings = {type: 'NONE', cronExpression: ""};
        }

        $scope.refreshSettings = refreshSettings;

        $scope.closeRefreshSettingsModal = function(){
            $uibModalInstance.dismiss();
        };

        $scope.saveRefreshSettings = function(){
            $scope.savingRefreshSettings = true;
            $http.post('/api/docs/bookmarks/' + indexId + '/update_refresh_settings', {
                settings: $scope.refreshSettings
            }).success(function(s){
                onSuccess(s);
                $scope.savingRefreshSettings = false;
                $scope.closeRefreshSettingsModal();
            }).error(function(e){
                $scope.savingRefreshSettings = false;
                common.showValidationErrors(e);
            })
        };

    }]);

});
