define(['./module', 'lodash', 'common'], function(module, _, cc) {
    module.service('BookmarkEventService', ['$http', '$rootScope', '$timeout', 'WSocket', '$q',
        function ($http, $rootScope, $timeout, WSocket, $q) {

            let eventCallbacks = {};

            function isEmbed($scope){
                return !!$scope.embed;
            }

            function event(type, payload, promise, $scope){
                var id = cc.randomGUID();
                if(promise){
                    eventCallbacks[id] = promise;
                }
                const eventData = {
                    "@type": type,
                    id,
                    tabId: $scope.tabId,
                    stateId: $scope.bookmarkStateId.stateId,
                    instanceId: cc.instanceGUID
                };
                return _.merge(payload, eventData);
            }

            var disableEmit = false;
            function suppressEmit(fn){
                disableEmit = true;
                fn();
                disableEmit = false;
            }

            function emit(type, payload, $scope, beforeSend){
                if(isEmbed($scope) || disableEmit){
                    return {}; // do not emit events for embedded items
                }
                let deferred = $q.defer();
                var e = event(type, payload, deferred, $scope);
                if(beforeSend) {
                    beforeSend(e.id);
                }
                $scope.tabsSection.options.activeTab.canUndo = true;
                $scope.tabsSection.options.activeTab.canRedo = false;
                $scope.tabsSection.options.activeTab.lastChangeEvent = e;
                WSocket.send('/vis/event', e);
                return _.assign(deferred.promise, {id: e.id});
            }

            function subscribeToTabEvents(tab, $scope){
                return WSocket.subscribe(`/vis/event-response/${tab.id}/${tab.currentState}` , function(e) {
                    switch (e.type) {
                        case 'TAB_STATE_CHANGED':
                            $scope.$apply(function () {
                                if(e.instanceId && e.instanceId != cc.instanceGUID) {
                                    switch(e["@type"]) {
                                        case '.PageModeChangeEvent':
                                            let pageMode = e.pageMode;
                                            $scope.pageMode = tab.state.pageMode = pageMode;
                                            $scope.tabsSection.refreshActiveTab(true);
                                            return;
                                    }
                                }
                            });
                            break;
                    }
                    let promise = eventCallbacks[e.id];
                    if(promise){
                        delete eventCallbacks[e.id];
                        promise.resolve(e);
                    }
                });
            }

            return {
                suppressEmit,
                emit,
                subscribeToTabEvents
            };
        }]);
});

