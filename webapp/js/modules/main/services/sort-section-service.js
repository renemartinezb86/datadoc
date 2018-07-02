define(['./module', 'common', 'lodash', 'angular'], function(module, cc, _, angular) {
    module.service('SortSectionService', ['$filter', 'DataLoadingService', 'EventNames', 'BookmarkEventService',
        function ($filter, DataLoadingService, EventNames, BookmarkEventService) {

        function getSortSettingsItem($scope, item, keysPathObj, axisObj, limitData, limitEventName, sortChangeEventName) {
            var SORT_DIRECTIONS = {
                    ASC: "ASC",
                    DESC: "DESC",
                    ASC_FULL: "Ascending",
                    DESC_FULL: "Descending"
                },
                SELECTING_AGG_PATH_STR = ' in...';

            // helpers

            var ChoicesAction = (function () {

                function setField(newName) {
                    this.originalItem.id.settings.sort.field = newName;
                }

                function setIsCount(value) {
                    this.originalItem.id.settings.sort.isCount = !!value;
                }

                function selectedByKeyChoiceFn() {
                    var sort = this.originalItem.id.settings.sort;
                    setIsCount.bind(this)(false);
                    setField.bind(this)(null);

                    sort.type = "BY_KEY";
                    sort.aggKeyPath = null;

                    this.syncAndRefresh();
                }

                function selectedIsCount() {
                    setField.bind(this)(null);
                    setIsCount.bind(this)(true);
                    this.originalItem.id.settings.sort.aggKeyPath = null;
                    this.syncAndRefresh();
                }

                function getSelectedByShowFn(show) {
                    return function() {
                        var sort = this.originalItem.id.settings.sort;
                        setIsCount.bind(this)(false);

                        sort.field = show.key;
                        sort.type = "BY_VALUE";
                        sort.aggKeyPath = [];

                        this.syncAndRefresh();
                    }
                }

                function getSelectedByShowPathFn(show) {
                    return function() {
                        var sort = this.originalItem.id.settings.sort;
                        setIsCount.bind(this)(false);

                        sort.field = show.key;
                        sort.type = "BY_VALUE";
                        sort.aggKeyPath = [];

                        resetMultiplyChoice(_.find(this.multiplyChoices, {match: show.showName+SELECTING_AGG_PATH_STR}));
                    }
                }

                function getSelectedByCountInPathFn() {
                    return function() {
                        var sort = this.originalItem.id.settings.sort;
                        setIsCount.bind(this)(true);

                        sort.field = null;
                        sort.type = "BY_VALUE";
                        sort.aggKeyPath = [];

                        resetMultiplyChoice(_.find(this.multiplyChoices, {match: "Count"+SELECTING_AGG_PATH_STR}));
                    }
                }

                function resetMultiplyChoice(multiplyChoice) {
                    var firstResultChoice;
                    multiplyChoice.isDropdownOpened = true;
                    multiplyChoice.resultChoices.splice(1);
                    firstResultChoice = multiplyChoice.resultChoices[0];
                    firstResultChoice.isOpen = true;
                    firstResultChoice.selectedChoice = firstResultChoice.choices[0].title;
                }

                return {
                    selectedByKey: selectedByKeyChoiceFn,
                    selectedIsCount: selectedIsCount,
                    getSelectedByShowFn: getSelectedByShowFn,
                    getSelectedByShowPathFn: getSelectedByShowPathFn,
                    getSelectedByCountInPathFn: getSelectedByCountInPathFn
                }
            })();

            var ChoicesHelper = (function() {

                function getChoiceObj(title, actionFn, key) {
                    return {
                        title: title,
                        action: actionFn,
                        key: key
                    }
                }

                function generateDirectionChoices() {
                    return [
                        getChoiceObj(SORT_DIRECTIONS.ASC_FULL),
                        getChoiceObj(SORT_DIRECTIONS.DESC_FULL)
                    ]
                }

                function getFirstChoices(keysObj) {
                    return _.map(_.filter(keysObj, function(k) {
                        return k.length == 1;
                    }), function(c) {
                        return c[0];
                    });
                }

                function generateMultiplyChoicesForFirstLevel(sortSectionItem, keysObj, axisObj) {
                    function getMultiply(showName, isSettedAggKeyPath) {
                        var allMatchedChoices = [{disabled: true, title: axisObj[0].name}, "Grand Total"];
                        var itemId = sortSectionItem.originalItem.id.settings.sort;

                        allMatchedChoices = allMatchedChoices.concat(getFirstChoices(keysObj));

                        var parentObj = {
                            match: showName + SELECTING_AGG_PATH_STR,
                            resultChoices: [],
                            sortSectionItem: sortSectionItem,
                            keysObj: keysObj,
                            axisObj: axisObj,
                            isDropdownOpened: false,
                            setIsOpen: function (resultChoice) {
                                if (this.isDropdownOpened) {
                                    _.forEach(this.resultChoices, function (c) {
                                        c.isOpen = false;
                                    });
                                    resultChoice.isOpen = true;
                                }
                            },
                            onToggle: function (resultChoice) {
                                if (this.isDropdownOpened) {
                                    this.closeDropdown();
                                } else {
                                    this.isDropdownOpened = true;
                                    resultChoice.isOpen = true;
                                }
                            },
                            closeDropdown: function () {
                                _.forEach(this.resultChoices, function (c) {
                                    c.isOpen = false;
                                });
                                this.isDropdownOpened = false;
                            },
                            filteredValue: function (value, resultChoice) {

                                if (value === "Grand Total" || value == "Total") {
                                    return value;
                                }

                                var axisObj = resultChoice.parent.axisObj[resultChoice.index];
                                return $filter('formatCell')(value, axisObj.col, axisObj);
                            }
                        };

                        // append first level

                        var obj = {
                            index: 0,
                            parent: parentObj,
                            selectedChoice: itemId.aggKeyPath && itemId.aggKeyPath.length == 0 ? allMatchedChoices[1] : allMatchedChoices[0].title,
                            choices: allMatchedChoices,
                            setMultiplyChoice: setMultiplyChoice,
                            isOpen: false
                        };

                        parentObj.resultChoices.push(obj);

                        if (isSettedAggKeyPath) {
                            if (itemId.aggKeyPath && itemId.aggKeyPath.length && keysObj.length) {

                                _.forEach(itemId.aggKeyPath, function (p, i) {
                                    parentObj.resultChoices[i].selectedChoice = p;

                                    var choices = getPathChoices(keysObj, i, parentObj.resultChoices);

                                    if (choices.length) {
                                        var obj = getMultiplyChoicesObj(p, choices, parentObj, axisObj[parentObj.resultChoices.length].name, itemId.aggKeyPath.length < axisObj.length);

                                        parentObj.resultChoices.push(obj);
                                    }
                                });
                            }
                        }

                        return parentObj;
                    }

                    if (!keysObj) return;

                    var choices = _.map($scope.dataSummary.shows, function(s) {
                        return getMultiply(s.showName, sortSectionItem.originalItem.id.settings.sort.field === s.key)
                    });

                    choices.push(getMultiply("Count", true));

                    return choices;
                }

                function generateSortByChoices(item, axisObj) {
                    var choices = [
                        ChoicesHelper.getObj(item.name, ChoicesAction.selectedByKey)
                    ];

                    if (axisObj.length) {
                        if (_.find($scope.dataSummary.aggs, item)) {
                            choices.push(ChoicesHelper.getObj("Count in...", ChoicesAction.getSelectedByCountInPathFn()));
                        } else {
                            choices.push(ChoicesHelper.getObj("Count", ChoicesAction.selectedIsCount));
                        }

                        _.forEach($scope.dataSummary.shows, function (s) {
                            var choice = s.showName + SELECTING_AGG_PATH_STR;
                            choices.push(ChoicesHelper.getObj(choice, ChoicesAction.getSelectedByShowPathFn(s), s.key));
                        });
                    } else {
                        choices.push(ChoicesHelper.getObj("Count", ChoicesAction.selectedIsCount));

                        _.forEach($scope.dataSummary.shows, function (s) {
                            var choice = s.showName;
                            choices.push(ChoicesHelper.getObj(choice, ChoicesAction.getSelectedByShowFn(s), s.key));
                        });
                    }

                    return choices;
                }

                function getSelectedSortBy(item, axisObj) {
                    var sort = item.id.settings.sort;

                    if ($scope.dataSummary.pivotOrder.length && _.find($scope.dataSummary.pivot, item)) {
                        return "Custom";
                    }

                    if (sort.aggKeyPath && !sort.isCount) {
                        return _.find(this.sortByChoices, {key: sort.field}).title;
                    } else if (sort.aggKeyPath && sort.isCount && axisObj && sort.aggKeyPath.length != axisObj.length) {
                        return "Count"+SELECTING_AGG_PATH_STR;
                    } else if(sort.isCount) {
                        return this.sortByChoices[1].title;
                    } else {
                        return this.sortByChoices[0].title;
                    }
                }

                return {
                    defaultDirections: generateDirectionChoices(),

                    getObj: getChoiceObj,
                    getMultiply: generateMultiplyChoicesForFirstLevel,
                    getSortBy: generateSortByChoices,
                    getSelectedSortBy: getSelectedSortBy
                }
            })();


            // Handlers
            function setDirection(choice) {
                switch (choice.title) {
                    case SORT_DIRECTIONS.ASC_FULL:
                        this.originalItem.id.settings.sort.direction = SORT_DIRECTIONS.ASC;
                        break;
                    case SORT_DIRECTIONS.DESC_FULL:
                        this.originalItem.id.settings.sort.direction = SORT_DIRECTIONS.DESC;
                        break;
                }

                if (this.selectedDirection != choice.title) {
                    if (choice.action) {
                        choice.action.bind(this)();
                    }
                    this.selectedDirection = choice.title;
                    this.syncAndRefresh();

                    if ($scope.dataSummary.pivotOrder
                        && $scope.dataSummary.pivotOrder.length
                        && _.find($scope.dataSummary.pivot, {key: this.field})) {

                        this.selectedSortBy = this.sortByChoices[0].title;
                        $scope.dataSummary.pivotOrder = [];
                        BookmarkEventService.emit(".shows.ShowMovePivotEvent", {pivotOrder: $scope.dataSummary.pivotOrder}, $scope);
                    }
                }

            }
            function setSortBy(choice) {
                if (this.selectedSortBy != choice.title) {
                    this.selectedSortBy = choice.title;
                    if (choice.action) {
                        choice.action.bind(this)();
                    }

                    if ($scope.dataSummary.pivotOrder
                        && $scope.dataSummary.pivotOrder.length
                        && _.find($scope.dataSummary.pivot, {key: this.field})) {

                        $scope.dataSummary.pivotOrder = [];
                        BookmarkEventService.emit(".shows.ShowMovePivotEvent", {pivotOrder: $scope.dataSummary.pivotOrder}, $scope);
                    }
                }
            }
            function setMultiplyChoice(selectedChoice) {
                this.selectedChoice = selectedChoice;
                var parent = this.parent;

                if (selectedChoice == "Grand Total") {
                    parent.resultChoices.splice(1);
                    parent.sortSectionItem.originalItem.id.settings.sort.aggKeyPath = [];
                    this.parent.sortSectionItem.syncAndRefresh();
                } else if (selectedChoice == "Total") {
                    parent.resultChoices.splice(parent.resultChoices.indexOf(this)+1);
                    parent.sortSectionItem.originalItem.id.settings.sort.aggKeyPath = _.map(parent.resultChoices.slice(0, parent.resultChoices.length - 1), "selectedChoice");
                    this.parent.sortSectionItem.syncAndRefresh();
                } else {
                    this.isOpen = false;

                    // prepare choices for next part
                    var index = this.parent.resultChoices.indexOf(this);

                    if (index + 1 < this.parent.resultChoices.length) {
                        parent.resultChoices.splice(index+1);
                    }

                    var choices = getPathChoices(parent.keysObj, index, parent.resultChoices);

                    parent.sortSectionItem.originalItem.id.settings.sort.aggKeyPath = _.map(parent.resultChoices, "selectedChoice");
                    if (choices.length) {
                        var obj = getMultiplyChoicesObj(selectedChoice, choices, parent, parent.axisObj[parent.resultChoices.length].name, false, true);

                        parent.resultChoices.push(obj);
                    } else {
                        this.parent.sortSectionItem.syncAndRefresh();
                    }
                }
            }

            function getPathChoices(keysObj, index, resultChoices) {
                function compareSelectedChoiceFn(key, i) {
                    return resultChoices[i].selectedChoice == key;
                }

                function isEveryMatches(arr) {
                    var arrWithoutLastValue = arr.slice(0, arr.length - 1);
                    return _.every(arrWithoutLastValue, compareSelectedChoiceFn);
                }

                return _.map(_.filter(keysObj, function(k) {
                    var arr = k;

                    if (arr.length == index + 2 && isEveryMatches(arr)) {
                        return true;
                    }
                }), function (c) {
                    return c[index + 1];
                });
            }

            function getMultiplyChoicesObj(match, choicesArr, parent, firstValue, isTotalSelected, isOpen) {
                choicesArr.unshift("Total");
                choicesArr.unshift({disabled: true, title: firstValue});

                return {
                    match: match,
                    parent: parent,
                    index: parent.resultChoices.length,
                    selectedChoice: isTotalSelected ? choicesArr[1] : choicesArr[0].title,
                    choices: choicesArr,
                    setMultiplyChoice: setMultiplyChoice,
                    isOpen: isOpen,

                    // Used in html for checking .selectedChoice previous item with this .match
                    isMatched: function() {
                        return this.index > 0 && this.index < parent.resultChoices
                            && this.match === parent.resultChoices[this.index - 1].selectedChoice;
                    }
                };
            }



            var sortSectionItem;

            sortSectionItem = {
                originalItem: item,
                field: item.field,
                displayName: item.displayName,

                directionChoices: ChoicesHelper.defaultDirections,
                selectedDirection: item.id.settings.sort.direction == SORT_DIRECTIONS.ASC
                    ? SORT_DIRECTIONS.ASC_FULL
                    : SORT_DIRECTIONS.DESC_FULL,

                setDirection: setDirection,
                setSortBy: setSortBy,
                syncSortWithServer: function() {
                    $scope.$broadcast('finishResize');
                    BookmarkEventService.emit(sortChangeEventName, {key: this.itemFromModel.id}, $scope);
                },
                syncItemFromModelLimitAndRefresh: function () {
                    BookmarkEventService.emit(limitEventName, {key: this.itemFromModel.id}, $scope);
                    DataLoadingService.doRefreshIfNeeded($scope);
                },
                syncAndRefresh: function() {
                    this.syncSortWithServer();
                    DataLoadingService.doRefreshIfNeeded($scope);
                },
                limit: item.id.settings.limit || limitData,
                itemFromModel: item,
                limitByBlur: function(limit){
                    if (!limit || limit > 1000) {
                        this.limit = limitData;
                        this.itemFromModel.id.settings.limit = null;
                        this.syncItemFromModelLimitAndRefresh();
                    } else {
                        if (this.itemFromModel.id.settings.limit != this.limit) {
                            this.itemFromModel.id.settings.limit = this.limit;
                            this.syncItemFromModelLimitAndRefresh();
                        }
                    }
                }
            };

            sortSectionItem.sortByChoices = ChoicesHelper.getSortBy(item, axisObj);
            sortSectionItem.selectedSortBy = ChoicesHelper.getSelectedSortBy.bind(sortSectionItem)(item, axisObj);
            sortSectionItem.multiplyChoices = axisObj.length ? ChoicesHelper.getMultiply(sortSectionItem, keysPathObj, axisObj): [];

            return sortSectionItem;
        }

        function getDataItem($scope, item) {
            function compareKeyPred(modelItem) {
                return DataLoadingService.getOpKey(modelItem) == DataLoadingService.getOpKey(item);
            }

            if (_.find($scope.dataSummary.aggs, compareKeyPred)) {
                return getSortSettingsItem(
                    $scope,
                    item,
                    $scope.allPivotKeys,
                    $scope.dataSummary.pivot,
                    $scope.dataSummary.limit.aggData,
                    EventNames.CHANGE_LIMIT_EVENT.AGGS,
                    EventNames.CHANGE_SORT_EVENT.AGGS
                );
            } else if (_.find($scope.dataSummary.pivot, compareKeyPred)) {

                return getSortSettingsItem(
                    $scope,
                    item,
                    $scope.allAggKeys,
                    $scope.dataSummary.aggs,
                    $scope.dataSummary.limit.pivotData,
                    EventNames.CHANGE_LIMIT_EVENT.PIVOT,
                    EventNames.CHANGE_SORT_EVENT.PIVOT
                );
            }
        }

        return {
            getDataItem: getDataItem
        }
    }]);
});