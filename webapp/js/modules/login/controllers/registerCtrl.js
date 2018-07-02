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
                    mobile: $scope.user.mobile,
                    avatarPath: $scope.userAvatar
                }).then(() => {
                    $scope.isUploading = false;
                    cc.showSuccess({message: "Registration completed"});
                    $state.go('auth.confirm-register', {'email':$scope.user.email});
                }).catch(err => {
                    $scope.isUploading = false;
                    cc.showError(err);
                })
            }

            $scope.submit = function () {
                if (!$scope.user.email) {
                    cc.showError({message: "Email is required!"})
                } else if (validateEmail($scope.user.email)) {
                    cc.showError({message: "Email is not correct!"})
                }
                else if (!$scope.user.password) {
                    cc.showError({message: "Password is required!"})
                }
                else  {
                    if ($scope.user.image) {
                        $scope.isUploading = true;
                        $scope.user.image.upload();
                    } else {
                        register();
                    }
                }
            };


            function validateEmail(email) {
                var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                return re.test(String(email).toLowerCase());
            }

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
