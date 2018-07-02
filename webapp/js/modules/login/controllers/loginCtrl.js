define(['./module', 'jquery', 'ladda', 'lodash'], function (controllers, jquery, ladda, cc, _) {
    'use strict';

    controllers.controller('loginCtrl',['$scope','$rootScope','$http','$state','User', '$stateParams',
        function($scope, $rootScope, $http, $state, User, $stateParams) {
            $scope.error = undefined;
            $scope.signingIn = false;
            $scope.signIn = function (anon) {
                $scope.signingIn = true;
                User.signIn($scope.login, $scope.password, anon).then(function () {
                    console.log('Login ' + User.UserModel);
                    debugger;
                    var nextPage = $rootScope.nextPageAfterLogin;
                    if (!User.getCurrent().active)  {
                        //cc.showSuccess({message: "You must verify your account"});
                        $state.go('auth.confirm-register', {'email':User.getCurrent().email});
                    }
                    if($stateParams.state && $stateParams.param) {
                        //todo replace this one day with lodash fromPairs
                        const params = _.reduce(_.chunk($stateParams.param.split(':'), 2), (acc, val, key) => {
                            (acc || (acc = {}));
                            acc[val[0]] = val[1];
                            return acc;
                        }, {});
                        $state.go($stateParams.state, params)
                    } else if (nextPage) {
                        $rootScope.nextPageAfterLogin = null;
                        $state.go(nextPage.name, nextPage.params);
                    } else {
                        $state.go('main');
                    }

                }, function(){
                    $scope.signingIn = false;
                    if (!User.getCurrent().active)  {
                        $state.go('auth.confirm-register', {'email':User.getCurrent().email});
                    }else {
                        $scope.error = "Incorrect login or password";
                    }
                });
            };

            $('#email-input').focus();
        }])
});
