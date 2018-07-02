define(['./module', 'moment', 'lodash', 'common', 'angular'], function (directives, moment, _, cc, angular) {
    directives.directive('vizFilters', ['DataLoadingService', 'AvailableFixedDates', 'BookmarkEventService', 'FilterService',
    function(DataLoadingService, AvailableFixedDates, BookmarkEventService, FilterService) {
        var ctrlNames = cc.getCtrlNames();
        return {
            restrict: 'A',
            templateUrl: 'static/templates/include/viz-directives/viz-filters.html',
            compile: function compile(el, attrs) {
                if(attrs.ctrlName === ctrlNames.EMBED) {
                    el.find('.sidebar-filters').removeAttr('sv-root');
                    el.find('.sidebar-filters').removeAttr('sv-part');
                    el.find('.filters-list').removeAttr('sv-element');
                    el.find('.sbar-title-ico').removeAttr('sv-handle');
                    el.find('.sbar-title-name').removeAttr('sv-handle');
                    el.find('.filter-dropdown-header').removeAttr('uib-dropdown');
                    el.find('.filter-dropdown-header').removeAttr('uib-dropdown-toggle');
                }
                return {
                    pre: function($scope, $el, $attrs){
                        $scope.filterId = $attrs.filterId;
                        $scope.savePaneWidth = 'true' === $attrs.saveWidth;
                        $scope.hideOnInit = 'true' === $attrs.hideOnInit;
                    }
                }
            },
            controller: ['$scope', '$q', '$http', '$timeout', '$uibModal', '$rootScope', function($scope, $q, $http, $timeout, $uibModal, $rootScope) {
                $scope.ctrlNames = ctrlNames;

                // don't ask me why
                $scope.onRenderFilters = _.debounce(function(){
                    $rootScope.$broadcast('reCalcViewDimensions');
                }, 100);

                $scope.getModeSwitchTooltip = function(filter){
                    switch(filter.col.type){
                        case 'DATE':
                            return filter.listMode ? 'Switch to date' : 'Switch to list';
                        case 'DECIMAL':
                            return filter.listMode ? 'Switch to slider' : 'Switch to list';
                    }
                };

                $scope.open1 = function(){
                    $scope.popup1.opened = true;
                };

                $scope.linterMessage;
                function linterHandler(message, obj, cm) {
                    if ($scope.linterMessage) {

                        var cursor = {
                                line: $scope.linterMessage.line - 1,
                                ch: $scope.linterMessage.column
                            },
                            line = cm.getLine(cursor.line),
                            start = cursor.ch, end = cursor.ch;

                        // line where spaces inside quotes replaced on underscore
                        var tempLine = spaceReplacer(line);

                        while (start > 0 && tempLine[start - 1] && !tempLine[start - 1].match(/[\t\n "']/)) --start;
                        while (end < tempLine.length && !tempLine[end].match(/[\t\n "']/)) ++end;

                        var word = line.slice(start, end);


                        console.groupCollapsed("Linter applied: %c%s", "color: darkgreen;", word);
                        console.log("start: %c", "color: blue;", start);
                        console.log("end: %c", "color: blue;", end);
                        console.groupEnd();

                        var obj = {
                            from: { line:cursor.line, ch: start },
                            to: { line:cursor.line, ch: end },
                            message: $scope.linterMessage.message
                        };
                        $scope.linterMessage = null;

                        return [obj];
                    }
                    return [];
                };

                $scope.complexFilterEditorOptions = {
                    autoRefresh: { delay: 100 },
                    lineWrapping: true,
                    lineNumbers: true,
                    extraKeys: {
                        "Ctrl-Space": "autocomplete",
                        "Ctrl-Enter": executeQuery
                    },
                    onLoad: function (cm) {
                        $scope.cmInstance = cm;
                        $scope.cmInstance.focus();
                        cm.on("change", function(cm) {
                            $scope.dataSummary.advancedFilterQuery = cm.getValue();
                            BookmarkEventService.emit('.AdvancedFilterQueryChangeEvent',
                                {query: cm.getValue()}, $scope);
                        });
                    },
                    mode: 'text/bnf',
                    hintOptions: { hint: autocomplete },
                    lint: linterHandler,
                    gutters: ["CodeMirror-lint-markers"]
                };

                function executeQuery() {
                    DataLoadingService.setDatasource($scope)
                }

                $scope.executeQuery = executeQuery;

                function spaceReplacer (str) {
                    var reg = /(["'].*?["'])/;
                    var arr = str.split(reg);
                    for (var i = 0; i < arr.length; ++i) {
                        if (arr[i].match(reg)) {
                            arr[i] = arr[i].replace(/ /g, '_');
                        }
                    }
                    return arr.join('');
                }

                var lastResData;
                function autocomplete(cm, option) {
                    return new Promise(function(accept) {
                        var cursor = cm.getCursor(),
                            line = cm.getLine(cursor.line),
                            start = cursor.ch, end = cursor.ch;

                        // line where spaces inside quotes replaced on underscore
                        var tempLine = spaceReplacer(line);
                        while (start > 0 && !tempLine[start - 1].match(/[\t\n ]/)) --start;
                        var word = line.slice(start, end).toLowerCase();
                        // console.log(word, start, end);
                        var opt = {
                            list: [],
                            from: CodeMirror.Pos(cursor.line, start),
                            to: CodeMirror.Pos(cursor.line, end)
                        };
                        // is wrote or first hint request
                        if (cm.state.completionActive.widget) {
                            opt.list = _.filter(lastResData, function (el) {
                                return el.toLowerCase().indexOf(word) !== -1;
                            });
                            return accept(opt);
                        } else {
                            $http.post('/api/visualization/autocomplete', {
                                bookmarkStateId: $scope.bookmarkStateId,
                                query: $scope.dataSummary.advancedFilterQuery,
                                cursor: cm.doc.getRange({line: 0, ch: 0}, cursor).length
                            }).then(function (result) {
                                // console.log('autocomplete return: ', result.data);
                                lastResData = opt.list = result.data;
                                return accept(opt);
                            });
                        }
                    });
                }

                function resetComplexQuery() {
                    $scope.dataSummary.advancedFilterQuery = null;
                }

                function setAdvancedModeCheck(value) {
                    $scope.dataSummary.advancedModeCheck = value;
                    BookmarkEventService.emit('.AdvancedFiltersQueryModeToggleEvent', {advancedMode: value}, $scope);
                }

                $scope.setAdvancedModeCheck = function (value) {

                    // basic mode to advanced
                    if (value) {
                        $http.post('/api/visualization/from-filters', {
                            bookmarkStateId: $scope.bookmarkStateId
                        }).then(function (result) {
                            $scope.dataSummary.advancedFilterQuery = result.data.advancedFiltersQuery;
                            setAdvancedModeCheck(value);
                        });
                    }
                    // advanced mode to basic
                    else {

                        $http.post('/api/visualization/to-filters', {
                            tableBookmarkId: $scope.tabId,
                            query: $scope.dataSummary.advancedFilterQuery
                        }).then(function (result) {
                            var filters = JSON.parse(result.data.filters);
                            DataLoadingService.updateFilters(filters, $scope);
                            setAdvancedModeCheck(value);
                            resetComplexQuery();
                        }, function (err) {
                            $scope.errorConvertFiltersModal = $uibModal.open({
                                templateUrl: 'static/templates/include/error-convert-filters.html',
                                scope: $scope,
                                animation: true,
                                size: 'md'
                            });

                            $scope.cancelConvertToFilters = function(){
                                $scope.errorConvertFiltersModal.dismiss();
                            };

                            $scope.resetConvertToFilters = function(){
                                $scope.resetAllFilters();
                                $scope.errorConvertFiltersModal.dismiss();
                                setAdvancedModeCheck(value);
                                resetComplexQuery();
                                DataLoadingService.setDatasource($scope)
                            };
                        });
                    }
                };

                $scope.isResetShow = cc.isResetShow;

                $scope.filterMoved = function(filter, toPosition){
                    BookmarkEventService.emit(".filter.FilterMoveEvent", {field: filter.field, toPosition: toPosition}, $scope);
                };

                $scope.addFilter = function (filter) {
                    filter.selected = !filter.selected;
                    var eventId = BookmarkEventService.emit(".filter.FilterToggleEvent", {field: filter.field, selected: filter.selected}, $scope).id;
                    if(filter.selected) {
                        DataLoadingService.startRefreshFilters(eventId, [filter], $scope);
                    }
                };

                $scope.resetAllFilters = function () {
                    _.each($scope.dataSummary.filters, function(filter){
                        $scope.resetOneFilter(filter);
                    });
                    DataLoadingService.clearAllFilters($scope);
                };

                // header actions
                $scope.isResetAllShow = function () {
                    return _.some($scope.dataSummary.filters, $scope.isResetShow);
                };

                $scope.switchLinLog = FilterService.switchLinLog;

                $scope.switchStringView = function (filter) {
                    // check is there need to update all filters
                    const isRequest = $scope.isResetShow(filter);

                    // update all filters or just one
                    if (isRequest) {
                        $scope.searching();
                    } else {
                        if($scope.controllerName !== ctrlNames.EMBED) $scope.saveFiltersState();
                    }
                };

                // for string filters
                $scope.switchAndOr = function (filter) {
                    filter.and_or = !filter.and_or;
                    var selectedList = _.filter(filter.list, function(el) { return el.selected || !el.show; });
                    if (selectedList.length >= 2) {
                        DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                    } else {
                        BookmarkEventService.emit(".filter.FilterChangeEvent", {filter: filter}, $scope);
                    }
                };

                $scope.hideNullValues = function (filter) {
                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.filterSearch = function (filter, force) {
                    if($scope.autoRefresh || force) {
                        DataLoadingService.filterSearch(filter, $scope);
                    }
                };

                $scope.delayedFilterSearch = _.debounce($scope.filterSearch, 600);

                $scope.clearSearch = function (filter) {
                    filter.search = '';
                    DataLoadingService.filterSearch(filter, $scope);
                };

                $scope.showNoResults = function (filter) {
                    return filter.search && filter.list.length === 0;
                };

                $scope.showNoValues = function (filter) {
                    return !filter.searching && !filter.search && filter.list.length === 0;
                };

                $scope.selectFilter = function (agg, filter) {
                    agg.selected = !agg.selected;
                    agg.show = true;
                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.isAllFiltersSelected = function () {
                    return _.every($scope.dataSummary.filters, function(s){ return s.selected; });
                };

                $scope.toggleSelectAllFilters = function () {
                    const value = !$scope.isAllFiltersSelected();
                    $scope.dataSummary.filters.forEach(function (el) {el.selected = value;});
                    BookmarkEventService.emit(".filter.FilterToggleAllEvent",  {selected: value}, $scope, (eventId) => {
                        if(value) {
                            DataLoadingService.startRefreshFilters(eventId, $scope.dataSummary.filters, $scope);
                        }
                    });
                };

                // for all filters
                $scope.only = function (filter, agg) {
                    agg.show = true;
                    _.forEach(filter.list, function (v) {
                        v.selected = v === agg;
                    });
                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.remove = function (filter, agg) {
                    agg.selected = false;
                    agg.show = false;
                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.blurSliderInput = function (filter) {
                    if (filter.value2 < filter.value1) {
                        filter.value2 = [filter.value1, filter.value1 = filter.value2][0]
                    }
                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.changeSliderInput = function (filter) {
                    if (!filter.linlog) {
                        filter.value1exp = Math.log(filter.value1);
                        filter.value2exp = Math.log(filter.value2);
                    }
                };

                $scope.keyPressSliderInput = function (event) {
                    if (event.which === 13) {
                        event.target.blur();
                    }
                };

                function isValidTS(ts) {
                    return !isNaN(Date.parse(ts));
                }

                $scope.selectText = (e) => {
                    if (!e.target)
                        return;

                    e.target.select();
                };

                $scope.changeDateInput = function (filter, clearFixed) {
                    if (!isValidTS(filter.options.fromDate)) {
                        filter.options.fromDate = new Date(filter.value1); // revert fromDate value
                        throw new Error("Invalid 'fromDate' value for the filter");
                    }

                    if(!isValidTS(filter.options.toDate)) {
                        filter.options.toDate = new Date(filter.value2); // revert toDate value
                        throw new Error("Invalid 'toDate' value for the filter");
                    }

                    const from = moment(filter.options.fromDate);
                    const to = moment(filter.options.toDate);

                    const isNeedToSwap = from.isAfter(to) || to.isBefore(from);

                    if(isNeedToSwap) {
                        filter.value1 = to.valueOf();
                        filter.value2 = from.valueOf();
                    } else {
                        filter.value1 = from.valueOf();
                        filter.value2 = to.valueOf();
                    }

                    if (filter.options.period && clearFixed) {
                        delete filter.options.period;
                        delete filter.fixedDate;
                        filter.isFixedDateEnabled = false;
                    }

                    // To reformat to the default format:
                    filter.options.fromDate = new Date(filter.value1);
                    filter.options.toDate = new Date(filter.value2);
                    // Model reapplied

                    DataLoadingService.makeRequestRefreshFilters(filter, $scope);
                };

                $scope.changeTimeInput = (filter) => {
                    let { fromDate, toDate, displayFromTime, displayToTime } = filter.options;

                    const formats = ["h:mm a", "h:mma", "ha", "h"]; // valid input formats
                    let fromTime = moment(displayFromTime, formats, true);
                    let toTime = moment(displayToTime, formats, true);

                    // Validation
                    if (!fromTime.isValid()) {
                        filter.options.displayFromTime = moment(fromDate).format("h:mm a");
                        throw new Error("Invalid 'from time' value for the filter");
                    }
                    if(!toTime.isValid()) {
                        filter.options.displayToTime = moment(toDate).format("h:mm a");
                        throw new Error("Invalid 'to time' value for the filter");
                    }

                    // If only hours were sent to the input, set time to "pm" by default
                    if (fromTime.creationData().format === "h" && fromTime.format('a') === "am") {
                        fromTime.add(12, "hours");
                    }
                    if (toTime.creationData().format === "h" && toTime.format('a') === "am") {
                        toTime.add(12, "hours");
                    }

                    // Convert dates to moment objects
                    fromDate = moment(fromDate);
                    toDate = moment(toDate);

                    // Assign time to dates
                    fromDate.set({
                        hours: fromTime.hours(),
                        minutes: fromTime.minutes()
                    });
                    toDate.set({
                        hours: toTime.hours(),
                        minutes: toTime.minutes()
                    });

                    // Reset the calculated values in the filter
                    filter.options.fromDate = fromDate.toDate();
                    filter.options.toDate = toDate.toDate();

                    filter.options.displayFromTime = moment(fromDate).format("h:mm a");
                    filter.options.displayToTime = moment(toDate).format("h:mm a");

                    $scope.changeDateInput(filter, true);
                };

                $scope.toggleFixedDateFilter = (e, f) => {
                    f.isFixedDateEnabled = !f.isFixedDateEnabled;

                    if(f.isFixedDateEnabled) {
                        $timeout(() => { f.options.isFixedDateDropdownOpened = true; });
                    }
                };

                $scope.getAvailableFixedPeriods = function (){
                    return AvailableFixedDates.allAvailableFixedDates;
                };

                $scope.getSelectedFixedPeriod = (filter) => {
                    const availableFixedDates = $scope.getAvailableFixedPeriods();
                    const noValueMessage = "Select Date";

                    if (!availableFixedDates || !filter)
                        return noValueMessage;

                    let selectedFixedPeriod = _.find(availableFixedDates, period => period.type === filter.fixedDate);

                    if (!selectedFixedPeriod)
                        return noValueMessage;

                    return selectedFixedPeriod.label;
                };

                $scope.selectFixedDateFilter = (filter, period) => {
                    const isResetFilter = period
                        && period.type === "reset_filter";

                    if (isResetFilter) {
                        $scope.resetOneFilter(filter);
                        $scope.changeDateInput(filter, true);
                        return;
                    }

                    filter.options.period = period;
                    filter.fixedDate = period.type;
                    filter.options.fromDate = period.value1;
                    filter.options.toDate = period.value2;
                    filter.options.displayFromTime = moment(period.value1).local().format("h:mm a");
                    filter.options.displayToTime = moment(period.value2).local().format("h:mm a");
                    $scope.changeDateInput(filter, false);
                };

                $scope.getCalendarFormat = function (filter) {
                    if(!filter) return;
                    var start = moment(filter.value1);
                    var end = moment(filter.value2);

                    var someMonth = start.isSame(end, 'month');
                    var edgeWeek = start.isSame(end, 'isoweek') && start.day() === 1 && end.day() === 0;
                    var edgesMonth = start.date() === 1 && end.date() === moment(end).endOf('month').date();

                    if (start.isSame(end, 'day')) {
                        return "Day: " + end.format("MMM D, YYYY");
                    } else if (edgeWeek && !someMonth) { // from monday to sunday different months
                        return "Week: " + start.format("MMM D") + " - " + end.format("MMM D, YYYY");
                    } else if (edgeWeek) { // from monday to sunday
                        return "Week: " + start.format("MMM D") + " - " + end.format("D, YYYY");
                    } else if (someMonth && edgesMonth) {
                        return "Month: " + end.format("MMMM YYYY");
                    } else if (someMonth) {
                        return start.format("MMM D") + " - " + end.format("D, YYYY");
                    } else if (start.month() === 0 && end.month() === 2 && edgesMonth) {
                        return "Q1: " + start.format("MMM") + " - " + end.format("MMM YYYY");
                    } else if (start.month() === 3 && end.month() === 5 && edgesMonth) {
                        return "Q2: " + start.format("MMM") + " - " + end.format("MMM YYYY");
                    } else if (start.month() === 6 && end.month() === 8 && edgesMonth) {
                        return "Q3: " + start.format("MMM") + " - " + end.format("MMM YYYY");
                    } else if (start.month() === 9 && end.month() === 11 && edgesMonth) {
                        return "Q4: " + start.format("MMM") + " - " + end.format("MMM YYYY");
                    } else if (start.dayOfYear() === 1 && end.date() === 31 && end.month() === 11) {
                        return "Year: " + end.format("YYYY");
                    } else if (start.isSame(end, 'year')) {
                        return start.format("MMM D") + " - " + end.format("MMM D, YYYY");
                    }
                    return start.format("MMM D, YYYY") + " - " + end.format("MMM D, YYYY");
                };

                $scope.isFilterActive = FilterService.isFilterActive;
                $scope.getSelectedFilters = FilterService.getSelectedFilters;
                $scope.resetFilterInRow = FilterService.resetFilterInRow.bind(null, $scope);
                $scope.resetOneFilter = FilterService.resetOneFilter;
                // for range and daterange filters
                $scope.reset = FilterService.reset.bind(null, $scope);


                $scope.getFilterFromFieldKey = function(key) {
                    var colDef = _.find($scope.gridOptions.columnDefs, {field: key});
                    if(colDef){
                        return colDef.customFilter;
                    }
                };

                $scope.getDateFilterForChart = function () {
                    $scope.chartDatepicker = true;
                    // select first filter if there are no selected daterange filter in Xaxis
                    return $scope.customDateChartFilter ||
                        _.find($scope.dataSummary.filters, $scope.vizSummary.xAxisShows.length &&
                        $scope.vizSummary.xAxisShows[0].type === 'daterange'
                            ? {name: $scope.vizSummary.xAxisShows[0].field}
                            : {type: 'daterange'});
                };

                $scope.datePickerInterval = function (agg, op) {
                    var promise, deferred;
                    if (!$scope.getDateFilterForChart()) {
                        var filterColumn = _.find($scope.filterList, {type: 'daterange'});
                        promise = $scope.addFilter(filterColumn);
                    } else {
                        deferred = $q.defer();
                        promise = deferred.promise;
                    }

                    promise.then(function() {
                        if(agg.type !== 'daterange') {
                            // agg = _.find($scope.getDateFilterAvalilableValues(), function(v) {
                            //     return $scope.humanize(v.name) == $scope.humanize($scope.getDateFilterForChart().name);
                            // })
                        }
                        var newAgg = _.find($scope.groupByList, {key: op.val + "_" + agg.field});
                        if (newAgg && newAgg.key !== agg.key) {
                            var index = _.indexOf($scope.dataSummary.aggs, _.find($scope.dataSummary.aggs, {key: agg.key}));
                            if (index >= 0) {
                                $scope.dataSummary.aggs.splice(index, 1, newAgg);
                            } else {
                                $scope.dataSummary.aggs.push(newAgg);
                                if ($scope.dataSummary.aggs.length === 1) {
                                    $scope.dataSummary.shows = [];
                                }
                                $timeout(function () {
                                    if ($scope.dataSummary.aggs.length === 1) {
                                        _.forEach(_.filter($scope.showMeList, function(v) {
                                            if($scope.controllerName === 'visualizationCtrl') return v.op.val === 'sum';
                                            else return v.op.val === 'sum' && _.find($scope.vizSummary.yAxisShows, {field: v.field});
                                        }), function(v) {
                                            // $scope.showMeOnSelect(v, true);
                                        });

                                        // $scope.vizSummary.yAxisShows = $scope.getYAxisAvailableValues();
                                    }
                                })
                            }
                            delete $scope.dataSummary.filter;
                            $scope.xAxisShowMeOnSelect(newAgg);
                            $scope.saveColumnDefs();
                            if ($scope.isSummary()) $scope.searching();
                        }
                    });

                    if (deferred) {
                        deferred.resolve();
                    }
                };

                $scope.svOnStopFilterList = function (part) {
                    $timeout(function () {
                        var tempFilters = _.cloneDeep($scope.dataSummary.filters);
                        $scope.dataSummary.filters = [];

                        _.forEach(part, function (v) {
                            if (v.selected) $scope.dataSummary.filters.push(_.find(tempFilters, {name: v.name}));
                        });
                    });
                };

                $scope.clearDatePickerInterval = function() {
                    // if($scope.vizSummary.xAxisShows[0].type == 'daterange') {
                    //     $scope.removeAllGroupBy();
                    // }
                };
            }]
        }
    }])
});
