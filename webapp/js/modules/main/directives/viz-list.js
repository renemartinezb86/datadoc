define(['./module'], function (directives) {
    directives.directive('vizList', ['DataLoadingService', function(DataLoadingService) {
        return {
            restrict: 'A',
            templateUrl: 'static/templates/include/viz-directives/viz-list.html',
            controller: ['$scope', function($scope) {
                $scope.listViewShows = new function($scope, count) {
                    if (count == null) {count = 1;}
                    var headerListViewCount = count;
                    return {
                        header: function() {
                            return $scope.dataSummary.shows.slice(0, headerListViewCount);
                        },
                        data: function() {
                            return $scope.dataSummary.shows.slice(headerListViewCount);
                        }
                    }
                }($scope, 1);

                $scope.getListItemSize = function() {
                    var showsSize = $scope.listViewShows.data().length;

                    // content + paddingBottom + borderBottom + marginBottom
                    var headerListItemSize = 21 + 4 + 1 + 20;

                    // showsLength * (content + paddingBottom + paddingTop)
                    var listItemSize = showsSize * (14 + 4 + 4);

                    // paddingTop + paddingBottom + borderBottom
                    var listContainerOffsets = 24 + 14 + 1;

                    return listContainerOffsets + listItemSize + headerListItemSize;
                };

                var loading = false;
                $scope.loadMoreData = function () {
                    if(loading || $scope.resultsList.length >= $scope.totalSize){
                        return;
                    }
                    loading = true;
                    if ($scope.resultsList.length == 0) {
                        $scope.floatingTopRows = [];
                    }
                    return DataLoadingService.loadMoreData($scope, {from: $scope.resultsList.length}, function(data){
                        $scope.resultsList = $scope.resultsList.concat(data);
                        loading = false;
                    });
                };

                // POSSIBLY NEEDED FOR RESTORING LIST VIEW
                //
                // $scope.searching = function() {
                //     return DataLoadingService.setDatasource($scope);
                // };
                //
                // $scope.humanize = function (str) {
                //     if(str) return cc.humanizeString(str);
                // };
                //
                // $scope.isAllowDrillDown = function (intoColumn) {
                //     var filter = _.find($scope.dataSummary.filters, {name: intoColumn.name});
                //     return !_.some($scope.dataSummary.aggs, {key: intoColumn.name})
                //         && !$scope.isFilterActive(filter);
                // };
                //
                // $scope.drillDown = function (byColumn, byValue, intoColumn, isResults, row) {
                //     return DataLoadingService.drillDown(byColumn, byValue, intoColumn, isResults, row, $scope);
                // };
                //
                // $scope.selectFromResultsRemove = function (byColumn, byValue, row, isGraph) {
                //     return DataLoadingService.selectFromResultsRemove(byColumn, byValue, false, row, isGraph, $scope);
                // };
                //
                // $scope.selectFromResults = function (byColumn, byValue, suppressRequest, row, isGraph) {
                //     return DataLoadingService.selectFromResults(byColumn, byValue, suppressRequest, row, isGraph, $scope)
                // };
                //
                // $scope.selectDataSummary = function (row, deleteNull, col, isTopValue) {
                //     DataLoadingService.selectDataSummary(row, $scope, deleteNull, col, isTopValue);
                // };

            }]}
    }]);
});