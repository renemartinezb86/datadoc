define(['./module', 'lodash'],
    function (directives, _) {
        'use strict';

        directives.directive('searchSettingsDropdown', ['$rootScope', 'BookmarkEventService', 'ColumnsService', 'DataLoadingService',
            function ($rootScope, BookmarkEventService, ColumnsService, DataLoadingService) {
                return {
                    restrict: 'E',
                    templateUrl: 'static/templates/include/search-settings-dropdown.html',
                    link: function ($scope, $el, $attr) {

                        let allSearchTypeOptions = _.map(ColumnsService.getSearchTypes(), st => ({value: st.code, text: st.label}));

                        $scope.$on('reset-search-settings', function(){
                            $scope.searchOptionsDropdown.columns = _.cloneDeep($scope.columns);
                            $scope.searchOptionsDropdown.instantSearch = _.find($scope.searchOptionsDropdown.onOffOptions, o => {
                                return o.value === $scope.dataSummary.instantSearch;
                            });
                            $scope.searchOptionsDropdown.highlightMatches = _.find($scope.searchOptionsDropdown.onOffOptions, o => {
                                return o.value === $scope.dataSummary.highlightMatches;
                            });
                            _.each(getNonSelectableColumns(), col => {
                                col.disabled = true;
                                let dataType = col.type === 'BOOLEAN' ? 'Boolean' : 'Date/Time';
                                col.disabledTooltip = `${dataType} fields are not searchable.<br> Use the filters panel on the left of the page to filter by this field.`
                            });
                            $scope.searchOptionsDropdown.refreshInfo();
                        });

                        $scope.$on('reset-search-type', function(event, data){
                            $scope.searchOptionsDropdown.onSearchTypeSelect({}, data.searchType, data.column);
                        });

                        function getOriginalColumn(col){
                            return _.find($scope.columns, {field: col.field});
                        }

                        let nonSelectableTypes = ['BOOLEAN', 'DATE', 'TIME'];

                        function getSelectableColumns(){
                            return _.filter($scope.searchOptionsDropdown.columns, col => {
                                return !_.includes(nonSelectableTypes, col.type)
                            })
                        }

                        function getNonSelectableColumns(){
                            return _.filter($scope.searchOptionsDropdown.columns, col => {
                                return _.includes(nonSelectableTypes, col.type)
                            })
                        }

                        function getAllSelectedColumns(){
                            let selected = $scope.searchOptionsDropdown.getSelectedColumns();
                            if(!selected.length) {
                                selected = _.filter($scope.searchOptionsDropdown.columns, col => {
                                    return _.includes(['DECIMAL', 'STRING'], col.type)
                                });
                            }
                            return selected;
                        }

                        $scope.searchOptionsDropdown = {
                            allColumnsOption: {field: '$$all', searchType: undefined},
                            enabledItemsCount: 0,
                            columns: [],
                            hasChangesToCommit: true,
                            instantSearch: undefined,
                            highlightMatches: undefined,
                            onOffOptions: [{text: 'off', value: false}, {text: 'on', value: true}],
                            isInstantSearchDropdownOpened: false,
                            toggleInstantSearchDropdown: function($event){
                                $event.preventDefault();
                                $event.stopPropagation();
                                if($scope.autoRefresh){
                                    $scope.searchOptionsDropdown.isInstantSearchDropdownOpened =
                                        !$scope.searchOptionsDropdown.isInstantSearchDropdownOpened;
                                    console.log($scope.searchOptionsDropdown.isInstantSearchDropdownOpened);
                                }
                            },
                            onInstantSearchSelect: function($event, instantSearch){
                                $scope.searchOptionsDropdown.instantSearch = instantSearch;
                                $scope.dataSummary.instantSearch = instantSearch.value;
                                BookmarkEventService.emit('.request.InstantSearchToggleEvent', {value: instantSearch.value}, $scope);
                            },
                            onHighlightMatchesSelect: function($event, highlightMatches){
                                $scope.searchOptionsDropdown.highlightMatches = highlightMatches;
                                $scope.dataSummary.highlightMatches = highlightMatches.value;
                                BookmarkEventService.emit('.HighlightMatchesToggleEvent', {value: highlightMatches.value}, $scope);
                                $scope.gridOptions.api.refreshView();
                            },
                            refreshInfo: function(){
                                $scope.searchOptionsDropdown.enabledItemsCount = $scope.searchOptionsDropdown.columns.filter(col => {
                                    return col.settings.searchType !== "NONE";
                                }).length;
                                $scope.searchOptionsDropdown.hasChangesToCommit = false;
                                _.each($scope.searchOptionsDropdown.columns, function(col){
                                    let originalCol = getOriginalColumn(col);
                                    if(col.settings.searchType !== originalCol.settings.searchType){
                                        $scope.searchOptionsDropdown.hasChangesToCommit = true;
                                    }
                                });
                                let selected = getAllSelectedColumns();
                                let searchTypes = _.uniq(_.map(selected, 'settings.searchType'));
                                $scope.searchOptionsDropdown.allColumnsOption.searchType
                                    = searchTypes.length === 1 ? searchTypes[0] : undefined;
                            },
                            getSelectedColumns: function (){
                                return _.filter($scope.searchOptionsDropdown.columns, 'selected');
                            },
                            getAllSelected: function () {
                                return $scope.searchOptionsDropdown.getSelectedColumns().length ===
                                    getSelectableColumns().length;
                            },
                            setAllSelected: function (value) {
                                _.forEach(getSelectableColumns(), function (item) {
                                    item.selected = value;
                                });
                                $scope.searchOptionsDropdown.refreshInfo();
                            },
                            allSelected: function (value) {
                                if (value !== undefined) {
                                    return $scope.searchOptionsDropdown.setAllSelected(value);
                                } else {
                                    return $scope.searchOptionsDropdown.getAllSelected();
                                }
                            },
                            availableAllFieldsOptions: [{value: "NONE", text: "Turn off"}, {value: "RESET", text: "Reset to default"}],
                            availableStringFieldOptions: allSearchTypeOptions,
                            availableNumberFieldOptions: _.filter(allSearchTypeOptions, st => _.includes(['NONE', 'EXACT_MATCH'], st.value)),
                            availableOtherFieldOptions: _.filter(allSearchTypeOptions, st => _.includes(['NONE'], st.value)),
                            getTypeName: function(searchType){
                                if(!searchType){
                                    return "<span class='selected-many'>--</span>";
                                }
                                return _.find($scope.searchOptionsDropdown.availableStringFieldOptions, {value: searchType}).text;
                            },
                            searchTypeMenuOpened: {},
                            opened: false,
                            toggle: function(toggle){
                                if(toggle == undefined){
                                    toggle = !$scope.searchOptionsDropdown.opened;
                                }
                                if(!toggle){
                                    $scope.searchOptionsDropdown.searchTypeMenuOpened = {};
                                }
                                $scope.searchOptionsDropdown.opened = toggle;
                            },
                            toggleSearchTypeOptions: function($event, col){
                                $event.preventDefault();
                                $event.stopPropagation();
                                if(col.disabled){
                                    return;
                                }
                                let opened = $scope.searchOptionsDropdown.searchTypeMenuOpened;
                                if(!opened[col.field]){
                                    opened = $scope.searchOptionsDropdown.searchTypeMenuOpened = {};
                                }
                                opened[col.field] ^= true;
                            },
                            getAvailableSearchTypes: function(col) {
                                let selected;
                                if(col.field === '$$all') {
                                    selected = getAllSelectedColumns();
                                    return $scope.searchOptionsDropdown.availableAllFieldsOptions;
                                } else {
                                    selected = [col];
                                }
                                function containsType(type) {
                                    return _.some(selected, column => column.type == type);
                                }
                                if (containsType('BOOLEAN') || containsType('DATE') || containsType('TIME')) {
                                    return $scope.searchOptionsDropdown.availableOtherFieldOptions;
                                } else if (containsType('DECIMAL')) {
                                    return $scope.searchOptionsDropdown.availableNumberFieldOptions;
                                } else if (containsType('STRING')) {
                                    return $scope.searchOptionsDropdown.availableStringFieldOptions;
                                }
                            },
                            onSearchTypeSelect: function($event, searchType, col){
                                let tab = $scope.tabsSection.options.activeTab,
                                    engineType = tab.tableSchema && tab.tableSchema.engineType;
                                // suggest re-ingestion when EDGE, FULL search type selected for ES
                                let selected;
                                if(col.field === '$$all') {
                                    selected = getAllSelectedColumns();
                                } else {
                                    selected = [col];
                                }
                                let shouldRefresh = false;
                                _.each(selected, col => {
                                    col.settings.searchType = searchType.value === "RESET" ? col.searchType : searchType.value;
                                    if(engineType === 'ES' &&
                                        (col.settings.searchType === 'EDGE' || col.settings.searchType === 'FULL')
                                        && col.searchType !== col.settings.searchType){
                                        return;
                                    }
                                    let originalCol = getOriginalColumn(col);
                                    shouldRefresh = true;
                                    originalCol.settings.searchType = searchType.value === "RESET" ? col.searchType : searchType.value;
                                    BookmarkEventService.emit('.cols.ColSearchTypeChangeEvent', {field: col.field, searchType: searchType.value === "RESET" ? col.searchType : searchType.value}, $scope);
                                });
                                $scope.searchOptionsDropdown.refreshInfo();
                                if(shouldRefresh) {
                                    DataLoadingService.doRefreshIfNeeded($scope);
                                }
                            },
                            saveChanges: function(){
                                if($scope.searchOptionsDropdown.hasChangesToCommit){
                                    $scope.searchOptionsDropdown.savingChanges = true;
                                    $scope.updateIngestSettingsAndCommit(() => {
                                        _.each($scope.searchOptionsDropdown.columns, col => {
                                            let ingestColumn = _.find($scope.ingestDataSummary.columns, function(c){
                                                return c.settings.rename == col.originalField || c.name == col.originalField;
                                            });
                                            if(ingestColumn) {
                                                ingestColumn.settings.searchType = col.settings.searchType;
                                            }
                                        });
                                        return true;
                                    }).then(() => {
                                        $scope.searchOptionsDropdown.savingChanges = false;
                                        $scope.searchOptionsDropdown.toggle();
                                    })
                                }
                            }
                        }
                    }
                }
            }])
    });