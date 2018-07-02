define(['./module', 'common'], function (controllers, cc) {
    'use strict';

    controllers.controller('resetPasswordCtrl',['$scope','$http', '$stateParams', function($scope, $http, $stateParams) {

        $scope.reset = false;
        var token = $stateParams.token;

        $scope.resetPassword = function(){
            if(!$scope.password || $scope.password == ""){
                cc.showError({message: "Password is empty"})
            } else if($scope.password != $scope.passwordConfirm) {
                cc.showError({message: "Passwords are not same"})
            } else {
                $http.post('/api/user/reset-password', {
                    token: token,
                    password: $scope.password
                }).success(function(){
                    $scope.reset = true;
                }).error(cc.showError)
            }
        }
    }])
});
