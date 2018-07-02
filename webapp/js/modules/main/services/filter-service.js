define(['./module', 'lodash', 'moment'], function(module, _, moment) {
    module.service('FilterService', ['DataLoadingService', function (DataLoadingService) {

        // todo make impure
        const switchLinLog = function (filter) {
            if (filter.linlog) {
                if (typeof filter.value1exp != 'undefined' && typeof filter.value2exp != 'undefined') {
                    _.forEach(['value1exp', 'value2exp'], function (k) {
                        delete filter[k];
                    });
                    filter.options = _.omit(filter.options, ['step', 'precision']);

                    filter.options.floor = filter.min;
                    filter.options.ceil = filter.max;
                    filter.options.step = filter.type == "range" ? 1 : 0.01;
                    filter.options.precision = filter.type == "range" ? 0 : 10
                }
            } else {
                if (typeof filter.value1exp == 'undefined' && typeof filter.value2exp == 'undefined') {
                    _.assign(filter, {
                        value1exp: (filter.value1 == 0 ? 1e-20 : Math.log(filter.value1)),
                        value2exp: Math.log(filter.value2)
                    });
                    _.assign(filter.options, {
                        floor: (filter.min == 0 ? 1e-20 : Math.log(filter.min)),
                        ceil: Math.log(filter.max),
                        step: 1e-6,
                        precision: 20
                    });
                }
            }
        };

        // todo make impure
        const resetOneFilter = (filter) => {
            var type = filter.col.type;
            switch (type) {
                case 'DECIMAL':
                    if (!filter.linlog) {
                        filter.linlog = true;
                        switchLinLog(filter);
                    } else {
                        filter.value1 = filter.min;
                        filter.value2 = filter.max;
                        filter.changed = false;
                    }
                    break;
                case 'TIME':
                case 'DATE':
                    filter.listMode = false;
                    filter.value1 = filter.min;
                    filter.value2 = filter.max;
                    filter.changed = false;
                    filter.isFixedDateEnabled = false;

                    // To apply default format:
                    filter.options.fromDate = new Date(filter.value1);
                    filter.options.toDate = new Date(filter.value2);
                    filter.options.displayFromTime = moment(filter.options.fromDate).utc().format("h:mm a");
                    filter.options.displayToTime = moment(filter.options.toDate).utc().format("h:mm a");
                    // Model reapplied

                    delete filter.options.period;
                    delete filter.fixedDate;
                    // cc.setChartDatepicker($scope);
                    break;
                case "LOCATION_LAT_LON":
                    delete filter.box;
                    break;
            }
            filter.search = '';
            filter.and_or = false;
            filter.count = 10;
            _.forEach(filter.list, function (agg) {
                agg.selected = false;
                agg.show = true;
            });
        };


        const reset = ($scope, filter) => {
            resetOneFilter(filter);
            DataLoadingService.makeRequestRefreshFilters(filter, $scope);
        };

        const resetFilterInRow = function ($scope, filter, $event) {
            $event.stopPropagation();
            reset($scope, filter);
        };

        const isFilterActive = (filter) => {
            if (filter) {
                if(filter.listMode) {
                    return _.some(filter.list, function (f) {
                        return f.selected || !f.show;
                    });
                } else {
                    return filter.value1 !== filter.min || filter.value2 !== filter.max;
                }
            }
        };


        const getSelectedFilters = (filters) => {
            return _.filter(filters, function (agg) {
                return agg.selected || !agg.show
            });
        };


        return {
            switchLinLog,
            resetFilterInRow,
            resetOneFilter,
            reset,
            isFilterActive,
            getSelectedFilters
        };
    }]);
});