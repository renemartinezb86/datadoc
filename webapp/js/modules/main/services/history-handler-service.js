define(['./module', 'common', 'lodash', 'angular'], function(module, cc, _, angular) {
    module.service('HistoryHandlerService', ['DataLoadingService', function (DataLoadingService) {

        function HistoryHandler($scope) {

            var ChangeEventNames = {
                CompositeState: '.BookmarkVizCompositeStateChangeEvent',
                RowsHeight: '.rows.RowsHeightChangeEvent',
                DefaultRowHeight: '.rows.DefaultRowHeightChangeEvent',
                RowsCollapsedState: '.rows.RowsCollapsedStateChangeEvent',
                PivotCollapsedState: '.pivot_collapsed_state.PivotCollapsedStateAddEvent',
                ShowTotals: '.show_totals.ShowTotalsChangeEvent',
                AggChangeShowTotal: '.aggs.AggChangeShowTotalEvent',
                PivotChangeShowTotalEvent: '.pivot.PivotChangeShowTotalEvent',
                ShowResizeEvent: '.shows.ShowResizeEvent'
            };


            function rowsChange(rowsHeight, historyType) {
                if ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length) {
                    $scope.dataSummary.rowsHeight = rowsHeight;

                    $scope.gridOptions.api.refreshInMemoryRowModel();
                } else {
                    var virtualPageRowModel = $scope.gridOptions.api.virtualPageRowModel;
                    var model;

                    if (historyType == 'undo') {
                        model = $scope.dataSummary.rowsHeight;
                    } else {
                        model = rowsHeight;
                    }

                    _.forEach(model, function(value, rowIndex) {
                        var row = virtualPageRowModel.getRow(+rowIndex);
                        row.rowHeight = rowsHeight[rowIndex] || DataLoadingService.DEFAULT_ROW_HEIGHT;
                    });

                    $scope.dataSummary.rowsHeight = rowsHeight;

                    virtualPageRowModel.virtualPageCache.updateAllRowTopFromIndexes();
                    $scope.gridOptions.api.refreshView();
                }

                $scope.gridOptions.api.rangeController.refreshBorders();
            }

            function defaultRowHeightChange(defaultRowHeight) {
                $scope.dataSummary.rowsHeight = {};
                $scope.dataSummary.defaultRowHeight = defaultRowHeight;

                if ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length) {
                    $scope.gridOptions.api.refreshInMemoryRowModel();
                } else {
                    var virtualPageRowModel = $scope.gridOptions.api.virtualPageRowModel;
                    var virtualPageCache = virtualPageRowModel.virtualPageCache;
                    var rowCount = virtualPageRowModel.virtualPageCache.getRowCount();
                    var rowsIndexesArray = _.range(rowCount);

                    virtualPageCache.updateHeightForIndexes(rowsIndexesArray, defaultRowHeight);

                    $scope.gridOptions.api.refreshView();
                }

                $scope.gridOptions.api.rangeController.refreshBorders();
            }

            function rowsCollapsedChange(rowsCollapsedState) {
                $scope.dataSummary.rowsCollapsedState = rowsCollapsedState;
                DataLoadingService.refreshRows($scope);

                // todo refresh borders
            }

            function pivotCollapsedChange(pivotCollapsedState) {
                $scope.dataSummary.pivotCollapsedState = pivotCollapsedState;
                DataLoadingService.updateShowTotals($scope);
            }

            function showTotalsInRawModeChange(showTotalsValue) {
                $scope.dataSummary.showTotals = showTotalsValue;
                DataLoadingService.toggleTotals($scope);
            }

            function aggShowTotalChange(id, historyType) {
                var agg = _.find($scope.getShowTotalsArray(), {id:{field: id.field}});

                var showTotalsValue;
                if (historyType == 'undo') {
                    showTotalsValue = !id.settings.showTotal;
                } else {
                    showTotalsValue = id.settings.showTotal;
                }

                agg.id.settings.showTotal = showTotalsValue;
                DataLoadingService.updateShowTotals($scope);
            }

            function showTotalAllChange(id, historyType) {
                var showTotalsArray = $scope.getShowTotalsArray();

                var showTotalsValue;
                if (historyType == 'undo') {
                    showTotalsValue = !id.settings.showTotal;
                } else {
                    showTotalsValue = id.settings.showTotal;
                }

                _.forEach(showTotalsArray, function(item){
                    item.id.settings.showTotal = showTotalsValue;
                });
                DataLoadingService.updateShowTotals($scope);
            }

            function showResizeChange(lastEvent, state, historyType) {
                function getOpFromId(id) {
                    return (id.op ? id.op + '_' : '') + id.field;
                }

                var width;
                var id = lastEvent.key;
                if (historyType == 'undo') {
                    width = _.find(state.queryParams.shows, function(s) {
                        return getOpFromId(s) == getOpFromId(id);
                    }).settings.width;
                } else {
                    width = lastEvent.width;
                }

                var show = _.find($scope.dataSummary.shows, function(s) {
                    return getOpFromId(s.id) == getOpFromId(id);
                });

                show.id.settings.width = width;

                DataLoadingService.recreateColumns($scope, true);
            }

            function historyHandler(tab, data, historyType) {
                var lastEvent;
                if (historyType === 'undo') {
                    lastEvent = tab.lastChangeEvent;
                } else {
                    lastEvent = data.event;
                }

                tab.lastChangeEvent = data.event;
                tab.canUndo = data.canUndo;
                tab.canRedo = data.canRedo;
                tab.state = data.state;

                switch(lastEvent['@type']) {
                    case ChangeEventNames.CompositeState:

                        switch (lastEvent.events[0]['@type']) {
                            case ChangeEventNames.DefaultRowHeight:
                                defaultRowHeightChange(data.state.defaultRowHeight);
                                break;
                            case ChangeEventNames.AggChangeShowTotal:
                            case ChangeEventNames.PivotChangeShowTotalEvent:
                                showTotalAllChange(lastEvent.events[0].key, historyType);
                                break;
                        }
                        break;
                    case ChangeEventNames.RowsHeight:
                        rowsChange(data.state.rowsHeight, historyType);
                        break;
                    case ChangeEventNames.RowsCollapsedState:
                        rowsCollapsedChange(data.state.rowsCollapsedState);
                        break;
                    case ChangeEventNames.PivotCollapsedState:
                        pivotCollapsedChange(data.state.pivotCollapsedState);
                        break;
                    case ChangeEventNames.ShowTotals:
                        showTotalsInRawModeChange(data.state.showTotals);
                        break;
                    case ChangeEventNames.AggChangeShowTotal:
                    case ChangeEventNames.PivotChangeShowTotalEvent:
                        aggShowTotalChange(lastEvent.key, historyType);
                        break;
                    case ChangeEventNames.ShowResizeEvent:
                        showResizeChange(lastEvent, data.state, historyType);
                        break;
                    default:
                        return true;
                }
            }

            return {
                undo: function(tab, data) {
                    return {
                        needRestore: historyHandler(tab, data, 'undo')
                    };
                },
                redo: function(tab, data) {
                    return {
                        needRestore: historyHandler(tab, data, 'redo')
                    };
                }
            }
        }

        return HistoryHandler;
    }]);
});