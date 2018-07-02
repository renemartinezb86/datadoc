define(['./module', 'lodash'], function(module, _) {
    module.service('FormatToolbarService', ['BookmarkEventService', 'DataLoadingService', function (BookmarkEventService, DataLoadingService) {

        let dataTypes = ['STRING', 'DECIMAL', 'DATE', 'TIME', 'BOOLEAN'];

        const BOOLEAN_POSSIBLE_TYPES = {
            y: 1,
            n: 0,
            t: 1,
            f: 0,
            yes: 1,
            no: 0,
            true: 1,
            false: 0,
            1: 1,
            0: 0
        };

        const isBooleanFormat = (exampleValue) => {
            if(exampleValue === undefined || exampleValue === null) {
                return false;
            }
            return _.includes(Object.keys(BOOLEAN_POSSIBLE_TYPES), ("" + exampleValue).toLowerCase())
        };

        const getBooleanByValue = (value) => {
            if(value === undefined || value === null) {
                return null;
            }
            if(isBooleanFormat(value)) {
                return BOOLEAN_POSSIBLE_TYPES[(value + "").toLowerCase()]
            } else {
                return null;
            }
        };

        let dataTypeFormats = {
            TEXT: dataTypes,
            NUMBER: ['DECIMAL'],
            PERCENT: ['DECIMAL'],
            FINANCIAL: ['DECIMAL'],
            DATE_1: ['DATE', 'DECIMAL'],
            DATE_2: ['DATE', 'DECIMAL'],
            DATE_TIME: ['DATE', 'DECIMAL'],
            TIME: ['TIME', 'DECIMAL', 'DATE'],
            DURATION: ['TIME', 'DECIMAL', 'DATE'],
            BOOLEAN_1: ['BOOLEAN'],
            BOOLEAN_2: ['BOOLEAN']
        };

        function getSelectedColumns($scope){
            if($scope.gridOptions) {
                let selectedColumns = _.map($scope.gridOptions.api.rangeController.selectedCols, col => {
                    return DataLoadingService.isPivotTable($scope) ? col.colDef.originalField : col.colDef.field;
                });
                return _($scope.dataSummary.shows)
                    .filter(show => _.includes(selectedColumns, DataLoadingService.getOpKey(show)))
                    .map(show => show.col)
                    .value()
            }
            return [];
        }

        function updateColFormat($scope, format){
            let selected = getSelectedColumns($scope),
                rememberCurrency;
            if(_.isFunction(format)){
                _.each(selected, col => {
                    let response = format(col.settings.format, col);
                    if(response && response.rememberCurrency){
                        rememberCurrency = col.settings.format.currency;
                    }
                });
            } else {
                _.each(selected, col => col.settings.format = format);
            }
            if(rememberCurrency){
                $scope.tabsSection.options.activeTab.state.lastSelectedCurrency = rememberCurrency;
            }
            _.each(selected, col => {
                BookmarkEventService.emit(".cols.ColFormatChangeEvent", {
                    field: col.field,
                    format: col.settings.format,
                    rememberLastSelectedCurrency: !!rememberCurrency
                }, $scope);
            });
            DataLoadingService.updateFiltersByColumn(selected, $scope);
            setTimeout(function(){
                $scope.gridOptions.api.refreshView();
            })
        }

        function setFinancialFormat($scope, currency){
            updateColFormat($scope, (format, col) => {
                if(col.type == 'DECIMAL') {
                    format.type = 'FINANCIAL';
                    format.decimalPlaces = 2;
                    format.showThousandsSeparator = true;
                    format.currency = currency || '$';
                    return {rememberCurrency: true};
                }
            })
        }

        function getLastSelectedCurrency($scope){
            return _.get($scope, 'tabsSection.options.activeTab.state.lastSelectedCurrency') || '$';
        }

        function isCurrencySelected($scope, currency){
            return function() {
                let column = getSelectedColumns($scope)[0];
                return column && column.settings.format.currency == currency
            }
        }

        function isFixedFormatApplied(show){
            return show.id.op && _.contains(['COUNT', 'UNIQUE_COUNT', 'APPROX_UNIQUE_COUNT'], show.id.op)
        }

        // todo improve performance by listening to range selection event
        function isFormatToolbarActive($scope){
            if($scope.gridOptions) {
                if ($scope.gridOptions.api.rangeController.selectedCols.length == 0) {
                    return false;
                }
                let selectedColumns = _.map($scope.gridOptions.api.rangeController.selectedCols, col => {
                    return DataLoadingService.isPivotTable($scope) ? col.colDef.originalField : col.colDef.field;
                });
                let selectedShows = _.filter($scope.dataSummary.shows, show => _.includes(selectedColumns, DataLoadingService.getOpKey(show)));
                if(selectedShows.length == 0){
                    return false;
                }
                return _.filter(selectedShows, show => isFixedFormatApplied(show)).length == 0;
            }
            return true;
        }

        function getFormatButtons($scope) {
            var obj = [
                {
                    label: () => getLastSelectedCurrency($scope),
                    tooltipMessage: 'Format as financial',
                    dropdownList: [
                        {
                            label: '$ English (United States)',
                            selected: isCurrencySelected($scope, '$'),
                            action: function(){
                                setFinancialFormat($scope, '$')
                            }
                        },
                        {
                            label: '€ Euro (€ 123)',
                            selected: isCurrencySelected($scope, '€'),
                            action: function(){
                                setFinancialFormat($scope, '€')
                            }
                        },
                        {
                            label: '£ English (United Kingdom)',
                            selected: isCurrencySelected($scope, '£'),
                            action: function(){
                                setFinancialFormat($scope, '£')
                            }
                        },
                        {
                            label: '¥ Chinese (China)',
                            selected: isCurrencySelected($scope, '¥'),
                            action: function(){
                                setFinancialFormat($scope, '¥')
                            }
                        }
                    ],
                    action: function() {
                        setFinancialFormat($scope, getLastSelectedCurrency($scope))
                    }
                },
                {
                    label: () => '%',
                    tooltipMessage: 'Format as percent',
                    action: function() {
                        updateColFormat($scope, (format, col) => {
                            if(col.type == 'DECIMAL') {
                                format.type = 'PERCENT';
                                format.decimalPlaces = 2;
                            }
                        })
                    }
                },
                {
                    label: () => ',',
                    tooltipMessage: 'Thousands separator',
                    action: function() {
                        updateColFormat($scope, (format, col) => {
                            if(col.type == 'DECIMAL') {
                                if(!_.includes(['NUMBER', 'PERCENT', 'FINANCIAL'], format.type)) {
                                    format.type = 'NUMBER';
                                }
                                format.showThousandsSeparator = !format.showThousandsSeparator;
                            }
                        })
                    }
                },
                {
                    label: () => '<div class="btn-icon less-dp"></div>',
                    tooltipMessage: 'Decrease Decimal Places',
                    action: function() {
                        updateColFormat($scope, (format, col) => {
                            if(col.type == 'DECIMAL') {
                                if (_.includes(['NUMBER', 'PERCENT', 'FINANCIAL'], format.type) && format.decimalPlaces > 0) {
                                    format.decimalPlaces--;
                                }
                            }
                        })
                    }
                },
                {
                    label: () => '<div class="btn-icon more-dp"></div>',
                    tooltipMessage: 'Increase Decimal Places',
                    action: function() {
                        updateColFormat($scope, (format, col) => {
                            if(col.type == 'DECIMAL') {
                                if (_.includes(['NUMBER', 'PERCENT', 'FINANCIAL'], format.type) && format.decimalPlaces < 10) {
                                    format.decimalPlaces++;
                                }
                            }
                        })
                    }
                }
            ];

            return obj;
        }

        var separator = function(){
            return {
                separator: true,
                action: function($event){
                    $event.stopPropagation();
                    $event.preventDefault()
                }
            };
        };

        function getFormatOptionsForColumn($scope, column, updateFn, suppressTypeCheck){
            const colType = _.get(column, 'type');
            const exampleValue = _.get(column, 'exampleValue');
            const colRepeated = _.get(column, 'repeated');
            const settingsFormatType = _.get(column, 'settings.format.type');
            const listInfo = !!colRepeated ? ` (list)` : '';
            const booleanFormat = isBooleanFormat(exampleValue);

            function option(label, descr, group, action, selected, disabled){
                const typeChangeDisabled = $scope.isViewOnly && colType !== group;

                return {
                    label,
                    descr,
                    group,
                    selected,
                    disabled: disabled || typeChangeDisabled,
                    action: () => {
                        updateFn($scope, action)
                    }
                };
            }

            return _.compact([
                option('Text' + listInfo, 'Hello', 'STRING',
                    (format, col) => format.type = 'TEXT',
                    settingsFormatType === 'TEXT' && !colRepeated,
                    colType !== 'STRING'),
                separator(),

                option('Number' + listInfo, '123.23', 'DECIMAL',
                    (format, col) => {
                        if(suppressTypeCheck || col.type === 'DECIMAL') {
                            format.type = 'NUMBER';
                            format.decimalPlaces = format.defaultDecimalPlaces;
                        }
                    },
                    settingsFormatType === 'NUMBER' && !colRepeated,
                    colType !== 'DECIMAL'),
                option('Percent', '12%', 'DECIMAL',
                    (format, col) => {
                        if(suppressTypeCheck || col.type === 'DECIMAL') {
                            format.type = 'PERCENT';
                            format.decimalPlaces = format.defaultDecimalPlaces;
                        }
                    },
                    settingsFormatType === 'PERCENT' && !colRepeated,
                    colType !== 'DECIMAL'),
                option('Financial', '$12,000.25', 'DECIMAL',
                    (format, col) => {
                        if(suppressTypeCheck || col.type === 'DECIMAL') {
                            format.type = 'FINANCIAL';
                            format.decimalPlaces = format.defaultDecimalPlaces;
                        }
                    },
                    settingsFormatType === 'FINANCIAL' && !colRepeated,
                    colType !== 'DECIMAL'),
                separator(),

                option('Date <span class="secondary">v1</span>', '11/17/2014', 'DATE',
                    (format, col) => {
                        if(suppressTypeCheck || _.includes(['DECIMAL', 'DATE'], colType)) {
                            format.type = 'DATE_1';
                        }
                    },
                    settingsFormatType === 'DATE_1',
                    !_.includes(['DECIMAL', 'DATE'], colType)),
                option('Date <span class="secondary">v2</span>', 'Sep. 14, 2014', 'DATE',
                    (format, col) => {
                        if(suppressTypeCheck || _.includes(['DECIMAL', 'DATE'], colType)) {
                            format.type = 'DATE_2';
                        }
                    },
                    settingsFormatType === 'DATE_2',
                    !_.includes(['DECIMAL', 'DATE'], colType)),
                option('Datetime', '11/17/2014 12:13:14', 'DATE',
                    (format, col) => {
                        if(suppressTypeCheck || _.includes(['DECIMAL', 'DATE'], colType)) {
                            format.type = 'DATE_TIME';
                        }
                    },
                    settingsFormatType === 'DATE_TIME',
                    !_.includes(['DECIMAL', 'DATE'], colType)),
                separator(),

                option('Time', '3:20:00 PM', 'TIME',
                    (format, col) => {
                        if(suppressTypeCheck || _.includes(['DECIMAL', 'TIME', 'DATE'], colType)) {
                            format.type = 'TIME';
                        }
                    },
                    settingsFormatType === 'TIME',
                    !_.includes(['DECIMAL', 'TIME', 'DATE'], colType)),
                option('Duration', '02:12:20', 'TIME',
                    (format, col) => {
                        if(suppressTypeCheck || _.includes(['DECIMAL', 'TIME', 'DATE'], colType)) {
                            format.type = 'DURATION';
                        }
                    },
                    settingsFormatType === 'DURATION',
                    !_.includes(['DECIMAL', 'TIME', 'DATE'], colType)),
                separator(),

                option('Boolean y/n', 'Yes', 'BOOLEAN',
                    (format, col) => {
                        format.type = 'BOOLEAN_1';
                    },
                    settingsFormatType === 'BOOLEAN_1',
                    !booleanFormat),
                option('Boolean T/F', 'TRUE', 'BOOLEAN',
                    (format, col) => {
                        format.type = 'BOOLEAN_2';
                    },
                    settingsFormatType === 'BOOLEAN_2',
                    !booleanFormat),
            ]);
        }

        function getOtherFormatOptions($scope){
            let column = getSelectedColumns($scope)[0];
            return getFormatOptionsForColumn($scope, column, updateColFormat);
        }

        function isBasicFormat(col, format){
            return dataTypeFormats[format][0] == col.type;
        }

        function getTypeByFormat(format) {
            return dataTypeFormats[format][0];
        }

        return {
            getFormatButtons,
            getOtherFormatOptions,
            getFormatOptionsForColumn,
            isFormatToolbarActive,
            isBasicFormat,
            getTypeByFormat,
            getBooleanByValue,
            BOOLEAN_POSSIBLE_TYPES
        };
    }]);
});