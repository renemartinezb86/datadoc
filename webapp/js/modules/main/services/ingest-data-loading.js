define(['./module', 'angular', /*'latlon-geohash',*/ 'common', 'lodash', 'moment', 'pluralize', 'ag-grid', 'fin-grid',
      /*'chartCommons'*/],
    function (services, angular, /*Geohash,*/ cc, _, moment, pluralize, agGrid, finGrid, /*chartC*/) {
        services.service('IngestDataLoadingService', ['$q', '$http', '$timeout', '$rootScope', '$filter', '$compile', 'WSocket',
            'ScopeService', 'SearchBarService', 'AvailableFixedDates', 'EventNames', 'Constants', 'ColumnsService', 'FormatCellService',
            function ($q, $http, $timeout, $rootScope, $filter, $compile , WSocket, ScopeService, SearchBarService,
                      AvailableFixedDates, EventNames, Constants, ColumnsService, FormatCellService) {
                var ROW_NUMBER_COL_ID = "$$row_number";
                var EMPTY_FIELDS_COL_ID = "$$empty_fields";
                var BLANK_FIELDS_COL_ID = "$$blank_fields";
                var DEFAULT_ROW_HEIGHT = 21;
                var MAX_FULLTEXT_DROPDOWN_WIDTH = 800;

                function initGrid(params, $scope) {
                    if($scope.previewGridOptions && $scope.previewGridOptions.api){
                        $scope.previewGridOptions.api.destroy();
                    }
                    $scope.inRequest = false;
                    $scope.errorFields = [];
                    $scope.errorFieldsCount = 0;
                    var selector = params.selector,
                        gridOptions = {
                        headerHeight: 26,
                        defaultRowHeight: DEFAULT_ROW_HEIGHT,

                        overlayLoadingTemplate: ` `,
                        minFitColWidth: 100,
                        maxFitColWidth: 500,
                        enableColResize: true,
                        rowSelection: 'none',
                        enableRangeSelection: true,
                        enableServerSideSorting: false,
                        suppressContextMenu: false,
                        suppressMenuFilterPanel: true,
                        suppressMenuColumnPanel: true,
                        suppressCellSelection: false,
                        suppressFieldDotNotation: true,
                        suppressMenuHide: true,
                        suppressColumnMoveAnimation: true,
                        enableFilter: false,
                        enableCopyWithHtml: true,
                        unSortIcon: true,
                        suppressDragLeaveHidesColumns: true,
                        suppressAggFuncInHeader: true,
                        suppressColumnVirtualisation: false,
                        toolPanelSuppressRowGroups: true,
                        rowDeselection: true,
                        columnDefs: [],
                        floatingTopRowData: [],
                        enableSorting: true,
                        suppressMoveToPinning: true,
                        suppressGhostIcon: true,
                        // todo move resize into ag-grid fork
                        onHeaderResizableDragStart: function (e){
                            var rootRect = this.eRoot.getBoundingClientRect();

                            var resizeHandler = $(this.eHeaderCell).find('.ag-header-cell-resize')[0];
                            var resizeHandlerRect = resizeHandler.getBoundingClientRect();

                            var height = rootRect.bottom - resizeHandlerRect.top;
                            var insideHandlerTop = rootRect.top - resizeHandlerRect.top;

                            this.eHandler = $('<div class="ag-resizable-handler">' +
                                '<div style="height: ' + resizeHandlerRect.height + 'px;" class="ag-resizable-inside-handler"></div>' +
                                '</div>')[0];

                            this.eHandler.style.left = (e.clientX - rootRect.left+2)+'px';
                            this.eHandler.style.top = -insideHandlerTop;
                            this.eHandler.style.height = height + 'px';
                            this.eRoot.appendChild(this.eHandler);

                            this.startWidth = this.column.getActualWidth();
                            e.stopPropagation();
                        },
                        onHeaderResizableDragging: function (dragChange, finished, e) {
                            var maxWidth = (this.column.colDef.maxWidth > 0 ? this.column.colDef.maxWidth : 2000);
                            if (finished) {
                                this.eHandler.remove();
                                var newWidth = this.startWidth + dragChange;
                                if(this.column.getActualWidth() != newWidth) {
                                    this.columnController.setColumnWidth(this.column, newWidth, finished);
                                    this.gridPanel.sizeColumnsToFit();
                                }
                            } else if (e) {
                                var x = (e.clientX - this.eRoot.getBoundingClientRect().left+2);
                                // left direction
                                if (dragChange < 0) {
                                    var colMinWidthPoint = (x - this.column.actualWidth) + this.column.minWidth;

                                    if (x + dragChange < colMinWidthPoint) {
                                        x = colMinWidthPoint - dragChange;
                                    }
                                } else if (dragChange > (maxWidth - this.column.actualWidth)) {
                                    var colMaxWidthPoint = (x - this.column.actualWidth) + maxWidth;

                                    x = colMaxWidthPoint - dragChange;
                                }

                                this.eHandler.style.left = x+'px';
                            }
                            if(e) {
                                e.stopPropagation();
                            }
                        },

                        customCreateGhost: function () {

                            var level = this.dragSource.dragGroup ?
                                this.dragSource.dragGroup.originalColumnGroup.colGroupDef.level : $scope.dataSummary.pivot.length,
                                dragWidth = _.reduce(this.dragSource.dragItem, function(result, item){ return result + item.actualWidth}, 0),
                                headerHeight = this.gridOptionsWrapper.getHeaderHeight();

                            var headersNumber = 1;

                            this.eBody = $(selector)[0];
                            this.eBodyViewport = this.eBody.querySelector('.ag-body-viewport');
                            this.eGhost = document.createElement('div');
                            this.eGhost.className = "ag-dnd-ghost";

                            var containerHeight = this.eBody.querySelector('.ag-full-width-container').getBoundingClientRect().height;
                            var bodyHeight = this.eBody.getBoundingClientRect().height - headerHeight - 2;

                            this.eGhost.style.top = headersNumber  * headerHeight + 'px';
                            this.eGhost.style.height = (containerHeight < bodyHeight ? containerHeight : bodyHeight) + 'px';
                            this.eGhost.style.width = dragWidth + 'px';
                            this.eGhost.style.borderColor = 'lightblue';
                            this.eGhost.style.backgroundColor = 'rgba(0,0,0,0.1)';

                            var ehbg = {};
                            ehbg.top = level * headerHeight;
                            ehbg.height = ($scope.dataSummary.pivot.length - level + 1) * headerHeight;

                            this.eBody.appendChild(this.eGhost);
                        },
                        customPositionGhost: function (event) {
                            var ghostRect = this.eGhost.getBoundingClientRect();
                            var bodyRect = this.eBody.getBoundingClientRect();
                            var leftPinnedWidth = this.columnController.getLeftPinnedWidth();
                            var scrollWidth = this.eBodyViewport.scrollLeft;
                            // for some reason, without the '-2', it still overlapped by 1 or 2 pixels, which
                            // then brought in scrollbars to the browser. no idea why, but putting in -2 here
                            // works around it which is good enough for me.
                            var browserWidth = cc.getBodyWidth() - 2;
                            // horizontally, place cursor just right of icon

                            var left = event.pageX - bodyRect.left - ghostRect.width/2;
                            var windowScrollX = window.pageXOffset || document.documentElement.scrollLeft;
                            // check ghost is not positioned outside of the browser
                            if (browserWidth > 0) {
                                if ((left + this.eGhost.clientWidth) > (browserWidth + windowScrollX)) {
                                    left = browserWidth + windowScrollX - this.eGhost.clientWidth;
                                }
                            }
                            var minLeft = leftPinnedWidth - scrollWidth;
                            if(minLeft < 0){
                                minLeft = 0;
                            }
                            if (left < minLeft) {
                                left = minLeft;
                            }

                            this.eGhost.style.left = left + 'px';
                        },
                        onCellDoubleClicked: function (params) {
                            if (cc.isOverflow(params.eGridCell)) {
                                let cellRect = params.eGridCell.getBoundingClientRect();
                                let childScope = $scope.$new();
                                let fullTextDropdown = $('<div click-out="closeDropdown()" class="fulltext-dropdown">'+params.value+'</div>');
                                if (cellRect.width > MAX_FULLTEXT_DROPDOWN_WIDTH) {
                                    fullTextDropdown.css('max-width', cellRect.width);
                                }
                                childScope.closeDropdown = function() {
                                    this.el.remove();
                                };
                                fullTextDropdown = $compile(fullTextDropdown)(childScope);
                                childScope.el = fullTextDropdown;
                                $('body').append(fullTextDropdown);
                                fullTextDropdown.css({
                                    top: Math.floor(cellRect.top) - 1,
                                    left: Math.floor(cellRect.left) - 1,
                                    "white-space": "pre-wrap",
                                    width: cellRect.width
                                });
                            }
                        },
                        onCellClicked: function (params) {
                            let isError = _.isObject(params.value) && params.value.type == 'ERROR';
                            if(!isError) {
                                var isArrayList = Array.isArray(params.value);
                                if (isArrayList || cc.isURL(params.value)) {
                                    var cellRect = params.eGridCell.getBoundingClientRect();
                                    var childScope = $scope.$new();
                                    var linkDropdown = $('<div ng-click="closeDropdown()" click-out="closeDropdown()" class="link-dropdown"></div>');
                                    var urlArr;

                                    if (isArrayList) {
                                        if (!_.isString(params.value[0])) {
                                            return;
                                        }

                                        urlArr = _.filter(params.value, function (value) {
                                            return value.match(cc.URL_REGEXP);
                                        });
                                    } else {
                                        urlArr = [params.value];
                                    }

                                    if (!urlArr.length) { return; }

                                    childScope.closeDropdown = function() {
                                        this.el.remove();
                                    };

                                    urlArr.forEach(function(url) {
                                        var text = url;

                                        if (text.length > 27) {
                                            text = text.slice(0, 14) + '...' + text.slice((text.length) - 13);
                                        }

                                        var link = $('<span><a href="'+url+'" target="_blank">' + text + '&nbsp;<i class="fa fa-external-link"></i></a></span>');
                                        linkDropdown.append(link);
                                    });

                                    linkDropdown = $compile(linkDropdown)(childScope);
                                    childScope.el = linkDropdown;

                                    $('body').append(linkDropdown);

                                    linkDropdown.css({
                                        top: (Math.floor(cellRect.top) - (linkDropdown[0].getBoundingClientRect().height + 2)),
                                        left: Math.floor(cellRect.left) - 1
                                    });

                                }
                            }
                        },
                        onColumnMoved: function(e){
                            let columnsToMove = [];
                            if(e.column){
                                columnsToMove = [e.column];
                            } else if (e.columns) {
                                columnsToMove = e.columns;
                            }

                            if (!$scope.ingestCommitFailed) {
                                _.each(columnsToMove, (column) => {
                                    let field = _.find($scope.ingestDataSummary.columns, function (s) {
                                            return s.id == column.colId;
                                        }),
                                        toPosition = e.toIndex - 2; // because of "row number" and "empty fields" columns

                                    cc.moveInArray($scope.ingestDataSummary.columns, field.settings.index, toPosition);

                                    $scope.$evalAsync(() => {
                                        $scope.updateIngestColumnsOrder();
                                        $scope.updateSelectedIngestColumns();
                                        $scope.updateIngestSettings(true);
                                    });
                                });
                            }
                        },
                        onGridSizeChanged: function() {
                            if($scope.previewGridOptions && $scope.previewGridOptions.api) {
                                $scope.previewGridOptions.api.sizeColumnsToFit();
                            }
                        },
                        getColumnsErrors: function() {
                            let columnApi = $scope.previewGridOptions.columnApi,
                                colDefs = columnApi.getAllColumns().map(col => col.colDef);

                            return _.reduce(colDefs, (acc, colDef) =>
                                colDef.firstError ? [...acc, colDef.field] : acc, []);
                        },
                        updateFieldsErrors: function() {
                            let fieldsErrors = this.getColumnsErrors();
                            $scope.$evalAsync(() => {
                                $scope.errorFieldsMessage = this.getFieldsErrorsMessage(fieldsErrors);
                                $scope.errorFieldsCount = _.size(fieldsErrors);
                            });
                        },
                        getFieldsErrorsMessage: function(fields) {
                            if (!fields || !_.isArray(fields)) {
                                fields = this.getColumnsErrors();
                            }
                            return `The following fields have possible errors: ${fields.join(", ")}. Please review them before saving your data.`;
                        },
                        overlayNoRowsTemplate: '<span class="ag-no-results">No results returned</span>',
                        headerCellTemplate: '<div class="ag-header-cell">\n    <div id="agResizeBar" class="ag-header-cell-resize"></div>\n    <span id="agMenu" class="ag-header-icon ag-header-cell-menu-button">\n        <i class="fa fa-caret-down"></i>\n    </span>\n    <div id="agHeaderCellLabel" class="ag-header-cell-label">\n        <span class="ag-header-cell-error" style="display: none">\n            <i class="fa fa-warning"></i>\n        </span>\n        <span id="agText" class="ag-header-cell-text"></span>\n        <span class="ag-header-cell-type"></span>\n        <span id="agRename" class="ag-header-cell-rename"><input/></span>\n        <div id="gridSortView"> <span id="agSortAsc" class="ag-header-icon ag-sort-icon ag-sort-ascending-icon">\n            <i class="fa fa-sort-asc"></i>\n        </span>\n        <span id="agSortDesc" class="ag-header-icon ag-sort-icon ag-sort-descending-icon">\n            <i class="fa fa-sort-desc"></i>\n        </span>\n        <span id="agNoSort" class="ag-header-icon ag-sort-icon ag-sort-none-icon">\n            <i class="fa fa-sort"></i>\n        </span>\n </div>   </div>\n</div>',
                    };

                    gridOptions = {
                        data: [],
                        theme: {
                            showAdditionalInfo: true
                        },
                        onColumnResized: function(column) {
                            console.log('onColumnResized', column);
                        },
                        onUpdateColumnName: function(column, renameTo) {
                            console.log('onUpdateColumnName', column, renameTo);
                            updateColumnName(column.colDef, renameTo, $scope);
                        },
                        onColumnsMoved: function(columnsToMove, toPosition) {
                            console.log('onColumnsMoved', columnsToMove, toPosition);
                            if (!$scope.ingestCommitFailed) {
                                _.each(columnsToMove.reverse(), (column) => {
                                    let field = _.find($scope.ingestDataSummary.columns, s => s.id == column.colId); // could be int or string

                                    cc.moveInArray($scope.ingestDataSummary.columns, field.settings.index, toPosition);

                                    $scope.$evalAsync(() => {
                                        $scope.updateIngestColumnsOrder();
                                        $scope.updateSelectedIngestColumns();
                                        $scope.updateIngestSettings(true);
                                    });
                                });
                            }
                        },
                        getMainMenuItems: function(params) {
                            let selectedCols = $scope.previewGridOptions.api.getSelectedColumns();
                            if (!selectedCols || selectedCols.length === 0) {
                                selectedCols = [params.column]; // because of rightclick feature selectedCols can be empty at the time of drawing menu
                            }
                            const columns = _.map(selectedCols, col => _.find($scope.ingestDataSummary.columns, c => c.id == col.colId)); // id and colId can be int or string
                            const column = _.find($scope.ingestDataSummary.columns, c => c.id == params.column.colId); // id and colId can be int or string

                            var dataTypeOption = ColumnsService.getDataTypeMenuOption($scope, columns, column);
                            var searchTypeOption = ColumnsService.getSearchTypeMenuOption($scope, columns, column);
                            let menuItems = [dataTypeOption];
                            menuItems.push('separator');
                            menuItems.push(searchTypeOption);
                            menuItems.push('separator');
                            if(columns.length < 2) {
                                menuItems.push({
                                    name: 'Rename',
                                    action: function (clickEvent, cellEvent) {
                                        cellEvent.grid.onEditorActivate(cellEvent);
                                    }
                                })
                            }
                            menuItems.push({
                                name: 'Remove',
                                action: function() {
                                    _.each(columns, function(column){
                                        $scope.setRemovedIngestColumn(column, true);
                                    });
                                    $scope.updateSelectedIngestColumns();
                                    $scope.updateIngestSettings(true);
                                    toggleColumns(columns, false, $scope);
                                }
                            });

                            return menuItems;
                        },
                        getContextMenuItems: function(params){
                            let menu = [],
                              rangeSelections = $scope.previewGridOptions.api.getRangeSelections();

                            if(rangeSelections.length){
                                menu.push({name: 'Copy', action: function(){
                                        $scope.previewGridOptions.api.copySelectedRangeToClipboard();
                                    }});
                                menu.push({name: 'Copy With Headers', action: function(){
                                        $scope.previewGridOptions.api.copySelectedRangeToClipboard(true);
                                    }});
                            }

                            return menu;
                        },
                        headerCellRenderer: function(params){
                            console.log('headerCellRenderer');
                            if (params.colDef.colId === ROW_NUMBER_COL_ID) {
                                let $h = $(params.eHeaderCell),
                                  $error = $h.find('.ag-header-cell-error'),
                                  $errorsCount = `<div class="cell-error-value" ng-bind="errorFieldsCount"></div>`;

                                $h.find(':first-child').find('*').not('.ag-header-cell-error').remove(); // remove all unnecessary elements.
                                $scope.previewGridOptions.updateFieldsErrors();
                                $error.addClass("ag-header-cell-error-count")
                                  .show()
                                  .attr("ng-show", "errorFieldsCount")
                                  .attr('uib-tooltip-html', "errorFieldsMessage")
                                  .attr('tooltip-popup-delay', 250)
                                  .attr('tooltip-append-to-body', true)
                                  .attr('tooltip-placement', "right")
                                  .attr('tooltip-class', "main-page-tooltip")
                                  .append($errorsCount);
                                $compile($error)($scope);
                                return;
                            }
                            let $h = $(params.eHeaderCell);

                            if(params.colDef.errorCount > 0){
                                let $error = $h.find('.ag-header-cell-error');
                                $error.show()
                                  .attr('uib-tooltip', params.colDef.firstError.description)
                                  .attr('tooltip-popup-delay', 250)
                                  .attr('tooltip-append-to-body', true)
                                  .attr('tooltip-placement', "bottom")
                                  .attr('tooltip-class', "main-page-tooltip");
                                $compile($error)($scope);
                            }

                            return params.value;
                        },
                        logEnable: false
                    };

                    var gridDiv = document.querySelector(selector);

                    function createGrid(gridDiv) {
                        if (!$scope.previewGridOptions || !$scope.previewGridOptions.isAlive || !$scope.previewGridOptions.isAlive()) {
                            window.grid = $scope.previewGridOptions = new finGrid(gridDiv, gridOptions);
                        }
                    }

                    if (gridDiv) {
                        createGrid(gridDiv);
                    } else {
                        const interval = setInterval(() => {
                            gridDiv = document.querySelector(selector);
                            if (gridDiv) {
                                createGrid(gridDiv);
                                clearInterval(interval);
                            }
                        }, 100);
                    }
                }

                function getCustomCellRenderer ($scope){
                    return function(params) {
                        let content = params.value,
                            column = _.find($scope.ingestDataSummary.columns, function(c){
                                return c.id === params.column.colId;
                            });

                        var align = 'right';
                        if(_.isObject(content) && content.type === 'ERROR'){
                            content = 'Ø';
                        } else if(_.isArray(params.value)) {
                            content = FormatCellService.arrayCell(params.value);
                        } else {
                            if(column){
                                let type = column.settings.type.dataType,
                                    formatType;
                                switch(type){
                                    case 'DATE':
                                        if(column.settings.type.noTime){
                                            formatType = 'DATE_1';
                                        } else {
                                            formatType = 'DATE_TIME';
                                        }
                                        break;
                                    case 'TIME':
                                        formatType = 'TIME';
                                        break;
                                    case 'BOOLEAN':
                                        formatType = 'BOOLEAN_2';
                                        break;
                                    case 'DECIMAL':
                                    case 'STRING':
                                    default:
                                        formatType = 'AUTO';
                                }
                                let c = {
                                        settings: {
                                            format: {type: formatType}
                                        },
                                        type: type
                                    };
                                if (column.settings.type.dataType === "STRING") {
                                    content = $filter('formatCell')(params.value, c);
                                }
                            }
                        }

                        if (column) {
                            switch (column.settings.type.dataType) {
                                case 'STRING':
                                case 'LOCATION_COUNTRY_CODES':
                                case 'LOCATION_USA_STATE_CODES':
                                    align = 'left';
                                    break;
                                case 'BOOLEAN':
                                    align = 'center';
                                    break;
                            }
                        }

                        return content;
                    };
                }

                var renameNotificationActive = false;
                function updateColumnName (col, renameTo, $scope) {
                    let column = _.find($scope.ingestDataSummary.columns, function(c){
                        return c.id == col.colId;
                    });

                    if (!column) {
                        return;
                    }

                    var columnNameUsed = _.some($scope.ingestDataSummary.columns, function(column) {
                        let name = column.settings.name;
                        if(column.settings.rename) {
                            name = column.settings.rename;
                        }
                        return name == renameTo.toLowerCase();
                    });
                    if (renameTo != col.headerName && !columnNameUsed) {
                        col.headerName = renameTo;
                        column.settings.rename = renameTo;
                        $scope.previewGridOptions.columnApi.resetColumnState();
                        $scope.closeFieldsStickyNote();
                        $scope.updateIngestColumnsAutocompleteList();
                        $scope.updateIngestSettings(true);
                    } else {
                        if(!renameNotificationActive) {
                            renameNotificationActive = true;
                            cc.notify({
                                message: 'Column name is already in use',
                                icon: 'warning',
                                wait: 5,
                                ondismiss: () => renameNotificationActive = false
                            });
                        }
                    }
                }

                function createColumnDef(c, $scope, suppressSizeToFit, colNameFormat){
                    var align = 'right';
                    switch (c.settings.type.dataType) {
                        case 'STRING':
                        case 'LOCATION_COUNTRY_CODES':
                        case 'LOCATION_USA_STATE_CODES':
                            align = 'left';
                            break;
                        case 'BOOLEAN':
                            align = 'center';
                            break;
                    }

                    return {
                        colId: c.id + '',
                        field: c.columnInfoIdentifier,
                        headerName: c.blank ? "" : ((c.settings.rename || ColumnsService.formatColumnName(colNameFormat, c.name))),
                        hide: c.settings.removed,
                        suppressSorting: true,
                        errorCount: c.errorCount,
                        firstError: c.firstError,
                        colType: c.settings.type ? c.settings.type.dataType : c.type.dataType,
                        colTypeSign: cc.getColumnType({ colType: c.settings.type ? c.settings.type.dataType : c.type.dataType }),
                        isList: !!c.settings.splitOn,
                        suppressSizeToFit,
                        minWidth: 10,
                        maxWidth: 2000,
                        suppressMenu: c.blank,
                        cellRenderer: getCustomCellRenderer($scope),
                        halign: align
                    }

                }

                function createColumnDefs(columns, $scope, colNameFormat) {
                    return _.map(_.sortBy(columns, (col) => col.settings.index), function(c) {
                        return createColumnDef(c, $scope, !c.blank, colNameFormat);
                    });
                }

                function addBlankColumns(arr, totalSize) {
                    for(let i = 0; i < totalSize; i++){
                        arr.push({id: BLANK_FIELDS_COL_ID, name: 'c' + i, settings: {type: {dataType: null}}, blank: true});
                    }
                }

                function clear($scope){
                    var data = [],
                        cols = [];
                    $scope.totalSize = 0;
                    $scope.previewDescriptor = null;
                    $scope.ingestPreviewLoaded = false;
                    $scope.updateIngestColumns();
                    $scope.updateIngestColumnsAutocompleteList();
                    addBlankColumns(cols, 0);
                    var columns = createColumnDefs(cols, $scope, $scope.tabsSection.options.activeTab.state.colNameFormat);
                    $scope.previewGridOptions.api.setColumnDefs(columns);
                    $scope.previewGridOptions.api.setRowData(data);
                    $scope.previewGridOptions.api.sizeColumnsToFit();
                }

                function isAllColumnsHidden($scope){
                    let columns = $scope.previewGridOptions.columnApi.getAllGridColumns();
                    return _.every(columns, column => {
                        return column.colId === ROW_NUMBER_COL_ID
                            || column.colId === EMPTY_FIELDS_COL_ID
                            || column.colId === BLANK_FIELDS_COL_ID
                            || !column.visible;
                    })
                }

                function isBlankOrEmptyField(column) {
                    return column.colId === BLANK_FIELDS_COL_ID
                        || column.colId === EMPTY_FIELDS_COL_ID;
                }

                function checkBlankVisibility($scope) {
                    const columnApi = $scope.previewGridOptions.columnApi,
                        virtualColumns = columnApi.getAllDisplayedVirtualColumns();
                    return _.some(virtualColumns, col => col.colId === BLANK_FIELDS_COL_ID);
                }

                function toggleColumns(cols, toggle, $scope){
                    const colIds = _.map(cols, col => col.id + ''),
                        columnApi = $scope.previewGridOptions.columnApi;

                    columnApi.setColumnsVisible(colIds, toggle);
                    columnApi.setColumnVisible(EMPTY_FIELDS_COL_ID, isAllColumnsHidden($scope));

                    // We don't need to show column if there're not visible columns
                    columnApi.setColumnVisible(BLANK_FIELDS_COL_ID, !isAllColumnsHidden($scope));
                    // We need to check if there's a place for blank column
                    columnApi.setColumnVisible(BLANK_FIELDS_COL_ID, checkBlankVisibility($scope));

                    const columnsIds = columnApi.getAllColumns().filter(col => !isBlankOrEmptyField(col) && col.colId);
                    columnApi.autoSizeColumns(columnsIds, true);
                    $scope.previewGridOptions.api.sizeColumnsToFit();
                }

                function preview($scope, options = {}){
                    $scope.ingestCommitOptions.isFailed = false;
                    if($scope.ingestDataSummary.selectedSources.length) {
                        $scope.previewGridOptions.api.applyProperties($scope.ingestDataSummary.selectedSources[0].descriptor.settings);
                        return makeRequest(options, $scope);
                    } else {
                        return clear($scope);
                    }
                }

                function makeRequest(options = {}, $scope) {
                    var promise = $q.defer();
                    var request = {
                        rootNode: 'OUTPUT',
                        limit: 1000,
                        force: options.force,
                        bookmarkStateId: $scope.tabsSection.options.activeTab.bookmarkStateId
                    };
                    $scope.ingestPreviewLoaded = false;
                    if ($scope.currentPreviewRequest
                        && $scope.currentPreviewRequest.canceler.promise.$$state.status == 1) {
                        $scope.currentPreviewRequest = null;
                        return;
                    }
                    $scope.currentPreviewRequest = {canceler: $q.defer()};
                    $scope.requestFinished = false;
                    $scope.inRequest = true;
                    if (!options.disablePageLoader) {
                        $scope.togglePageLoader(true, options.shouldBackdrop, 'Previewing...');
                    }
                    if ($scope.ingestDataSummary.queryMode && $scope.ingestDataSummary.query) {
                        $scope.togglePageLoaderCancelButton($scope.cancelPreviewRequest);
                    }
                    let scrollPosition = {
                        top: $scope.previewGridOptions.api.gridPanel.getVerticalScrollPosition(),
                        left: $scope.previewGridOptions.api.gridPanel.getHorizontalScrollPosition()
                    };
                    let startTime = new Date().getTime();
                    $http({
                        method: 'POST',
                        url: "/api/flow/preview",
                        timeout: $scope.currentPreviewRequest.canceler.promise,
                        data: request
                    }).then(function (res) {
                        $scope.requestFinished = true;
                        $scope.requestTime = new Date().getTime() - startTime;
                        let data = res.data.data;
                        $scope.previewLimit = res.config.data.limit;
                        $scope.totalRowsCount = $scope.ingestDataSummary.selectedSources[0].descriptor.rowsCount;
                        $scope.totalSize = data.length;
                        $scope.currentQueryData.cachedPreviewData = res.data.cached;
                        $scope.currentPreviewRequest = null;
                        $scope.previewDescriptor = res.data.descriptor;
                        $scope.updateIngestColumns();
                        $scope.updateIngestColumnsAutocompleteList();
                        $rootScope.$emit('refresh-ingest-other-settings-dropdown');
                        const colDefs = createColumnDefs($scope.ingestDataSummary.columns, $scope, $scope.tabsSection.options.activeTab.state.colNameFormat);
                        $scope.previewGridOptions.api.setColumnDefs(colDefs);
                        $scope.previewGridOptions.api.setRowData(data);
                        $scope.ingestPreviewLoaded = true;
                        toggleColumns([], true, $scope);
                        if(!options.resetScrollPosition){
                            $scope.previewGridOptions.api.gridPanel.getVerticalScrollPosition(scrollPosition.top);
                            $scope.previewGridOptions.api.gridPanel.setHorizontalScrollPosition(scrollPosition.left);
                        }
                        promise.resolve({
                            time: $scope.requestTime,
                            size: $scope.totalSize
                        });
                        $scope.inRequest = false;
                        $scope.togglePageLoader(false);
                    }, function (response) {
                        let err = getErrorMessage();
                        $scope.inRequest = false;
                        $scope.togglePageLoader(false);
                        $scope.currentPreviewRequest = null;
                        if(response.status == 400){
                            $scope.linterMessage = response.data;
                            let errors = response.data;
                            if(errors && _.isArray(errors)){
                                err = getErrorMessage(errors[0]);
                            }
                        }
                        if (!$scope.ingestDataSummary.queryMode) {
                            err.message = 'Preview ' + err.message;
                            cc.notify(err);
                        }
                        promise.reject(response);
                    });

                    return promise.promise;
                }

                function getErrorMessage(e){
                    let message, icon = 'warning';
                    if(!e || !e.code){
                        message = e && e.message ? e.message : 'Ingest error on our end';
                    } else {
                        switch (e.code) {
                            case 'stop_on_error':
                                message = 'Ingest stopped due to errors';
                                break;
                            case 'interrupted':
                                icon = 'notification';
                                message = 'Ingest failure due to user cancellation';
                                break;
                            case 'db_conn_refused':
                            case 'db_auth_error':
                            case 'db_not_exists':
                            case 'access_denied_error':
                            case 'db_unknown_host':
                                message = 'Ingest failure due to database connectivity error';
                                break;
                            case 'source_not_found':
                                message = 'Ingest failure: source not found';
                                break;
                            case 'query_exception':
                                message = 'It looks like your query was disconnected. Please try again.';
                                break;

                            default:
                                message = e.message;
                        }
                    }
                    return {message, icon};
                }

                return {
                    initGrid: initGrid,
                    preview: preview,
                    toggleColumns: toggleColumns,
                    clear: clear,
                    createColumnDefs,
                    getErrorMessage: getErrorMessage
                }
            }]
        );
    }
);
