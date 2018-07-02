define([
    './module', 'angular', 'lodash', 'common', 'moment', 'notifications-utils',
    'rzslider', 'angular-sortable-view', 'angular-ui-bootstrap-tpls', 'angular-ui-select', 'angular-sanitize'
], function (controllers, angular, _, cc, moment, NotificationsUtils) {

    'use strict';

    controllers.controller('visualizationCtrl', ['$rootScope', '$scope', '$http', '$localStorage', '$timeout',
    '$stateParams', '$q', '$state', 'SearchBarService', 'CodesService',
    '$uibModal', '$filter', '$compile', 'ExportService', 'DataLoadingService',
    'GridService', '$window', 'EmbedService', 'SortSectionService', 'HistoryHandlerService', 'EventNames',
    'TabsSection', 'IngestDataLoadingService', 'SourceService', 'WSocket', 'FlowService', 'BookmarkCommitService',
    'BookmarkEventService', 'FormatToolbarService', 'ColumnsService', 'cronService',
    'TimeZoneService', '$location', 'RecentSourcesService', 'User', 'ShareService', 'RouterService', 'FilterService',
    'BrowserHistoryService',
    function ($rootScope, $scope, $http, $localStorage, $timeout, $stateParams, $q, $state,
              SearchBarService, CodesService, $uibModal, $filter, $compile,
              ExportService, DataLoadingService, GridService, $window, EmbedService, SortSectionService,
              HistoryHandlerService, EventNames, TabsSection, IngestDataLoadingService, SourceService,
              WSocket, FlowService, BookmarkCommitService, BookmarkEventService,
              FormatToolbarService, ColumnsService, cronService, TimeZoneService, $location, RecentSourcesService, User,
              ShareService, RouterService, FilterService, BrowserHistoryService) {
        $scope.controllerName = 'visualizationCtrl';
        $scope.currentState = $stateParams.sharedId ? "main.visualize-shared" : "main.visualize";
        $scope.datadocId = $stateParams.id;

        let changeStateOnceHandler;
        $scope.isFilterActive = FilterService.isFilterActive;
        $scope.getSelectedFilters = FilterService.getSelectedFilters;
        $scope.resetFilterInRow = FilterService.resetFilterInRow.bind(null, $scope);
        $scope.ingestSettingsDropdown = {open: false};
        $scope.sourceSettingsDropdown = {open: false};
        $scope.databaseTablesSettings = { opened: true, disabled: false, refresh: false  };
        $scope.savedViewsSettings = { opened: false, disabled: true, refresh: false };

        $scope.toggleDatabaseTables = (items) => items.length > 0 && ($scope.databaseTablesSettings.opened = true);

        $scope.toggleSavedViews = (items) => items.length > 0 && ($scope.savedViewsSettings.opened = true);

        $scope.toggleIngestSettingsDropdown = () => {
            $scope.ingestSettingsDropdown.open = !$scope.ingestSettingsDropdown.open;
        };
        $scope.hideIngestSettingsDropdown = () => {
            $scope.ingestSettingsDropdown.open = false;
        };

        $scope.toggleSourceSettingsDropdown = () => {
            $scope.sourceSettingsDropdown.open = !$scope.sourceSettingsDropdown.open;
        };
        $scope.hideSourceSettingsDropdown = () => {
            $scope.sourceSettingsDropdown.open = false;
        };

        $scope.selectedGroupByCount = () => $scope.rawShowMeList ? $scope.rawShowMeList.reduce((acc, val) => (acc += val.id.selected ? 1 : 0), 0) : 0;

        $scope.switchAutoRefresh = function (value) {
            $scope.autoRefresh = value;

            var tab = $scope.tabsSection.options.activeTab;
            tab.state.autoRefresh = value;
            if(value){
                $scope.doCancelRefresh();
            }
            $scope.dataSummary.instantSearch = value;
            $timeout(() => $scope.$broadcast('reset-search-settings'));
            BookmarkEventService.emit(".request.AutoQueryingToggleEvent", {value: value}, $scope);
        };

        function setDefaultTimezone() {
            const bookmarkTimezone = _.get($scope, 'tabsSection.options.activeTab.state.timezone');
            const userTimezone = User.getCurrent().timezone;
            let timezone;
            if ($scope.isConvertToUserTimezone()) {
                timezone = userTimezone ? userTimezone : moment.tz.guess();
            } else {
                timezone = bookmarkTimezone;
            }
            moment.tz.setDefault(timezone);
            return timezone;
        }

        let attempts = 0;
        const defaultTimezoneInterval = setInterval(() => {
            const MaxAttemptsNumber = 50;
            const result = setDefaultTimezone();
            attempts++;
            if (attempts > MaxAttemptsNumber) {
                console.log(`Failed to set default time zone. Exceeded attempts limit.`);
                clearInterval(defaultTimezoneInterval);
                return;
            }
            if (result) {
                console.log(`Default time zone was set to "${moment().tz()}".`);
                clearInterval(defaultTimezoneInterval);
            }
        }, 100);

        $scope.isConvertToUserTimezone = () => _.get($scope, 'tabsSection.options.activeTab.state.convertToUserTimezone');
        $scope.columnHeaderAvailableFormats = ColumnsService.colNameFormat;
        $scope.isCurrentHeaderAdjustment = (key) => {
          const currentFormat = ColumnsService.colNameFormat[key];
          let activeFormat = ColumnsService.colNameFormat[_.get($scope, 'tabsSection.options.activeTab.state.colNameFormat')];
          return currentFormat === activeFormat;
        };
        $scope.getCurrentHeaderAdjustmentValue = () => ColumnsService.colNameFormat[_.get($scope, 'tabsSection.options.activeTab.state.colNameFormat')];
        $scope.setCurrentHeaderAdjustmentValue = (colNameFormat) => {
          const tab = $scope.tabsSection.options.activeTab;
          if (tab.state) {
            tab.state.colNameFormat = colNameFormat;
            _.each($scope.dataSummary.filters, filter => filter.col.name = ColumnsService.formatColumnName(colNameFormat, filter.col.originalField));
            _.each($scope.showMeList, show => DataLoadingService.wrapShow(show, colNameFormat));
            _.each($scope.groupByList, group => DataLoadingService.wrapAgg(group, colNameFormat));
            $scope.updateGroupByAutocompleteList();
            $scope.$emit('DoRebuildCollapsedTags');
            BookmarkEventService.emit('.ingest.ColNameFormatChangeEvent', { colNameFormat }, $scope);
            $scope.$emit('update-columns-header', { colNameFormat });
          }
        };

        $scope.switchConvertTimes = function (value) {
            const bookmarkState = _.get($scope, 'tabsSection.options.activeTab.state');
            bookmarkState.convertToUserTimezone = value;
            BookmarkEventService.emit(".BookmarkStateConvertToUserTimezone", {convertToUserTimezone: value}, $scope);

            let timezone;
            if (value) {
                let userTimezone = User.getCurrent().timezone; // Time zone name
                timezone = userTimezone ? userTimezone : moment.tz.guess();
            } else {
                timezone = bookmarkState.timezone;
            }
            moment.tz.setDefault(timezone);
            console.log(`Current time zone was set to "${moment().tz()}"`);
            DataLoadingService.doRefreshIfNeeded($scope);
            DataLoadingService.updateFilters($scope.dataSummary.filters, $scope);
        };

        $scope.updateBookmarkTimezone = (timezone) => {
            const tab = _.get($scope, 'tabsSection.options.activeTab');

            tab.state.timezone = timezone;
            BookmarkEventService.emit(".BookmarkTimezoneChangeEvent", { timezone }, $scope);
            moment.tz.setDefault(timezone);
            console.log(`Bookmark time zone was set to "${moment.tz.zone(timezone).name}"`);
        };

        $scope.getBookmarkTimezoneAbbreviation = () => {
            const availableAbbreviations = TimeZoneService.getTimeZones();
            const bookmarkTimezone = _.get($scope, 'tabsSection.options.activeTab.state.timezone');

            return _.chain(availableAbbreviations)
                .find(a => bookmarkTimezone === a.name)
                .get("abbr")
                .value();
        };

        $scope.isGuessedTimezone = () => moment.tz.guess() === moment().tz();

        $scope.isSelectedBookmarkTimezone = (timezone) => {
            const bookmarkTimezone = _.get($scope, 'tabsSection.options.activeTab.state.timezone');
            return bookmarkTimezone === timezone;
        };

        function ChangeStateOnceHandler() {
            // todo can be generalized
            const self = this;
            const callback = (id) => $http.delete(`/api/docs/${id}`);
            this.register = () => {
                this.event = $rootScope.$on('$stateChangeStart',
                    function(event, toState, toParams, fromState, fromParams){
                        event.preventDefault();
                        callback(fromParams.id).then(() => {
                            self.unregister();
                            $state.go(toState, toParams);
                        });
                    });
            };
            this.unregister = () => {
                this.event && this.event();
            };
        }

        if($stateParams.preSave) {
            changeStateOnceHandler = new ChangeStateOnceHandler();
            changeStateOnceHandler.register();
        }

        $scope.isPagination = false;
        $scope.isInfiniteScroll = false;
        $scope.allowInfiniteScroll = false;
        var isMoveShowMe = false;

        $scope.storage = $localStorage.$default();

        $scope.currentRequest = {};
        $scope.maxResults = 10000;
        $scope.currentPagination = 1;
        $scope.totalSize = 0;
        $scope.filtersStatus = {
            refreshing: false
        };
        $scope.inRequest = false;
        $scope.isSuggestionFolderSelected = false;

        $scope.floatingTopRows = [];

        // todo refactoring this after refactoring collapsed-tags
        $scope.hideCollapsedTags = true;

        $scope.dataTabs = {
            results: true,
            summary: false
        };

        $scope.sourceTagsSectionAutoCompleteList = [];
        $scope.ingestColumnsAutoCompleteList = [];

        const PAGE_MODE = $scope.PAGE_MODE = {
            VIZ: 0,
            INGEST: 1
        };

        $scope.pageMode = $stateParams.pageMode;
        $scope.previewGridOptions = {};

        $scope.isVizMode = () => $scope.pageMode === PAGE_MODE.VIZ;

        $scope.isIngestMode = () => $scope.pageMode === PAGE_MODE.INGEST;

        $scope.isShowTables = () => $scope.ingestDataSummary.queryMode || $scope.ingestDataSummary.tableMode;

        $scope.datadocViewers = [];

        function isEventOwner(event) {
            let hidden;
            if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
                hidden = "hidden";
            } else if (typeof document.msHidden !== "undefined") {
                hidden = "msHidden";
            } else if (typeof document.webkitHidden !== "undefined") {
                hidden = "webkitHidden";
            }

            const isUsersMatch = event.user === User.getCurrent().id || event.sessionId === User.getCurrent().sessionId,
                isDocumentVisibleAndFocused = !document[hidden] && document.hasFocus();

            return isUsersMatch && isDocumentVisibleAndFocused;
            // Do not handle event if it came from its owner.
            // document.hidden == false - if it's active window (tab). https://caniuse.com/#feat=pagevisibility
            // So the same user can handle events through tabs.
            // document.hasFocus() - means that the document isn't only active (highlighted tab), but also is focused at the moment
        }

        WSocket.subscribe(`/doc/event/${$scope.datadocId}`, event => {
            const tabsOptions = $scope.tabsSection.options;
            switch (event.type) {
                case "DATADOC_NAME_CHANGED": {
                    if (isEventOwner(event))
                        return;
                    $scope.$evalAsync(() => {
                        $scope.selectedTable.name = event.renameTo;
                        $scope.$emit('$titleChanged', $scope.selectedTable.name);
                    });
                    break;
                }
                case "DATADOC_VIEWED": {
                    $scope.$evalAsync(() => {
                        $scope.datadocViewers = _.filter(event.datadocViewUsers, u => u.userId !== User.getCurrent().id);
                    });
                    break;
                }
                case "TAB_NAME_CHANGED": {
                    if (isEventOwner(event))
                        return;
                    let tab = _.find(tabsOptions.tabs, tab => tab.id === event.tabId);
                    $scope.$evalAsync(() => {
                        tab.name = event.renameTo
                    });
                    break;
                }
                case "TAB_ADDED": {
                    if (isEventOwner(event))
                        return;
                    $scope.tabsSection.loadTabFromServer({id: event.tabId}, event.stateId, event.user)
                        .then(newTab => {
                            newTab && tabsOptions.tabs.push(newTab)
                        });
                    break;
                }
                case "TAB_REMOVED": {
                    if (isEventOwner(event))
                        return;
                    $scope.$evalAsync(() => {
                        if (tabsOptions.activeTab.id === event.tabId) {
                            let newActiveTabIndex = (event.tabIndex === 0) ? 0 : event.tabIndex - 1;
                            tabsOptions.activeTab = {};
                            $scope.tabsSection.setActiveTab(tabsOptions.tabs[newActiveTabIndex], true, true, false);
                        }
                        _.remove(tabsOptions.tabs, t => t.id === event.tabId);
                        $scope.tabsSection.calculateTabsWidth(false, true);
                    });
                    break;
                }
                case "TAB_POSITION_CHANGED": {
                    if (isEventOwner(event))
                        return;
                    $scope.$evalAsync(() => {
                        let tab = _.chain(tabsOptions.tabs)
                            .remove(t => t.id === event.tabId)
                            .head()
                            .value();

                        tabsOptions.tabs.splice(event.tabIndex, 0, tab);

                        _.each(tabsOptions.tabs, t => t.position = tabsOptions.tabs.indexOf(t))
                    });
                    break;
                }
            }
        }, true);

        WSocket.send(`/doc/event`, {
            "@type": "com.dataparse.server.service.docs.ViewDatadocEvent",
            datadocId: parseInt($scope.datadocId)
        });

        const unsubscribeFromDatadocViewers = $rootScope.$on('$stateChangeStart', (e, toState, toParams, fromState) => {
            if(fromState.name === toState.name) {
                return;
            }
            WSocket.unsubscribe(`/doc/event/${$scope.datadocId}`);
            unsubscribeFromDatadocViewers();
        });

        $scope.ingestDataSummary = {
            pageLoaded: false,
            selectedSources: [],
            sources: [],
            lastSourceSelected: null,
            selectedColumns: [],
            columns: [],
            query: "",
            queryEditorOptions: {
                autoRefresh: {delay: 100},
                lineWrapping: true,
                lineNumbers: true,
                mode: 'text/x-sql',
                matchBrackets: true,
                extraKeys: {
                    'Cmd-Enter': function() {
                        $scope.$broadcast('ingest-run-query')
                    },
                    'Ctrl-Enter': function() {
                        $scope.$broadcast('ingest-run-query')
                    }
                }
            },
            runningSchedule: {
                status: "Never",
                cronExpression: "0 0 0 * * *",
                timeZone: 'UTC',
                lastCommitDuration:'',
                availableTimeZones: TimeZoneService.getTimeZones(),
                config: {
                    options: {
                        'alloweach minute' : false,
                        'allowhourly' : true,
                        'allowmonthly' : false,
                        'allowannually' : false
                    }
                }
            },
            settingString: ''
        };

        $scope.cantDetectFieldNamesNote = {opened: false};
        $scope.cantDetectDelimiterNote = {opened: false};
        $scope.cantIngestFileDueToErrorsNote = {opened: false};

        $scope.getSettingString = function () {
            let weekDay = {
                SUN: 'Sunday',
                MON: 'Monday',
                TUE: 'Tuesday',
                WED: 'Wednesday',
                THU: 'Thursday',
                FRI: 'Friday',
                SAT: 'Saturday',
            };
            let schedule = $scope.ingestDataSummary.runningSchedule;
            let scheduleTab = $scope.tabsSection.options.activeTab.tableSchema.refreshSettings;
            if(schedule.status === "Never"){
                $scope.ingestDataSummary.settingString = 'never';
            } else {
                let cron = scheduleTab.cronExpression.replace(/\s+/g, ' ').split(' ');
                let fromCron = cronService.fromCron(scheduleTab.cronExpression);
                let timePeriod = parseInt(cron[2]) >= 12 ? 'PM' : 'AM';
                let hours = ((parseInt(cron[2]) + 11) % 12 + 1);
                let cronString;
                switch (fromCron.base){
                    case 2:
                        cronString = cron[1] + ' min past the hour';
                        break;
                    case 3:
                        cronString = hours + timePeriod.toLowerCase() + ' ' + schedule.timeZone.text;
                        break;
                    case 4:
                        cronString = hours + timePeriod.toLowerCase() + ' ' + schedule.timeZone.text + ' on ' + weekDay[cron[5]];
                        break;
                    default:
                        cronString = '';
                        break;
                }
                $scope.ingestDataSummary.settingString = schedule.status.toLowerCase() +' at '+ cronString;
            }
        };

        $scope.getUserTimezoneAbbreviation = () => {
            const timezone = User.getCurrent().timezone;

            // If we did not receive data from the server
            if (!timezone) {
                const guessedTimezone = moment.tz.guess();
                return moment.tz.zone(guessedTimezone).abbr(moment());
            }

            return moment.tz.zone(timezone).abbr(moment());
        };

        $scope.getLastCommitDuration = (withPrefix = false) => {
            const lastCommitDuration = _.get($scope, 'tabsSection.options.activeTab.tableSchema.lastCommitDuration');

            if (!lastCommitDuration) {
                return '';
            }

            let duration = moment.duration(lastCommitDuration);
            let result = '';

            if (lastCommitDuration > 1000) {
                result = `${duration.minutes()}m ${duration.seconds()}s`;
            } else {
                result = `less than a second`;
            }

            if (withPrefix && result) {
                result = `in ${result}`;
            }
            return result;
        };

        function getRunningScheduleStatus(cronExpression){
            let options = ["Each minute", "Hourly", "Daily", "Weekly", "Monthly", "Annually"],
                base = cronService.fromCron(cronExpression).base;
            return options[base - 1];
        }

        function restoreRunningSchedule (){
            let tab = $scope.tabsSection.options.activeTab,
                refreshSettings = tab.tableSchema.refreshSettings,
                runningSchedule = $scope.ingestDataSummary.runningSchedule;

            runningSchedule.lastCommitDuration = $scope.getLastCommitDuration();
            if(refreshSettings.type === "NONE"){
                runningSchedule.status = 'Never';
            } else {
                runningSchedule.status = getRunningScheduleStatus(refreshSettings.cronExpression);
            }
            runningSchedule.cronExpression = refreshSettings.cronExpression;

            let timeZones = TimeZoneService.getTimeZones();

            runningSchedule.timeZone = _.find(timeZones, ({text}) => text === 'UTC');
            $scope.getSettingString();
        }

        $scope.updateRunningSchedule = function () {
            let tab = $scope.tabsSection.options.activeTab,
                refreshSettings = tab.tableSchema.refreshSettings,
                runningSchedule = $scope.ingestDataSummary.runningSchedule;
            if(!runningSchedule.cronExpression){
                runningSchedule.status = 'Never';
                refreshSettings.type = "NONE";
            } else {
                runningSchedule.status = getRunningScheduleStatus(runningSchedule.cronExpression);
                refreshSettings.type = "FULL";
            }
            refreshSettings.cronExpression = runningSchedule.cronExpression;
            refreshSettings.timeZone = _.get(runningSchedule, 'timeZone.offset');
            $scope.getSettingString();
            return $http.post(`/api/docs/bookmarks/${tab.id}/update_refresh_settings`, {
                settings: _.omit(tab.tableSchema.refreshSettings, 'id')
            });
        };

        $scope.updateRunningScheduleTimeZone = function (timeZone) {
            $scope.ingestDataSummary.runningSchedule.timeZone = timeZone;
            $scope.updateRunningSchedule();
        };

        $scope.isSelectedTimeZone = function (timeZone) {
            const currentTimeZone = $scope.ingestDataSummary.runningSchedule.timeZone;
            if(!currentTimeZone) {
                return;
            }
            if (_.isPlainObject(currentTimeZone)) {
                return timeZone === currentTimeZone.text;
            } else if (_.isString(currentTimeZone.text)) {
                return timeZone === currentTimeZone;
            } else {
                console.warn("Failed to recognize time zone.")
            }
        };

        $rootScope.$on("LoadQueryTime", (event, startQueryTime) => {
            $timeout(() => {
                $scope.loadQueryTime = _.round((new Date() - startQueryTime) / 1000, 2);
            })
        });

        $scope.getIngestPreviewLabel = function (){
            let total = $scope.totalSize;
            let str = '';

            if (total === 1000){
                str += 'Showing 1,000 rows';
            } else if (total > 0) {
                str += `Showing ${total} rows`;
            }

            if ($scope.isIndexChanged()) {
                str += '. Save Changes to import all data';

                if($scope.ingestDataSummary.queryMode){
                    str += ' from your query';
                } else if ($scope.ingestDataSummary.tableMode){
                    str += ' from your table';
                }

                str += '.';
            }
            return str;
        };

        $scope.getUploadIcon = upload => SourceService.getIcon(upload);

        $scope.exportDropdownSettings = { opened: false };

        $scope.togglePageMode = function(toggledByUser, pageMode, localChange) {
            if(toggledByUser) {
                BrowserHistoryService.push('TogglePageMode', 'main.visualize');
            }

            if (!pageMode) {
                pageMode = $scope.pageMode === PAGE_MODE.VIZ ? PAGE_MODE.INGEST : PAGE_MODE.VIZ;
            }

            let tab = $scope.tabsSection.options.activeTab;
            tab.state.pageMode = pageMode;
            $scope.pageMode = pageMode;
            if(!localChange) {
                BookmarkEventService.emit('.PageModeChangeEvent', {pageMode: $scope.pageMode}, $scope);
            }

            if (pageMode === PAGE_MODE.VIZ) {
                tab.state.flowJSON = tab.state.pendingFlowJSON;
            }

            $scope.tabsSection.refreshActiveTab(true, null, false);
            return true;
        };

        const onTogglePageMode = $rootScope.$on('TogglePageMode', () => {
            $scope.togglePageMode();
        });

        $scope.updateColumns = function() {
            _.each($scope.ingestDataSummary.columns, function (column, index) {
                column.settings.type = column.settings.type || column.type;
                column.settings.name = column.settings.name || column.name;
                column.settings.index = cc.isDefined(column.settings.index) ? column.settings.index : index;

                if(!column.settings.searchType){
                    ColumnsService.resetSearchType(column);
                }
                if(_.get(column.settings.type.dataType)) {
                    switch(column.settings.type.dataType.toLowerCase()){
                        case 'location_lat_lon':
                            column.settings.filter = 'lat-lon';
                            break;
                        case 'location_usa_state_codes':
                        case 'location_country_codes':
                            column.settings.filter = 'codes';
                            break;
                    }

                    if(column.settings.pkey || column.pkey
                        || _.contains(['STRING'], column.settings.type.dataType)){

                        column.settings.preserveHistory = null;
                    }
                }
            })
        };

        $scope.commit = function() {
            if(!$scope.isCommitted() && _.startsWith($scope.selectedTable.name, 'Untitled datadoc')) {
                $scope.renameDocModal = $uibModal.open({
                    templateUrl: 'static/templates/include/rename-datadoc.html',
                    scope: $scope,
                    animation: true,
                    size: 'md',
                    windowClass: 'tiny-modal'
                });
                $scope.renameDocModal.opened.then(function(){
                    $scope.renameDocModal.docName = $scope.selectedTable.name;
                });
                $scope.renameDocModal.rendered.then(function(){
                    $('.tiny-modal input[name=document-name]').focus().select();
                })
            } else {
               doCommit();
            }
        };

        function toggleCommit(toggle){
            $scope.previewGridOptions.suppressMenuMainPanel = toggle;
            $scope.previewGridOptions.suppressMovableColumns = toggle;
        }

        function doCommit(){
            changeStateOnceHandler && changeStateOnceHandler.unregister();
            toggleCommit(true);
            closeAllStickyNotes();
            return $scope.updateIngestSettings(true, false).then(() => {
                return BookmarkCommitService.commit($scope.tabId, true)
                    .catch(e => {
                        cc.showError(e);
                        toggleCommit(false);
                    })
            });
        }

        $scope.isCommitRunning = function (bookmarkId){
            if(!bookmarkId){
                bookmarkId = $scope.tabId;
            }

            const isCommitRunning = BookmarkCommitService.isCommitRunning(bookmarkId);
            if (isCommitRunning) {
                $scope.isRefreshingNow = true;
            }
            return isCommitRunning;
        };

        $scope.isCommitCancelling = function (bookmarkId){
            if(!bookmarkId){
                bookmarkId = $scope.tabId;
            }
            return BookmarkCommitService.isCommitCancelling(bookmarkId)
        };

        $scope.renameDocForm = {};
        $scope.saveNameAndCommit = function () {
            $scope.renameDocModal.dismiss();
            $scope.selectedTable.name = $scope.renameDocModal.docName;
            $scope.updateTable().then(function(){
                doCommit();
            })
        };

        $scope.cancelRenameModal = function () {
            $scope.renameDocModal.dismiss();
        };

        $scope.isCommitted = function() {
            let tab = $scope.tabsSection.options.activeTab;
            return tab && tab.tableSchema && tab.tableSchema.committed;
        };

        $scope.lastUpdateTabMessage = () => {
            let tab = $scope.tabsSection.options.activeTab;
            const updated = _.get(tab, 'updated');
            if(_.get(tab, 'tableSchema.committed') && updated) {
                return `Failed since ${moment(updated).format("D.MM.YY h:mmA")}`
            }
        };


        $scope.getTimeSinceLastCommit = () => {
            const lastCommit = _.get($scope, 'tabsSection.options.activeTab.tableSchema.committed');
            return moment(lastCommit).fromNow();
        };

        $scope.getLastIngestedTime = () => {
            const lastIngestedTime = _.get($scope, 'tabsSection.options.activeTab.tableSchema.committed');
            return moment(lastIngestedTime).format("MMM D, YYYY [at] h:mmA");
        };

        $scope.isIndexChanged = function() {
            let tab = $scope.tabsSection.options.activeTab ;
            if (!tab.state) return false;

            return tab.state.flowJSON !== tab.state.pendingFlowJSON;
        };

        $scope.getSaveDataMessage = () => {
            const dataType = $scope.ingestDataSummary.queryMode ? "Query" : ($scope.ingestDataSummary.tableMode ? "Table" : "All");
            return `Save ${dataType} Data`;
        };

        $scope.resetIngestSettings = function() {
            let tab = $scope.tabsSection.options.activeTab;
            tab.state.flowJSON = tab.state.pendingFlowJSON;
            BookmarkEventService.emit('.ingest.ResetIngestSettings', {}, $scope);
            $scope.refreshIngestPage();
        };

        $scope.refreshIngestPage = function(togglePageLoader, shouldBackdropWhenPreview = false) {
            let tab = $scope.tabsSection.options.activeTab;
            $scope.sourceSearch = {value: ''};
            $scope.sourcePath = '';
            $scope.ingestDataSummary.pageLoaded = false;
            $scope.isShowFilters = tab.state.showFilters &&
                ($scope.ingestDataSummary.queryMode || $scope.ingestDataSummary.tableMode) && !$scope.isMobileView();
            $timeout(() => {
                restoreRunningSchedule();

                if ($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                    IngestDataLoadingService.initGrid({
                        selector: '#preview-grid',
                        mode: 'ingest_raw'
                    }, $scope);
                }

                if ($scope.isShowFilters) {
                    $scope.$broadcast('expand-visualization-filters');
                } else {
                    $scope.$broadcast('collapse-visualization-filters');
                }

                let flowJSON = tab.state ? tab.state.flowJSON : null;
                return $scope.deserializeIngestSettingsFromJSON(flowJSON)
                    .then(() => {
                        if($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                            if ($scope.ingestDataSummary.queryMode || $scope.ingestDataSummary.tableMode) {
                                $scope.$broadcast('reset-query-editor-resize', tab.state.queryEditorHeight);
                                $scope.toggleSourceSuggestionActive(false);
                                IngestDataLoadingService.clear($scope);
                                $timeout(() => $scope.togglePageLoader(false));
                            } else {
                                /**
                                 * Ingest page Preview
                                 * If you want to display the default data (all columns), pass force: true to function below
                                 * And if you want to display the data that you see on the visualization page, then pass force: false
                                 */
                                IngestDataLoadingService.preview($scope, {force: true, shouldBackdrop: shouldBackdropWhenPreview});
                                if (!flowJSON) {
                                    $scope.toggleSourceSuggestionActive(true);
                                    $timeout(() => {
                                        $('.search-autocomplete input').focus();
                                    })
                                } else {
                                    $scope.toggleSourceSuggestionActive(false);
                                }
                            }

                            if ($scope.ingestDataSummary.lastSourceSelected) {
                                tryShowDelimiterStickyNote($scope.ingestDataSummary.lastSourceSelected);
                            }

                            // Load table/query when preview db from datadoc
                            if ($scope.ingestDataSummary.table && $scope.ingestDataSummary.tableMode) {
                                IngestDataLoadingService.preview($scope, {force: false, shouldBackdrop: shouldBackdropWhenPreview});
                            } else if ($scope.ingestDataSummary.query && $scope.ingestDataSummary.queryMode) {
                                $scope.updateQueryFromFavorites($scope.ingestDataSummary.selectedSources[0]);
                            } else if ($scope.ingestDataSummary.selectedSources[0]) {
                                $scope.loadSource($scope.ingestDataSummary.selectedSources[0], null, true, false);
                            }

                            $scope.ingestDataSummary.pageLoaded = true;
                        } else {
                            let flow = JSON.parse(flowJSON);
                            let inputNode = flow.cells[0];

                            $scope.ingestDataSummary.columns = _.map(inputNode.settings.columns, (settings, i) =>
                                ({id: i + 1, name: settings.name, settings}));
                        }
                    });
            });
        };

        $scope.isShowHeaderInFirstRowOption = function(){
            let source = $scope.ingestDataSummary.selectedSources[0];
            return source && _.includes(['CSV', 'XLS_SHEET', 'XLSX_SHEET'], source.descriptor.format)
        };

        $scope.getIngestSelectedSourceSettings = function() {
            let source = $scope.ingestDataSummary.selectedSources[0];
            return source ? source.descriptor.settings : {};
        };

        $scope.switchIngestUseHeaders = function(value) {

            let source = $scope.ingestDataSummary.selectedSources[0];
            if (source.descriptor.settings.useHeaders !== value) {
                let oldValue = source.descriptor.settings.useHeaders;
                source.descriptor.settings.useHeaders = value;

                if ($scope.pageMode === $scope.PAGE_MODE.VIZ) {
                    return;
                }

                $scope.togglePageLoader(true);
                $scope.updateIngestFileSettings(source.id, source.descriptor.settings)
                    .then((res) => {
                        source.descriptor = res.data.descriptor;
                        source.previewDescriptor = res.data.previewDescriptor;

                        $scope.ingestPreviewLoaded = false;

                        $scope.updateIngestColumns();
                        $scope.updateIngestSettings(!$scope.ingestDataSummary.selectedSources.length);
                        $scope.updateIngestColumnsAutocompleteList();

                    }, (e) => {
                        source.descriptor.settings.useHeaders = oldValue;

                        $scope.togglePageLoader(false);
                        let err = IngestDataLoadingService.getErrorMessage({
                            code: e.errorCode,
                            message: e.errorMessage
                        });
                        err.message = 'Ingest ' + err.message;
                        cc.notify(err);
                    });
            }
        };

        $scope.updateIngestFileSettings = function(id, settings) {
            return $http.post('/api/files/update_settings', {
                path: 'id:' + id,
                settings: settings
            });
        };

        $scope.cleanState = async () => {
            $scope.firstRequestApplied = false;
            return $scope.presetDefaultState({tabId: $scope.tabId, toCleanState: true});
        };

        $scope.cancelPreviewRequest = function () {
            if($scope.currentPreviewRequest && $scope.currentPreviewRequest.canceler) {
                $scope.currentPreviewRequest.canceler.resolve();
            }
            $scope.inRequest = false;
            $scope.togglePageLoader(false);
        };

        let searchMode = false;

        $scope.sourceSearchPopupOptions = {
            selectedFolder: null,
            ingestDataSummary: $scope.ingestDataSummary,
            mostRecentSource: _.head(RecentSourcesService.getList()),
            isSelectFolderRequest: null
        };

        $scope.toggleSourceSuggestionActive = function (toggle, $event) {
            if($scope.isMobileView()) {
                return;
            }
            $event && $event.stopPropagation();
            $scope.sourceSuggestionClicked = !!(toggle && $event);
            $timeout(function() {
                $scope.sourceSuggestionActive = toggle;
                if (toggle) {
                    closeAllStickyNotes();
                    $scope.cantIngestFileDueToErrorsNote.opened = false;
                    $timeout(() => {
                        $('.search-autocomplete input').focus();
                    });
                }
            });
        };

        function wrapSource(container, source){
            if (container && container.type === 'composite-ds') {
                source.fullName = container.name + '.' + source.name;
            } else {
                source.fullName = source.name;
            }
            return source;
        }

        function isNewQuerySource(source){
            return source && source.type === 'new_query';
        }

        function createNewQuerySource(container, name){
            return {
                id: container.id,
                icon: 'query',
                type: 'new_query',
                name: name ? name : container.name,
                fullName: container.name + (name ? '.' + name : ''),
                descriptor: {
                    format: container.descriptor.format + '_QUERY'
                }
            }
        }

        $scope.uploadsExist = false;

        $scope.sourceSuggestions = function (searchText) {
            const setUpdatingSource = setTimeout(() => {
                $scope.updatingSourceSuggestions = true;
            }, 300);

            let mapFile = (o) => {
                o.icon = SourceService.getIcon(o);
                o.isTable = o.descriptor && _.endsWith(o.descriptor.format, "TABLE");
                return o;
            };

            let getFiles = (data) => {
                return _.sortBy(_.map(data, mapFile), (o) => o.name.toLowerCase());
            };

            if(searchText) {
                return $http.post('/api/search/suggest-sources', {s: searchText, limit: 10})
                    .then((response) => {
                        clearTimeout(setUpdatingSource);
                        searchMode = true;
                        $scope.updatingSourceSuggestions = false;
                        return getFiles(response.data);
                    })
            } else {
                const params = {
                    offset: 0,
                    limit: 100,
                    path: $scope.sourcePath,
                    withDatadocs: true,
                    sourcesOnly: true,
                    foldersOnly: true,
                };

                return $http.post('/api/files/list_files', params)
                    .then((response) => {
                        clearTimeout(setUpdatingSource);
                        searchMode = false;
                        let container = $scope.sourceSearchPopupOptions.selectedFolder;
                        let files = getFiles(response.data);
                        files = _.map(files, _.partial(wrapSource, container));
                        if(SourceService.isDbSource(container)){
                            files.unshift(createNewQuerySource(container));
                        }
                        if($scope.sourcePath) {
                            files.unshift({
                                type: 'folder',
                                icon: 'folder',
                                name: '..',
                                id: container.parentId
                            })
                        }
                        $scope.uploadsExist = !_.isEmpty(response.data) || $scope.uploadsExist;
                        $timeout(function() {
                            if($scope.ingestDataSummary.pageLoaded && !$scope.inRequest){
                                $scope.togglePageLoader(false);
                            }
                        }, 500);
                        $scope.sourceSearchPopupOptions.isSelectFolderRequest = false;
                        $scope.sourceSearchPopupOptions.currentSelected = '';
                        $scope.updatingSourceSuggestions = false;
                        return files;
                    })
            }
        };

        $scope.queryChanged = function (){
            $scope.currentQueryData.manualChangesPerformed = false;
            $scope.ingestPreviewLoaded = false;
        };

        $scope.$on('ingest-change-query', function(e, data){
            $scope.ingestDataSummary.query = data.query;
            $scope.ingestPreviewLoaded = false;
        });

        $scope.openQueryEditor = function (){
            $scope.ingestDataSummary.queryMode = true;
            $scope.ingestDataSummary.tableMode = false;
            $scope.isTableDisabled = true;
            $scope.ingestDataSummary.table = null;
            $scope.$broadcast('open-query-editor');
        };

        $scope.isMobileView = function () {
            return (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent)
                || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0, 4)));
        };

        $scope.isLiveSource = () => {
            return ($scope.ingestDataSummary.tableMode || $scope.ingestDataSummary.queryMode);
        };

        $scope.isUningestedTab = () => {
            let flowJSON = _.get($scope, 'tabsSection.options.activeTab.state.flowJSON', null);
            return !flowJSON;
        };

        $scope.getDisabledPreviewMessage = () => {
            if($scope.isLiveSource()) {
                return "Editing live source disabled on mobile."
            }
            if ($scope.isUningestedTab()) {
                return "Editing source disabled on mobile."
            }
            return "";
        };

        $scope.disableGridBeforeQuery = function (){
            $scope.isTableDisabled = true;
        };

        $scope.enableGridAfterQuery = function (){
            $scope.isTableDisabled = false;
            $scope.ingestDataSummary.table = null;
        };

        $scope.enableTable = function () {
            if (!$scope.isTableDisabled) {
                return;
            }
            $scope.ingestDataSummary.queryMode = false;
            $scope.ingestDataSummary.tableMode = true;
            $scope.isTableDisabled = false;
            $scope.ingestDataSummary.table = _.get($scope, "ingestDataSummary.selectedSources[0].tableId", null);
        };

        let originalSelectedSource = null;

        $scope.currentQueryData = {
            successQuery: false,
            canceledQuery: false,
            errorQuery: false,
            manualChangesPerformed: false,

            queryRunning: false,
            lastQueryErrorMessage: "",
            cachedPreviewData: false,
            lastQueryTime: 0,
            reset: function() {
                this.successQuery = false;
                this.canceledQuery = false;
                this.errorQuery = false;
                this.manualChangesPerformed = false;
                this.cachedPreviewData = false;
            }
        };

        $scope.getQueryNoteMessage = () => {
            const { errorQuery , successQuery, queryRunning } = $scope.currentQueryData;

            if(errorQuery || queryRunning) {
                return null;
            } else if($scope.ingestDataSummary.queryMode && !successQuery) {
                return `Note that you can save your data directly to a datadoc by clicking "${$scope.getSaveDataMessage()}".`;
            } else if($scope.ingestDataSummary.tableMode || $scope.ingestDataSummary.queryMode) {
                return `To save all results to your datadoc, click "${$scope.getSaveDataMessage()}".`;
            } else if($scope.currentQueryData.cachedPreviewData) {
                return `To get "fresh" results, click Run Query.`;
            }
            return null;
        };

        $scope.getQuerySuccessMessage = () => {
            const {successQuery, canceledQuery, errorQuery, queryRunning, manualChangesPerformed} = $scope.currentQueryData;
            if(queryRunning || errorQuery || !(successQuery || canceledQuery || $scope.ingestDataSummary.tableMode || $scope.ingestDataSummary.queryMode)) {
                return null;
            } else if($scope.currentQueryData.cachedPreviewData && successQuery && !manualChangesPerformed) {
                return `Preview Data loaded from cache.`;
            } else if($scope.ingestDataSummary.tableMode) {
                return `Previewing table below.`;
            } else if($scope.ingestDataSummary.queryMode && !successQuery) {
                return `Click button to preview query results.`;
            } else if($scope.ingestDataSummary.queryMode) {
                return `Previewing results below (${$scope.currentQueryData.lastQueryTime} elapsed)`;
            } else if($scope.currentQueryData.canceledQuery) {
                return `Query cancelled after ${$scope.currentQueryData.lastQueryTime}`;
            }
            return null;
        };

        $scope.getQueryErrorMessage = () => {
            const { errorQuery , queryRunning } = $scope.currentQueryData;

            if(queryRunning) {
                return null;
            }

            if(errorQuery) {
                return $scope.currentQueryData.lastQueryErrorMessage;
            }
            return null;
        };

        function resetSavedViewsSelection() {
            const savedViews = _.get($scope, 'ingestDataSummary.savedViews');

            if (!savedViews)
                return;

            _.each($scope.ingestDataSummary.savedViews, v => {
                v.selected = false;
            });
        }

        $scope.loadSource = function(source, parent, skipPreview = false, forcePreview = true, payload = {}){
            IngestDataLoadingService.clear($scope);
            // select source
            resetSavedViewsSelection();
            $scope.sourceSearch.value = '';
            originalSelectedSource = source;
            let savedQuerySelected = SourceService.isDbQuerySource(source),
                newQuerySelected = isNewQuerySource(source),
                tableSelected = SourceService.isDbTableSource(source);

            $scope.ingestDataSummary.queryMode = $scope.isTableDisabled = savedQuerySelected || newQuerySelected;
            $scope.ingestDataSummary.query = savedQuerySelected ? source.descriptor.query : $scope.ingestDataSummary.query;
            $scope.ingestDataSummary.tableMode = tableSelected;
            $scope.ingestDataSummary.table = tableSelected ? source.tableId : null;

            // Todo: check if we need it at all
            if(savedQuerySelected){ // attach DB source to the tab
                source.queryId = source.id;
                source.id = source.parentId;
            }

            if((savedQuerySelected || newQuerySelected || tableSelected) && parent){
                $scope.updateQueryHistory(parent);
                $scope.updateQueryFavorites(parent);
                $scope.updateDatabaseTables(parent);
                $scope.updateQueryEditorMode(source);
            }
            if(!isNewQuerySource(source)) {
                if(parent){
                    wrapSource(parent, source);
                } else {
                    if(tableSelected) {
                        source.fullName = source.parentName;
                    } else {
                        wrapSource({
                            id: source.parentId,
                            name: source.parentName,
                            type: source.descriptor.section ? 'composite-ds' : 'ds'
                        }, source)
                    }
                }
            }
            $scope.ingestDataSummary.selectedSources = [_.cloneDeep(source)];
            $scope.ingestDataSummary.lastSourceSelected = _.cloneDeep(source);
            $scope.ingestDataSummary.relatedDatadocs = _.cloneDeep(source.relatedDatadocs);
            $scope.sourceSearchPopupOptions.ingestDataSummary = $scope.ingestDataSummary;

            // sync last selected source with server
            let tab = $scope.tabsSection.options.activeTab;
            tab.state.lastSourceSelectedId = source.id;
            BookmarkEventService.emit('.ingest.LastSourceSelectedIdChangeEvent', {
                lastSourceSelectedId: tab.state.lastSourceSelectedId
            }, $scope);

            $scope.ingestPreviewLoaded = false;
            $scope.updateIngestSettings(skipPreview, false, false, forcePreview, false, payload)
                .then(() => {
                    $rootScope.$emit('refresh-ingest-other-settings-dropdown');
                });
            $scope.isShowFilters = tab.state.showFilters && ($scope.ingestDataSummary.queryMode || $scope.ingestDataSummary.tableMode) && !$scope.isMobileView();
            if($scope.isShowFilters) {
                $scope.$broadcast('expand-visualization-filters');
            } else {
                $scope.$broadcast('collapse-visualization-filters');
            }
            tryShowDelimiterStickyNote($scope.ingestDataSummary.lastSourceSelected);
        };

        $scope.sourceSuggestionSelected = function ($item, $event) {
            $event.stopPropagation();

            const suggestionOptions = { keepOpened: true };
            $scope.sourceSearchPopupOptions.currentSelected = $item.id;
            $scope.sourceSearch.value = '';

            if (SourceService.isDbSource($item)) {
                $http.post('/api/files/get_file', { path: 'id:' + $item.id, sections: true })
                    .then(response => {
                        let parent = response.data;
                        let newQuery = createNewQuerySource(parent);
                        $scope.loadSource(newQuery, parent);
                        $scope.sourceSearchPopupOptions.currentSelected = null;
                    }).catch(e => {
                    console.error(e);
                    $scope.sourceSearchPopupOptions.currentSelected = null;
                });
            } else if ($item.type === 'folder' || $item.type === 'composite-ds') {
                $scope.sourceSearchPopupOptions.isSelectFolderRequest = true;
                $scope.sourcePath = $item.id ? 'id:' + $item.id : '';

                let p = $scope.sourcePath ? $http.post('/api/files/get_file', { path: $scope.sourcePath, sections: true }) : { data: null };
                let container = $($event.currentTarget).parent();

                $q.when(p).then((response) => {
                    let source = response.data;
                    $scope.sourceSearchPopupOptions.selectedFolder = source;
                    $scope.$emit('typeahead-refresh');
                    $timeout(() => container.scrollTop(0));
                    if (source && _.size(source.sections) === 1) {
                        $scope.sourceSuggestionActive = false;
                        $scope.loadSource(_.cloneDeep(source.sections[0]), $scope.sourceSearchPopupOptions.selectedFolder);
                    }
                });
            } else {
                $scope.loadSource(_.cloneDeep($item), $scope.sourceSearchPopupOptions.selectedFolder, false, true, { disablePageLoader: true });
                if ($scope.ingestDataSummary.tableMode) {
                    $timeout(() => $scope.$broadcast('scroll-to-selected-table'))
                }
            }
            return suggestionOptions;
        };

        $scope.removeSource = function (item, $event) {
            _.remove($scope.ingestDataSummary.selectedSources, {id: item.id});
            $scope.cancelPreviewRequest();
            $scope.ingestPreviewLoaded = false;
            $scope.updateIngestColumns();
            $scope.updateIngestSettings();
            $scope.updateIngestColumnsAutocompleteList();
            $event.preventDefault();
            $event.stopPropagation();
        };

        $scope.serializeIngestSettingsToJSON = function(resetColumns) {
            let bookmark = $scope.tabsSection.options.activeTab;
            let dataSummary = $scope.ingestDataSummary;
            let source = dataSummary.selectedSources[0];
            let columns = dataSummary.columns;
            if(resetColumns){
                columns = [];
            }
            let columnSettings = _.filter(_.map(columns, col => {
                let isSelected = $scope.isIngestColChecked(col);
                col.settings.initialIndex = col.initialIndex;
                if (!isSelected) {
                    let cloneCol = _.cloneDeep(col);
                    cloneCol.settings.removed = true;
                    return cloneCol.settings;
                }
                return col.settings;
            }), c => c.name);

            if (!source) { return null; }
            return FlowService.create(bookmark, source, columnSettings, dataSummary);
        };

        $scope.cancelCommit = function(){
            if($scope.isCommitRunning()){
                $scope.ingestionCancelModal = $uibModal.open({
                    templateUrl: 'static/templates/include/cancel-commit.html',
                    scope: $scope,
                    animation: true,
                    size: 'md',
                    windowClass: 'preview-format-modal'
                });
            }
        };

        $scope.doCancelCommit = function (){
            BookmarkCommitService.updateStatus($scope.tabId, 'Cancelling...');

            BookmarkCommitService.cancel($scope.tabId);
        };

        $scope.closeIngestionCancelModal = function(){
            if($scope.ingestionCancelModal) {
                $scope.ingestionCancelModal.dismiss();
            }
        };

        $scope.selfBlur = (event) => { event.currentTarget.blur() };

        $scope.ingestCommitOptions = {
            isFailed: false
        };

        $scope.commitProgress = {
            getValue: function(bookmarkId){
                if(!bookmarkId){
                    bookmarkId = $scope.tabId;
                }
                let task = BookmarkCommitService.get(bookmarkId);
                return task && task.progress;
            },
            getShortText: function(bookmarkId) {
                if(!bookmarkId) {
                    bookmarkId = $scope.tabId;
                }
                let task = BookmarkCommitService.get(bookmarkId);
                if(task && (task.progress != undefined)) {
                    return (task.progress >= 100 ? 99 : task.progress) + '%';
                }
                return '';
            },
            getText: function(bookmarkId) {
                if(!bookmarkId){
                    bookmarkId = $scope.tabId;
                }
                let task = BookmarkCommitService.get(bookmarkId);
                if(task && !task.progress && task.status) {
                    return task.status;
                } else if(task && (task.progress != undefined)) {
                    return task.progress >= 100 ? 'Finishing...' : task.progress + '%';
                }
                return '';
            }
        };

        function tryShowDelimiterStickyNote(source){
            $scope.cantDetectDelimiterNote.opened =
                !_.includes(source.closedNotes, 'CANT_DETECT_DELIMITER')
                && source.descriptor.format === 'CSV'
                && !source.descriptor.settings.delimiter;
        }

        $scope.closeDelimiterStickyNote = function(){
            let source = $scope.ingestDataSummary.selectedSources[0],
                noteType = 'CANT_DETECT_DELIMITER';
            if(source) {
                if($scope.cantDetectDelimiterNote.opened) {
                    originalSelectedSource.closedNotes.push(noteType);
                    $http.post('/api/files/close_sticky_note', {
                        path: 'id:' + source.id,
                        stickyNoteType: noteType
                    })
                }
                $scope.cantDetectDelimiterNote.opened = false;
            }
        };

        function hasRelatedDatadocs(source) {
            return _.size(source.relatedDatadocs) > 0;
        }

        $scope.closeFieldsStickyNote = function(){
            let source = $scope.ingestDataSummary.selectedSources[0],
                noteType = 'CANT_DETECT_FIELDS';
            if(source) {
                if($scope.cantDetectFieldNamesNote.opened) {
                    originalSelectedSource.closedNotes.push(noteType);
                    $http.post('/api/files/close_sticky_note', {
                        path: 'id:' + source.id,
                        stickyNoteType: noteType
                    })
                }
                $scope.cantDetectFieldNamesNote.opened = false;
            }
        };

        function closeAllStickyNotes(){
            $scope.closeFieldsStickyNote();
            $scope.closeDelimiterStickyNote();
        }

        $scope.updateQueryFromHistory = function(query){
            $scope.ingestDataSummary.query = query;
            $scope.ingestDataSummary.table = null;
            $timeout(() => IngestDataLoadingService.clear($scope));
        };

        $scope.updateQueryHistory = function(source){
            $scope.ingestDataSummary.queryHistory = _.sortByOrder(source.descriptor.queryHistory, 'startTime', 'desc');
        };

        $scope.updateQueryFromFavorites = function(query){
            $scope.loadSource(_.cloneDeep(query));
            $scope.$broadcast('ingest-run-query', {force: false});
        };

        $scope.saveFavoriteQuery = () => {
            $scope.saveQueryModalSettings.saving = true;
            let update = !!$scope.ingestDataSummary.selectedSources[0].queryId
                && ($scope.saveQueryModalSettings.queryName === $scope.ingestDataSummary.selectedSources[0].name),
                url, params;
            if(update){
                url = 'api/files/update_remote_query';
                params = {
                    name: $scope.saveQueryModalSettings.queryName,
                    query: $scope.ingestDataSummary.query,
                    path: 'id:' + $scope.ingestDataSummary.selectedSources[0].queryId
                }
            } else {
                url = '/api/files/create_remote_query';
                params = {
                    name: $scope.saveQueryModalSettings.queryName,
                    query: $scope.ingestDataSummary.query,
                    remoteLinkPath: 'id:' + $scope.ingestDataSummary.selectedSources[0].id
                }
            }
            $http.post(url, params)
                .then((result) => {
                    $scope.$emit('typeahead-refresh');
                    $scope.refreshQueryFavorites().then(() => {
                        if(!update) {
                            let query = result.data;
                            query = wrapSource({name: query.parentName, id: query.parentId}, query);
                            $scope.loadSource(query, null, true, true);
                        }
                        $scope.saveQueryModalSettings.saving = false;
                        $scope.closeSaveQueryModal();
                    });
                }, response => {
                    console.log('saving error', response.data);
                    $scope.saveQueryModalSettings.saving = false;
                    $scope.closeSaveQueryModal();
                    cc.notify({
                        message: response.data.message,
                        icon: 'warning',
                        wait: 2
                    });
                });
        };

        $scope.updateQueryFavorites = function(source) {
            let favorites = _.filter(source.sections, function(s) {
                return !s.descriptor.tableName;
            });
            _.each(favorites, fav => {
                wrapSource(source, fav);
            });
            $scope.ingestDataSummary.queryFavorites = _.sortByOrder(favorites, [fav => fav.name.toLowerCase()]);
        };

        $scope.confirmQueryDelete = function(e, query) {
            $scope.selectedQuery = query;
            $scope.confirmationModal = $uibModal.open({
                templateUrl: 'static/templates/include/delete-query.html',
                scope: $scope,
                animation: true,
                size: 'md'
            });
        };

        $scope.deleteQueryFromFavorites = function(query) {
            $http.post('/api/files/delete', {paths: ['id:' + query.id]})
                .then(() => {
                    $scope.refreshQueryFavorites();
                });
        };

        $scope.closeConfirmationModal = function() {
            $scope.confirmationModal.dismiss();
        };

        $scope.$on('refresh-query-history', function(){
            let sourceId = $scope.ingestDataSummary.selectedSources[0].id;
            $http.post('/api/files/get_file', {path: 'id:' + sourceId})
                .then(result => {
                    let source = result.data;
                    $scope.updateQueryHistory(source);
                })

        });

        $scope.refreshQueryFavorites = function() {
            let sourceId = $scope.ingestDataSummary.selectedSources[0].id;
            return $http.post('/api/files/get_file', {path: 'id:' + sourceId, sections:true})
                .then(result => {
                    let source = result.data;
                    $scope.updateQueryFavorites(source);
                })
        };

        $scope.isRemote = function(source) {
            const selectedSource = $scope.ingestDataSummary.selectedSources[0];

            let sourceDescriptor = source ? source.descriptor.remote :
                (selectedSource ? selectedSource.descriptor.remote : false);
            let newQueryType = source ? source.type :
                (selectedSource ? selectedSource.type : false);
            return sourceDescriptor || newQueryType === 'new_query';
        };

        $scope.isRefreshableSource = function (){
            let schema = $scope.tabsSection.options.activeTab.tableSchema;
            return schema
                && schema.uploads
                && schema.uploads.length
                && schema.uploads[0].descriptor.remote
                && !$scope.sourceValidationInfo.removed
                ;
        };

        $scope.ingestOtherSettingsInfo = {};
        $scope.isShowMore = function (){
            let enabledMainSettingsCount = _.compact([
                !$scope.ingestDataSummary.queryMode,
                $scope.isShowHeaderInFirstRowOption(),
                $scope.isRemote()
            ]).length;
            let enabledOtherSettingsCount = $scope.ingestOtherSettingsInfo.count;

            return enabledMainSettingsCount > 1 && enabledOtherSettingsCount > 2;
        };

        $scope.isSaveOrUpdate = function() {
            return $scope.saveQueryModalSettings.update
                && $scope.saveQueryModalSettings.queryName
                === $scope.ingestDataSummary.selectedSources[0].name
        };

        $scope.saveQueryModalSettings = {};
        $scope.showSaveQueryModal = function() {
            let update = !!$scope.ingestDataSummary.selectedSources[0].queryId;
            if(update) {
                $scope.saveQueryModalSettings.queryName = $scope.ingestDataSummary.selectedSources[0].name;
            } else {
                $scope.saveQueryModalSettings.queryName = null;
            }
            $scope.saveQueryModalSettings.update = update;
            $scope.saveQueryModal = $uibModal.open({
                templateUrl: 'static/templates/include/save-query-to-favorites.html',
                scope: $scope,
                animation: true,
                size: 'md'
            });
        };
        $scope.closeSaveQueryModal = function() {
            $scope.saveQueryModal.dismiss();
        };
        $scope.updateDatabaseTables = function(source){
            let sections = _.filter(source.sections, function(s) {
                return s.descriptor.tableName;
            });
            $scope.ingestDataSummary.databaseTables = _.chain(sections)
                .each(s => s.tableId = s.id)
                .sortBy(s => s.descriptor.tableName)
                .value();
        };

        $scope.selectDatabaseView = (view) => {
            const source = _.get($scope, 'ingestDataSummary.selectedSources[0]');
            if (source) {
                source.queryId = view.query.id;
            }
            $scope.ingestDataSummary.table = null;
            resetSavedViewsSelection();
            view.selected = true;
            $scope.ingestDataSummary.tableMode = false;
            $scope.ingestDataSummary.queryMode = true;
            $scope.ingestDataSummary.query = view.query.query;
            $scope.$broadcast('ingest-run-query', {force: true});
        };

        $scope.forceRefreshDatabaseTables = function (database) {

            if ($scope.databaseTablesSettings.refresh) {
                return;
            }
            $scope.databaseTablesSettings.refresh = true;
            $scope.ingestDataSummary.databaseTables = [];
            if (SourceService.isDbSource(database)) {
                return $http.post('/api/files/refresh_tables', {path: 'id:' + database.id})
                    .then(response => {
                        $scope.updateDatabaseTables(response.data);
                        $scope.databaseTablesSettings.refresh = false;
                    }, e => {
                        console.error('Failed to update tables', e);
                        $scope.databaseTablesSettings.refresh = false;
                    });
            } else {
                console.error('Wrong source', database);
                $scope.databaseTablesSettings.refresh = false;
            }
        };

        $scope.updateQueryEditorMode = function(source){
            let mode = 'text/x-sql';
            switch(source.descriptor.format){
                case 'MYSQL_QUERY':
                    mode = 'text/x-mysql';
                    break;
                case 'POSTGRESQL_QUERY':
                    mode = 'text/x-pgsql';
                    break;
                case 'MSSQL_QUERY':
                    mode = 'text/x-mssql';
                    break;
                case 'ORACLE_QUERY':
                        mode = 'text/x-plsql';
                    break;
            }
            $scope.ingestDataSummary.queryEditorOptions.mode = mode;
        };

        $scope.isSourceDeleted = () => {
            return _.get($scope.ingestDataSummary, 'selectedSources[0].deleted');
        };

        $scope.sourceValidationInfo = {
            removed: false,
            valid: true
        };

        $scope.deserializeIngestSettingsFromJSON = function(json) {
            if (json) {
                let obj = JSON.parse(json);

                let selectedSource = obj.cells[0],
                    selectedSourceId = selectedSource.settings.uploadId;
                $scope.ingestDataSummary.selectedColumns = [];
                return $http.post('/api/files/get_file', {path: 'id:' + selectedSourceId, sections: true, relatedDatadocs: true})
                    .then(response => {
                        $scope.sourceValidationInfo.removed = false;
                        let promises = [];
                        let source = response.data;
                        if (SourceService.isDbSource(source)) {
                            SourceService.retrieveDbRelatedData(source.id).then(result => {
                                $scope.ingestDataSummary.savedViews = result;
                            });

                            $scope.ingestDataSummary.parentDatabase = source;
                            $scope.sourceValidationInfo.valid = _.get($scope.ingestDataSummary.parentDatabase, 'descriptor.valid') !== false;

                            if (FlowService.isQueryInputNode(obj.cells[0])) {
                                $scope.ingestDataSummary.queryMode = true;
                                $scope.ingestDataSummary.tableMode = false;
                                $scope.ingestDataSummary.query = selectedSource.settings.query;
                                $scope.updateQueryHistory(source);
                                $scope.updateQueryFavorites(source);
                                $scope.updateDatabaseTables(source);
                                source = createNewQuerySource(source);
                                source.queryId = selectedSource.settings.queryId;
                                $scope.updateQueryEditorMode(source);
                            } else if (FlowService.isTableInputNode(obj.cells[0])) {
                                $scope.ingestDataSummary.queryMode = false;
                                $scope.ingestDataSummary.tableMode = true;
                                $scope.ingestDataSummary.table = selectedSource.settings.tableId;
                                $scope.updateDatabaseTables(source);
                                source = _.find($scope.ingestDataSummary.databaseTables, {tableId: selectedSource.settings.tableId});
                                source.fullName = source.parentName;
                            }
                        } else {
                            if(hasRelatedDatadocs(source)) {
                                $scope.ingestDataSummary.relatedDatadocs = source.relatedDatadocs;
                            }
                            $scope.ingestDataSummary.tableMode = false;
                            $scope.ingestDataSummary.queryMode = false;
                            wrapSource(source.parentsPath[0], source);
                        }
// this mutation is unacceptable, but without it, we need to reimplement descriptors
                        return $http.post(`/api/docs/bookmarks/preset_settings_from_bookmark`, {
                            tabId: $scope.tabId,
                            sourceId: source.id
                        }).then(({data}) => {
                            if(data) source.descriptor = data;
                            $scope.ingestDataSummary.selectedSources = [source];
                            let activeCommitTask = BookmarkCommitService.get($scope.tabsSection.options.activeTab.id);
                            toggleCommit(!!activeCommitTask);
                            return $q.all(promises);
                        });
                    }).catch(e => {
                        if(e.status === 404) {
                            if($scope.isIngestMode()) {
                                const message = 'This datadoc is not connected to a source. Please re-add a source for this datadoc';
                                NotificationsUtils.notify({ message }, { type: NotificationsUtils.NotificationType.WARNING, delay: 4});
                            }
                            $scope.sourceValidationInfo.removed = true;
                            $scope.sourceSuggestions();
                            $timeout(() => {
                                $('.search-autocomplete input').focus();
                            });
                            $scope.toggleSourceSuggestionActive(false);
                        }
                    });
            } else {
                toggleCommit(false);

                $scope.ingestDataSummary.selectedSources = [];
                $scope.ingestDataSummary.sources = [];
                $scope.ingestDataSummary.lastSourceSelected = null;
                $scope.ingestDataSummary.mostRecentSource = null;
                $scope.ingestDataSummary.selectedColumns = [];
                return Promise.resolve();
            }
        };

        $scope.updateIngestSettings = function(skipPreview, noReset, resetColumns, forcePreview = true, changedByUser = true, options = {}) {
            if(!$scope.isCommitRunning()) {
                $scope.currentQueryData.manualChangesPerformed = changedByUser;
                const flowJSON = $scope.serializeIngestSettingsToJSON(resetColumns);
                $scope.tabsSection.options.activeTab.state.flowJSON = flowJSON;
                if(!skipPreview && !$scope.ingestDataSummary.selectedSources.length){
                    IngestDataLoadingService.clear($scope);
                }

                const params = {
                    flowJSON: flowJSON,
                    skipPreview: skipPreview,
                    force: forcePreview,
                    noReset: noReset
                };

                return BookmarkEventService.emit('.ingest.IngestSettingsChanged', params, $scope)
                    .then(() => {
                        if (!skipPreview) {
                            options.force = forcePreview;
                            return IngestDataLoadingService.preview($scope, options);
                        }
                    }).then(response => {
                        $scope.toggleSourceSuggestionActive(false);
                        return response;
                    });
            }
            return Promise.resolve();
        };

        function onIngestStart (t, e) {
            if($scope.ingestDataSummary.selectedSources[0]) {
                // $scope.isRefreshingNow = false;
                if (_.includes(e.sourceIds, $scope.ingestDataSummary.selectedSources[0].id)) {
                    $scope.ingestDataSummary.selectedSources[0].ingesting = true;
                    $scope.ingestDataSummary.selectedSources[0].ingestProgress = 0;
                }
            }
        }
        function onIngestComplete (t, e) {
            $scope.isRefreshingNow = false;
            if (e.user !== User.getCurrent().id) {
                $scope.tabsSection.loadTabFromServer({id: e.bookmarkId}, null, User.getCurrent().id)
                    .then(processedTab => {
                        if (!processedTab)
                            return;

                        const activeTabId = _.get($scope, 'tabsSection.options.activeTab.id');

                        _.remove($scope.tabsSection.options.tabs, t => t.id === e.bookmarkId); // remove existing tab
                        $scope.tabsSection.options.tabs.push(processedTab); // push processed tab
                        $scope.tabsSection.options.tabs = _.sortBy($scope.tabsSection.options.tabs, t => t.position); // sort by position

                        if (activeTabId === e.bookmarkId) {
                            $timeout(() => $scope.tabsSection.setActiveTab(processedTab, false, true));
                        }
                    }).catch(e => {
                    console.error("Fetching processed tab failed", e);
                });
                return;
            }
            const selectedSource = $scope.ingestDataSummary.selectedSources[0];
            if(selectedSource) {
                $scope.closeIngestionCancelModal();
                if (_.includes(e.sourceIds, selectedSource.id) || _.includes(e.sourceIds, selectedSource.parentId)) {
                    if (e.error || e.stopped) {
                        if(e.errorCode === 'interrupted' || e.stopped) {
                            console.log("APPLY FLOW COMPLETE INTERRUPTED OR STOP")
                            return;
                        }
                        let err = IngestDataLoadingService.getErrorMessage({
                            code: e.errorCode,
                            message: e.errorMessage
                        });
                        if(e.errorCode === 'stop_on_error'){
                            $scope.cantIngestFileDueToErrorsNote.opened = true;
                        } else if (e.errorCode !== 'interrupted') {
                            cc.notify(err);
                        }

                        if (e.errorCode !== 'interrupted') {
                            $scope.$evalAsync(() => $scope.ingestCommitOptions.isFailed = true);
                        }
                    } else {
                        selectedSource.ingesting = false;
                        selectedSource.ingestProgress = 1;
                        $scope.goToVisualization({id: e.datadocId});
                    }
                }
            }
        }
        function onIngestProgress (t, e) {
            if($scope.ingestDataSummary.selectedSources[0]) {
                if (_.includes(e.sourceIds, $scope.ingestDataSummary.selectedSources[0].id)) {
                    $scope.ingestDataSummary.selectedSources[0].ingesting = true;
                    $scope.ingestDataSummary.selectedSources[0].ingestProgress = t.progress >= 100 ? 0.99 : t.progress / 100.;
                }
            }
        }

        $scope.ingestSelectedSource = function () {
            $scope.ingestDataSummary.selectedSources[0].ingesting = true;
            $scope.ingestDataSummary.selectedSources[0].ingestProgress = 0;
            BookmarkCommitService.ingest($scope.ingestDataSummary.selectedSources[0], {embedded: false});
        };

        BookmarkCommitService.reset({isPublicChannel: true});
        BookmarkCommitService.on('start', onIngestStart);
        BookmarkCommitService.on('complete', onIngestComplete);
        BookmarkCommitService.on('progress', onIngestProgress);

        $scope.$on('$destroy', function(){
            BookmarkCommitService.off('start', onIngestStart);
            BookmarkCommitService.off('complete', onIngestComplete);
            BookmarkCommitService.off('progress', onIngestProgress);
        });

        $scope.updateIngestColumns = function() {
            let descriptor = $scope.previewDescriptor;
            if(!descriptor){
                descriptor = {columns: []};
            }
            $scope.ingestDataSummary.columns = descriptor.columns;
            $scope.ingestDataSummary.selectedColumns = descriptor.columns;
            $scope.updateColumns();
        };


        $scope.dataTypeModalSettings = {
            columns: [],
            availableFormatOptions: [],
            hasChanges: false,
            needToReIngest: false,
            formatTypeNames: {
                TEXT: 'Text',
                NUMBER: 'Number',
                PERCENT: 'Percent',
                FINANCIAL: 'Financial',
                DATE_1: 'Date v1',
                DATE_2: 'Date v2',
                DATE_TIME: 'Datetime',
                TIME: 'Time',
                DURATION: 'Duration',
                BOOLEAN_1: 'Boolean y/n',
                BOOLEAN_2: 'Boolean T/F'
            },
            iconClass: {
                TEXT: 'string',
                NUMBER: 'number',
                PERCENT: 'number',
                FINANCIAL: 'number',
                DATE_1: 'date',
                DATE_2: 'date',
                DATE_TIME: 'date',
                TIME: 'time',
                DURATION: 'time',
                BOOLEAN_1: 'boolean',
                BOOLEAN_2: 'boolean'
            },
            highlightOtherFormatGroup: function(group){
                let options = _.filter($scope.dataTypeModalSettings.availableFormatOptions, {group: group});
                $scope.dataTypeModalSettings.removeHighlightOtherFormat();
                _.each(options, option => { option.highlighted = true });
            },
            removeHighlightOtherFormat: function(){
                _.each($scope.dataTypeModalSettings.availableFormatOptions, option => { option.highlighted = false });
            },
            refreshFormatOptions: function (col, open){
                function checkNeedToReIngest(){
                    let needToReIngest = false,
                        hasChanges = false;
                    _.each($scope.dataTypeModalSettings.columns, function(col){
                        needToReIngest = needToReIngest || !FormatToolbarService.isBasicFormat(col, col.settings.format.type);
                        let originalCol = _.find($scope.columns, {field: col.field});
                        col.formatChanged = originalCol.settings.format.type !== col.settings.format.type;
                        hasChanges = hasChanges || col.formatChanged;
                    });
                    $scope.dataTypeModalSettings.needToReIngest = needToReIngest;
                    $scope.dataTypeModalSettings.hasChanges = hasChanges;
                }

                if(open){
                    $scope.dataTypeModalSettings.availableFormatOptions =
                        FormatToolbarService.getFormatOptionsForColumn($scope, col, ($scope, format) => {

                            $http.post("/api/visualization/format-value", {
                                tabId: $scope.tabId,
                                stateId: $scope.bookmarkStateId,
                                fieldName: col.field,
                                format: col.settings.format
                            }).then((newExampleValue) => {
                                col.exampleValue = newExampleValue.data;

                                if (col.parseFailed) {
                                    col.parseFailed = false;
                                }
                            }).catch((err) => {
                                console.log(col);
                                col.exampleValue = ``;
                                col.parseFailed = true;
                            });
                            if(_.isFunction(format)){
                                format(col.settings.format, col);
                            } else {
                                col.settings.format = format
                            }
                            checkNeedToReIngest();
                        }, true);
                }
            },
            reset: function(){
                $scope.dataTypeModalSettings.hasChanges = false;
                $scope.dataTypeModalSettings.needToReIngest = false;
            },
            inputFocus: function(col, index, event) {
              col.oldName = col.name;
                event.currentTarget.select();
            },
            doUpdateColumnName: function(col) {
                let column = _.find($scope.columns, {field: col.field});
                if(col.name !== col.oldName) {
                    DataLoadingService.updateColumnName(column, col.name, $scope);
                }
            },
            inputKeyPress: function(e, col) {
                e.stopPropagation();
                switch (e.keyCode) {
                    case 13:
                        e.currentTarget.blur();
                        break;
                    case 27:
                        col.name = col.oldName;
                        e.currentTarget.blur();
                        break;
                }
            },
            apply: function(){
                $scope.dataTypeModalSettings.savingChanges = false;
                $timeout(function(){
                    if($scope.dataTypeModalSettings.needToReIngest){
                        $scope.updateIngestSettingsAndCommit(() => {
                            _.each($scope.dataTypeModalSettings.columns, col => {
                                let ingestColumn = _.find($scope.ingestDataSummary.columns, function (c) {
                                    return c.settings.rename === col.originalField || c.name === col.originalField;
                                });
                                if(ingestColumn) {
                                    if(col.formatChanged) {
                                        ingestColumn.settings.formatType = col.settings.format.type;
                                        if(!FormatToolbarService.isBasicFormat(col, col.settings.format.type)) {
                                            let format = FormatToolbarService.getTypeByFormat(
                                                ingestColumn.settings.formatType);
                                            ColumnsService.setDataType(ingestColumn, format);
                                        }
                                    }
                                }
                            });
                            return true;
                        }).then(() => {
                            $scope.dataTypeModalSettings.savingChanges = false;
                        })
                    } else {
                        _.each($scope.dataTypeModalSettings.columns, col => {
                            if(col.formatChanged && FormatToolbarService.isBasicFormat(col, col.settings.format.type)) {
                                let originalCol = _.find($scope.columns, c => c.field === col.field);
                                originalCol.settings.format = col.settings.format;
                                BookmarkEventService.emit(".cols.ColFormatChangeEvent", {
                                    field: col.field,
                                    format: col.settings.format
                                }, $scope);
                            }
                        });
                        setTimeout(function(){
                            $scope.gridOptions.api.refreshView();
                        })
                    }
                });
            }
        };

        $scope.dateFormatModalSettings = {
            column: null,
            pattern: null
        };
        $scope.showDateFormatModal = function(settings, columns, originalType){
            let pattern = settings.type.pattern || (originalType && originalType.pattern);
            $scope.dateFormatModalSettings = {
                column: settings,
                columns: columns,
                pattern: pattern
            };
            $scope.dateFormatModal = $uibModal.open({
                templateUrl: 'static/templates/include/date-format.html',
                scope: $scope,
                animation: true,
                size: 'md'
            })
        };
        $scope.closeDateFormatModal = function(){
            $scope.dateFormatModal.dismiss();
        };
        $scope.updateDateFormat = function(){
            _.each($scope.dateFormatModalSettings.columns, function(column){
                column.settings.type = {
                    '@class': 'com.dataparse.server.service.parser.type.DateTypeDescriptor',
                    dataType: 'DATE',
                    pattern: $scope.dateFormatModalSettings.pattern
                };
                ColumnsService.resetSearchType(column);
            });
            $scope.dateFormatModal.dismiss();
            $scope.updateIngestSettings(true);
        };

        $scope.convertToListModalSettings = {
            columns: null,
            separator: null,
            hasSeparator: null
        };
        $scope.showConvertToListModal = function(columns){
            $scope.convertToListModalSettings.columns = columns;
            let column = _.find(columns, col => col.settings.splitOn);
            if(column){
                $scope.convertToListModalSettings.hasSeparator = true;
                $scope.convertToListModalSettings.separator = column.settings.splitOn;
            } else {
                $scope.convertToListModalSettings.hasSeparator = false;
                $scope.convertToListModalSettings.separator = ',';
            }
            $scope.convertToListModal = $uibModal.open({
                templateUrl: 'static/templates/include/convert-to-list.html',
                scope: $scope,
                animation: true,
                size: 'md'
            });
        };
        $scope.closeConvertToListModal = function () {
            console.log('modal closed');
            $scope.convertToListModal.dismiss();
        };
        function saveIngestColumnChanges(columns, callback){
            if ($scope.isVizMode()) {
                $scope.showReIngestModal({
                    actionText: `Convert ${columns[0].name} to list?`,
                    reload: () => {
                        $scope.reIngestModalOptions.starting = true;
                        $scope.updateIngestSettingsAndCommit(() => {
                            callback(columns);
                            return true;
                        }).then(() => {
                            $scope.reIngestModalOptions.starting = false;
                            $scope.cancelReIngestModal();
                        });
                    }
                });
            } else {
                callback(columns);
                $scope.updateIngestSettings();
            }
        }

        $scope.updateConvertToList = function() {
            saveIngestColumnChanges($scope.convertToListModalSettings.columns, columns => {
                _.each(columns, column => {
                    column.settings.splitOn = $scope.convertToListModalSettings.separator;
                });
            });
            $scope.convertToListModal.dismiss();
        };
        $scope.deleteConvertToList = function(){
            saveIngestColumnChanges($scope.convertToListModalSettings.columns, columns => {
                _.each(columns, column => {
                    column.settings.splitOn = null;
                });
            });
            $scope.convertToListModal.dismiss();
        };

        $scope.showDatadocInfoModal = function(){
            $scope.datadocInfoModal = $uibModal.open({
                templateUrl: 'static/templates/include/datadoc-info.html',
                scope: $scope,
                animation: true,
                size: 'md'
            });
            $scope.datadocInfoModal.stats = {};
            $scope.datadocInfoModal.statsLoading = true;
            $scope.datadocInfoModal.selectTab = function(tab){
                $scope.datadocInfoModal.selectedTabStats = tab;
            };
            $http.get('/api/docs/' + $scope.selectedTable.id + '/stats').then(result => {
                $scope.datadocInfoModal.stats = result.data;
                $scope.datadocInfoModal.statsLoading = false;
                $scope.datadocInfoModal.selectTab(_.find(result.data.bookmarks, {
                    bookmarkId: $scope.tabsSection.options.activeTab.id
                }));
            });

        };
        $scope.closeDatadocInfoModal = function(){
            $scope.datadocInfoModal.dismiss();
        };

        function getCurrentFolder() {
            let currentFolderId = _.get(SourceService.getSelectedFolder(), 'id', null);
            if (!currentFolderId) {
                if ($scope.isVizMode() && !$scope.selectedTable.preSaved) {
                    currentFolderId = _.get($scope, 'selectedTable.parentId');
                } else if ($scope.isIngestMode()) {
                    // todo: What if we need to get to the untitled, presaved datadoc, not it's source?
                    let parentsPath = _.get($scope, 'ingestDataSummary.selectedSources[0].parentsPath[0]');
                    if (parentsPath && parentsPath.type === "folder")
                        currentFolderId = parentsPath.id;
                } else {
                    console.warn("Cannot specify current folder");
                }
            }
            return currentFolderId;
        }

        $scope.goToMainPage = (toFolder) => {
            RouterService.goToMainPage(true, {f: $scope.isMobileView() || toFolder ? getCurrentFolder() : null});
            // Redirect to the directory where was selected datadoc. Only in mobile view mode for now
        };

        $scope.handleMobileBack = function() {
            if($scope.isViewRawData) {
                $scope.selectDataSummaryBack();
            } else {
                $scope.goToMainPage();
            }
        };

        $scope.showMeList = [];
        $scope.columns = [];
        $scope.results = [];
        $scope.showMeAutoCompleteList = [];
        $scope.groupByList = [];
        $scope.isShowFilterTooltip = false;
        $scope.subMenuShowMeShown = {};
        $scope.history = [];
        $scope.chartDatepicker = false;
        $scope.chartTotals = [];
        $scope.popupData = {is: false};
        $scope.bookmarkStorage = {
            $$newBookmark: {
                name: ''
            },
            $$editing: null,
            $$isOpen: false,
            bookmarks: []
        };
        $scope.requestFinished = false;
        $scope.fromHistory = false;
        $scope.expandOnDrillDown = false;
        $scope.initialLoading = true;
        $scope.customDateChartFilter = null;

        $scope.selectedTable = DataLoadingService.getCurrentDoc();

        if(!$scope.selectedTable) {
            RouterService.goToMainPage(true);
        }

        const VIEW_MODES = cc.getViewModes(),
            VIEW_MODE_OPTIONS = cc.getViewModeOptions();
        $scope.viewMode = VIEW_MODES.TABLE;
        $scope.viewModes = VIEW_MODES;
        $scope.viewModeCodes = _.values(VIEW_MODES).sort();
        $scope.formatToolbarButtons = FormatToolbarService.getFormatButtons($scope);
        $scope.otherFormatOptions = FormatToolbarService.getOtherFormatOptions($scope);
        $scope.isFormatToolbarActive = function (){
            return FormatToolbarService.isFormatToolbarActive($scope);
        };
        $scope.refreshOtherFormatOptions = function(){
            $scope.columnTypeDropdownStatus = {
                isOpen: false
            };
            $scope.otherFormatOptions = FormatToolbarService.getOtherFormatOptions($scope);
            $scope.columnTypeDropdownStatus.isOpen = true;
        };

        $scope.formatModalSettings = {};

        const dataSummaryDefault = {
            shows: [], aggs: [], pivot: [], filters: [], search: '',
            count: 100, active: true,
            showAggregationTotal: true,
            advancedModeCheck: false,
            advancedFilterQuery: null,
            formats: [],
            limit: {rawData: 10000, pageSize: 1000, aggData: 100, pivotData: 100}
        };
        $scope.dataSummary = _.merge({}, dataSummaryDefault);

        $scope.isDecimalColFormattedAsDate = (filter) => {
            const DATE_TIME_FORMATS = ['DATE_1', 'DATE_2', 'DATE_TIME', 'TIME']
            const formatType = filter.col.settings.format.type;
            return filter.col.type === 'DECIMAL' && DATE_TIME_FORMATS.includes(formatType);
        };

        $scope.getTooltipForFilter = (filter) => {
          const currentRef = window.location.href;
          const newReferenceToPreviewPage = currentRef.substring(0, currentRef.length - 1) + '1';
          return `Note: to use the date-picker, you will need to go to change this field from a Number to a Date/Time on the <a href="${newReferenceToPreviewPage}">Preview</a> page.`;
        };

        const vizSummaryDefault = {
            xAxisShows: [],
            yAxisShows: [],
            sortBy: [],
            segmentBy: [],
            chartType: VIEW_MODES.TABLE,
            regressionType: null,
            graphLimit: undefined,
            seriesType: {},
            enabledMultiAxis: false,
            showMeasures: true
        };
        $scope.vizSummary = _.merge({}, vizSummaryDefault);

        $scope.isCurrentView = function(view) {
            switch(view) {
                case 'table':
                    return $scope.viewMode === VIEW_MODES.TABLE;
                case 'list':
                    return $scope.viewMode === VIEW_MODES.LIST;
                case 'map':
                    return $scope.viewMode === VIEW_MODES.MAP;
                case 'chart':
                    return !_.contains([VIEW_MODES.TABLE, VIEW_MODES.LIST, VIEW_MODES.MAP], $scope.viewMode);
            }
        };

        $scope.showMeContextMenuOptions = {
            options: []
        };

        $scope.groupByContextMenuOptions = {
            options: []
        };

        $scope.pivotByContextMenuOptions = {
            options: []
        };

        $scope.sourceTagsSectionContextMenuOptions = {
            options: []
        };

        $scope.ingestColumnsContextMenuOptions = {
            options: []
        };

        $scope.updateIngestSettingsAndCommit = function(callback){
            if ($scope.isCommitRunning()) {
                let err = IngestDataLoadingService.getErrorMessage();
                err.message = 'You should cancel current ingest first.';
                cc.notify(err);
                return;
            }

            let tab = $scope.tabsSection.options.activeTab;
            let flowJSON = tab.state.flowJSON;
            let promise = $q.defer();
            $scope.deserializeIngestSettingsFromJSON(flowJSON).then(function(){
                if (callback()) {
                    $scope.ingestDataSummary.selectedColumns = $scope.ingestDataSummary.columns;
                    flowJSON = $scope.serializeIngestSettingsToJSON();
                    tab.state.flowJSON = flowJSON;
                    doCommit();
                    promise.resolve();
                } else {
                    promise.reject();
                    console.error("can't re-ingest");
                }
            });
            return promise.promise;
        };


        $scope.saveSourceSettings = () => {
            // TODO: hide popover
            $scope.updateIngestSettingsAndCommit(() => true);
        };

        $scope.showReIngestModal = function (options, callback) {
            $scope.reIngestModalOptions = _.merge({
                reload: function(){
                    $scope.reIngestModalOptions.starting = true;
                    $timeout(function(){
                        $scope.updateIngestSettingsAndCommit(callback).then(() => {
                            $scope.reIngestModalOptions.starting = false;
                            $scope.cancelReIngestModal();
                        });
                    });
                },
                lastLoadText: $scope.getLastCommitDuration(),
                isStarting: false
            }, options);
            $scope.reIngestModal = $uibModal.open({
                templateUrl: 'static/templates/include/re-ingest-confirm.html',
                scope: $scope,
                animation: true,
                size: 'md'
            });
        };

        $scope.cancelReIngestModal = function (){
            $scope.reIngestModal.dismiss();
        };

        function createIngestColumnsContextMenuObj(col, title) {
            let child = $scope.$new(),
                iconTemplate;

            child.column = col;
            iconTemplate = '<i class="context-menu-icon fa fa-fw" ng-class="{\'fa-check\': $parent.isIngestColChecked(column)}" ></i>';

            const iconHtml = $compile(iconTemplate)(child);

            return {
                getPreHtml: () => iconHtml,
                title: title
            };
        }

        function createShowMeContextMenuObj(col, title, isCheckedFn) {
            return {
                getPreHtml: function() {
                    return '<i class="context-menu-icon fa fa-fw '+(isCheckedFn(col) ? 'fa-check' :'')+'"></i>'
                },
                title: title
            };
        }

        function createShowMeContextMenuObjForShows(col, title, order) {
            let child = $scope.$new(),
                iconTemplate;

            child.column = col;
            iconTemplate = '<i class="context-menu-icon fa fa-fw" ng-class="{\'fa-check\': $parent.isCheckedShowMe(column)}" ></i>';

            const iconHtml = $compile(iconTemplate)(child);

            return {
                getPreHtml: () => iconHtml,
                title: title,
                name: col.name,
                order: order
            };
        }

        function createShowMeContextMenuObjWithAngular(col) {

            var child = $scope.$new(),
                titleTemplate = '<span>' +
                    '<span ng-bind-html="column.showName"></span> ' +
                    '<span style="font-weight: bold; padding-right: 10px;" ng-bind="$parent.showGrouppedByAggs(column.field)"></span>' +
                    '</span>',
                iconTemplate = '<i class="context-menu-icon fa fa-fw" ng-class="{\'fa-check\': $parent.isCheckedShowMe(column)}" ></i>';

            child.column = col;

            var titleHtml = $compile(titleTemplate)(child);
            var iconHtml = $compile(iconTemplate)(child);

            return {
                getPreHtml: function() {
                    return iconHtml;
                },
                getTitleHtml: function() {
                    return titleHtml;
                }
            }
        }

        function getOnShowMeContextMenuClickFn(col, isCheckedFn) {
            return function(scope, event, arg, element) {
                var contextMenuIcon = element.find('.context-menu-icon');

                var isTheSameShow = _.find($scope.dataSummary.shows, { key: col.key }),
                    showIndex = $scope.dataSummary.shows.indexOf(isTheSameShow);

                if (isTheSameShow) {
                    $scope.showMeOnSelect(col, true, null, scope.uiSelectCursorPosition);
                    if (scope.uiSelectCursorPosition > 0 && showIndex < scope.uiSelectCursorPosition) {
                        scope.uiSelectCursorPosition--;
                    }
                } else {
                    $scope.showMeOnSelect(col, true, null, scope.uiSelectCursorPosition);
                }

                if (isCheckedFn(col)) {
                    if(!contextMenuIcon.hasClass('fa-check')) {
                        contextMenuIcon.addClass('fa-check');
                    }
                } else {
                    contextMenuIcon.removeClass('fa-check');
                }
            }
        }

        function getOnIngestColumnsContextMenuClickFn(col, isCheckedFn) {
            return function(scope, event, arg, element) {
                var contextMenuIcon = element.find('.context-menu-icon');

                var isTheSameShow = _.find($scope.ingestDataSummary.selectedColumns, { id: col.id }),
                    colIndex = $scope.ingestDataSummary.selectedColumns.indexOf(isTheSameShow);

                if (isTheSameShow) {
                    $scope.onIngestColumnsSelect(col, true, null, scope.uiSelectCursorPosition);
                    if (scope.uiSelectCursorPosition > 0 && colIndex < scope.uiSelectCursorPosition) {
                        scope.uiSelectCursorPosition--;
                    }
                } else {
                    $scope.onIngestColumnsSelect(col, true, null, scope.uiSelectCursorPosition);
                }

                if (isCheckedFn(col)) {
                    if(!contextMenuIcon.hasClass('fa-check')) {
                        contextMenuIcon.addClass('fa-check');
                    }
                } else {
                    contextMenuIcon.removeClass('fa-check');
                }
            }
        }

        $scope.showCollapsedTags = true;
        $scope.setShowCollapsedTags = function (value) {
            $scope.showCollapsedTags = value;
            if(value){
                $scope.isShowFilterSection = false;
            }
            if (!$scope.isCurrentView('chart')) {
                $scope.$emit('DoRebuildCollapsedTags');
            }
        };

        $scope.$on('DoTableLayout', function () {
            if($scope.gridOptions) {
                if ($scope.showCollapsedTags) {
                    $('#non-collapsed-tags').css('display', 'none');
                    $('#collapsed-tags').css('display', 'table-cell');
                } else {
                    $('#collapsed-tags').css('display', 'none');
                    $('#non-collapsed-tags').css('display', 'table-cell');
                }
                $scope.gridOptions.api.doLayout();
            }
        });

        $scope.isShowFilterSection = false;

        $scope.showFilterSection = function (){
            $scope.isShowFilterSection = true;
        };

        $scope.toggleFilterTooltip = function (e) {
            var posX = e.clientX;
            if (!$('.filterRowTooltipClass').attr('class').match('fade in top')) {
                var style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = '.filterRowTooltipClass { left: ' + (posX - 125) + ' !important; }';
                document.getElementsByTagName('head')[0].appendChild(style);
            }
        };

        $scope.isVisibleForRow = function () {
            return GridService.isVisibleForRow($scope);
        };

        $scope.resetSearch = function () {
            SearchBarService.setSearch('');
            $scope.searchInputChange('');
        };

        // header panel actions
        $scope.searchInputChange = function (searchText, force) {
            $scope.dataSummary.search = searchText;
            return DataLoadingService.search(searchText, force, $scope);
        };
        SearchBarService.callback = $scope.searchInputChange;

        $scope.isSameMonth = function (filter) {
            return moment(filter.value1).isSame(filter.value2, 'month');
        };

        $scope.isSameYear = function (filter) {
            return moment(filter.value1).isSame(filter.value2, 'year') && !$scope.isSameMonth(filter);
        };

        $scope.switchPaginate = function (pag) {
            $scope.currentPagination = pag;
            $scope.isPagination = true;
            $scope.searching();
        };

        $scope.toggleSelectAllFieldRaw = function () {
            var value = !$scope.isAllFieldsRawSelected();
            $scope.rawShowMeList.forEach(function (el) {el.id.selected = value;});

            BookmarkEventService.emit(".raw.RawShowToggleAllEvent", {selected: value}, $scope);
            doRefreshRawShows();
        };

        $scope.isAllFieldsRawSelected = function () {
            return _.every($scope.rawShowMeList, function(s){ return s.id.selected; });
        };

        $scope.toggleRawShow = function (show) {
            show.id.selected = !show.id.selected;
            BookmarkEventService.emit(".raw.RawShowChangeEvent", {show: show.id}, $scope);
            doRefreshRawShows();
        };

        function doRefreshRawShows(supressRefresh) {
            return DataLoadingService.doRefreshRawShows(supressRefresh, $scope);
        }

        function getAggChangeShowTotalEventName(item) {
            if (_.indexOf($scope.dataSummary.pivot, item) !== -1) {
                return EventNames.CHANGE_SHOW_TOTAL.PIVOT;
            } else {
                return EventNames.CHANGE_SHOW_TOTAL.AGGS;
            }
        }

        function getAggChangeSortEventName(item) {
            if (_.indexOf($scope.dataSummary.pivot, item) !== -1) {
                return EventNames.CHANGE_SORT_EVENT.PIVOT;
            } else {
                return EventNames.CHANGE_SORT_EVENT.AGGS;
            }
        }

        $scope.toggleShowTotal = function (item) {
            item.id.settings.showTotal = !item.id.settings.showTotal;
            BookmarkEventService.emit(getAggChangeShowTotalEventName(item), {key: item.id}, $scope);
            DataLoadingService.updateShowTotals($scope);
        };

        $scope.getShowTotalsArray = function() {
            var pivotArray = $scope.dataSummary.pivot,
                aggsArray = $scope.dataSummary.aggs.slice(0, 1);

            return _.union(pivotArray, aggsArray);
        };

        $scope.getSortClass = function (direction) {
            switch (direction) {
                case 'ASC': return 'fa fa-sort-asc';
                case 'DESC': return 'fa fa-sort-desc';
                default: return 'fa fa-sort';
            }
        };

        function getNextSortDirection(direction) {
            switch(direction) {
                case "ASC": return "DESC";
                case "DESC": return null;
                default: return "ASC";
            }
        }

        function getNextPriority() {
            var priorityArray = _.map(_.filter($scope.rawShowMeList, function(rawShow) {
                return rawShow.id.sort;
            }), function(rawShowWithSort) {
                return rawShowWithSort.id.sort.priority;
            });

            if (!priorityArray.length) {
                return 0;
            }

            return _.max(priorityArray) + 1;
        }

        $scope.switchShowRawSort = function (show) {
            if (!show.id.sort) {
                show.id.sort = {
                    direction: getNextSortDirection(),
                    priority: getNextPriority()
                }
            } else {
                var nextDirection = getNextSortDirection(show.id.sort.direction);

                if (!nextDirection) {
                    show.id.sort = null;
                } else {
                    show.id.sort.direction = nextDirection;
                }
            }

            BookmarkEventService.emit(".raw.RawShowChangeEvent", {show: show.id}, $scope);
            doRefreshRawShows();
        };

        $scope.endSortFieldsRaw = function (item, to) {
            BookmarkEventService.emit(".raw.RawShowMoveEvent", {key: item.id, toPosition: to}, $scope);
        };

        $scope.doHandleRefresh = function () {
            if($scope.refreshAvailable) {
                if ($scope.dataSummary.filtersToRefresh.length > 0) {
                    _.set($scope, 'filtersStatus.refreshing', true);
                }
                BookmarkEventService.emit(".request.ApplyRequestEvent", {}, $scope);
            }
        };

        $scope.doCancelRefresh = function () {
            BookmarkEventService.emit('.request.CancelRequestEvent', {}, $scope);

            var tab = $scope.tabsSection.options.activeTab;
            tab.state.refreshAvailable = false;
            tab.state.pendingQueryParams = _.cloneDeep(tab.state.queryParams);

            DataLoadingService.restore(tab, '#ag-grid', $scope, {suppressReloadingData: true});
            $scope.$emit('DoRebuildCollapsedTags');
            $scope.updateShowMeAutocompleteList();
            $scope.updateGroupByAutocompleteList();
        };

        $scope.onIngestColumnMoved = function(indexFrom, indexTo) {
            $scope.updateIngestColumnsOrder();
            $scope.previewGridOptions.columnApi.moveColumn(indexFrom, indexTo);
        };

        $scope.getAllSelectedIngestColumns = function() {
            return _.filter($scope.ingestDataSummary.columns, col => col.settings && !col.settings.removed && !col.blank);
        };

        $scope.$on('uiSelectSort:change', function (event, args) {
            var to = args.to;
            switch (args.id) {
                case 'shows-select':
                    to++;
                    if(isAggregatedData()) to++;

                    isMoveShowMe = true;
                    if ($scope.dataSummary.pivot.length > 0) {
                        resetShows(args.array);
                        DataLoadingService.onShowsOrderChangePivot($scope, args.array, args.to);
                    } else {
                        var from = _.findIndex($scope.gridOptions.columnApi.getAllGridColumns(), function (col) {
                            return col.colDef.field === args.item.key
                        });
                        if (from > -1) {
                            resetShows(args.array);
                            $scope.gridOptions.columnApi.moveColumn(from, to);
                        }
                    }
                    break;
                case 'group-by-select':
                    resetAggs(args.array);
                    BookmarkEventService.emit(".aggs.AggMoveEvent", {key: args.item.id, toPosition: to}, $scope);
                    DataLoadingService.doRefreshIfNeeded($scope);
                    break;
                case 'pivot-by':
                    resetPivot(args.array);
                    BookmarkEventService.emit(".pivot.PivotMoveEvent", {key: args.item.id, toPosition: to}, $scope);
                    DataLoadingService.doRefreshIfNeeded($scope);
                    break;
                case 'import-fields':
                    var offset = 1, // row-number column
                        from = -1,
                        to = -1;
                    let columns = $scope.ingestDataSummary.columns.slice();
                    columns.sort((c1, c2) => c1.settings.index - c2.settings.index);
                    let hidden = 0;
                    for(let i=0; i<columns.length; i++){
                        if(columns[i].settings.removed){
                            hidden++
                        }
                        if(from < 0 && args.from === i - hidden){
                            from = i;
                        }
                        if(to < 0 && args.to === i - hidden){
                            to = i;
                        }
                    }
                    $scope.previewGridOptions.columnApi.moveColumn(from + offset, to + offset);
                    break;
            }
        });

        // global navigation
        $scope.closeIndex = function () {
            $state.go('main');
        };

        $scope.$on('$destroy', function(){
            $scope.cancelPreviewRequest();
            $scope.cancelRequest();

            if($scope.previewGridOptions && $scope.previewGridOptions.api){
                $scope.previewGridOptions.api.destroy(true);
            }
            if($scope.gridOptions && $scope.gridOptions.api){
                $scope.gridOptions.api.destroy(true);
            }
        });

        $scope.goToVisualization = function(index, newTab){
            if (newTab) {
                let url = $state.href('main.visualize', {id: index.id, pageMode: index.pageMode, preSave: false});
                window.open(url,'_blank');
            } else {
                $state.go('main.visualize', {id: index.id, pageMode: index.pageMode, preSave: false})
            }
        };

        $scope.goToDataModel = function () {
            $state.go('main.index-edit', {id: $scope.datadocId});
        };

        $scope.updateTable = function () {
            if(!$scope.selectedTable.name){
                $scope.selectedTable.name = 'Untitled datadoc'
            }
            $scope.isUpdating = true;
            return $http.post(`/api/docs/${$scope.selectedTable.id}`, {
                name: $scope.selectedTable.name,
                preSave: false
            }).then(function (response) {
                $scope.isUpdating = false;
                $scope.$emit('$titleChanged', $scope.selectedTable.name);
                WSocket.send("/doc/event", {
                    "@type": "com.dataparse.server.service.docs.DatadocNameChangedEvent",
                    datadocId: parseInt($scope.datadocId),
                    renameTo: $scope.selectedTable.name
                });
                return response.data;
            }, function (e) {
                cc.showError(e);
                $scope.isUpdating = false;
            });
        };

        /**
         * magic with scope required because of ui-select bug, related to showing ui-select inside modal
         *  attrs.$observe('tagging', function() {
         * */

        ShareService.retrieveSharedInfo($scope.datadocId).then((sharedInfo => {
            $scope.datadocSharedInfo = sharedInfo;
        })).catch(err => {
            console.error(`Can not retrieve shared information about "${$scope.selectedTable.name}"`, `${err.status} (${err.statusText})`);
        });
        $scope.shareWithDatadocMessage = () => {
            if($scope.datadocSharedInfo) {
                return ShareService.shareWithMessage($scope.datadocSharedInfo);
            }
        };
        $scope.openShareModal = _.partial(ShareService.openShareModal, $scope.datadocId, $scope);

        $scope.tabSwitcher = function (tab) {
            _.forEach($scope.dataTabs, function (val, key) {
                $scope.dataTabs[key] = key === tab;
            });
        };

        $scope.isForbiddenTab = tab => {
            const createdByUserId = _.get(tab, 'createdByUser.id'),
                tableSchema = _.get(tab, 'tableSchema');

            if (!createdByUserId)
                return;

            return createdByUserId !== User.getCurrent().id && !tableSchema.committed;
        };

        $scope.setFocusElementBySelector = function (selector, delay) {
            if (delay != null) {
                $timeout(function () {
                    $(selector).focus();
                }, delay);
            } else {
                $(selector).focus();
            }
        };

        $scope.togglePageLoader = function(toggle, backdrop = false, innerText = "") {
            $rootScope.$broadcast("togglePageLoader-main-loader", {toggle: toggle, backdrop: backdrop, innerText: innerText});
        };

        $scope.togglePageLoaderCancelButton = function(cancelCallback) {
            $rootScope.$broadcast("togglePageLoaderCancelButton-main-loader", cancelCallback);
        };

        $scope.cancelRequest = function () {
            if ($scope.currentRequest.canceler) {
                $scope.currentRequest.canceler.resolve();
            }
            $scope.inRequest = false;
            $scope.togglePageLoader(false);
        };

        function removeAllShows() {
            resetShows([]);
            DataLoadingService.doRefreshIfNeeded($scope);
        }

        $scope.removeAllShowMe = function () {
            $scope.deselectAllShowMe();
        };

        $scope.isHiddenShowAll = function () {
            return ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length)
                || $scope.dataSummary.shows.length > 0;
        };

        $scope.isHiddenIngestColumnsAll = function() {
            return $scope.ingestDataSummary.selectedSources.length && _.every($scope.ingestDataSummary.columns, col => col.settings && !!col.settings.removed);
        };

        $scope.isCheckedIngestColumnsAll = function() {
            return ($scope.ingestDataSummary.selectedSources.length)
                && _.every($scope.ingestDataSummary.columns, col => col.settings && !col.settings.removed);
        };

        $scope.isCheckedShowAll = function() {
            return ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length)
                || $scope.dataSummary.shows.length === 0;
        };

        $scope.isHiddenShowMe = function (col, $select) {

            if (col.isAll) return true;

            if ($select.search.length >= 2) {
                return isRawData() ? col.operation : !col.operation
            } else if(col.isCountAgg || !col.operation) {
                return false;
            }

            return true;
        };

        $scope.isCheckedShowMe = function (col) {
            return (!isRawData() && $scope.showGrouppedByAggs(col.field))
                || (col.operation && !isRawData() && $scope.showMeColChecked(col))
                || (!col.operation && isRawData() && $scope.showMeColChecked(col));
        };

        $scope.isCheckedSourceTag = function(col) {
            return !!_.find($scope.ingestDataSummary.selectedSources, {id: col.id});
        };

        $scope.isIngestColChecked = function(col) {
            return !!_.find($scope.ingestDataSummary.selectedColumns, {id: col.id});
        };

        $scope.showMeAll = function ($event) {
            resetShows(_.filter($scope.showMeList, function(s){
                return s.id.op == null;
            }));
            var events = _.map($scope.dataSummary.shows, function(show){
                return {"@type": ".shows.ShowAddEvent", key: show.id}
            });
            DataLoadingService.doRefreshIfNeeded($scope);
            $event.stopPropagation();
            $event.preventDefault();
            BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
        };

        $scope.deselectAllShowMe = function ($event) {
            if ($event) {
                $event.stopPropagation();
                $event.preventDefault();
            }
            var events = _.map($scope.dataSummary.shows, function(show){
                return {"@type": ".shows.ShowRemoveEvent", key: show.id}
            });
            BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
            removeAllShows();
        };

        $scope.toggleAllIngestColumns = function(event) {
            if (!$scope.isCheckedIngestColumnsAll()) {
                $scope.selectAllIngestColumns(event);
            } else {
                $scope.deselectAllIngestColumns(event);
            }
        };

        $scope.deselectAllIngestColumns = function ($event) {
            if ($event) {
                $event.stopPropagation();
                $event.preventDefault();
            }

            $scope.removeAllIngestColumns();
        };

        $scope.selectAllIngestColumns = function($event) {
            if ($event) {
                $event.stopPropagation();
                $event.preventDefault();
            }

            _.each($scope.ingestDataSummary.columns, (c) => {
                c.settings.removed = false;
            });

            $scope.updateSelectedIngestColumns();

            if ($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                $scope.updateIngestSettings(true);
                IngestDataLoadingService.toggleColumns($scope.ingestDataSummary.columns, true, $scope)
            }
        };

        $scope.fixedIfFloat = function(x){
            return !!(x % 1) ? parseFloat(x.toFixed(2)) : x;
        };

        $scope.onHiddenFilterInputBlur = function () {
            $timeout(function() {
                $scope.$broadcast('BlurOnSelectInput', 'filter-by-select');
            }, 200)
        };

        const resetShowMeInput = $select => {
            if ($select) {
                $select.resetBlurTimeout();
                $select.search = '';
            }
        };

        $scope.showMeOnRemove = function (item, isSubMenu, $select) {
            resetShowMeInput($select);

            _.remove($scope.dataSummary.shows, {key: item.key});

            if(_.isEmpty($scope.dataSummary.shows)) {
                DataLoadingService.updateShowTotals($scope);
            }

            $scope.gridOptions.columnApi.setColumnsVisible([item.key], false);
            BookmarkEventService.emit(".shows.ShowRemoveEvent", {key: item.id}, $scope);
            $scope.$emit('tags-changed', {type: 'show', op: 'remove', tag: item});
            $scope.gridOptions.api.sizeColumnsToFit();

        };

        $scope.showMeOnSelect = function (item, isSubMenu, $select, newPosition) {
            const emitAddEvent = () => {
                BookmarkEventService.emit(".shows.ShowAddEvent", {key: item.id, toPosition: newPosition}, $scope);
                DataLoadingService.doRefreshIfNeeded($scope);
            };

            resetShowMeInput($select);
            if(!item.isCountAgg && isSubMenu){
                const isTheSameShow = _.find($scope.dataSummary.shows, { key: item.key });

                if (isTheSameShow) {
                    _.remove($scope.dataSummary.shows, isTheSameShow);
                    $scope.gridOptions.columnApi.setColumnsVisible([item.key], false);
                    $scope.gridOptions.api.sizeColumnsToFit();

                    BookmarkEventService.emit(".shows.ShowRemoveEvent", {key: item.id}, $scope);

                    if(_.isEmpty($scope.dataSummary.shows)) {
                        DataLoadingService.updateShowTotals($scope);
                    }
                } else {
                    if (newPosition != null) {
                        $scope.dataSummary.shows = [].concat($scope.dataSummary.shows.slice(0, newPosition), item, $scope.dataSummary.shows.slice(newPosition));
                    } else {
                        $scope.dataSummary.shows.push(item);
                    }
                    emitAddEvent();
                }
            } else if (!isSubMenu) {
                // Case when column selected from autocomplete dropdown, not from tag-context-menu)
                emitAddEvent();
            }
            $scope.$emit('tags-changed', {type: 'show', op: 'add', tag: item});
        };

        $scope.$on('update-show-me-list', function(e, options, alreadySorted) {
            _.each($scope.dataSummary.shows, s => {
                _.each(options, o => {
                    if(s.name && s.name === o[0].name) {
                        s.order = o[0].order;
                    }
                });
            });

            $scope.dataSummary.shows = _.sortBy($scope.dataSummary.shows, alreadySorted ? 'name' : 'order');
            DataLoadingService.doRefreshIfNeeded($scope);
        });

        $scope.$on('update-columns-header', function(e, options) {
            DataLoadingService.recreateColumns($scope, true);
        });

        $scope.toggleIngestColumn = function(item) {
            var isRemoved = !item.settings.removed;

            $scope.setRemovedIngestColumn(item, isRemoved);
            $scope.updateSelectedIngestColumns();

            if ($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                $scope.updateIngestSettings(true);
                IngestDataLoadingService.toggleColumns([item], !isRemoved, $scope)
            }
        };

        $scope.onIngestColumnsSelect = function (item, isSubMenu, $select, newPosition) {
            if ($select) {
                $select.resetBlurTimeout();
            }

            let isRemoved = false;
            if(isSubMenu){
                isRemoved = !!_.find($scope.ingestDataSummary.selectedColumns, { id: item.id });
            }

            $scope.setRemovedIngestColumn(item, isRemoved);
            $scope.updateSelectedIngestColumns();
            $scope.updateIngestSettings(true);
            IngestDataLoadingService.toggleColumns([item], !isRemoved, $scope)
        };

        $scope.updateSelectedIngestColumns = function() {
            $scope.ingestDataSummary.selectedColumns = _.filter(_.sortBy($scope.ingestDataSummary.columns, 'settings.index'), (c) => !c.settings.removed && !c.blank);
        };

        $scope.setRemovedIngestColumn = function(item, removed) {
            let col = _.find($scope.ingestDataSummary.columns, {id: item.id});
            col.settings.removed = removed;
        };

        $scope.updateIngestColumnsOrder = function() {
            _.each($scope.ingestDataSummary.columns, (c, i) => {
                c.settings.index = i;
            });
        };

        $scope.onIngestColumnsRemove = function (item) {
            $scope.setRemovedIngestColumn(item, true);
            $scope.updateSelectedIngestColumns();
            $scope.updateIngestSettings(true);
            $scope.updateIngestColumnsAutocompleteList();
            IngestDataLoadingService.toggleColumns([item], false, $scope);
        };

        $scope.removeAllIngestColumns = function() {
            _.each($scope.ingestDataSummary.columns, (c) => {
                c.settings.removed = true;
            });

            $scope.ingestDataSummary.selectedColumns = [];

            if ($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                $scope.updateIngestSettings(true);
                IngestDataLoadingService.toggleColumns($scope.ingestDataSummary.columns, false, $scope)
            }
        };

        $scope.subMenuShowCountSelect  = function (item, $select, $event) {
            delete $scope.dataSummary.filter;
            resetShows([item]);
            resetAggs([_.find($scope.groupByList, {key: item.field})]);
            DataLoadingService.doRefreshIfNeeded($scope);
            $timeout(function () {
                $select.resetBlurTimeout();
                $select.resetChoicesPosition();
            });
            $event.stopPropagation();
            $event.preventDefault();
        };

        $scope.subMenuShowItemSelect = function (item, $select) {
            var col = _.find($scope.dataSummary.shows, {key: item.key});
            if (col) {
                $scope.showMeOnRemove(item, true)
            } else {
                $scope.showMeOnSelect(item, true)
            }
            $timeout(function () {
                $select.resetBlurTimeout();
                $select.resetChoicesPosition();
            })
        };

        $scope.showGrouppedByAggs = function (colField) {
            var grouppedBy = _.groupBy($scope.dataSummary.shows, {field: colField});
            var string = '';

            _.forEach(grouppedBy.true, function (item) {
                if (!item.operation) return;
                if (string == '') string += ': ';
                else string += ', ';
                string += item.showListView
            });

            return string;
        };

        $scope.showMeColChecked = function (col) {
            return typeof _.find($scope.dataSummary.shows, {key: col.key}) != 'undefined';
        };

        $scope.removeFromShowsMe = function (col, e, $select) {
            // todo this hack doesn't work with keyboard
            if ((col.isCountAgg || !isRawData()) && !col.operation) {
                e.preventDefault();
                e.stopPropagation();
            }

            if ($select) {
                $select.resetBlurTimeout();
            }

            $scope.setFocusElementBySelector('#shows-select input');
        };

        $scope.isShowSubmenuToTheRight = function () {
            const $menu = $('.ui-select-choices.ui-select-choices-content.ui-select-dropdown:visible');
            return $('body').width() - ($menu.offset().left + $menu.width()) < 200;
        };

        function resetShows(shows) {
            return DataLoadingService.resetShows(shows, $scope);
        }

        function resetAggs(aggs) {
            return DataLoadingService.resetAggs(aggs, $scope);
        }

        function resetPivot(pivot) {
            return DataLoadingService.resetPivot(pivot, $scope);
        }

        function removeFromShows(key) {
            const shows = $scope.dataSummary.shows.slice();
            _.remove(shows, key);
            resetShows(shows);
        }

        function cleanShows() {
            if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length === 1) {
                resetShows([]);
            }
        }

        function restoreShows(item) {
            if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length === 0) {
                resetPivot([]);
                var shows = _.filter($scope.showMeList, function(s){
                    return s.id.op == null;
                });
                shows = _.take(shows, 10);
                resetShows(shows);
            } else {
                removeFromShows({key: item.key});
            }
        }

        function removeGroup(events) {
            if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length <= 0) {
                const shows = _.filter($scope.showMeList, function (s) {
                    return s.id.op == null;
                });
                resetShows(_.take(shows, 10));
            }
            BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
            DataLoadingService.doRefreshIfNeeded($scope);
        }

        $scope.groupBySummarySelect = function (item, $model, $select, newPosition) {
            if ($select) {
                $select.resetBlurTimeout();
            }

            if (!_.find($scope.dataSummary.aggs, item)) {

                if (newPosition != null) {
                    $scope.dataSummary.aggs = [].concat($scope.dataSummary.aggs.slice(0, newPosition), item, $scope.dataSummary.aggs.slice(newPosition));
                } else {
                    $scope.dataSummary.aggs.push(item);
                }
                BookmarkEventService.emit(".aggs.AggAddEvent", {key: item.id, toPosition: newPosition}, $scope);
            }

            cleanShows();
            resetAggs($scope.dataSummary.aggs);
            if (isAggregatedData() || DataLoadingService.isPivotTable($scope)) {
                DataLoadingService.doRefreshIfNeeded($scope);
            }
            $scope.$emit('tags-changed', {type: 'agg', op: 'add', tag: item});
        };
        $scope.groupBySelectOnRemove = function (item, $select) {
            restoreShows(item);
            if ($select) {
                $select.resetBlurTimeout();
            }

            resetAggs($scope.dataSummary.aggs);
            BookmarkEventService.emit(".aggs.AggRemoveEvent", {key: item.id}, $scope);
            DataLoadingService.doRefreshIfNeeded($scope);
            $scope.$emit('tags-changed', {type: 'agg', op: 'remove', tag: item});
        };

        $scope.removeAllGroupBy = function () {
             // remove all aggs and restore all columns
            const events = _.map($scope.dataSummary.aggs, function (agg) {
                return {"@type": ".aggs.AggRemoveEvent", tabId: $scope.tabId, key: agg.id}
            });

            resetAggs([]);
            removeGroup(events);
        };

        window.moment = moment;

        $scope.groupPivotBySummarySelect = function (item, $model, $select, newPosition) {
            if (!_.find($scope.dataSummary.pivot, item)) {
                if (newPosition != null) {
                    $scope.dataSummary.pivot = [].concat($scope.dataSummary.pivot.slice(0, newPosition), item, $scope.dataSummary.pivot.slice(newPosition));
                } else {
                    $scope.dataSummary.pivot.push(item);
                }
                BookmarkEventService.emit(".pivot.PivotAddEvent", {key: item.id, toPosition: newPosition}, $scope);
            }

            cleanShows();
            resetPivot($scope.dataSummary.pivot);

            $scope.$emit('tags-changed', {type: 'pivot', op: 'add', tag: item});
            DataLoadingService.doRefreshIfNeeded($scope);
        };

        $scope.groupPivotBySelectOnRemove = function (item) {
            restoreShows(item);

            resetPivot($scope.dataSummary.pivot);
            $scope.$emit('tags-changed', {type: 'pivot', op: 'remove', tag: item});
            BookmarkEventService.emit(".pivot.PivotRemoveEvent", {key: item.id}, $scope);
            DataLoadingService.doRefreshIfNeeded($scope);
        };

        function resetPivotOrder() {
            $scope.dataSummary.pivotOrder = [];
            BookmarkEventService.emit(".shows.ShowMovePivotEvent", {pivotOrder: $scope.dataSummary.pivotOrder}, $scope);
        }

        $scope.$on('tags-changed', function(e, data){
            if (data.type === 'agg' || data.type === 'pivot') {
                if (data.op === 'add') {
                    $scope.viewMode = cc.getViewModes().TABLE;
                } else if (data.op === 'remove') {
                    var events = [],
                        model, pathModel;

                    if (data.type === 'agg') {
                        model = $scope.dataSummary.pivot;
                        pathModel = $scope.dataSummary.aggs;
                    } else {
                        model = $scope.dataSummary.aggs;
                        pathModel = $scope.dataSummary.pivot;
                    }

                    _.forEach(model, function(item) {
                        var sort = item.id.settings.sort;

                        if (sort.aggKeyPath && sort.aggKeyPath.length) {
                            sort.aggKeyPath.splice(pathModel.length);

                            events.push({
                                '@type': getAggChangeSortEventName(item),
                                key: item.id
                            });
                        }
                    });

                    if (events.length) {
                        BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
                    }
                }

                if (data.type === 'pivot') {
                    resetPivotOrder();
                }

                if($scope.dataSummary.pinnedRowsCount !== 0) {
                    DataLoadingService.smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.ROWS, 0);
                }
                if($scope.dataSummary.pinnedColsCount !== 0) {
                    DataLoadingService.smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.COLS, 0);
                }
                $scope.updateGroupByAutocompleteList();
                $scope.updateShowMeAutocompleteList();
            } else if (data.type === 'show') {

                if (data.op === 'remove') {

                    if ($scope.dataSummary.aggs.length > 0 || $scope.dataSummary.pivot.length > 0) {
                        var events = [];
                        var items = $scope.dataSummary.aggs.concat($scope.dataSummary.pivot);

                        _.forEach(items, function (item) {
                            var sort = item.id.settings.sort;
                            if (data.tag.key === sort.field) {
                                sort.isCount = false;
                                sort.type = "BY_KEY";
                                sort.field = null;
                                sort.aggKeyPath = null;
                                sort.direction = "ASC";

                                events.push({
                                    '@type': getAggChangeSortEventName(item),
                                    key: item.id
                                });
                            }
                        });

                        if (events.length) {
                            BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
                        }

                        if ($scope.dataSummary.pivot.length) {
                            resetPivotOrder();
                        }
                    }
                }
                if($scope.dataSummary.pinnedRowsCount !== 0) {
                    DataLoadingService.smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.ROWS, 0);
                }
                if($scope.dataSummary.pinnedColsCount !== 0) {
                    DataLoadingService.smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.COLS, 0);
                }
            }
        });

        $scope.$on('data-request-started', function(){
        });

        $scope.removeAllGroupPivotBy = function () {
            // todo PivotRemoveAll event
            const events = _.map($scope.dataSummary.pivot, function (piv) {
                return {"@type": ".pivot.PivotRemoveEvent", tabId: $scope.tabId, key: piv.id}
            });
            resetPivot([]);
            removeGroup(events);
        };

        function isRawData(){
            return $scope.dataSummary.aggs.length === 0 && $scope.dataSummary.pivot.length === 0;
        }
        $scope.isRawData = isRawData;

        function isAggregatedData(){
            return $scope.dataSummary.aggs.length > 0 && $scope.dataSummary.pivot.length === 0;
        }

        $scope.keydownColumnName = function (column, event) {
            if (event.which === 27) {
                column.rename = column.displayName;
                event.target.blur();
                event.preventDefault();
                event.stopPropagation();
            } else if (event.which === 13) {
                column.edited = false;
                event.target.blur();
                event.preventDefault();
                event.stopPropagation();
            }
        };

        function getShowMeColumnsForContextMenu(show) {
            return _.map(_.filter($scope.showMeList, function(s) {
                return show.col.field === s.col.field && !!s.id.op;
            }), function(s){
                return [createShowMeContextMenuObj(s, s.id.op, $scope.showMeColChecked),
                    getOnShowMeContextMenuClickFn(s, $scope.showMeColChecked)];
            });
        };

        function createSelectingObjForContextMenuWithAngular() {
            var titleTemplate = '<span ng-bind="isHiddenShowAll() ? \'Deselect All\' : \'Select All\'"></span>',
                titleHtml = $compile(titleTemplate)($scope);

            return {
                getPreHtml: function() {
                    return '<i class="fa fa-fw"></i>'
                },
                getTitleHtml: function() {
                    return titleHtml;
                }
            }
        }

        function createSelectDeselectObjForContextMenuWithAngular() {
            const titleTemplate = '<span ng-bind="isHiddenIngestColumnsAll() ? \'Select All\' : \'Deselect All\'"></span>',
                titleHtml = $compile(titleTemplate)($scope);

            return {
                getPreHtml: function() {
                    return '<i class="fa fa-fw"></i>'
                },
                getTitleHtml: function() {
                    return titleHtml;
                }
            }
        }

        function getGroupByOptions(actionFn, colNameFormat) {
            function getOnClickSubMenuFn(col, colName) {
                return function(scope, event, modelValue, text, $li, parentEl) {
                    actionFn(col);
                    const parent = _.find(scope.options, function(o) {
                        return o[0] === colName;
                    });

                    _.remove(parent[1], function(el) {
                        return el[0] === col.operation
                    });

                    // if parent is empty
                    if (!parent[1].length) {
                        _.remove($scope.options, parent);
                        $li.parent().remove();
                        parentEl.remove();
                    }

                    $li.remove();
                }
            }

            function getOnClickMenuFn(col) {
                return function(scope, event, modelValue, text, $li) {
                    $li.remove();
                    actionFn(col, null, null, scope.uiSelectCursorPosition);
                }
            }

            function getDateTypeCols() {
                return _.filter($scope.filterGroupBy(), {type: "DATE"});
            }

            function getColsWithoutDateType() {
                return _.filter($scope.filterGroupBy(), function(a){ return a.type !== "DATE"; });
            }

            function getArrayWithUniqueColNames(array) {
                return _.uniq(_.map(array, function(col) { return col.colName; }));
            }

            var dateColumnsArray = getDateTypeCols();
            var colNamesArray = getArrayWithUniqueColNames(dateColumnsArray)

            // generating contextMenus with subLevels
            var groupByOptions =  _.map(colNamesArray, function(colName) {
                return [colName, _.map(_.filter(dateColumnsArray, function(dateCol) { return colName === dateCol.colName; }), function(col) {
                    return [col.operation, getOnClickSubMenuFn(col, colName)]
                })]
            });

            groupByOptions = groupByOptions.concat(_.map(getColsWithoutDateType(), function(col) {
                return [ColumnsService.formatColumnName(colNameFormat, col.colName), getOnClickMenuFn(col)]
            }));

            groupByOptions = _.sortBy(groupByOptions);

            return groupByOptions;
        }

        $scope.updateGroupByAutocompleteList = function() {
            const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;
            $scope.groupByContextMenuOptions.options = getGroupByOptions($scope.groupBySummarySelect, colNameFormat);
            $scope.pivotByContextMenuOptions.options = getGroupByOptions($scope.groupPivotBySummarySelect, colNameFormat);
            $scope.$broadcast('refresh-context-menu');
        };

        $scope.updateShowMeAutocompleteList = function(){
            var shows = _.filter($scope.showMeList, function(s){
                return !s.id.op;
            });

            if (!isRawData()) {
                $scope.showMeContextMenuOptions.options = _.map(shows, function(s) {
                    return [createShowMeContextMenuObjWithAngular(s), getShowMeColumnsForContextMenu(s)]
                });
                $scope.showMeContextMenuOptions.isShowButton = false;
            } else {

                var showsArr = [];

                showsArr.push([createSelectingObjForContextMenuWithAngular(), function(scope, event) {

                    if ($scope.isHiddenShowAll()) {
                        $scope.deselectAllShowMe(event);
                    } else {
                        $scope.showMeAll(event);
                    }
                }]);

                var order = 0;
                showsArr = showsArr.concat(_.map(shows, function(s) {
                    order++;
                    return [createShowMeContextMenuObjForShows(s, s.showName, order), getOnShowMeContextMenuClickFn(s, $scope.isCheckedShowMe)];
                }));

                $scope.showMeContextMenuOptions.options = showsArr;
                $scope.showMeContextMenuOptions.isShowButton = true;
            }


            $scope.showMeAutoCompleteList = _.filter($scope.showMeList, function(s) {
                return isRawData() ? !s.id.op : s.id.op
            });
        };

        $scope.updateIngestColumnsAutocompleteList = function() {
            let descriptor = $scope.previewDescriptor;
            if(!descriptor){
                descriptor = {columns: []};
            }
            let columns = _.cloneDeep(descriptor.columns);
            let columnsArr = [];
            columnsArr.push([createSelectDeselectObjForContextMenuWithAngular(), function($scope, event, arg, element) {
                const contextMenuIcon = element.parent().parent().find('.context-menu-icon');

                if ($scope.isHiddenIngestColumnsAll()) {
                    contextMenuIcon.addClass('fa-check');
                    $scope.selectAllIngestColumns(event);
                } else {
                    contextMenuIcon.removeClass('fa-check');
                    $scope.deselectAllIngestColumns(event);
                }
            }]);

            columnsArr.push(..._.map(columns, function (c) {
                return [createIngestColumnsContextMenuObj(c, c.settings.rename || c.name, $scope.isIngestColChecked),
                    getOnIngestColumnsContextMenuClickFn(c, $scope.isIngestColChecked)];
            }));
            $scope.ingestColumnsContextMenuOptions.options = columnsArr;
            $scope.ingestColumnsAutoCompleteList = columns;
        };

        $scope.isDisableChoice = function (col) {
            return !col.operation && !isRawData()
                && !(_.some($scope.dataSummary.aggs, {key: col.field}) && !_.some($scope.dataSummary.shows, {key: col.key}));
        };

        $scope.sortMatchFn = function (match) {
            const smatch = match.split(/\W+/);
            return function (value) {
                let searchValue = [value.col.name];

                if (value.type) {
                    searchValue.push(value.type);

                    if (value.isCount) {
                        searchValue.push("COUNT");
                    }

                } else if (value.item && value.item.op.name) {
                    searchValue.push(value.item.op.name);
                }

                if (value.id.pivot) {
                    searchValue = searchValue.concat(_.map(value.id.pivot, function(el){return el+'';}));
                }

                return _.every(smatch, function (m) {
                    return _.some(searchValue, function (sv) {
                        return sv ? sv.toLowerCase().indexOf(m.toLowerCase()) > -1 : '';
                    });
                });
            }
        };

        $scope.matchFn = function (match, brokenDown) {
            const smatch = match.split(/\W+/);
            return function (value) {
                const searchValue = brokenDown
                    ? [value.selectedName, value.displayName]
                    : [value.showName, value.op.name];

                return _.every(smatch, function (m) {
                    return _.some(searchValue, function (sv) {
                        return sv ? sv.toLowerCase().indexOf(m.toLowerCase()) > -1 : '';
                    });
                });
            }
        };

        $scope.ingestColumnsMatchFn = function (match) {
            const smatch = match.split(/\W+/);
            return function (value) {
                const searchValue = value.name;
                return _.every(smatch, function (m) {
                    return searchValue ? searchValue.toLowerCase().indexOf(m.toLowerCase()) > -1 : '';
                });
            }
        };

        $scope.filterGroupBy = function () {
            return _.filter($scope.groupByList, function(g) {
                return !_.find(_.union($scope.dataSummary.pivot, $scope.dataSummary.aggs), {key: g.key});
            });
        };

        $scope.downloader = ExportService.downloader;
        ExportService.checkPendingExports($scope);

        $scope.isDefaultState = () =>
            $scope.tabsSection.options.activeTab.currentState === $scope.tabsSection.options.activeTab.defaultState;

        $scope.selectedViewStateId = $stateParams.stateId;

        $scope.onSaveCurrentState = name => {
            const request = {tabId: $scope.tabId, name, stateId: $scope.bookmarkStateId.stateId};
            $http.post("/api/docs/bookmarks/save_state", request)
                .then(response => {
                    $scope.setNameForStateModal.close();

                    $scope.allBookmarkStates = response.data.allBookmarkStates;
                    $scope.tabsSection.options.activeTab.currentState = response.data.currentState;
                    $scope.selectedViewStateId = response.data.currentState;

                    const newStateParams = {
                        pid: response.data.bookmarkStateId.tabId,
                        stateId: response.data.bookmarkStateId.stateId
                    };

                    $scope.firstRequestApplied = false;

                    $state.transitionTo($scope.currentState, _.merge({}, $stateParams, newStateParams), {
                        notify: false,
                        location: 'replace'
                    });

                    cc.notify({
                        message: `Successfully saved view "${name}"`,
                        icon: 'success',
                        wait: 2
                    });
                })
                .catch(err => {
                    cc.showError(err);
                    $scope.setNameForStateModal.close()
                })
        };

        $scope.saveCurrentState = () => {
            $scope.setNameForStateModal = $uibModal.open({
                templateUrl: 'static/templates/include/set-name-modal.html',
                animation: true,
                scope: $scope,
                size: 'md',
                windowClass: 'tiny-modal'
            });
        };

        $scope.cancelDeleteViewModal = () => {
            if($scope.deleteStateModal) {
                $scope.deleteStateModal.close();
                $scope.deleteViewOptions = {};
            }
        };

        $scope.removeState = ($event, {uuid: stateId, tabId, name}) => {
            $event.stopPropagation();
            $scope.deleteViewOptions = { name };
            $scope.deleteStateModal = $uibModal.open({
                templateUrl: 'static/templates/include/delete-view.html;',
                scope: $scope,
                animation: true,
                size: 'md',
                keyboard: true
            });
            $scope.deleteViewOptions.deleteBookmarkState = () => {
                $scope.cancelDeleteViewModal();
                const currentStateId = $scope.tabsSection.options.activeTab.currentState,
                    defaultStateId = $scope.tabsSection.options.activeTab.defaultState;

                $scope.allBookmarkStates = $scope.allBookmarkStates.filter(el => el.uuid !== stateId);
                $http.delete(`/api/docs/bookmarks/state/${tabId}/${stateId}`).then(() => {

                    const newStateParams = _.omit($stateParams, 'stateId');
                    $scope.firstRequestApplied = false;

                    if (currentStateId === stateId) {
                        const activeTab = $scope.tabsSection.options.activeTab;

                        activeTab.currentState = defaultStateId;
                        $scope.bookmarkStateId.stateId = defaultStateId;
                        $scope.tabsSection.restoreTab(activeTab, false, true);
                    }

                    $state.transitionTo($scope.currentState, _.merge({}, newStateParams), {
                        notify: false,
                        location: 'replace'
                    });

                    cc.notify({
                        message: `Successfully removed view "${name}"`,
                        icon: 'success',
                        wait: 2
                    });
                }).catch(() => {
                    cc.showError({message: `Failed to remove view '${name}'.`});
                })
            };
        };

        $scope.changeBookmarkState = ({tabId, uuid: stateId}, resetFirstRequest) => {
            return $http.post("/api/docs/bookmarks/change_bookmark_state", {tabId, stateId}).then((resp) => {
                //todo we can do refresh more specific
                $scope.firstRequestApplied = !resetFirstRequest;
                $scope.selectedViewStateId = resp.data.state.id;
                $scope.tabsSection.refreshActiveTab(false, stateId);
            }).catch(err => {
                cc.showError(err)
            })
        };

        $scope.presetDefaultState = async ({tabId, stateId, toCleanState}) => {
            return $http.post("/api/docs/bookmarks/preset_default", {bookmarkStateId: {tabId, stateId}, toCleanState}).then((resp) => {
                const {defaultState: uuid, id: tabId} = resp.data;
                $scope.changeBookmarkState({tabId, uuid}, toCleanState);
            }).catch(err => {
                console.error(err)
            });
        };

        $scope.prepareExport = function (format) {
            $timeout(() => $scope.exportDropdownSettings.opened = false, 500);
            if((format === 'XLS' || format === 'XLS_WORKBOOK')
                && isRawData() && $scope.totalSize > 2000000){
                $scope.exportFormat = format;
                $scope.exportWarningMessage = "Results size exceeds Excel limits (2M rows). Would you like to export limited results?";
                $scope.exportWarningModal = $uibModal.open({
                    templateUrl: 'static/templates/include/export-warning.html',
                    scope: $scope,
                    animation: true,
                    size: 'sm',
                    windowClass: 'preview-format-modal'
                });
            } else {
                $scope.proceedExport(format);
            }
        };

        $scope.proceedExport = function (format) {
            var tabIds = [];
            if(format !== 'XLS_WORKBOOK'){
                tabIds = [$scope.tabId];
            }
            ExportService.prepareExport($scope.datadocId, tabIds, format, $scope);
        };

        $scope.closeExportWarningModal = function (){
            $scope.exportWarningModal.dismiss();
        };

        $scope.isShowRefreshDropdown = false;
        $scope.isRefreshingNow = false;
        $scope.toggleRefreshDropdown = function () {
            $scope.isShowRefreshDropdown = !$scope.isShowRefreshDropdown;
            if ($scope.isShowRefreshDropdown) {
                restoreRunningSchedule();
            }
        };

        $scope.closeRefreshDropdown = function () {
            if ($scope.isShowRefreshDropdown) {
                $scope.toggleRefreshDropdown();
            }
        };

        $scope.refreshNow = function () {
            $scope.isRefreshingNow = true;
            $timeout(function () {
                $scope.updateIngestSettingsAndCommit(() => true).then(() => {
                    $scope.closeRefreshDropdown();
                });
            })
        };

        $scope.isShowLimitDropdown = false;
        $scope.toggleLimitDropdown = function(){
            $scope.isShowLimitDropdown = !$scope.isShowLimitDropdown;
        };

        $scope.closeLimitDropdown = function(){
            if($scope.isShowLimitDropdown){
                $scope.toggleLimitDropdown();
            }
        };

        $scope.isShowIngestOtherSettingsDropdown = false;
        $scope.toggleIngestOtherSettingsDropdown = function(){
            $scope.isShowIngestOtherSettingsDropdown = !$scope.isShowIngestOtherSettingsDropdown;
            if($scope.isShowIngestOtherSettingsDropdown){
                $scope.closeDelimiterStickyNote();
            }
        };

        $scope.closeIngestOtherSettingsDropdown = function(){
            if($scope.isShowIngestOtherSettingsDropdown){
                $scope.toggleIngestOtherSettingsDropdown();
            }
        };

        $scope.isShowEmbedDropdown = false;
        $scope.previewEmbed = EmbedService.preview;

        $scope.$on('embed-settings-saved', function(e, data){
            $scope.tabsSection.options.activeTab.embedSettings = data.settings;
            if(data.duplicateTab){
                var tab = $scope.tabsSection.options.activeTab;
                tab.name = tab.name + " (Embed)";
                $scope.tabsSection.doRenameTab(tab);
                $scope.tabsSection.duplicateTab();
            }
        });

        $scope.selectDataSummaryBack = function () {
            DataLoadingService.selectDataSummaryBack($scope);
        };

        $scope.onViewModeSelected = function (viewMode) {
            $scope.viewMode = viewMode;
            BookmarkEventService.emit(".ViewModeChangeEvent", {viewMode: viewMode}, $scope);
        };

        $scope.onExportRawDataLimitChanged = function (){
            BookmarkEventService.emit(".RawDataExportLimitChangeEvent", {limit: $scope.dataSummary.limit.rawDataExport}, $scope);
        };

        $scope.getViewModeTooltip = function (type) {
            return VIEW_MODE_OPTIONS[type].desc;
        };

        $scope.isViewModeSelected = function (viewMode) {
            return $scope.viewMode === viewMode;
        };

        $scope.isAllowedViewMode = function (code) {
            switch (code){
                case VIEW_MODES.COLUMN:
                case VIEW_MODES.BAR:
                case VIEW_MODES.LINE:
                case VIEW_MODES.AREA:
                case VIEW_MODES.PIE:
                case VIEW_MODES.MAP:
                case VIEW_MODES.SCATTER:
                    return false;
                case VIEW_MODES.TABLE:
                    return true;
                case VIEW_MODES.LIST:
                    return isRawData();
                default:
                    throw "Unknown chart type: " + code;
            }
        };

        $scope.getViewModeIcon = function (code) {
            switch (code){
                case VIEW_MODES.COLUMN: return 'fa-bar-chart';
                case VIEW_MODES.BAR: return 'fa-bar-chart rotate-90-and-flip-vertical';
                case VIEW_MODES.PIE: return 'fa-pie-chart';
                case VIEW_MODES.LINE: return 'fa-line-chart';
                case VIEW_MODES.AREA: return 'fa-area-chart';
                case VIEW_MODES.MAP: return 'fa-globe';
                case VIEW_MODES.SCATTER: return 'cf-scatter-plot';
                case VIEW_MODES.TABLE: return 'fa-table';
                case VIEW_MODES.LIST: return 'fa-search';
                default:
                    throw "Unknown chart type: " + code;
            }
        };

        $scope.openLink = function(link) {
            $window.open(link, '_blank');
        };

        $scope.onTabsDropdownToggled = function($event, tab) {
            if(tab.dropdownOpened || !$scope.isCommitRunning(tab.id)) {
                tab.dropdownOpened = !tab.dropdownOpened;
            }
        };

        $scope.historyHandler = new HistoryHandlerService($scope);
        $scope.tabsSection = new TabsSection($scope);

        $scope.moveTabs = function(action) {
            var tabsList = $('#tabs-list');
            var left = parseInt(tabsList.css('left'));
            var leftShadow = $('#tabs-list-wrapper .left-shadow');
            var rightShadow = $('#tabs-list-wrapper .right-shadow');
            // 110 - filters button with padding, 20 - padding between tabs and filters, 0.7 - max-width of tabs content 70%
            const currentTabsWidthWithoutOverflow = (document.body.clientWidth - 110 - 20) * 0.7;
            var tabsWidth = currentTabsWidthWithoutOverflow - tabsList.width();

            if(action === 'right') {
                leftShadow.removeClass('hidden');

                left -= 80;
                if(left <= tabsWidth) left = tabsWidth;
                if(left === tabsWidth) rightShadow.addClass('hidden');
            } else {
                rightShadow.removeClass('hidden');

                left += 80;
                if(left > 0) left = 0;
                if(left === 0) leftShadow.addClass('hidden');
            }

            tabsList.css('left', left);
        };

        $scope.snakeCase = text =>_.snakeCase(text);

        $scope.$on('onResize-visualization-filters', function(){
            $rootScope.$broadcast('reCalcViewDimensions');
            if($scope.gridOptions && $scope.gridOptions.api) {
                $scope.gridOptions.api.doLayout();
            }
        });

        $scope.setMaxHeightOnElement = function(selector) {
            if (selector == void 0) {selector = '.ui-select-choices.dropdown-menu:not(.ng-hide)'}

            var element = $(selector),
                marginBottom = 10,
                bodyHeight, maxHeight;

            if (element.length) {
                bodyHeight = $(window).height();

                maxHeight = (bodyHeight - element.offset().top) - marginBottom;

                element.css( 'max-height', maxHeight + 'px');
            }
        };

        // Todo: Never comes here.
        $scope.$on('onResizeFinished-visualization-filters', function(){
            $scope.resizeChart();
            $rootScope.$broadcast('sizeSearchInput');
        });

        $scope.toggleRightFilters = function() {
            $scope.isShowFilters = !$scope.isShowFilters;
            $scope.tabsSection.options.activeTab.state.showFilters = $scope.isShowFilters;

            if($scope.isShowFilters) {
                $scope.$broadcast('expand-visualization-filters');
                BookmarkEventService.emit('.ToggleFiltersEvent', {show: true}, $scope);
            } else {
                $scope.$broadcast('collapse-visualization-filters');
                BookmarkEventService.emit('.ToggleFiltersEvent', {show: false}, $scope);
            }
        };

        // todo DRY. move into ag-grid.
        $(document).mousedown(function(event) {
            let target = $(event.target);
            if( (!_.isEmpty(target.closest('.CodeMirror-scroll')) || !_.isEmpty(target.closest('.CodeMirror-line')))
                && $scope.previewGridOptions && $scope.previewGridOptions.api) {
                $scope.previewGridOptions.api.clearFocusedCell();
                $scope.previewGridOptions.api.clearRangeSelection();
            } else if (_.isEmpty(target.closest('#ag-grid'))
              && _.isEmpty(target.closest('.data-format'))
              && _.isEmpty(target.closest('.settings'))
              && _.isEmpty(target.closest('.ag-menu'))
              && $scope.gridOptions && $scope.gridOptions.api) {
                $scope.gridOptions.api.clearFocusedCell();
                $scope.gridOptions.api.clearRangeSelection();
            }
        }).keydown(function(objEvent) {
            if (objEvent.target.nodeName === "INPUT") {
                return true;
            }

            if (objEvent.ctrlKey) {
                if (objEvent.keyCode === 65) { // ctrl + a
                    return false;
                }
            }
        });

        $scope.showSortSettingsDropdown = function($event, item) {

            var sortSectionItem = SortSectionService.getDataItem($scope, item);

            var childScope = $scope.$new();
            childScope.item = sortSectionItem;
            childScope.getShowTotalsArray = $scope.getShowTotalsArray;
            childScope.toggleShowTotal = item => $scope.toggleShowTotal(item.itemFromModel);

            const targetRect = $event.currentTarget.getBoundingClientRect();
            const subMenu = $compile(angular.element('<sort-settings-dropdown></sort-settings-dropdown>'))(childScope);

            childScope.closeDropdown = function() {
                subMenu.remove();
            };
            childScope.$on('closeSortSettingsDropdown', childScope.closeDropdown);

            $('body').append(subMenu);

            $timeout(function() {
                subMenu.css({
                    left: targetRect.left - subMenu.width() + targetRect.width + 4,
                    top: targetRect.bottom
                });
            })

        };

        $(document).ready(function () {
            $(window).resize(function() {
                $scope.setMaxHeightOnElement();
            });

            // dev tool
            $timeout(function() {
                window.$scope = angular.element($('#wrapper')).scope();
                window.clr = function() {
                    localStorage.clear();
                };
            }, 1000);
        });
    }]);
});
