define(['./module', 'common', 'lodash'], function (controllers, cc, _) {
    'use strict';

    controllers.controller('confirmRegisterCtrl', ['$scope', '$http', '$state', '$stateParams',
        function ($scope, $http, $state, $stateParams) {


            $scope.verificationCode = '';
            $scope.email = $stateParams.email;
            console.log($stateParams.email);

            function confirmRegister() {
                $http.post("/api/user/validateActivationCode", {
                    email: $scope.email,
                    verificationCode: $scope.verificationCode
                }).then(() => {
                    $scope.isUploading = false;
                cc.showSuccess({message: "Registration completed"});
                $state.go('auth.login', $stateParams);
                }).catch(err => {
                        $scope.isUploading = false;
                    cc.showError(err);
                })
            }

            $scope.submit = function () {
                if (!$scope.verificationCode && !$scope.email) {
                    cc.showError({message: "Email and verification code are required!"})
                } else {
                    confirmRegister();
                }
            };

        }]);
});
