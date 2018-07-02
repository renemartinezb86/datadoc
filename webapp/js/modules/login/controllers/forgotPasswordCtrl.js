define(['./module', 'common', 'jquery'], function (controllers, cc) {
    'use strict';

    controllers.controller('forgotPasswordCtrl',['$scope','$http', function($scope, $http) {

        $scope.sent = false;
        
        $scope.sendPasswordResetNotification = function(){
            $http.post('/api/user/forgot-password', {
                email: $scope.email
            }).success(function(){
                $scope.sent = true;
            }).error(cc.showError)
        };

        $('#email-input').focus();
        
    }])
});
