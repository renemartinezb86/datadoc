define(['./module'], function (module) {
    module.factory('UserStateService', ['User', '$http', '$q', '$rootScope', function (User, $http, $q, $rootScope) {

        var userState = {};

        function getPromise(){
            return $http.get('/api/user/state/' + User.getCurrent().id)
                .then(function(res){
                    userState = res.data;
                    return userState;
                })
        }

        var state = {
            get: function(){
                return userState;
            },
            reset: function(){
                return state.promise = getPromise();
            }
        };

        state.reset();
        $rootScope.$on('sign_in', function() {
            state.reset();
        });

        return state;
    }]);
});