define(['./module', 'common', 'lodash', 'angular'], function (module, cc, _, angular) {
    module.service('TabsSection', ['$http', '$state', '$stateParams', '$timeout', '$compile', 'DataLoadingService', 'BookmarkEventService', '$q', 'WSocket', 'ShareService', '$rootScope', 'BrowserHistoryService',
        function ($http, $state, $stateParams, $timeout, $compile, DataLoadingService, BookmarkEventService, $q, WSocket, ShareService, $rootScope, BrowserHistoryService) {

        function TabsSection($scope) {

            $rootScope.$on('SetActiveTab', (event, data) => {
                const tab = _.find(tabsOptions.tabs, {id: data.tabId});
                setActiveTab(tab, data.refresh, data.togglePageLoader, false);
            });

            $(window).resize((e) => {
                calculateTabsWidth();
            });

            const tabNameChatLimit = 40;

            var tabsOptions = {
                tabs: [],
                activeTab: {}
            };
            var activeTabIndex = {
                get: function () {
                    return $scope.storage.activeTabIndex[$scope.datadocId];
                },
                set: function (index) {
                    $scope.storage.activeTabIndex[$scope.datadocId] = index;
                }
            };

            createStorageForTabs();
            getAllTabsFromServer();

            function addNewTab() {
                const lastActiveTab = tabsOptions.activeTab;

                $scope.togglePageLoader(true, true);
                disableAllTabs();

                const newTab = {
                    dropdownOpened: false,
                    name: "Sheet<i class='fa fa-fw fa-spinner fa-spin'/>"
                };

                tabsOptions.tabs.push(newTab);

                $http.post('/api/docs/bookmarks', { datadocId: parseInt($scope.datadocId) })
                    .then(result => {
                        console.log('result', result);

                        notifyAboutTabEvent({
                            "@type": "com.dataparse.server.service.docs.TabAddedEvent",
                            datadocId: parseInt($scope.datadocId),
                            tabId: result.data.id,
                            stateId: result.data.state.id
                        });

                        _.merge(newTab, result.data);
                        setActiveTab(newTab, true, true, false);
                    }, err => {
                        if (err.status === 403) {
                            cc.notify({ message: "You are not allowed to create bookmarks", icon: "warning", wait: 3 });
                        } else {
                            cc.notify({ message: "Error while creating bookmark", icon: "warning", wait: 3 });
                        }
                        console.error("Can not create bookmark", err);

                        tabsOptions.tabs.pop();
                        setActiveTab(lastActiveTab, true, false, false);
                    });
            }

            function undo() {
                var tab = tabsOptions.activeTab;
                if (tab.canUndo) {
                    loadPreviousTabChangeFromServer(tab).then(function (data) {

                        if ($scope.historyHandler.undo(tab, data).needRestore) {
                            restoreTab(tab);
                        }

                        calculateTabsWidth();
                    })
                }
            }

            function redo() {
                var tab = tabsOptions.activeTab;
                if (tab.canRedo) {
                    loadNextTabChangeFromServer(tab).then(function (data) {

                        if ($scope.historyHandler.redo(tab, data).needRestore) {
                            restoreTab(tab);
                        }

                        calculateTabsWidth();
                    })
                }
            }

            function setActiveTab(tab, refresh, togglePageLoader, addToHistory = true) {
                if(addToHistory) {
                    const stateData = {
                        tabId: tabsOptions.activeTab.id,
                        refresh: false,
                        togglePageLoader: false
                    };
                    BrowserHistoryService.push('SetActiveTab', 'main.visualize', stateData);
                }
                const startRefresh = new Date();
                const gridInitializationListener = $rootScope.$on("GridInitialized", () => {
                    gridInitializationListener();
                    $scope.$emit("LoadQueryTime", startRefresh);
                });

                if (!tab.state.flowJSON) {
                    // New tab was selected
                    $scope.ingestDataSummary.queryMode = false;
                    $scope.ingestDataSummary.tableMode = false;
                    $scope.ingestDataSummary.selectedSources = [];
                } else {
                    // Old tab, preventing blinking of source suggestions.
                    $scope.sourceSuggestionActive = false;
                }

                let updateTab = Promise.resolve();

                if(tab.shouldUpdateFromServer) {
                    $scope.togglePageLoader(true, true);

                    updateTab = loadTabFromServer(tab, tab.currentState).then((data) => {
                        tab.state = data.state;
                        tab.lastChangeEvent = {};
                        tab.tableSchema = data.tableSchema;
                        tab.shouldUpdateFromServer = false;
                    });
                }
                updateTab.then(() => {
                    const activeTab = tab.active;
                    if (tab.active && !refresh) return;

                    if (!window.tabsState) {
                        window.tabsState = {};
                    }

                    tab.active = true;
                    tab.dropdownOpened = false;

                    tabsOptions.activeTab = tab;

                    disableAllTabs(true);
                    $scope.pageMode = $stateParams.pageMode && $stateParams.pageMode === $scope.pageMode
                        ? tab.state.pageMode = $stateParams.pageMode
                        : $scope.pageMode = $stateParams.pageMode = tab.state.pageMode;
                    const isVisualization = tab.state.pageMode === $scope.PAGE_MODE.VIZ;
                    const isCurrentStateDefault = tab.currentState === tab.defaultState;

                    const stateId = isVisualization && !isCurrentStateDefault ? tab.currentState : null;

                    activeTabIndex.set(_.indexOf(tabsOptions.tabs, tab));
                    $state.transitionTo($scope.currentState, _.merge({}, $stateParams, {pid: tab.id, stateId}), {
                        notify: false,
                        location: 'replace'
                    });

                    if(!activeTab) {
                        if($scope.tabResponseEventHandler) {
                            $scope.tabResponseEventHandler.unsubscribe();
                        }
                        $scope.tabResponseEventHandler = BookmarkEventService.subscribeToTabEvents(tab, $scope);
                        $scope.$on('$destroy', function(){
                            if($scope.tabResponseEventHandler){
                            $scope.tabResponseEventHandler.unsubscribe();
                            }
                        });
                    }

                    if ($scope.pageMode === $scope.PAGE_MODE.VIZ) {
                        $scope.inRequest = true;
                        $scope.togglePageLoader(true, true);
                        $scope.refreshIngestPage(togglePageLoader);
                        $timeout(function() {
                            restoreTab(tab, true);
                            calculateTabsWidth();
                        });

                    } else {
                        //todo remove tabId, $scope.bookmarkStateId is enough
                        $scope.tabId = tab.id;
                        $scope.sourceInfoMessage = DataLoadingService.buildSourceInfo(tab);
                        $scope.bookmarkStateId = tab.bookmarkStateId;
                        $scope.allBookmarkStates = tab.allBookmarkStates;
                        $scope.refreshIngestPage(togglePageLoader);
                        $timeout(function() {
                            calculateTabsWidth();
                            $scope.sourcePath = '';
                            $scope.sourceSearchPopupOptions.selectedFolder = null;
                            $scope.$emit('typeahead-refresh');
                    })
                    }
                })
            }

            // Todo: Do I need it here?
            // function getTabSharedStates(tab) {
            //     return $http.get(`/api/docs/bookmarks/${tab.id}/shared_states`)
            //         .then(result => {
            //             console.log(result);
            //             return result.data;
            //         }, err => {
            //             console.error("Failed to load bookmark shared states", err);
            //         });
            // }

            function deleteTab(tab, ind, e) {
                prevEvents(e);

                if (tabsOptions.tabs.length == 1) {
                    alert('You cannot delete last tab');
                    closeDropdown(tab);
                    return;
                }

                var youReallyWannaThis = confirm('You really want to remove this tab?');

                if (youReallyWannaThis) {
                    notifyAboutTabEvent({
                        "@type": "com.dataparse.server.service.docs.TabRemovedEvent",
                        datadocId: parseInt($scope.datadocId),
                        tabId: tab.id,
                        tabIndex: ind
                    });
                    deleteTabFromServer(tab, ind);
                } else {
                    closeDropdown(tab);
                }
            }

            function renameTab(tab, index, e) {
                prevEvents(e);

                tab.editable = true;
                tab.oldName = _.cloneDeep(tab.name);
                calculateTabsWidth();

                $timeout(function () {
                    var inputId = "#" + $scope.snakeCase(tab.name) + "_" + index;
                    $(inputId + ' ~ input').focus();
                    $(inputId + ' ~ input').select();
                });

                closeDropdown(tab);
            }

            function inputKeyPress(e, tab, index) {
                switch (e.keyCode) {
                    case 13:
                    case 27:
                        doRenameTab(tab);
                        break;
                }

                calculateTabsWidth(false, false, true);

                var calc = 0;
                var tabsListLeft = parseInt($('#tabs-list').css('left'));
                if (tabsListLeft < 0) tabsListLeft *= -1;
                $('li.single-tab').each(function () {
                    var tab = $(this);
                    calc += tab.outerWidth();
                });

                if (calc - tabsListLeft > 700) $scope.moveTabs('right');
            }

            function closeInputOnTab(tab) {
                if (tab.editable) doRenameTab(tab);
            }

            function moveTabForServer(tab, toPosition) {

                $http.post('/api/docs/bookmarks/move', {
                    tableBookmarkId: tab.id,
                    toPosition: toPosition
                }).then(function () {
                    tab.position = toPosition;
                    activeTabIndex.set(toPosition);
                    notifyAboutTabEvent({
                        "@type": "com.dataparse.server.service.docs.TabPositionChangedEvent",
                        datadocId: parseInt($scope.datadocId),
                        tabId: tab.id,
                        tabIndex: toPosition
                    });
                });
            }

            function notifyAboutTabEvent(options = {}) {
                if (_.isEmpty(options)) {
                    console.warn("No payload specified for WebSocket Event");
                    return;
                }
                if (!options["@type"]) {
                    console.error('Property "@type" is required');
                    return;
                }

                WSocket.send(`/doc/event`, options);
            }

            function onMoveStart(tab) {
                tab.dropdownOpened = false;
                tabsOptions.move = true;
            }

            function onMoveStop() {
                tabsOptions.move = false;
            }

            function deleteTabFromServer(tab, ind) {
                $http.delete('/api/docs/bookmarks/' + tab.id).then(function () {
                    if (tabsOptions.activeTab == tab) {
                        tabsOptions.activeTab = {};
                    }
                    _.remove(tabsOptions.tabs, tab);

                    setActiveTab(tabsOptions.tabs[(ind == 0) ? 0 : ind - 1], true, true, false);
                    calculateTabsWidth(false, true);
                }, function (err) {
                    console.log("CAN'T REMOVE BOOKMARK", err)
                });
            }

            function loadTabFromServer({id: tabId}, stateId, userId) {
                return $http.get('/api/docs/bookmarks/state', {params: {tabId, stateId, userId}})
                    .then(function (result) {
                        return result.data;
                    }, function (err) {
                        console.error("CAN'T LOAD BOOKMARK STATE", err);
                    });
            }

            function loadPreviousTabChangeFromServer(tab) {
                return $http.post('/api/docs/bookmarks/' + tab.id + '/undo')
                    .then(function (result) {
                        return result.data;
                    }, function (err) {
                        console.error("CAN'T UNDO BOOKMARK STATE", err);
                    });
            }

            function loadNextTabChangeFromServer(tab) {
                return $http.post('/api/docs/bookmarks/' + tab.id + '/redo')
                    .then(function (result) {
                        return result.data;
                    }, function (err) {
                        console.error("CAN'T REDO BOOKMARK STATE", err);
                    });
            }

            function updateNameFromServer(tab, newName) {
                return $http.put('/api/docs/bookmarks/' + tab.id, {
                    name: newName
                }).then(function (result) {
                    let savedTab = result.data;

                    tab.name = savedTab.name;
                    tab.editable = false;
                    calculateTabsWidth();
                    return savedTab;
                }, function (err) {
                    console.error("CAN'T EDIT BOOKMARK", err);
                });
            }

            function restoreTab(tab, getFromState, suppressReloadingData) {
                DataLoadingService.restore(tab, '#ag-grid', $scope, {
                    getFromState: getFromState,
                    suppressReloadingData: suppressReloadingData
                });
                $scope.updateShowMeAutocompleteList();
                $scope.updateGroupByAutocompleteList();
            }

            function getAllTabsFromServer(stateId = $stateParams.stateId) {
                const params = {
                    datadocId: $scope.datadocId,
                    tabId: $stateParams.pid,
                    stateId: stateId,
                    fetchState: true
                };

                let tab;
                let activeTabState = stateId;
                let activeTabId = parseInt($stateParams.pid);

                return $http.get('/api/docs/bookmarks/all', { params })
                    .then(result => {
                        let tabs = _.map(result.data, insertTab);

                        if(activeTabId) {
                            tab = _.find(tabs, { id: activeTabId }) || tabs[0];
                        } else {
                            tab = tabs[activeTabIndex.get()];
                        }

                        if(!_.get(tab, 'state')) {
                            throw new Error('State is empty (deleted or so)');
                        }
                    }, error => {
                        if (error && error.status === 404) {
                            $scope.goToMainPage(true);
                            throw new Error(`The datadoc "${$scope.selectedTable.name}" has been deleted due to user ingest cancellation.`)
                        }
                        if (tab) {
                            return $http.post("/api/docs/bookmarks/preset_default",
                                { bookmarkStateId: { tabId: tab.id }, toCleanState: true });
                        }
                    })
                    .then(response => {
                        if (!tab) {
                            return getAllTabsFromServer(null);
                        }

                        if (response) {
                            activeTabState = response.data.state.id;
                            tab.state = response.data.state;
                        }

                        if(activeTabState) {
                            tab.currentState = activeTabState;
                            tab.bookmarkStateId.stateId = activeTabState;
                            if(tab.currentState !== tab.defaultState) {
                                tab.shouldUpdateFromServer = true;
                            }
                        }

                        setActiveTab(tab, false, true, false);
                        calculateTabsWidth();
                    })
            }

            function disableAllTabs(withoutActiveTab) {
                _.each(tabsOptions.tabs, function (t) {
                    if (!withoutActiveTab || t != tabsOptions.activeTab) {
                        t.active = false;
                        t.dropdownOpened = false;
                    }
                });
            }

            function prevEvents(e) {
                e.preventDefault();
                e.stopPropagation();
            }

            function closeDropdown(tab) {
                tab.dropdownOpened = false;
            }

            function insertTab(tab) {
                var mergedTab = _.merge(tab, {
                    active: false,
                    dropdownOpened: false,
                    getFullName: function(){
                        var baseName = "Sheet" + (_.indexOf(tabsOptions.tabs, mergedTab) + 1);
                        return baseName + ' - ' + mergedTab.name;
                    }
                });

                // return added tab
                return tabsOptions.tabs[tabsOptions.tabs.push(mergedTab) - 1];
            }

            function calculateTabsWidth(moveToEnd, checkWidthAfterDelete, doNotUseTimeout) {
                function calculate() {
                    var calc = 0;
                    var tabsList = $('#tabs-list');
                    var tabsArrows = $('#tabs-bar #tabs-arrows');
                    var rightShadow = $('#tabs-list-wrapper .right-shadow');
                    var leftShadow = $('#tabs-list-wrapper .left-shadow');

                    $('li.single-tab').each(function () {
                        var tab = $(this);
                        calc += tab.outerWidth();
                    });
                    // 110 - filters button with padding, 20 - padding between tabs and filters, 0.7 - max-width of tabs content 70%
                    const minWidth = (document.body.clientWidth - 110 - 20) * 0.7;

                    if (calc > minWidth) {
                        tabsList.width(calc + 100);
                        $('#tabs-list-wrapper .right-shadow').removeClass('hidden');
                        tabsArrows.removeClass('hidden');

                        if (moveToEnd) {
                            tabsList.css('left', minWidth - tabsList.width() + 100);
                            rightShadow.addClass('hidden');
                            leftShadow.removeClass('hidden');
                        }

                        var left = parseInt(tabsList.css('left'));
                        var tabsWidth = minWidth - tabsList.width() + 100;
                        if (checkWidthAfterDelete && left < tabsWidth) {
                            tabsList.css('left', tabsWidth)
                        }
                    } else {
                        tabsList.width('auto');
                        tabsList.css('left', 0);
                        tabsArrows.addClass('hidden');

                        rightShadow.addClass('hidden');
                        leftShadow.addClass('hidden');
                    }
                }

                if (!doNotUseTimeout) {
                    $timeout(function () {
                        calculate();
                    });
                } else {
                    calculate();
                }
            }

            function createStorageForTabs() {
                if ($scope.storage.activeTabIndex == null) {
                    $scope.storage.activeTabIndex = {};
                }

                if ($scope.storage.activeTabIndex[$scope.datadocId] == null) {
                    $scope.storage.activeTabIndex[$scope.datadocId] = 0;
                }

                $scope.storage.$apply();
            }

            function doRenameTab(tab) {
                if (_.size(tab.name) > tabNameChatLimit) {
                    cc.notify({message: `${tabNameChatLimit} characters limit exceeded`, icon: 'warning', wait: 3});
                    tab.name = tab.oldName;
                    tab.editable = false;
                    calculateTabsWidth();
                    return;
                }

                if (tab.name && tab.name != tab.oldName) {
                    updateNameFromServer(tab, tab.name).then((updatedTab) => {
                        notifyAboutTabEvent({
                            "@type": "com.dataparse.server.service.docs.TabNameChangedEvent",
                            datadocId: parseInt($scope.datadocId),
                            tabId: updatedTab.id,
                            renameTo: updatedTab.name
                        })
                    });
                } else {
                    tab.name = tab.oldName;
                    tab.editable = false;
                    calculateTabsWidth();
                }
            }

            function refreshActiveTab(withoutRemoteUpdate, stateId, addToHistory = true) {
                $scope.togglePageLoader(true, false);

                if (withoutRemoteUpdate) {
                    setActiveTab(tabsOptions.activeTab, true, false, addToHistory);
                } else {
                    setAndRefreshTab(tabsOptions.activeTab, true, false, stateId);
                }
            }

            function setAndRefreshTab(tab, refresh, toggleLoader, stateId) {
                loadTabFromServer(tab, stateId).then((data) => {
                    tab.canUndo = false;
                    tab.canRedo = false;
                    tab.allBookmarkStates = data.allBookmarkStates;
                    tab.currentState = data.currentState;
                    tab.bookmarkStateId = { tabId: data.state.tabId, stateId: data.state.id };
                    tab.state = data.state;
                    tab.lastChangeEvent = {};
                    tab.tableSchema = data.tableSchema;
                    setActiveTab(tab, refresh, toggleLoader, false);
                });
            }

            return {
                options: tabsOptions,
                undo: undo,
                redo: redo,
                addNewTab: addNewTab,
                setActiveTab: setActiveTab,
                deleteTab: deleteTab,
                renameTab: renameTab,
                doRenameTab: doRenameTab,
                inputKeyPress: inputKeyPress,
                closeInputOnTab: closeInputOnTab,
                moveTabForServer: moveTabForServer,
                onMoveStart: onMoveStart,
                onMoveStop: onMoveStop,
                restoreTab: restoreTab,
                loadTabFromServer: loadTabFromServer,
                calculateTabsWidth: calculateTabsWidth,
                refreshActiveTab: refreshActiveTab,
                setAndRefreshTab
            }
        }

        return TabsSection;
    }]);
});