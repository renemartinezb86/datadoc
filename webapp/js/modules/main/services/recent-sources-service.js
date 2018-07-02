define(['./module', 'lodash'], function(module, _) {
    module.factory('RecentSourcesService', ['$http', '$rootScope', function ($http, $rootScope) {

        var limit = 1;
        var sources = [];

        function getPromise(){
            return $http.post('/api/files/recent_files', {limit: limit})
                .success(function(data){
                    sources = data;
                })
        }

        var state = {
            getList: function(){
                return sources;
            },
            push: function(source){
                sources.unshift(source);
                if(sources.length > limit){
                    return sources.pop();
                }
            },
            upsert: function(source){
                var idx = _.findIndex(sources, {id: source.id});
                if(idx >= 0) {
                    sources.splice(idx, 1, source);
                } else {
                    sources.splice(0, 0, source);
                }
            },
            removeAll: function(ss){
                var ids = _.map(ss, 'id');
                return _.remove(sources, function(o){ return _.includes(ids, o.id)})
            },
            remove: function(source){
                return _.remove(sources, function(i){ return i.id = source.id; })
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