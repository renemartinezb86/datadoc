define(['./module', 'lodash'], function(module, _) {
    module.factory('ColumnsService', ['$timeout', function ($timeout) {

        const colNameFormat = {
            OFF: 'Off',
            DATABASE_FRIENDLY: 'Database-friendly',
            HUMAN_FRIENDLY: 'Human-friendly'
        };

        let searchTypes = [
            {label: 'off', code: 'NONE'},
            {label: '<span class="hl">exact match</span>', code: 'EXACT_MATCH'},
            {label: '<span class="hl">edge</span> search', code: 'EDGE'},
            {label: 'full in<span class="hl">ner</span> search', code: 'FULL'}
        ];

        const getTypeText = function(type) {
            if (type === "STRING") {
                return 'Text';
            } if (type === "DECIMAL") {
                return 'Number'
            }
        };

        const formatColumnName = (format, name) => {
            if(!format) {
                return name;
            }

            switch (colNameFormat[format]) {
                case colNameFormat.OFF:
                    return name;
                case colNameFormat.DATABASE_FRIENDLY:
                    return name.toLowerCase().split(" ").join("_");
                case colNameFormat.HUMAN_FRIENDLY:
                    return name.toLowerCase().split(/_|-|\s/).map((namePart) => namePart ? _.capitalize(namePart) : "").join(" ");
                default:
                    console.warn(`There is no such format - ${format}`);
            }
        };

        const defaultTypeAction = function($scope, columns, column, type, customHandler){
            const actionFn = () => {
                if (customHandler) {
                    customHandler(column.settings, columns);
                } else {
                    _.each(columns, function (column) {
                        setDataType(column, type);
                    });
                }
            };

            if ($scope.isVizMode()) {
                $scope.showReIngestModal({
                    actionText: `Change data type on ${column.name} from "${getTypeText(column.settings.type.dataType)}"  to "${getTypeText(type)}"`,
                    reload: () => {
                        actionFn();
                        $scope.updateIngestSettingsAndCommit(() => true);
                        $scope.cancelReIngestModal();
                    }
                });
            } else {
                actionFn();
                $scope.updateIngestSettings(false, false, false);
            }
        };



        const getListDataTypeMenuOption = ($scope, columns, column) => {
            const selected = !!column.settings.splitOn;
            const fieldInfo = `List field: ${selected ? `<span class="success-text">yes (${column.settings.splitOn})</span>` : 'no'}`;
            const type = column.settings.type.dataType;

            const listChildMenu = (name, splitCharacter) => {
                const defaultListAction = () => {
                    defaultTypeAction($scope, columns, column, type , () => {
                        columns.forEach(col => col.settings.splitOn = splitCharacter);
                    });
                };

                const buildItemName = (name, splitCharacter) => {
                    if(splitCharacter) {
                        return `
                        <span class="split-character">${splitCharacter}</span>
                        <span class="split-character-description">(${name})</span>
                        `
                    } else {
                        return name;
                    }
                };

                return {
                    name: buildItemName(name, splitCharacter),
                    icon: '<i class="fa fa-fw ' + (column.settings.splitOn === splitCharacter ? 'fa-check' : '') + '"></i>',
                    action: defaultListAction
                }
            };

            const fieldName = `<span class="capitalized-text ${selected ? '' : 'disabled'}">${fieldInfo}</span>`;
            return { name: fieldName,
                childMenu: [
                    listChildMenu('Not a list field', null),
                    listChildMenu('comma', ','),
                    listChildMenu('colon', ':'),
                    listChildMenu('semi-color', ';'),
                ]
            };
        };

        function getDataTypeMenuOption($scope, columns, column) {
            function getCastToTypeOption(title, type, customHandler){
                const selected = column.settings.type.dataType == type;

                return {
                    name: `<span class="capitalized-text">${title}</span>`,
                    icon: selected ? '<i class="fa fa-fw fa-check"></i>' : '<i class="fa fa-fw"></i>',
                    action: defaultTypeAction.bind(null, $scope, columns, column, type, customHandler)
                }
            }

            function isOfType(types){
                if(_.isArray(types)) {
                    return _.contains(types, column.settings.type.dataType);
                }
                return column.settings.type.dataType == types;
            }

            function isList() {
                return !!column.settings.splitOn;
            }

            function getAgSelectedTypeTemplate(type, capitalized = true) {
                return `: <span class="ag-grid-selected-type ${capitalized ? 'capitalized-text' : ''}">${type}</span>`;
            }

            function getSelectedTypeMenuText() {
                const list = isList() ? ' (List)' : '';

                if ( isOfType(['DECIMAL']) ) {
                    return `Number ${list}`;
                } else if ( isOfType(['DATE', 'TIME']) ) {
                    return 'Date/Time';
                } else if ( isOfType(['BOOLEAN']) ) {
                    return 'Other';
                }
                return `Text ${list}`;
            }

            return {
                name: 'Data Type' + getAgSelectedTypeTemplate(getSelectedTypeMenuText(), false),
                childMenu: [
                    getCastToTypeOption('Text', 'STRING'),
                    getCastToTypeOption('Number', 'DECIMAL'),
                    getCastToTypeOption('Date/Time', 'DATE'),
                    'separator',
                    getListDataTypeMenuOption($scope, columns, column),
                ]
            };
        }

        function getSearchTypeMenuOption ($scope, columns, column) {

            function getSearchTypeOption(title, type) {
                let selected = column.settings.searchType == type;
                return {
                    name: title,
                    icon: selected ? '<i class="fa fa-fw fa-check"></i>' : '<i class="fa fa-fw"></i>',
                    action: function () {
                        if ($scope.isVizMode()) {
                            $scope.$broadcast('reset-search-type', {searchType: {text: title, value: type}, column: column});
                        } else {
                            _.each(columns, column => {
                                column.settings.searchType = type;
                            });
                            $scope.updateIngestSettings(true);
                        }
                    }
                };
            }
            function isAllOfType(type) {
                return _.every(columns, column => _.get(column, 'settings.type.dataType') === type);
            }
            function containsType(type) {
                return _.some(columns, column => _.get(column, 'settings.type.dataType') === type);
            }
            function getSelectedSearchTypeMenuText() {
                let label = _.find(searchTypes, {code: column.settings.searchType}).label;
                return `: <span class="ag-grid-selected-type">${label}</span>`;
            }
            let availableCodes = ['NONE'];
            if(containsType('DECIMAL') || containsType('STRING')){
                availableCodes.push('EXACT_MATCH')
            }
            if (isAllOfType('STRING')) {
                availableCodes.push('EDGE');
                availableCodes.push('FULL');
            }
            return {
                name: 'Search Type' + getSelectedSearchTypeMenuText(),
                childMenu: _(searchTypes)
                    .filter(searchType => _.includes(availableCodes, searchType.code))
                    .map(searchType => getSearchTypeOption(searchType.label, searchType.code))
                    .value()
            };
        }

        function getConvertToListOption($scope, columns, column){
            return{
                name: "List",
                icon: '<i class="fa fa-fw ' + (column.settings.splitOn ? 'fa-check' : '') + '"></i>',
                action: function(){
                    $scope.showConvertToListModal(columns);
                }
            }
        }

        function resetSearchType(column){
            let settings = column.settings;
            switch (settings.type.dataType){
                case 'STRING':
                    settings.searchType = 'EDGE';
                    break;
                case 'DECIMAL':
                    settings.searchType = 'EXACT_MATCH';
                    break;
                default:
                    settings.searchType = 'NONE';
            }
        }

        function getClassForType(type){
            switch (type){
                case 'DECIMAL':
                    return 'com.dataparse.server.service.parser.type.NumberTypeDescriptor';
                default:
                    return 'com.dataparse.server.service.parser.type.TypeDescriptor';
            }
        }

        function setDataType(column, dataType){
            column.settings.type = {
                '@class': getClassForType(dataType),
                dataType: dataType
            };
            resetSearchType(column);
        }

        return {
            getDataTypeMenuOption,
            getSearchTypeMenuOption,
            getSearchTypes: () => searchTypes,
            getConvertToListOption,
            colNameFormat,
            resetSearchType,
            setDataType,
            formatColumnName
        };
    }]);
});