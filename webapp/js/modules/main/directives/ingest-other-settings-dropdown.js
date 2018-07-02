define(['./module', 'angular', 'lodash', 'KeyJS', 'common'],
function (controllers, angular, _, KeyJS, cc) {
    'use strict';

    controllers.directive('ingestOtherSettingsDropdown', ['$rootScope', '$timeout', 'IngestDataLoadingService',
        'EventNames', 'Constants', 'BookmarkEventService', 'User', 'ColumnsService',
        function ($rootScope, $timeout, IngestDataLoadingService, EventNames, Constants, BookmarkEventService, User, ColumnsService) {
            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/ingest-other-settings-dropdown.html',
                link: function ($scope, $el, $attr) {

                    const ingestErrorMode = {
                        REPLACE_WITH_NULL: 'set value to null',
                        SKIP_ROW: 'skip ingesting row',
                        STOP_INGEST: 'stop ingest (strict mode)'
                    };

                    const engineSelectionStrategies = {
                        DEPENDING_ON_DATASET_SIZE: 'auto',
                        ALWAYS_ES: 'small',
                        ALWAYS_BQ: 'large'
                    };

                    function getKeyByValue(m, value) {
                        for (let key in m) {
                            if (m[key] == value) {
                                return key;
                            }
                        }
                    }

                    function getValueByKey(m, key) {
                        return m[key];
                    }

                    function isNumberInput(key) {
                        switch(key) {
                            case 'startOnRow':
                            case 'skipAfterHeader':
                            case 'skipFromBottom':
                                return true;
                            default:
                                return false;
                        }
                    }

                    function isEditable(key){
                        switch (key) {
                            case 'ingestErrorMode':
                            case 'rowXPath':
                            case 'engineSelectionStrategy':
                                return false;
                            default:
                                return true;
                        }
                    }

                    function getIngestOtherSettingsChoicesObj(source){
                        const helperDropdowns = {
                            ingestErrorMode: _.map(ingestErrorMode, (m) => m),
                            rowXPaths: source.descriptor.availableRowXPaths,
                            engineSelectionStrategies: _.map(engineSelectionStrategies, (m) => m)
                        };

                        return {
                            startOnRow: {
                                defaultValue: 1
                            },
                            skipAfterHeader: {
                                infoText: "Have empty rows or comments after your heading? Use this setting to skip those rows.",
                                defaultValue: 0
                            },
                            skipFromBottom: {
                                infoText: "Have totals or export information at the bottom of your file? Use this setting to skip those rows.",
                                defaultValue: 0
                            },
                            delimiter: {
                                defaultValue: ","
                            },
                            quote: {
                                defaultValue: `"`
                            },
                            escape: {
                                defaultValue: null
                            },
                            commentCharacter: {
                                infoText: "If a row starts with this character, we will skip it.",
                                 defaultValue: null
                            },
                            ingestErrorMode: {
                                helperDropdown: helperDropdowns.ingestErrorMode
                            },
                            rowXPath: {
                                helperDropdown: helperDropdowns.rowXPaths
                            },
                            engineSelectionStrategy: {
                                helperDropdown: helperDropdowns.engineSelectionStrategies
                            }
                        };
                    }

                    function refresh() {
                        $scope.ingestOtherSettingsDropdown = (function() {
                            const source = $scope.ingestDataSummary.selectedSources[0];
                            if (!source) return;

                            const ingestOtherSettingsChoices = getIngestOtherSettingsChoicesObj(source);

                            const itemTitles = {
                                charset: "Charset:",
                                commentCharacter: "Comment Character:",
                                delimiter: "Delimiter:",
                                nullString: "Null Value String:",
                                quote: "Quote:",
                                escape: "Escape: ",
                                skipAfterHeader: "Skip After Header:",
                                skipFromBottom: "Skip From Bottom:",
                                startOnRow: "Start On Row:",
                                ingestErrorMode: "Ingest error mode:",
                                rowXPath: "Path to rows:",
                                engineSelectionStrategy: "Storage type:"
                            };

                            const withoutSettings = [
                                'useHeaders',
                                'id',
                                '@class',
                                "charset",
                                "nullString",
                                "commentCharacter",
                                "skipFromBottom",
                                "rowDelimiter"
                            ];

                            const withoutFlowSettings = [];

                            if(source.descriptor.engine === 'BIGQUERY'){
                                withoutFlowSettings.push('ingestErrorMode');
                            }

                            if(!User.getCurrent().manualEngineSelection){
                                withoutFlowSettings.push('engineSelectionStrategy');
                            }

                            let items = _.map(_.omit(source.descriptor.settings, withoutSettings), getItem);
                            const tab = $scope.tabsSection.options.activeTab;

                            if (tab.state) {
                                items = items.concat(_.map(_.omit(tab.state.flowSettings, withoutFlowSettings), getItem));
                            }

                            function getItem(value, key) {
                                let numberInput = isNumberInput(key);

                                if (key === 'ingestErrorMode') {
                                    value = getValueByKey(ingestErrorMode, value);
                                }

                                if (key === 'engineSelectionStrategy') {
                                    value = getValueByKey(engineSelectionStrategies, value);
                                }

                                return {
                                    title: itemTitles[key],
                                    key,
                                    value: numberInput ? value != null ? value : 0 : value,
                                    type: numberInput ? 'number' : 'text',
                                    isOpen: false,
                                    isEditable: isEditable(key)
                                }
                            }

                            $scope.$eval(function () {
                                $scope.ingestOtherSettingsInfo.count = _.size(items);
                            });

                            return {
                                choices: ingestOtherSettingsChoices,
                                items: items,
                                toggleChoicesDropdown: function($event, item, value) {
                                    $event.preventDefault();
                                    $event.stopPropagation();

                                    if (value != null) {
                                        item.isOpen = value;
                                    } else {
                                        item.isOpen = !item.isOpen;
                                    }
                                }
                            }
                        })();
                    }

                    $rootScope.$on('refresh-ingest-other-settings-dropdown', refresh);

                    $scope.onIngestOtherSettingsModelChanged = function(item) {
                        function checkMinMax(item, min, max) {
                            if (angular.isNumber(item.value)) {
                                if(item.value > max) {
                                    item.value = max;
                                } else if (_.isUndefined(item.value) || item.value < min) {
                                    item.value = min;
                                }
                            }
                        }

                        if (item.key === "startOnRow") {
                            checkMinMax(item, 1, 5000);
                        } else {
                            checkMinMax(item, 0, 5000);
                        }
                    };

                    $scope.onKeyDownIngestOtherSettingsInput = function(event, item) {
                        switch (event.which) {
                            case KeyJS.ENTER:
                            case KeyJS.ESC:
                            case KeyJS.TAB:
                                event.target.blur(item);
                                $scope.ingestOtherSettingsDropdown.toggleChoicesDropdown(event, item, false);
                        }
                    };

                    function updateIngestOtherSettings(key, value) {
                        // update flowSettings
                        if (key === "ingestErrorMode") {
                            let tab = $scope.tabsSection.options.activeTab;
                            if (tab.state) {
                                value = getKeyByValue(ingestErrorMode, value);
                                tab.state.flowSettings[key] = value;
                                BookmarkEventService.emit('.ingest.IngestErrorModeChangeEvent', {[key]: value}, $scope);
                                $scope.updateIngestSettings(true);
                            }
                        } else if (key === "engineSelectionStrategy") {
                            let tab = $scope.tabsSection.options.activeTab;
                            if (tab.state) {
                                value = getKeyByValue(engineSelectionStrategies, value);

                                tab.state.flowSettings[key] = value;
                                BookmarkEventService.emit('.ingest.EngineSelectionStrategyChangeEvent', {[key]: value}, $scope);
                                $scope.updateIngestSettings(true);
                            }
                        } else {
                            let source = $scope.ingestDataSummary.selectedSources[0];
                            let oldValue = source.descriptor.settings[key];
                            source.descriptor.settings[key] = value;

                            $scope.togglePageLoader(true);
                            $scope.updateIngestFileSettings(source.id, source.descriptor.settings)
                                .then(() => {
                                    $scope.ingestPreviewLoaded = false;
                                    $scope.updateIngestSettings();
                                }, (e) => {
                                    source.descriptor.settings[key] = oldValue;
                                    $scope.togglePageLoader(false);
                                    let err = IngestDataLoadingService.getErrorMessage({
                                        code: e.errorCode,
                                        message: e.errorMessage
                                    });
                                    err.message = 'Ingest ' + err.message;
                                    cc.notify(err);

                                    IngestDataLoadingService.clear($scope);
                                    $scope.$evalAsync(function () {
                                        $scope.ingestCommitOptions.isFailed = true;
                                    });

                                });
                        }
                    }

                    $scope.onIngestOtherSettingsChoiceSelect = function($event, choice, item) {
                        $event.preventDefault();

                        if (choice !== item.value) {
                            item.value = choice;

                            if($scope.pageMode === $scope.PAGE_MODE.INGEST) {
                                updateIngestOtherSettings(item.key, item.value);
                            }
                        }
                    };

                    $scope.onIngestOtherSettingsFocusInput = function($event) {
                        $event.stopPropagation();
                        $($event.target).select();
                    };

                    $scope.onIngestOtherSettingsBlur = function(item) {
                        if (!item.value) {
                            const source = $scope.ingestDataSummary.selectedSources[0];
                            item.value = getIngestOtherSettingsChoicesObj(source)[item.key].defaultValue;
                        }

                        if (item.value !== _.get($scope.ingestDataSummary, ['selectedSources', 0, 'descriptor', 'settings', item.key])
                            && $scope.pageMode === $scope.PAGE_MODE.INGEST) {
                            updateIngestOtherSettings(item.key, item.value);
                        }
                    };

                    refresh();
                }
            }
        }])
});