define(['./module', 'lodash'], function (directives, _) {
    'use strict';
    directives.directive('searchBar', ['$state', 'SearchBarService', '$rootScope', 'SourceService',
        function ($state, SearchBarService, $rootScope, SourceService) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/app/search-bar.html',
            transclude: {
                'dropdownOptions': '?dropdownOptions'
            },
            link: function ($scope, $elm) {

                $scope.searchInput = { keepClosed: false };
                $scope.currentSuggestions = {};
                $scope.previousSearch = null;

                $scope.$on('update-ingesting-value', function (e, source) {
                    if (source) {
                        const suggestion = _.find(_.get($scope.currentSuggestions, '$$state.value'), {id: source.id});
                        if (suggestion) {
                            suggestion.ingestingProgress = source.ingestingProgress;
                        }
                    }
                });

                $scope.isLandingPage = function() {
                    return !!~$state.current.name.indexOf('landing');
                };

                $scope.isVisualization = function() {
                    return !!~$state.current.name.indexOf('visualize');
                };

                SearchBarService.resetSearch = function(search){
                    $scope.searchInput.value = search;
                    $scope.searchInputChange($scope.searchInput.value);
                };

                SearchBarService.setSearch = function(search){
                    $scope.previousSearch = search;
                    $scope.searchInput.value = search;
                };

                $scope.searchInputChange = function (val, force) {
                    if((val !== null && val !== undefined && val !== '') || $scope.previousSearch) {
                        if (SearchBarService.callback) {
                            const callbackResult = SearchBarService.callback(val, force);
                            if(callbackResult !== -1) {
                                $scope.previousSearch = val;
                            }
                        }
                        $scope.searchInput.noSearchResults = false;
                    }
                };

                $scope.getSuggestions = function(val){
                    const suggestions = SearchBarService.suggestions ? SearchBarService.suggestions(val) : [];

                    suggestions.then((result) => {
                        _.each(result, file => {
                            const loadedFile = SourceService.get(file.id);
                            file.ingestingProgress = _.get(loadedFile, 'ingestingProgress');
                        });
                    });

                    $scope.currentSuggestions = suggestions;
                    return suggestions;
                };

                $scope.onSuggestionSelected = function($item, $model, $label, $event){
                    if(SearchBarService.suggestionSelected){
                        $event.stopPropagation();
                        SearchBarService.suggestionSelected($item, $model, $label, $event);
                    }
                };

                function _searchInputChange (val, force){
                    $scope.$apply(() => $scope.searchInputChange(val, force));
                }

                $scope.delayedSearchInputChange = _.debounce(_searchInputChange, 600);

            }
        }
    }]);
});
