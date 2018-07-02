define(['./module', 'lodash', 'KeyJS'],
function (controllers, _, KeyJS) {
    'use strict';

    controllers.directive('limitSettingsDropdown', ['DataLoadingService', 'EventNames', 'Constants', 'BookmarkEventService',
        function (DataLoadingService, EventNames, Constants, BookmarkEventService) {
            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/limit-settings-dropdown.html',
                link: function ($scope, $el, $attr) {

                    $scope.$on('refresh-limit-settings-dropdown', function() {
                        $scope.limitSettingsDropdown = (function() {
                            var limitChoices = (function(){
                                var pivotData = [5, 10, 25, 50, 100];
                                var aggData = [5, 10, 25, 50, 100, 250, 500, 1000];
                                var pageSize = [50, 100, 250, 500, 1000];
                                var rawData = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
                                return {
                                    pivotData: pivotData,
                                    aggData: aggData,
                                    pageSize: pageSize,
                                    rawData: rawData
                                }
                            })();

                            var itemTitles = {
                                rawData: 'Raw Data:',
                                pageSize: 'Page size:',
                                aggData: 'Drill into rows:',
                                pivotData: 'Pivot columns:'
                            };


                            var items = _.map(_.omit($scope.dataSummary.limit, ['rawDataExport']), getItem);

                            function getItem(limit, key) {
                                return {
                                    title: itemTitles[key],
                                    key: key,
                                    limit: limit,
                                    isOpen: false
                                }
                            }

                            return {
                                choices: limitChoices,
                                items: items,
                                toggleChoicesDropdown: function($event, item, value) {
                                    $event.preventDefault();
                                    $event.stopPropagation();

                                    item.isOpen = value;
                                }
                            }
                        })();
                    });

                    function getAggChangeLimitEventName(item) {
                        if (_.indexOf($scope.dataSummary.pivot, item) !== -1) {
                            return EventNames.CHANGE_LIMIT_EVENT.PIVOT;
                        } else {
                            return EventNames.CHANGE_LIMIT_EVENT.AGGS;
                        }
                    }

                    function clearLimitsInModel(model) {
                        _.forEach(model, function (agg) {
                            if (agg.id.settings.limit !== null) {
                                $scope.changeAggLimit(agg, null);
                            }
                        });
                    }

                    $scope.onLimitModelChanged = function(item) {
                        function checkMinMax(item, min, max) {
                            if(item.limit > max) {
                                item.limit = max;
                            } else if (typeof item.limit == 'undefined' || item.limit < min) {
                                item.limit = min;
                            }
                        }

                        switch(item.key) {
                            case 'rawData':
                                checkMinMax(item, 0, 10000);
                                break;
                            case 'pageSize':
                                checkMinMax(item, Constants.MIN_PAGE_SIZE, 1000);
                                break;
                            case 'aggData':
                                checkMinMax(item, 0, 1000);
                                break;
                            case 'pivotData':
                                checkMinMax(item, 0, 100);
                                break;
                        }
                    };

                    $scope.onKeyDownLimitInput = function(event, item) {
                        switch (event.which) {
                            case KeyJS.ENTER:
                            case KeyJS.ESC:
                            case KeyJS.TAB:
                                event.target.blur(item);
                                $scope.limitSettingsDropdown.toggleChoicesDropdown(event, item, false);
                        }
                    };

                    $scope.changeAggLimit = function(item, limit, refresh) {
                        item.id.settings.limit = limit;
                        BookmarkEventService.emit(getAggChangeLimitEventName(item), {key: item.id}, $scope);
                        if (refresh) {
                            DataLoadingService.setDatasource($scope);
                        }
                    };

                    function updateLimit(dataType, limit) {
                        $scope.dataSummary.limit[dataType] = limit;

                        if(dataType == 'rawData') {
                            BookmarkEventService.emit(".limit.LimitRawDataChangedEvent", {tabId: $scope.tabId, limit: limit}, $scope);
                            if($scope.isRawData($scope)) {
                                DataLoadingService.setDatasource($scope);
                            }
                        } else if(dataType == 'pageSize') {
                            BookmarkEventService.emit(".limit.LimitPageSizeChangedEvent", {tabId: $scope.tabId, limit: limit}, $scope);
                            $scope.gridOptions.paginationPageSize = limit;
                            if($scope.isRawData($scope)) {
                                DataLoadingService.setDatasource($scope);
                            }
                        } else if(dataType == 'aggData') {
                            BookmarkEventService.emit(".limit.LimitAggDataChangeEvent", {tabId: $scope.tabId, limit: limit}, $scope);
                            clearLimitsInModel($scope.dataSummary.aggs);

                            if($scope.dataSummary.aggs.length) DataLoadingService.setDatasource($scope);
                        } else if(dataType == 'pivotData') {
                            BookmarkEventService.emit(".limit.LimitPivotDataChangeEvent", {tabId: $scope.tabId, limit: limit}, $scope);
                            clearLimitsInModel($scope.dataSummary.pivot);

                            if($scope.dataSummary.pivot.length) DataLoadingService.setDatasource($scope);
                        }
                    }

                    $scope.onLimitChoiceSelect = function(choice, item) {
                        if (choice != item.limit) {
                            item.limit = choice;
                            updateLimit(item.key, item.limit);
                        }
                    };

                    $scope.onLimitBlur = function(item) {
                        if(!item.limit) {
                            item.limit = 100;
                        }

                        if (item.limit != $scope.dataSummary.limit[item.key]) {
                            updateLimit(item.key, item.limit);
                        }
                    };

                }
            }
        }])
});