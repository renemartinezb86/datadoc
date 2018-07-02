define(['./module', 'common', 'lodash', 'angular'], function(module, cc, _, angular) {
    module.service('SortSectionColumnsService',
        ['SortDirection', 'UserEventService', 'UserStateService', 'SearchService',
        function (SortDirection, UserEventService, UserStateService, SearchService) {

        var COLUMN_NUMBERS = {
            FIRST: 0,
            SECOND: 1,
            THIRD: 2
        };

        function getSectionOptions(eventName, callback, $scope) {
            return {
                getSelected: function() {
                    return _.map(this.columns, function(col) {
                        return col.selected.title;
                    });
                },
                getSorted: function() {
                    return _.find(this.columns, function(col) {
                        if (col.sort && col.sort.direction) {
                            return true;
                        }
                    });
                },
                onSort: function(e, col) {
                    if (e) {
                        e.stopPropagation();
                    }
                    if(!col.selected.sortDisabled) {
                        var direction = col.sort.direction;

                        this.resetAllSort(col);

                        if (!direction) {
                            col.sort.direction = SortDirection.ASC;
                        } else if (direction == SortDirection.ASC) {
                            col.sort.direction = SortDirection.DESC;
                        } else {
                            col.sort.direction = SortDirection.ASC;
                        }
                        callback({
                            field: col.selected.sortProperty,
                            desc: col.sort.direction == SortDirection.DESC
                        })
                    }
                    UserEventService.emit(eventName,
                        {columnIndex: _.indexOf(this.columns, col), selected: _.indexOf(col.choices, col.selected), newDirection: col.sort.direction}, $scope);



                },
                resetAllSort: function(withoutCol) {
                    if (!withoutCol) { withoutCol = {}; }

                    _.forEach(this.columns, function(col) {
                        if (col.selected != withoutCol.selected) {
                            col.sort.direction = null;
                        }
                    });
                }
            }
        }

        function getColumnOptions(params, parentObj) {
            var column = {
                class: params.class || 'col-md-3 col-sm-3 col-xs-3',
                innerClass: params.innerClass || 'index-header',
                templateUrl: params.templateUrl
            };

            column.choices = params.choices;
            column.selected = column.choices[params.selected];
            column.sort = params.sort;

            if (params.withHeaderClickHandler) {

                if (params.onHeaderClick) {
                    column.onHeaderClick = params.onHeaderClick;
                } else {
                    column.onHeaderClick = function() {
                        parentObj.onSort(null, this);
                    }
                }
            }

            if (params.choices.length > 1) {
                column.onChoiceSelected = function(choice) {
                    this.selected = choice;

                    if (choice.defaultByDesc && !choice.sortDisabled) {
                        this.sort.direction = SortDirection.ASC;
                    } else if(!choice.sortDisabled) {
                        this.sort.direction = null;
                    }

                    parentObj.onSort(null, this);
                    UserStateService.reset();
                }
            }

            return column;
        }

        function genSortColumnsOptions($scope, search) {
            const us = $scope.userState,
                { datadocsOnly, foldersOnly, sourcesOnly } = us.showTypesOptions,
                searchOptions = _.merge({},
                    getSectionOptions('.sources_section_columns.SourcesSectionColumnsSelectedChangeEvent',
                    sort => $scope.resetSearchResults({sort}), $scope)),
                listOptions = _.merge({},
                    getSectionOptions('.sources_section_columns.SourcesSectionColumnsSelectedChangeEvent',
                    sort => $scope.resetSources({sort, backdrop: true, datadocsOnly, foldersOnly, sourcesOnly}), $scope)
                );

            const searchText = SearchService.getSearchText(),
                sortSectionColumnsOptions = search ? searchOptions : listOptions;

            const firstColumn = getColumnOptions({
                selected: us.sourcesSectionColumns[COLUMN_NUMBERS.FIRST].selected,
                class: 'col-md-6 col-sm-6 col-xs-6',
                choices: [{
                    title: search ? `Search results for ${searchText}` : 'Name',
                    sortProperty: 'name'
                }],
                templateUrl: search ? null : '/static/templates/main/sources-breadcrumbs.html',
                sort: us.sourcesSectionColumns[COLUMN_NUMBERS.FIRST].sortSettings,
                withHeaderClickHandler: true
            }, sortSectionColumnsOptions);

            const secondColumn = getColumnOptions({
                selected: us.sourcesSectionColumns[COLUMN_NUMBERS.SECOND].selected,
                choices: [{
                    title: 'Type',
                    sortProperty: 'f.entityType'
                }],
                innerClass: 'index-header with-choices',
                sort: us.sourcesSectionColumns[COLUMN_NUMBERS.SECOND].sortSettings,
            }, sortSectionColumnsOptions);

            const thirdColumn = getColumnOptions({
                selected: us.sourcesSectionColumns[COLUMN_NUMBERS.THIRD].selected,
                choices: [{
                    title: 'Date',
                    sortProperty: 'lastViewedByMeOrAddedOn',
                    defaultByDesc: true
                }, {
                    title: 'Added on',
                    sortProperty: 'f.created',
                    defaultByDesc: true
                }, {
                    title: 'Added by',
                    sortProperty: 'user.email'
                }, {
                    title: 'Size',
                    sortProperty: 'descriptor.size',
                    defaultByDesc: true
                }, {
                    title: 'Last viewed by me',
                    sortProperty: 'lastViewedByMe'
                }, {
                    title: 'Data last refreshed',
                    sortProperty: 'committed',
                    defaultByDesc: true
                }],
                innerClass: 'index-header with-choices',
                sort: us.sourcesSectionColumns[COLUMN_NUMBERS.THIRD].sortSettings
            }, sortSectionColumnsOptions);

            sortSectionColumnsOptions.columns = [
                firstColumn, secondColumn, thirdColumn
            ];

            return sortSectionColumnsOptions;
        }

        function genSearchResultsEmptyResultsSortColumnsOptions($scope) {
            var sortSectionColumnsOptions = _.merge({}, sort => {}, getSectionOptions());

            var firstColumn = getColumnOptions({
                selected: 0,
                class: 'col-md-6',
                choices: [{
                    title: "Found 0 items"
                }],
                sort: {disabled: true},
                innerClass: 'index-header without-click-action'
            }, sortSectionColumnsOptions);

            sortSectionColumnsOptions.columns = [
                firstColumn
            ];

            return sortSectionColumnsOptions;
        }


        return {
            genSortColumnsOptions: genSortColumnsOptions,
            genSearchResultsEmptyResultsSortColumnsOptions: genSearchResultsEmptyResultsSortColumnsOptions
        }
    }]);
});