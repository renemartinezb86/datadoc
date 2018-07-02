define(['./module', 'moment', 'lodash', 'common', /*'chartCommons',*/ 'angular'], function (directives, moment, _, cc, /*chartC,*/ angular) {
    directives.directive('embedWidget', ['$timeout', '$http', '$filter', '$q', 
        'ExportService', '$compile', 'CodesService', '$uibModal', 'DataLoadingService',
        'GridService', '$rootScope', 'EventNames',
        function ($timeout, $http, $filter, $q, ExportService, $compile, CodesService,
                  $uibModal, DataLoadingService, GridService, $rootScope, EventNames) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/embed-widget.html',
            scope: {
                embedSettings: '=settings'
            },
            link: function($scope, $el, $attr) {
                $scope.controllerName = 'embedCtrl';

                // $scope.REGRESSION_TYPE_OPTIONS = chartC.REGRESSION_TYPE_OPTIONS;
                $scope.viewModes = cc.getViewModes();
                $scope.viewMode = $scope.viewModes.TABLE;
                $scope.currentRequest = {};
                $scope.popupData = {is: false};
                $scope.isExportRunning = false;
                $scope.exportPopup = {isopen: false};
                $scope.isShowFilters = false;
                $scope.exportDropdown = ExportService.getExportOptions('table');

                $scope.storage = {};
                $scope.inRequest = false;
                $scope.dataSummary = {
                    shows: [], aggs: [], pivot: [], filters: [], search: '',
                    count: 100, active: true, showAggregationTotal: true,
                    formats: [],
                    limit: {rawData: 100, aggData: 100, pivotData: 100}
                };
                $scope.embed = true;

                $scope.floatingTopRows = [];

                $scope.isRawData = () => DataLoadingService.isRawData($scope);

                $scope.togglePageLoader = function(toggle, backdrop) {
                    $rootScope.$broadcast("togglePageLoader-embed-loader", {toggle: toggle, backdrop: backdrop});
                };

                $scope.togglePageLoaderCancelButton = function(cancelCallback) {
                    $rootScope.$broadcast("togglePageLoaderCancelButton-embed-loader", cancelCallback);
                };

                $scope.togglePageLoader(); // enable loading state

                function applyFilterState(){
                    if($scope.isShowFilters) {
                        $scope.$broadcast('expand-visualization-filters');
                    } else {
                        $scope.$broadcast('collapse-visualization-filters');
                    }
                }

                $scope.resetSearch = function () {
                    if($scope.embedSettings.search) {
                        $scope.dataSummary.search = '';
                        DataLoadingService.search($scope.dataSummary.search, $scope);
                    }
                };

                $scope.searching = function () {
                    DataLoadingService.search($scope.dataSummary.search, true, $scope);
                };

                $scope.isVisibleForRow = function () {
                    return GridService.isVisibleForRow($scope);
                };
                
                $scope.$on('allowViewRawChanged', function(){
                    $scope.gridOptions.api.refreshView();
                });

                $scope.$on('onResize-visualization-filters', function(){
                    $rootScope.$broadcast('rzSliderForceRender');
                    $rootScope.$broadcast('sizeSearchInput');
                    if($scope.viewMode == $scope.viewModes.TABLE) {
                        if ($scope.gridOptions && $scope.gridOptions.api) {
                            $scope.gridOptions.api.doLayout();
                        }
                    }
                });

                $scope.selectDataSummaryBack = function () {
                    DataLoadingService.selectDataSummaryBack($scope);
                };

                $scope.toggleRightFilters = function() {
                    $scope.isShowFilters = !$scope.isShowFilters;
                    applyFilterState();
                };

                $scope.exportData = function(e, type) {
                    e.stopPropagation();
                    e.preventDefault();
                    if ($scope.exportPopup) {
                        $scope.exportPopup.isopen = !$scope.exportPopup.isopen;
                    }
                    if(type == "CSV" || type == "XLS") {
                        $scope.isExportRunning = true;
                        ExportService.prepareExport($scope.datadocId, [$scope.embedSettings.tabId], type, $scope, true, true);
                    }
                };

                $http.get('/embed/' + $attr.uuid).success(function (embed){
                    $scope.datadocId = embed.datadocId;
                    if(!$scope.embedSettings) {
                        $scope.embedSettings = embed.settings;
                    }
                    $scope.inRequest = true;
                    DataLoadingService.restore({
                        id: embed.bookmarkId,
                        tableSchema: {id: embed.tableId},
                        state: embed.state
                    }, '#ag-grid-embed', $scope);
                });

                // todo DRY. move into ag-grid.
                $(document).mousedown(function(event) {
                    if (_.isEmpty(event.target.closest('#ag-grid'))
                        && _.isEmpty(event.target.closest('.data-format'))
                        && _.isEmpty(event.target.closest('.settings'))
                        && $scope.gridOptions && $scope.gridOptions.api) {
                        $scope.gridOptions.api.clearFocusedCell();
                        $scope.gridOptions.api.clearRangeSelection();
                    }
                });

                // dev tool
                $('document').ready(function () {
                    $timeout(function() {
                        window.$scope = angular.element($('#embed-page')).scope();
                        window.clr = function() {
                            localStorage.clear();
                        };
                    }, 1000);
                });
            }
        }
    }]);
});