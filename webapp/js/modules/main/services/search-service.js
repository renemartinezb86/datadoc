define(['./module'], function(module) {
    module.factory('SearchService', ['$http', '$q', function ($http, $q) {

        var results = [],
            search = '',
            loadingResults,
            currentOrderBy = null;

        function getPromise(searchText, options = {}){
            loadingResults = true;
            let orderBy = options.sort || currentOrderBy;
            search = searchText;
            if(searchText && !/^\s*$/.test(searchText)) {
                return $http.post('/api/search',
                    {
                        s: searchText,
                        limit: 100,
                        orderBy: orderBy,
                        fetchSections : true,
                        fetchRelatedDatadocs: true
                    })
                    .then((response) => {
                        loadingResults = false;
                        return results = response.data.files;
                    });
            } else results = null;
            return $q.when(function(){
                results = [];
                loadingResults = false;
                return {response: results};
            });
        }

        var state = {
            getList: function(){
                return results;
            },
            getSearchText: function(){
                return search;
            },
            search: function(searchText, options = {}){
                return state.promise = getPromise(searchText, options);
            },
            isLoadingResults: function() {
                return loadingResults;
            }
        };
        return state;
    }]);
});