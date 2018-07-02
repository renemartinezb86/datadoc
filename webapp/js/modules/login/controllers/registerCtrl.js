define(['./module', 'common', 'lodash'], function (controllers, cc, _) {
    'use strict';

    controllers.controller('registerCtrl', ['$scope', '$http', '$state', '$stateParams', 'FileUploader',
        function ($scope, $http, $state, $stateParams, FileUploader) {

            $scope.user = {};

            $scope.uploader = new FileUploader({
                url: '/api/user/upload_avatar',
                filters: [{
                    name: 'onlyImages',
                    fn: function (item) {
                        return _.startsWith(item.type, 'image');
                    }
                }]
            });

            function register() {
                $http.post("/api/user/register", {
                    email: $scope.user.email,
                    password: $scope.user.password,
                    fullName: $scope.user.fullName,
                    avatarPath: $scope.userAvatar
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
                if (!$scope.user.email) {
                    cc.showError({message: "Email is required!"})
                }
                else if (!$scope.user.password) {
                    cc.showError({message: "Password is required!"})
                }
                else if ($scope.user.password !== $scope.user.passwordConfirm) {
                    cc.showError({message: "Passwords doesn't match!"})
                } else {
                    if ($scope.user.image) {
                        $scope.isUploading = true;
                        $scope.user.image.upload();
                    } else {
                        register();
                    }
                }
            };

            $scope.uploader.onAfterAddingFile = function (item) {
                item.headers['Datadocs-API-Arg'] = JSON.stringify({fileSize: item.file.size});
                $scope.user.image = item;
            };

            $scope.uploader.onSuccessItem = function (item, {url}) {
                $scope.userAvatar = url;
                register();
            };
        }])
});
