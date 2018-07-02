define(['./module', 'lodash', /*'chartCommons'*/], function (services, _, /*chartC*/) {
    services.service('GridService', [function () {

        function isVisibleForRow($scope) {
            return ($scope.dataSummary.aggs.length && typeof $scope.dataSummary.aggs[0].box != 'undefined')
                || $scope.dataSummary.search
                || _.some($scope.dataSummary.filters, function (filter) {
                    var result = false;
                    // todo this is a duplicate of viz-filters
                    if(filter.listMode) {
                        result = _.some(filter.list, function (f) {
                            return f.selected || !f.show;
                        });
                    } else {
                        result = filter.value1 != filter.min || filter.value2 != filter.max;
                    }
                    return result
                });
        }

        return {
            isVisibleForRow: isVisibleForRow
        }
    }]);
});