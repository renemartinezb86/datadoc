define(['./module', 'lodash', 'common'], function(module, _, cc) {
    module.service('UserEventService', ['$http', '$rootScope', '$timeout', 'WSocket', '$q', 'User',
        function ($http, $rootScope, $timeout, WSocket, $q, User) {

            let eventCallbacks = {};

            function event(type, payload, promise, $scope){
                var id = cc.randomGUID();
                if(promise){
                    eventCallbacks[id] = promise;
                }
                return _.merge(payload, {
                    "@type": type,
                    id: id,
                    tabId: $scope.tabId,
                    instanceId: cc.instanceGUID,
                    userId: User.getCurrent().id
                });
            }

            var disableEmit = false;
            function suppressEmit(fn){
                disableEmit = true;
                fn();
                disableEmit = false;
            }
            function emit(type, payload, $scope){
                if(disableEmit){
                    return {};
                }
                let deferred = $q.defer();
                var e = event(type, payload, deferred, $scope);
                WSocket.send('/user/event', e);
                return _.assign(deferred.promise, {id: e.id});
                // todo implement resolving
            }

            return {
                suppressEmit,
                emit
            };
        }]);
});

