define(['./module', 'angular', 'common', 'lodash', 'moment', 'pluralize', 'ag-grid', 'fin-grid', 'notifications-utils'],
    function (services, angular, cc, _, moment, pluralize, agGrid, finGrid, NotificationsUtils) {
        services.service('DataLoadingService', ['$q', '$http', '$timeout', '$rootScope', '$filter', '$compile', 'WSocket',
            'ScopeService', 'SearchBarService', 'AvailableFixedDates', 'EventNames', 'Constants', 'ColumnsService',
            'BookmarkEventService', 'FormatCellService',
            function ($q, $http, $timeout, $rootScope, $filter, $compile , WSocket, ScopeService, SearchBarService,
                      AvailableFixedDates, EventNames, Constants, ColumnsService, BookmarkEventService, FormatCellService) {
                var ROW_NUMBER_COL_ID = "$$row_number";
                var GRAND_TOTAL_COL_ID = "$$grand_total";
                var AGGREGATION_COL_ID = "$$aggregation";
                var CLUSTER_SIZE_COL_ID = "$$cluster_size";
                var EMPTY_FIELDS_COL_ID = "$$empty_fields";
                var INSIDE_TOTAL_PREFIX = 'inside-total_';
                var DEFAULT_COLS_PINNED_COUNT = 1;
                var DEFAULT_ROW_HEIGHT = 21;
                var MAX_FULLTEXT_DROPDOWN_WIDTH = 800;
                var VIEW_MODES = cc.getViewModes();
                var suppressSortCallback = false;

                var pinnedRowNodes = [];
                const buildSourceInfo = (tab) => {
                    const descriptorFormat = _.get(tab, 'tableSchema.descriptor.format');
                    const sourceType = cc.toUpperCase((_.get(tab, 'tableSchema.descriptor.params.protocol') || descriptorFormat));
                    const normalizedSourceType = normalizeSourceType(sourceType);
                    const fileName = _.get(tab, 'tableSchema.descriptor.originalFileName') || _.get(_.first(tab.tableSchema.uploads), 'name');

                    const tableName = _.get(tab, 'tableSchema.descriptor.tableName');
                    const query = _.get(tab, 'tableSchema.descriptor.query');
                    const dbSourceType = tableName ? ' Table' : '' || query ? ' Query' : '';

                    return `${fileName} (${normalizedSourceType})${dbSourceType}`;
                };
                function normalizeSourceType(sourceType) {
                    // todo: Figure out, maybe it can be reduced
                    switch (sourceType) {
                        case 'JSON_LINES': return "JSON Lines";
                        case 'JSON_OBJECT': return "JSON Object";
                        case 'JSON_ARRAY': return "JSON Array";
                        case 'AVRO': return "AVRO";

                        case 'CSV': return "CSV";

                        case 'XLSX_SHEET': return "XLSX Sheet";
                        case 'XLS_SHEET': return "XLS Sheet";
                        case 'XLS': return "XLS";
                        case 'XLSX': return "XLSX";

                        case 'XML':return "XML";

                        case 'MYSQL_TABLE': return "MySQL Table";
                        case 'ORACLE_TABLE': return "Oracle Table";
                        case 'MSSQL_TABLE': return "MSSQL Table";
                        case 'POSTGRESQL_TABLE': return "PostgreSQL Table";

                        case 'MYSQL_QUERY': return "MySQL Query";
                        case 'POSTGRESQL_QUERY': return "PostgreSQL Query";
                        case 'MSSQL_QUERY': return "MSSQL Query";
                        case 'ORACLE_QUERY': return "Oracle Query";
                        case 'MSSQL': return "MSSQL";
                        case 'MYSQL': return "MySQL";
                        case 'POSTGRESQL': return "PostgreSQL";
                        case 'ORACLE': return "Oracle";
                        case 'UNDEFINED': return "Undefined";

                        default: return "Unrecognizable"
                    }
                }
                function initGrid(params, $scope) {
                    if($scope.previewGridOptions && $scope.previewGridOptions.api){
                        $scope.previewGridOptions.api.destroy();
                    }
                    $scope.gridMode = params.mode;
                    if($scope.gridOptions && $scope.gridOptions.api) {
                        $scope.gridOptions.api.destroy();
                    }
                    $scope.inRequest = false;
                    var selector = params.selector, gridOptions = {
                          headerHeight: 26,
                          defaultRowHeight: DEFAULT_ROW_HEIGHT,
                          rowHeight: $scope.dataSummary.defaultRowHeight,
                          getRowHeight: function(params) {
                              var rowIndex;

                              if (params.node.floating == "top") {
                                  if (isActualRawData($scope)) {
                                      rowIndex = params.data[ROW_NUMBER_COL_ID] - 1;
                                  } else {
                                      rowIndex = params.rowIndex;
                                  }
                              } else {
                                  rowIndex = params.rowIndex + $scope.dataSummary.pinnedRowsCount;
                              }

                              var stateHeight = $scope.dataSummary.rowsHeight[rowIndex + ''];
                              return stateHeight && stateHeight >= DEFAULT_ROW_HEIGHT ? stateHeight : $scope.dataSummary.defaultRowHeight;
                          },
                          onRowsResized: genOnRowsResizedFn($scope),
                          minFitColWidth: 100,
                          maxFitColWidth: 1000,
                          enableColResize: true,
                          rowSelection: 'none',
                          enableRangeSelection: true,
                          enableServerSideSorting: params.mode != 'raw',
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
                          isScrollLag: function() {
                              return true;
                          },
                          rowBuffer: 10,
                          rowDeselection: true,
                          columnDefs: [],
                          floatingTopRowData: [],
                          enableSorting: true,
                          enableFreezebar: true,
                          suppressMoveToPinning: true,
                          suppressGhostIcon: true,
                          isFloatingForInMemoryRowModel: true,
                          getPinnedRowsCount: function() {
                              return $scope.dataSummary.pinnedRowsCount;
                          },
                          // todo move resize into ag-grid fork
                          onHeaderResizableDragStart: function(e) {
                              var rootRect = this.eRoot.getBoundingClientRect();

                              var resizeHandler = $(this.eHeaderCell).find('.ag-header-cell-resize')[0];
                              var resizeHandlerRect = resizeHandler.getBoundingClientRect();

                              var height = rootRect.bottom - resizeHandlerRect.top;
                              var insideHandlerTop = rootRect.top - resizeHandlerRect.top;

                              this.eHandler = $('<div class="ag-resizable-handler">' +
                                '<div style="height: ' + resizeHandlerRect.height + 'px;" class="ag-resizable-inside-handler"></div>' +
                                '</div>')[0];

                              this.eHandler.style.left = (e.clientX - rootRect.left + 2) + 'px';
                              this.eHandler.style.top = -insideHandlerTop;
                              this.eHandler.style.height = height + 'px';
                              this.eRoot.appendChild(this.eHandler);

                              this.startWidth = this.column.getActualWidth();
                              e.stopPropagation();
                          },
                          onHeaderResizableDragging: function(dragChange, finished, e) {
                              var maxWidth = (this.column.colDef.maxWidth > 0 ? this.column.colDef.maxWidth : 2000);
                              if (finished) {
                                  this.eHandler.remove();
                                  var newWidth = this.startWidth + dragChange;
                                  if (this.column.getActualWidth() != newWidth) {
                                      this.columnController.setColumnWidth(this.column, newWidth, finished);
                                      this.gridPanel.sizeColumnsToFit();
                                  }
                              } else if (e) {
                                  var x = (e.clientX - this.eRoot.getBoundingClientRect().left + 2);
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

                                  this.eHandler.style.left = x + 'px';
                              }
                              if (e) {
                                  e.stopPropagation();
                              }
                          },
                          customCreateGhost: function() {
                              var level = this.dragSource.dragGroup ?
                                this.dragSource.dragGroup.originalColumnGroup.colGroupDef.level : $scope.dataSummary.pivot.length,
                                dragWidth = _.reduce(this.dragSource.dragItem, function(result, item) {
                                    return result + item.actualWidth
                                }, 0),
                                headerHeight = this.gridOptionsWrapper.getHeaderHeight(),
                                headersNumber = getActualPivot($scope).length;
                              if ($scope.dataSummary.shows.length > 1) {
                                  headersNumber += 1;
                              }

                              this.eBody = $(selector)[0];
                              this.eBodyViewport = this.eBody.querySelector('.ag-body-viewport');
                              this.eGhost = document.createElement('div');
                              this.eGhost.className = "ag-dnd-ghost";

                              var containerHeight = this.eBody.querySelector('.ag-full-width-container').getBoundingClientRect().height;
                              var bodyHeight = this.eBody.getBoundingClientRect().height - headerHeight - 2;

                              if (!headersNumber) {
                                  headersNumber = 1;
                              }

                              this.eGhost.style.top = headersNumber * headerHeight + 'px';
                              this.eGhost.style.height = (containerHeight < bodyHeight ? containerHeight : bodyHeight) + 'px';
                              this.eGhost.style.width = dragWidth + 'px';
                              this.eGhost.style.borderColor = 'lightblue';
                              this.eGhost.style.backgroundColor = 'rgba(0,0,0,0.1)';

                              var ehbg = {};
                              ehbg.top = level * headerHeight;
                              ehbg.height = ($scope.dataSummary.pivot.length - level + 1) * headerHeight;

                              this.eBody.appendChild(this.eGhost);
                          },
                          customPositionGhost: function(event) {
                              var ghostRect = this.eGhost.getBoundingClientRect();
                              var bodyRect = this.eBody.getBoundingClientRect();
                              var leftPinnedWidth = this.columnController.getLeftPinnedWidth();
                              var scrollWidth = this.eBodyViewport.scrollLeft;
                              // for some reason, without the '-2', it still overlapped by 1 or 2 pixels, which
                              // then brought in scrollbars to the browser. no idea why, but putting in -2 here
                              // works around it which is good enough for me.
                              var browserWidth = cc.getBodyWidth() - 2;
                              // horizontally, place cursor just right of icon

                              var left = event.pageX - bodyRect.left - ghostRect.width / 2;
                              var windowScrollX = window.pageXOffset || document.documentElement.scrollLeft;
                              // check ghost is not positioned outside of the browser
                              if (browserWidth > 0) {
                                  if ((left + this.eGhost.clientWidth) > (browserWidth + windowScrollX)) {
                                      left = browserWidth + windowScrollX - this.eGhost.clientWidth;
                                  }
                              }
                              var minLeft = leftPinnedWidth - scrollWidth;
                              if (minLeft < 0) {
                                  minLeft = 0;
                              }
                              if (left < minLeft) {
                                  left = minLeft;
                              }

                              this.eGhost.style.left = left + 'px';
                          },
                          onCellDoubleClicked: function(params) {
                              if (cc.isOverflow(params.eGridCell)) {
                                  var cellRect = params.eGridCell.getBoundingClientRect();
                                  var childScope = $scope.$new();
                                  var fullTextDropdown = $('<div click-out="closeDropdown()" class="fulltext-dropdown">' + params.value + '</div>');

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

                              if ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length) {
                                  var colId = params.colDef.colId,
                                    column = params.columnApi.getColumn(colId),
                                    aggregationColumn = colId == AGGREGATION_COL_ID,
                                    col;

                                  if (!aggregationColumn) {
                                      if (isPivotTable($scope) && params.colDef.originalField == CLUSTER_SIZE_COL_ID) {
                                          viewRaw(params.node, $scope, false, column, true);
                                      } else {
                                          var show = _.find($scope.dataSummary.shows, function(show) {
                                              return getOpKey(show) == params.colDef.originalField;
                                          });
                                          col = show ? show.col : null;

                                          if (col && isAllowClickIn(colId, show, $scope)) {
                                              viewRaw(params.node
                                                , $scope
                                                , isPivotTable($scope) ? params.colDef.originalField : params.colDef.colId
                                                , column);
                                          }
                                      }
                                  }
                              }
                          },
                          onCellClicked: function(params) {

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

                                      urlArr = _.filter(params.value, function(value) {
                                          return value.match(cc.URL_REGEXP);
                                      });
                                  } else {
                                      urlArr = [params.value];
                                  }

                                  if (!urlArr.length) {
                                      return;
                                  }

                                  childScope.closeDropdown = function() {
                                      this.el.remove();
                                  };

                                  urlArr.forEach(function(url) {
                                      var text = url;

                                      if (text.length > 27) {
                                          text = text.slice(0, 14) + '...' + text.slice((text.length) - 13);
                                      }

                                      var link = $('<span><a href="' + url + '" target="_blank">' + text + '&nbsp;<i class="fa fa-external-link"></i></a></span>');
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
                          },
                          icons: {
                              groupExpanded: '<i class="fa fa-fw fa-minus-square-o"/>',
                              groupContracted: '<i class="fa fa-fw fa-plus-square-o"/>'
                          },
                          onColumnResized: function(e) {
                              var columns = [];
                              if (e.column) {
                                  columns.push(e.column);
                              } else if (e.columns) {
                                  columns = e.columns;
                              }
                              if (!e.sizeToFit && columns.length) {
                                  if (isActualPivotData($scope)) return;
                                  _.each(columns, function(column) {
                                      if (e.finished && column.colId != "$$aggregation") {
                                          var show = _.find($scope.dataSummary.shows, function(s) {
                                              return getOpKey(s) == column.colId;
                                          });

                                          if (!show) {
                                              show = {
                                                  id: _.find($scope.tabsSection.options.activeTab.state.queryParams.shows, function(id) {
                                                      return getOpKey({ id: id }) == column.colId;
                                                  })
                                              }
                                          }

                                          show.id.settings.width = column.actualWidth;

                                          BookmarkEventService.emit(".shows.ShowResizeEvent", { key: show.id, width: column.actualWidth }, $scope);
                                      }
                                  });
                              }
                          },
                          onColumnGroupOpened: function(event) {
                              var colId = event.columnGroup.originalColumnGroup.colGroupDef.columnName;
                              var collapsed = !$scope.dataSummary.pivotCollapsedState[colId];

                              $scope.dataSummary.pivotCollapsedState[colId] = collapsed;

                              BookmarkEventService.emit('.pivot_collapsed_state.PivotCollapsedStateAddEvent', {
                                  key: colId,
                                  value: collapsed
                              }, $scope)
                              $scope.gridOptions.api.sizeColumnsToFit();
                          },
                          onRowGroupOpened: function(params) {
                              function getAggKeyFromNode(node) {
                                  var keyPathArr = [];
                                  for (var i = 0; i < node.level; ++i) {
                                      keyPathArr.push(node.data[$scope.dataSummary.aggs[i].key]);
                                  }
                                  keyPathArr.push(node.data.$$aggregation);
                                  return keyPathArr.join('_');
                              }

                              var expanded = params.node.expanded;
                              var floatingRowModel = $scope.gridOptions.api.floatingRowModel;

                              floatingRowModel.setExpanded(params.node.id, expanded);
                              $scope.gridOptions.api.rowModel.setExpanded(params.node.id, expanded);

                              if (params.node.floating == "top") {

                                  var displayedRowsLeaf = floatingRowModel.flattenStage.execute(params.node);
                                  var floatingRows = floatingRowModel.floatingTopRows;
                                  var lastRowsPinnedCount = $scope.dataSummary.pinnedRowsCount;

                                  if (expanded) {
                                      $scope.dataSummary.pinnedRowsCount += displayedRowsLeaf.length;
                                  } else {

                                      var displayedRows = _.filter(displayedRowsLeaf, function(row) {
                                          return !!_.find(floatingRows, { id: row.id });
                                      });

                                      $scope.dataSummary.pinnedRowsCount -= displayedRows.length;
                                  }

                                  if (lastRowsPinnedCount != $scope.dataSummary.pinnedRowsCount) {
                                      smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.ROWS);
                                  }

                              }

                              var key = getAggKeyFromNode(params.node);

                              params.node.data.$$open = expanded;
                              $scope.dataSummary.rowsCollapsedState[key] = expanded;

                              BookmarkEventService.emit('.rows.RowsCollapsedStateChangeEvent', { key: key, value: expanded }, $scope);
                          },
                          onSortChanged: function() {
                              const startTime = new Date();

                              function getShowChangeSortEvent(show) {
                                  return {
                                      "@type": '.shows.ShowChangeSortEvent',
                                      key: show.id
                                  }
                              }

                              function resetAllAggsSort(sortObj) {
                                  function resetAggSort(aggSort, sortObj) {
                                      if (!sortObj) {
                                          sortObj = {}
                                      }

                                      aggSort.direction = sortObj.direction || "ASC";
                                      aggSort.isCount = sortObj.isCount || false;
                                      aggSort.type = sortObj.type || "BY_KEY";
                                      aggSort.field = sortObj.field || null;
                                      aggSort.aggKeyPath = sortObj.aggKeyPath || null;
                                  }

                                  _.forEach($scope.dataSummary.aggs, function(agg) {
                                      resetAggSort(agg.id.settings.sort, sortObj);
                                  })
                              }

                              function getChangeSortEventsForAllAggs() {
                                  return _.map($scope.dataSummary.aggs, function(agg) {
                                      return {
                                          "@type": EventNames.CHANGE_SORT_EVENT.AGGS,
                                          key: agg.id
                                      }
                                  })
                              }

                              if (suppressSortCallback) {
                                  suppressSortCallback = false;
                                  return;
                              }
                              var sortModel = this.api.getSortModel(),
                                events = [];

                              console.log('onSortChanged: ', sortModel);

                              if (isActualAggData($scope)) {
                                  var sortedCol = sortModel[0];

                                  if (!sortedCol) {
                                      resetAllAggsSort();
                                  } else if (sortedCol.colId == AGGREGATION_COL_ID) {
                                      resetAllAggsSort({
                                          direction: sortedCol.sort.toUpperCase()
                                      });
                                  } else {
                                      if (!isActualPivotData($scope)) {
                                          resetAllAggsSort({
                                              direction: sortedCol.sort.toUpperCase(),
                                              type: "BY_VALUE",
                                              field: sortedCol.colId,
                                              aggKeyPath: []
                                          });
                                      } else {
                                          var gridCol = _.find(this.columnApi.getAllGridColumns(), { colId: sortedCol.colId });

                                          var sortObj = {
                                              direction: sortedCol.sort.toUpperCase(),
                                              type: "BY_VALUE",
                                              aggKeyPath: _.filter(gridCol.colDef.pivotKeys, function(key) {
                                                  return key != null ? key + '' : '';
                                              })
                                          };

                                          if (gridCol.colDef.originalField == CLUSTER_SIZE_COL_ID) {
                                              sortObj.isCount = true;
                                          } else {
                                              sortObj.field = gridCol.colDef.originalField;
                                          }

                                          resetAllAggsSort(sortObj);

                                      }
                                  }

                                  events = getChangeSortEventsForAllAggs();
                                  $scope.$broadcast('finishResize');
                              } else {

                                  var needToReset = _.filter($scope.dataSummary.shows, function(show) {
                                      var sortSettings = show.id.settings.sort;
                                      return sortSettings && !_.find(sortModel, { colId: show.key });
                                  });

                                  events = _.map(needToReset, function(show) {
                                      show.id.settings.sort = null;
                                      return getShowChangeSortEvent(show);
                                  });

                                  _.forEach(sortModel, function(agGridSort, i) {
                                      var show = _.find($scope.dataSummary.shows, { key: agGridSort.colId });

                                      if (!show) return;

                                      var showSettings = show.id.settings;

                                      if (!showSettings.sort) {
                                          showSettings.sort = {
                                              direction: agGridSort.sort.toUpperCase(),
                                              priority: i
                                          };
                                          events.push(getShowChangeSortEvent(show));
                                      } else if (showSettings.sort.direction != agGridSort.sort.toUpperCase()
                                        || showSettings.sort.priority != i) {
                                          showSettings.sort.direction = agGridSort.sort.toUpperCase();
                                          showSettings.sort.priority = i;

                                          events.push(getShowChangeSortEvent(show));
                                      }
                                  });
                              }

                              if (events.length) {
                                  BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", { events: events }, $scope);

                                  ScopeService.safeApply($scope, function() {
                                      doRefreshIfNeeded($scope, startTime);
                                  });
                              }

                              if (!isEmbed($scope)) {
                                  $scope.setShowCollapsedTags(true);
                                  $scope.$broadcast('closeSortSettingsDropdown');
                              }
                          },
                          onDragStopped: function() {
                              var eBody = document.getElementsByClassName('ag-custom')[0];
                              var eBgHd = document.getElementsByClassName('ag-background-pivot')[0];
                              if (eBody && eBgHd) eBody.removeChild(eBgHd);
                          },
                          onColumnMoved: function(e) {
                              if (isPivotTable($scope)) {
                                  var groupSize = $scope.dataSummary.shows.length;
                                  var toPosition = e.toIndex % groupSize;
                                  if (e.column) { // trigger changing for other pivot groups
                                      var show = _.find($scope.dataSummary.shows, { key: e.column.colDef.field });
                                      if (show) {
                                          var fromPosition = $scope.dataSummary.shows.indexOf(show);
                                          move($scope.dataSummary.shows, fromPosition, toPosition);
                                          onShowsOrderChangePivot($scope, $scope.dataSummary.shows, toPosition);
                                          $scope.$apply();
                                      }
                                  }

                                  // save column order for pivot table
                                  $scope.dataSummary.pivotOrder = _.map(gridOptions.columnApi.getAllGridColumns(), 'colId');
                                  BookmarkEventService.emit(".shows.ShowMovePivotEvent", { pivotOrder: $scope.dataSummary.pivotOrder }, $scope);
                              } else {
                                  var columnsToMove = [];
                                  if (e.column) {
                                      columnsToMove = [e.column];
                                  } else if (e.columns) {
                                      columnsToMove = e.columns;
                                  }

                                  if (isActualRawData($scope) && !$scope.dataSummary.aggs.length && !$scope.dataSummary.pivot.length
                                    || ($scope.dataSummary.aggs.length && isActualAggData($scope))) {
                                      _.each(columnsToMove, function(column) {
                                          show = _.find($scope.showMeList, function(s) {
                                              return s.key == column.colId;
                                          }),
                                            toPosition = e.toIndex - 1; // because of "row number" column
                                          if (isAggregatedData($scope)) {
                                              toPosition--; // because of "aggregation" column
                                          }
                                          BookmarkEventService.emit(".shows.ShowMoveEvent", { key: show.id, toPosition: toPosition }, $scope);
                                          var columns = $scope.gridOptions.columnApi.getAllGridColumns();

                                          ScopeService.safeApply($scope, function() {
                                              resetShows(_(columns)
                                                .filter(function(column) {
                                                    return !_.contains([ROW_NUMBER_COL_ID, '$$aggregation'], column.colId);
                                                }).map(function(column) {
                                                    return _.find($scope.showMeList, { key: column.colId });
                                                }).value(), $scope);
                                          })

                                      })
                                  }
                              }
                              $timeout(function() {
                                  $scope.$emit('DoRebuildCollapsedTags');
                              });
                          },
                          onGridSizeChanged: function() {
                              if ($scope.gridOptions && $scope.gridOptions.api) {
                                  $scope.gridOptions.api.sizeColumnsToFit();
                              }
                          },
                          overlayNoRowsTemplate: '<span class="ag-no-results">No results returned</span>',
                          headerCellTemplate: '<div class="ag-header-cell">\n    <div id="agResizeBar" class="ag-header-cell-resize"></div>\n    <span id="agMenu" class="ag-header-icon ag-header-cell-menu-button">\n        <i class="fa fa-caret-down"></i>\n    </span>\n    <div id="agHeaderCellLabel" class="ag-header-cell-label">\n        <span id="agText" class="ag-header-cell-text"></span>\n        <span id="agRename" class="ag-header-cell-rename"><input/></span>\n        <div id="gridSortView"> <span id="agSortAsc" class="ag-header-icon ag-sort-icon ag-sort-ascending-icon">\n            <i class="fa fa-sort-asc"></i>\n        </span>\n        <span id="agSortDesc" class="ag-header-icon ag-sort-icon ag-sort-descending-icon">\n            <i class="fa fa-sort-desc"></i>\n        </span>\n        <span id="agNoSort" class="ag-header-icon ag-sort-icon ag-sort-none-icon">\n            <i class="fa fa-sort"></i>\n        </span>\n </div>   </div>\n</div>',
                          headerCellRenderer: function(params) {
                              var $h = $(params.eHeaderCell),
                                $rename = $h.find('#agRename'),
                                $text = $h.find('#agText');
                              colHeaders[params.colDef.colId] = $h;
                              var show = _.find($scope.dataSummary.shows, function(s) {
                                  return getOpKey(s) == (isPivotTable($scope) ? params.colDef.originalField : params.colDef.field);
                              });

                              if (show && !params.colDef.suppressDefaultTitle) {
                                  $text.html('<span>' + show.opName + ' </span>');
                              }

                              var hideRename = function() {
                                  $rename.hide();
                                  $text.show();
                              };

                              $rename.click(function(e) {
                                  e.stopPropagation();
                                  e.preventDefault();
                              })
                                .hide()
                                .find('input')
                                .blur(hideRename)
                                .keyup(function(e) {
                                    if (e.keyCode == 13) {
                                        $scope.$apply(() => updateColumnName(show.col, e.currentTarget.value, $scope));
                                        hideRename();
                                    } else if (e.keyCode == 27) {
                                        hideRename();
                                    }

                                });
                              return params.value;
                          },
                          processHeaderForClipboard: function(params) {
                              if (params.column.colGroupDef) {
                                  return params.column.colGroupDef.rawHeaderName;
                              } else if (!params.column.colDef) {
                                  return "";
                              } else {
                                  if ($scope.dataSummary.shows.length > 1) {
                                      var show = _.find($scope.dataSummary.shows, function(s) {
                                          return getOpKey(s) ==
                                            (isPivotTable($scope) ? params.column.colDef.originalField :
                                              params.column.colDef.field);
                                      });
                                      if (show) {
                                          return (show.id.op ? toTitle(show.id.op) + ' ' : '') + show.name;
                                      }
                                  }
                                  return params.column.colDef.rawHeaderName;
                              }
                          },
                          processCellForClipboard: function(params) {
                              var value = params.value;
                              if (params.column.colId == '$$row_number') {
                                  if (params.node.floating == "top") {
                                      value = null;
                                  } else if (params.node.data !== undefined && isRawData($scope)) {
                                      value = +params.node.id + 1;
                                  } else if (params.node.data !== undefined) {
                                      var rows = params.node.gridOptionsWrapper.gridOptions.api.getModel().rowsToDisplay;
                                      value = _.indexOf(rows, params.node) + 1;
                                  }
                              }
                              if (value === null) return "";
                              if (cc.isValidURL(value)) return value;

                              var show;
                              if (params.column.colId == "$$aggregation") {

                                  if (params.node.data[GRAND_TOTAL_COL_ID]) {
                                      return value;
                                  }

                                  show = $scope.dataSummary.aggs[params.node.level];
                              } else {
                                  show = _.find($scope.dataSummary.shows, {
                                      key: isPivotTable($scope)
                                        ? params.column.colDef.originalField
                                        : params.column.colId
                                  })
                              }
                              if (show) {
                                  return isSuppressColFormatRules(show) ? value : $filter('formatCell')(value, show.col);
                              }
                              return value;
                          },
                          onCtrlAndZ: function() {
                              $scope.tabsSection.undo();
                          },
                          onCtrlShiftAndZ: function() {
                              $scope.tabsSection.redo();
                          },
                          onVFreezebarDragEnd: function(params) {
                              var countToFreeze = params.countToFreeze;

                              if (countToFreeze != $scope.dataSummary.pinnedColsCount) {
                                  togglePinnedColumns($scope, params.countToFreeze);
                              }
                          },
                          onHFreezebarDragEnd: function(params) {
                              var countToFreeze = params.countToFreeze;

                              if (countToFreeze && $scope.dataSummary.showTotals) {
                                  countToFreeze--;
                              }

                              if (countToFreeze != $scope.dataSummary.pinnedRowsCount) {
                                  var isRemovedPinnedRows = countToFreeze < $scope.dataSummary.pinnedRowsCount;

                                  togglePinnedRows($scope, countToFreeze);

                                  if (isActualRawData($scope)) {
                                      $scope.gridOptions.api.rowModel.virtualPageCache.updateHeightForAllRows();
                                  }

                                  if (isRemovedPinnedRows) {
                                      $scope.gridOptions.api.refreshView();
                                  }
                                  $scope.gridOptions.api.rangeController.refreshBorders();
                                  $scope.gridOptions.api.gridPanel.resetVerticalScrollPosition();
                              }
                          }
                      };

                    if(params.mode == 'raw'){
                        gridOptions.rowModelType = 'virtual';
                        gridOptions.paginationPageSize = $scope.dataSummary.limit.pageSize;
                        gridOptions.paginationOverflowSize = 2;
                        gridOptions.maxConcurrentDatasourceRequests = 2;
                        gridOptions.paginationInitialRowCount = 1;
                    } else if (params.mode == 'agg' || params.mode == 'pivot') {
                        gridOptions.getNodeChildDetails = function(row) {
                            if(row.$$expandable) {
                                return {
                                    group: true,
                                    children: row.$$children,
                                    expanded: row.$$open
                                };
                            }
                            return null;
                        };
                        gridOptions.rowData = [];
                        gridOptions.suppressMultiSort = true;
                    }

                    var colHeaders = {};

                    var gridDiv = document.querySelector(selector);
                    // new agGrid.Grid(gridDiv, gridOptions);
                    // $scope.gridOptions = gridOptions;

                    gridOptions = {
                        data: [],
                        onColumnResized: function(column) {
                            console.log('onColumnResized', column);
                            if (column.colId !== "$$aggregation" && !isActualPivotData($scope) && column.colDef) {
                                let show = _.find($scope.dataSummary.shows, s => getOpKey(s) === column.colId) ||
                                  { id: _.find($scope.tabsSection.options.activeTab.state.queryParams.shows, id => getOpKey({ id: id }) === column.colId) };
                                show.id.settings.width = column.actualWidth;
                                BookmarkEventService.emit(".shows.ShowResizeEvent", { key: show.id, width: column.getWidth() }, $scope);
                            }
                        },
                        onUpdateColumnName: function(column, renameTo) {
                            console.log('onUpdateColumnName', column, renameTo);
                            const show = _.find($scope.dataSummary.shows, s => getOpKey(s) === column.name);
                            if (show) {
                                updateColumnName(show.col, renameTo, $scope);
                            }
                        },
                        onColumnsMoved: function(columns, toIndex) {
                            if (isPivotTable($scope)) {
                                const groupSize = $scope.dataSummary.shows.length;
                                const toPosition = toIndex % groupSize;
                                columns.forEach(column => {
                                    if (column) { // trigger changing for other pivot groups
                                        const show = _.find($scope.dataSummary.shows, { key: column.colDef.field });
                                        if (show) {
                                            const fromPosition = $scope.dataSummary.shows.indexOf(show);
                                            move($scope.dataSummary.shows, fromPosition, toPosition);
                                            onShowsOrderChangePivot($scope, $scope.dataSummary.shows, toPosition);
                                            $scope.$apply();
                                        }
                                    }
                                });

                                // save column order for pivot table
                                $scope.dataSummary.pivotOrder = _.map($scope.gridOptions.columnApi.getAllGridColumns(), 'colId');
                                BookmarkEventService.emit(".shows.ShowMovePivotEvent", { pivotOrder: $scope.dataSummary.pivotOrder }, $scope);
                            } else if (
                              (isActualRawData($scope) && !$scope.dataSummary.aggs.length && !$scope.dataSummary.pivot.length)
                              ||
                              ($scope.dataSummary.aggs.length && isActualAggData($scope))
                            ) {
                                _.each(columns.reverse(), function(column) {
                                    const show = _.find($scope.showMeList, s => s.key === column.name);
                                    if (!show) {
                                        return;
                                    }
                                    if (isAggregatedData($scope)) {
                                        toIndex--; // because of "aggregation" column
                                    }
                                    BookmarkEventService.emit(".shows.ShowMoveEvent", { key: show.id, toPosition: toIndex }, $scope);
                                });

                                const newOrderedColumns = $scope.gridOptions.columnApi.getAllGridColumns();
                                ScopeService.safeApply($scope, function() {
                                    resetShows(
                                      _(newOrderedColumns)
                                        .filter(column => !_.contains([ROW_NUMBER_COL_ID, '$$aggregation'], column.colId))
                                        .filter(column => column.colDef)
                                        .map(column => _.find($scope.showMeList, { key: column.colId })).value(),
                                      $scope
                                    );
                                });
                            }

                            $timeout(function() {
                                $scope.$emit('DoRebuildCollapsedTags');
                            });
                        },
                        getMainMenuItems: function(params) {
                            var selectedColumns = $scope.gridOptions.api.getSelectedColumns();
                            var menuItems = [];

                            if (!$scope.isViewOnly) {
                                if (selectedColumns.length < 2) {
                                    menuItems.push({
                                        name: 'Rename',
                                        action: function(clickEvent, cellEvent) {
                                            console.log('rename selected', clickEvent, cellEvent);
                                            cellEvent.grid.onEditorActivate(cellEvent);
                                        }
                                    })
                                }

                                menuItems = menuItems.concat([{
                                    name: 'Remove',
                                    action: function(clickEvent, cellEvent) {
                                        console.log('remove selected', clickEvent, cellEvent);

                                        const grid = cellEvent.grid;
                                        const colDef = grid.columnDefs;

                                        selectedColumns.forEach((column) => {
                                            const removed = _.remove($scope.dataSummary.shows, { key: column.name });
                                            _.each(removed, ({ id }) => {
                                                BookmarkEventService.emit(".shows.ShowRemoveEvent", { key: id }, $scope)
                                            });

                                            $timeout(function() {
                                                $scope.$emit('DoRebuildCollapsedTags');
                                            });

                                            const singleColDef = grid.getColDef(column.name);
                                            if (singleColDef) {
                                                colDef.splice(colDef.indexOf(singleColDef), 1);
                                            }
                                        });
                                        grid.api.setColumnDefs(colDef);
                                    }
                                }]);

                                if ($scope.gridOptions.api.getRangeSelections().length > 0) {
                                    [].push.call(menuItems, {
                                          name: 'Copy', action: function() {
                                              $scope.gridOptions.api.copySelectedRangeToClipboard();
                                          }
                                      },
                                      {
                                          name: 'Copy With Headers', action: function() {
                                              $scope.gridOptions.api.copySelectedRangeToClipboard(true);
                                          }
                                      });
                                }
                            }

                            return menuItems;
                        },
                        getContextMenuItems: function(params) {
                            var menu = [],
                              colId = params.column.colId,
                              col,
                              aggregationColumn = colId == '$$aggregation',
                              rangeSelections = $scope.gridOptions.api.getRangeSelections(),
                              isGrandTotalCell = params.node.data && params.node.data[GRAND_TOTAL_COL_ID],
                              isBlankNode = params.node.data && params.node.data['$$blank_node'];

                            const singleCellSelected = !_.some(rangeSelections, range => range.left !== range.right || range.top !== range.bottom);

                            if (!isBlankNode && singleCellSelected) {

                                if (isPivotTable($scope) && params.column.colDef.originalField == CLUSTER_SIZE_COL_ID) {
                                    menu.push({
                                        name: "View <b>Raw Data</b>",
                                        action: function() {
                                            viewRaw(params.node, $scope, false, params.column, true);
                                        }
                                    })
                                } else {
                                    if (aggregationColumn) {
                                        var agg = $scope.dataSummary.aggs[params.node.level];
                                        col = agg.col;
                                    } else if (params.column.colDef) {
                                        var show = _.find($scope.dataSummary.shows, function(show) {
                                            return getOpKey(show) == params.column.colDef.originalField;
                                        });
                                        col = show ? show.col : null;
                                    }

                                    if (col) {
                                        if (isAllowClickIn(colId, show, $scope)) {
                                            menu.push({
                                                name: "View <b>Raw Data</b>",
                                                action: function() {
                                                    viewRaw(params.node, $scope, !aggregationColumn
                                                      ? isPivotTable($scope)
                                                        ? params.column.colDef.originalField
                                                        : params.column.colId
                                                      : null, params.column);
                                                }
                                            })
                                        }

                                        if (!isGrandTotalCell && (isRawData($scope) || (aggregationColumn || show.id.op == 'VALUE'))) {
                                            menu = menu.concat([{
                                                name: "<b>Filter</b> to value",
                                                action: function() {
                                                    filterToResults(col, params.value, $scope);
                                                }
                                            }, {
                                                name: "<b>Exclude</b> this value",
                                                action: function() {
                                                    excludeFromResults(col, params.value, $scope);
                                                }
                                            }]);
                                        }
                                    }
                                }
                            }
                            if (rangeSelections.length) {
                                menu.push({
                                    name: 'Copy', action: function() {
                                        $scope.gridOptions.api.copySelectedRangeToClipboard();
                                    }
                                });
                                menu.push({
                                    name: 'Copy With Headers', action: function() {
                                        $scope.gridOptions.api.copySelectedRangeToClipboard(true);
                                    }
                                });
                            }
                            return menu;
                        },
                        onAggregatedCellClick: function(event) {
                            viewRaw({ data: event.dataRow, level: event.dataRow.__treeLevel }, $scope, false, event.column);
                        },
                        onCtrlAndZ: function() {
                            $scope.tabsSection.undo();
                        },
                        onCtrlShiftAndZ: function() {
                            $scope.tabsSection.redo();
                        },
                        logEnable: false
                    };

                    if ($scope.ingestDataSummary.selectedSources.length > 0) {
                        _.merge(gridOptions, $scope.ingestDataSummary.selectedSources[0].descriptor.settings);
                    }

                    if (!$scope.gridOptions || !$scope.gridOptions.isAlive || !$scope.gridOptions.isAlive()) {
                        window.grid = $scope.gridOptions = new finGrid(gridDiv, gridOptions);
                    }
                }

                function getActualPivot($scope) {
                    if (!$scope.autoRefresh && $scope.tabsSection) {
                        return $scope.tabsSection.options.activeTab.state.queryParams.pivot;
                    } else {
                        return $scope.dataSummary.pivot;
                    }
                }

                function isRawData($scope){
                    return $scope.dataSummary.aggs.length == 0;
                }

                function isActualRawData($scope) {
                    return !isActualAggData($scope) && !isActualPivotData($scope);
                }

                function isActualAggData($scope) {
                    return (!$scope.autoRefresh && $scope.tabsSection
                        ? $scope.tabsSection.options.activeTab.state.queryParams.aggs.length > 0
                        : $scope.dataSummary.aggs.length > 0);
                }

                function isActualPivotData($scope) {
                    return (!$scope.autoRefresh && $scope.tabsSection
                        ? $scope.tabsSection.options.activeTab.state.queryParams.pivot.length > 0
                        : $scope.dataSummary.pivot.length > 0);
                }

                function isAggregatedData($scope){
                    return !isRawData($scope) && $scope.dataSummary.pivot.length == 0;
                }

                function isPivotTable($scope){
                    return $scope.dataSummary.pivot.length > 0;
                }

                function getAggPath(o, aggs, level){
                    return _.map(aggs.slice(0, level + 1), function(agg){
                        return o[getOpKey(agg)];
                    }).join('_');
                }

                function getMatchHighlightedStr(str, match, searchType) {
                    if(!str) return str;
                    var words = match.split(/[ ,]+(\(.*?\))?/)
                        .filter(function(e){ return !!e })
                        .join('|');
                    var flags = 'gi', reg;
                    var antiTagRegExp = '(?![^<>]*(([\/\"\']|]]|\b)>))';
                    if (searchType === 'EXACT_MATCH') {
                        reg = new RegExp('\\b' + words + '\\b' + antiTagRegExp, flags);
                    }
                    else if (searchType === 'EDGE') {
                        reg = new RegExp('\\b' + words + antiTagRegExp, flags);
                    }
                    else if(searchType === 'FULL') {
                        reg = new RegExp(words + antiTagRegExp, flags);
                    }
                    return (str + '').replace(reg, '<span class="match-highlighter">$&</span>');
                }

                function togglePinnedRows($scope, nodesToPinCount, withTimeout){
                    var nodesToRemove = [],
                        data = [];
                    var pinnedNodesCount = pinnedRowNodes.length;

                    if (isActualRawData($scope)) {
                        if(nodesToPinCount >= pinnedNodesCount) {
                            var shouldRewrite = nodesToPinCount === pinnedNodesCount;
                            var to = nodesToPinCount - (shouldRewrite ? 0 : pinnedNodesCount);

                            for (var i = 0; i < to; i++) {
                                var node = $scope.gridOptions.api.getModel().getRow(i);
                                node.data['$$row_number'] = parseInt(node.id) + 1;
                                nodesToRemove.push(node);
                            }

                            $scope.gridOptions.api.removeItems(nodesToRemove);

                            if (shouldRewrite) {
                                pinnedRowNodes = nodesToRemove;
                            } else {
                                pinnedRowNodes = pinnedRowNodes.concat(nodesToRemove);
                            }

                        } else {
                            var nodesToUnpin = pinnedRowNodes.slice(nodesToPinCount);
                            pinnedRowNodes = pinnedRowNodes.slice(0, nodesToPinCount);
                            $scope.gridOptions.api.insertItemsAtIndex(0, nodesToUnpin)
                        }

                        $scope.floatingTopRows = _.map(pinnedRowNodes, 'data');
                    }

                    if($scope.dataSummary.pinnedRowsCount != nodesToPinCount) {
                        smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.ROWS, nodesToPinCount);
                    }

                    toggleTotals($scope, withTimeout);

                    $scope.gridOptions.api.clearRangeSelection();
                    $scope.gridOptions.api.clearFocusedCell();
                }

                function togglePinnedColumns($scope, columnsToPinCount) {
                    $scope.gridOptions.columnApi.changePinnedRange(columnsToPinCount);

                    smartEmit($scope, EventNames.CHANGE_PINNED_COUNT.COLS, columnsToPinCount);
                }

                function getCustomCellRenderer ($scope){
                    const showsWrap = $scope.dataSummary.shows;
                    const isPivot = isPivotTable($scope);
                    return function(params) {
                        var content, field = isPivot ? params.colDef.originalField : params.colDef.field;

                        if (field === '$$cluster_size') {
                            content = params.value;
                        } else {
                            var shows = _.indexBy(showsWrap, getOpKey),
                                show = shows[field];

                            if (!show) {
                                var state = $scope.tabsSection.options.activeTab.state;

                                show = {
                                    col: _.find(state.columnList, {field: field}),
                                    id: _.find(state.queryParams.shows, {field: field})
                                };

                                if (!show.id) {
                                    return;
                                }
                            }


                            if(_.isArray(params.value)) {
                                if(show.col.type === "DATE") {
                                    const preProcessDate = (v) => $filter('formatCell')(v, show.col, null, search, null, $scope.isConvertToUserTimezone() ? timezone : null);
                                    content = FormatCellService.arrayCell(params.value, preProcessDate)
                                } else {
                                    content = FormatCellService.arrayCell(params.value);
                                }

                            } else if (!isSuppressColFormatRules(show)) {
                                let search = $scope.dataSummary.highlightMatches ? $scope.dataSummary.search : null;
                                if (show.col.type === "STRING") {
                                    // content = $filter('formatCell')(params.value, show.col, null, search, cc.onlyHighlightURL);
                                    content = $filter('formatCell')(params.value, show.col, null, search);
                                } else if (show.col.type === "DATE") {
                                    const timezone = $scope.getUserTimezoneAbbreviation();
                                    content = $filter('formatCell')(params.value, show.col, null, search, null, $scope.isConvertToUserTimezone() ? timezone : null)
                                } else {
                                    content = $filter('formatCell')(params.value, show.col, null, search)
                                }
                            } else {
                                content = $filter('formatCell')(params.value, _.merge({}, show.col,
                                    {type: 'DECIMAL', settings: {format: {decimalPlaces: 0, showThousandsSeparator: true, type: 'NUMBER'}}}));
                            }
                        }
                        return content;
                    };
                }

                function getNoFieldsCellRenderer($scope) {
                    let noFieldsText = $scope.totalSize > 0 ? 'No fields selected.' : 'No data returned.';
                    function NoFieldsCellRenrerer () {}
                    NoFieldsCellRenrerer.prototype.update = function(params) {
                    };
                    NoFieldsCellRenrerer.prototype.init = function(params) {
                        this.eGui = $('<span class="cell-value"></span>');
                        var content;
                        if (params.node.floating == "top") {
                            // console.log(params.node);
                            if(params.node.data['$$row_number'] == 1){
                                content = noFieldsText;
                            }
                        } else if (params.data !== undefined) {
                            if(+params.node.id == 0){
                                content = noFieldsText;
                            }
                        }
                        this.eGui.append(content);
                        this.update(params);
                    };
                    NoFieldsCellRenrerer.prototype.getGui = function() {
                        return this.eGui[0];
                    };
                    NoFieldsCellRenrerer.prototype.refresh = function(params) {
                        this.update(params);
                    };
                    NoFieldsCellRenrerer.prototype.destroy = function() {
                    };
                    return NoFieldsCellRenrerer;
                }

                function isSuppressColFormatRules(show){
                    return show.id.op && _.contains(['COUNT', 'UNIQUE_COUNT', 'APPROX_UNIQUE_COUNT'], show.id.op)
                }

                function getAggregationRequestSize(level, $scope) {
                    return $scope.vizSummary.segmentBy.length
                    && $scope.dataSummary.aggs[level]
                    && $scope.dataSummary.aggs[level].key == $scope.vizSummary.segmentBy[0].key ? 10 : $scope.dataSummary.count;
                }

                var renameNotificationActive = false;
                function updateColumnName(col, renameTo, $scope) {
                    const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;

                    const columns = $scope.gridOptions.columnApi.getAllColumns();
                    const columnNameUsed = _.some(columns, column => column.colDef.headerName === renameTo);

                    if (renameTo !== col.name && !columnNameUsed) {
                        const showsForRename = _.filter($scope.showMeList, s =>  s.id.field === col.field);
                        _.each(columns, function(gridCol){
                            if (_.some(showsForRename, s => getOpKey(s) === gridCol.colDef.colId)) {
                                gridCol.colDef.headerName = renameTo;
                            }
                        });

                        $scope.gridOptions.columnApi.resetColumnState();
                        let column = _.find($scope.tabsSection.options.activeTab.state.columnList, c => c.field === col.field);
                        col.name = renameTo;
                        column.name = renameTo;
                        // todo refactor. remove key and try remove other props for visualization
                        _.each($scope.showMeList, show => wrapShow(show, colNameFormat));
                        _.each($scope.groupByList, group => wrapAgg(group, colNameFormat));
                        $rootScope.$broadcast('sizeSearchInput');
                        BookmarkEventService.emit('.cols.ColRenameEvent', {field: col.field, renameTo: renameTo}, $scope);
                        setTimeout(function(){
                            // update corresponding column name on ingest page when updating on viz
                            let flowJSON = $scope.tabsSection.options.activeTab.state.flowJSON;
                            $scope.deserializeIngestSettingsFromJSON(flowJSON).then(function(){
                                let column = _.find($scope.ingestDataSummary.columns, c => c.settings.rename === col.originalField || c.name === col.originalField);
                                if (column && renameTo !== column.settings.rename) {
                                    column.settings.rename = renameTo;
                                    flowJSON = $scope.serializeIngestSettingsToJSON();
                                    $scope.tabsSection.options.activeTab.state.flowJSON = flowJSON;
                                    $scope.updateIngestSettings(true, true);
                                }
                            });
                        });
                        $scope.$emit('DoRebuildCollapsedTags');
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

                function onLoadMoreData($scope, result){
                    $scope.totalSize = result.count;
                    if ($scope.popupData.is) $scope.popupData.totalSize = _.cloneDeep($scope.totalSize);
                    $scope.totals = result.totals;
                    $scope.externalId = result.externalId;
                    $scope.scrollId = result.scrollId;
                    $scope.headers = result.headers;
                    if($scope.totalSize == 0){
                        $scope.gridOptions.api.showNoRowsOverlay();
                    } else {
                        $scope.gridOptions.api.hideOverlay();
                    }
                }

                function loadMoreData($scope, options, successCallback){
                    if(!isRawData($scope)){
                        return;
                    }
                    var cb = function (result) {
                        onLoadMoreData($scope, result);
                        successCallback(_.map(result.data.children, function(item){ return item.data }));
                    };
                    makeRequest(options, $scope, cb);
                }

                function loadAggregationData(data, $scope) {
                    return $http({
                        method: 'POST',
                        url: "/api/visualization/search",
                        timeout: $scope.currentRequest.canceler.promise,
                        data: {
                            datadocId: $scope.datadocId,
                            params: {
                                shows: _.map($scope.dataSummary.shows, 'id'),
                                aggs: _.map($scope.dataSummary.aggs, 'id'),
                                pivot: _.map($scope.dataSummary.pivot, 'id'),
                                filters: $scope.dataSummary.filters,
                                search: $scope.dataSummary.search,
                                limit: $scope.dataSummary.limit,
                                row: _.clone(data),

                                advancedMode: $scope.dataSummary.advancedModeCheck,
                                advancedFilterQuery: $scope.dataSummary.advancedFilterQuery
                            }
                        }
                    }).then(function (res) {
                        var answer = res.data;
                        console.log(`SEARCH QUERY: `, answer.query.replace(/`/g, ""));
                        $scope.totalSize = answer.count;
                        // $scope.totals = answer.totals;
                        var childTreeLevel = data.__treeLevel + 1,
                            children = generateAggDataForGrid({
                                data: answer.data,
                                key: getAggKey($scope, childTreeLevel),
                                expandable: $scope.dataSummary.aggs.length - 1 > childTreeLevel,
                                treeLevel: childTreeLevel,
                                parentData: data
                            }),
                            parentAggValues = {};
                        _.each($scope.dataSummary.aggs, function(agg){
                            var aggKey = getOpKey(agg);
                            parentAggValues[aggKey] = data[aggKey];
                        });

                        data.$$children = _.map(children, function (child) {
                            return _.merge({}, parentAggValues, child);
                        });

                        return data;
                    });
                }

                function move(array, from, to) {
                    array.splice(to, 0, array.splice(from, 1)[0]);
                }

                function onShowsOrderChangePivot($scope, showsArray, to) {
                    var gridOptions = $scope.gridOptions,
                        onColumnMovedOld = gridOptions.onColumnMoved;
                    delete gridOptions.onColumnMoved;

                    // $$row_number + $$aggregation columns
                    var offset = 1 + !!$scope.dataSummary.aggs.length,
                        gridColumns = _.cloneDeep(gridOptions.columnApi.getAllGridColumns()),
                        groupSize = showsArray.length;

                    for (var newIndex = 0; newIndex < groupSize; newIndex++) {
                        var column = showsArray[newIndex];
                        _.forEach(_.keys(_.pick(gridColumns, function (el) {
                            // find all old indexes of columns
                            return el.colDef.originalField == column.key;
                        })), function (oldPosition, groupIndex) {
                            // set all new indexes for columns
                            var newPosition = (groupIndex * groupSize + newIndex) + offset;
                            if (oldPosition != newPosition) {
                                gridOptions.columnApi.moveColumn(oldPosition, newPosition);
                                move(gridColumns, oldPosition, newPosition);
                            }
                        })
                    }
                    gridOptions.onColumnMoved = onColumnMovedOld;
                    if (to != undefined) {
                        BookmarkEventService.emit(".shows.ShowMoveEvent", {key: showsArray[to].id, toPosition: to}, $scope);
                    }
                }

                function setPivotOrder(columnController, pivotOrder) {
                    var columns = columnController.getAllGridColumns();
                    _.forEach(pivotOrder, function (pivotColId, newIndex) {
                        var oldIndex = _.findIndex(columns, {colId: pivotColId});
                        if (oldIndex >= 0 && oldIndex != newIndex) {
                            move(columns, oldIndex, newIndex);
                        }
                    });
                    columnController.updateDisplayedColumns();
                }

                function getOpKey(o){
                    var key = o.id.key ? o.id.key : (o.id.op ? o.id.op + '_' : '') + o.id.field;
                    return (o.id.pivot ? o.id.pivot.join('_') + '_' : '') + key;
                }

                function getOpPred (list, wrapId) {
                    return function (o1) {
                        var el = _.find(list, function(o2){
                            return getOpKey(wrapId ? {id: o1} : o1) == getOpKey(o2);
                        });
                        if (el && wrapId) {
                            el.id = o1;
                        }
                        return el;
                    }
                }

                function isAllowClickIn(colId, show, $scope) {
                    return ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length)
                        && (colId == '$$aggregation' || show.id.op != 'VALUE') && (!isEmbed($scope) || $scope.embedSettings.clickIn);
                }

                function getShowsWithCount($scope){
                    var shows = [].concat($scope.dataSummary.shows);
                    if(shows.length == 0){
                        shows.push({
                            id: {
                                field: '$$cluster_size',
                                settings: {}
                            },
                            col: {
                                name: 'count',
                                type: 'DECIMAL',
                                settings: {
                                    format: {
                                        decimalPlaces: 0,
                                        showThousandsSeparator: true,
                                        type: 'NUMBER'
                                    }
                                }
                            },
                            showName: 'count'
                        })
                    }
                    return shows;
                }


                function genOnRowsResizedFn($scope) {
                    function updateRowsHeightState(rowIndex, height, limit, withoutEmit) {
                        if (rowIndex + 1 <= limit) {
                            $scope.dataSummary.rowsHeight[rowIndex+''] = height;

                            if (!withoutEmit) {
                                BookmarkEventService.emit('.rows.RowsHeightChangeEvent', {rowsHeight: $scope.dataSummary.rowsHeight}, $scope);
                            }

                            return true;
                        }
                    }

                    function updateRowsHeightStateFromArray(rows, height, limit) {
                        var changed = false;
                        rows.forEach(function(index) {
                            if (updateRowsHeightState(index, height, limit, true)) {
                                changed = true;
                            }
                        });

                        if (changed) {
                            BookmarkEventService.emit('.rows.RowsHeightChangeEvent', {rowsHeight: $scope.dataSummary.rowsHeight}, $scope);
                            return true;
                        }
                    }

                    function updateDefaultRowsHeightState(rangeController, height, limit) {
                        if (rangeController.allRowsSelected) {
                            $scope.dataSummary.defaultRowHeight = height;
                            $scope.dataSummary.rowsHeight = {};

                            var events = [{
                                "@type": '.rows.DefaultRowHeightChangeEvent',
                                defaultRowHeight: $scope.dataSummary.defaultRowHeight
                            }, {
                                "@type": '.rows.RowsHeightChangeEvent',
                                rowsHeight: $scope.dataSummary.rowsHeight
                            }];

                            BookmarkEventService.emit(".BookmarkVizCompositeStateChangeEvent", {events: events}, $scope);
                            return true;
                        } else {
                            return updateRowsHeightStateFromArray(rangeController.selectedRows, height, limit);
                        }
                    }

                    function isRowsSelectedResizing(rangeController, rowIndex) {
                        function isResizedSelectedRow() {
                            return _.some(rangeController.selectedRows, function (index) {
                                return index == rowIndex;
                            });
                        }

                        return rangeController.selectingRows
                            && rangeController.selectedRows.length > 1
                            && isResizedSelectedRow();
                    }

                    return function (height) {
                        var rowIndex;

                        if (!isActualRawData($scope)) {

                            if (this.node.floating == "top") {
                                rowIndex = this.rowIndex;
                            } else {
                                rowIndex = this.rowIndex + this.gridApi.rowRenderer.floatingRowModel.floatingTopRows.length;
                            }

                            var changed = false;
                            if (isRowsSelectedResizing(this.rangeController, rowIndex)) {
                                changed = updateDefaultRowsHeightState(this.rangeController, height, $scope.dataSummary.limit.aggData);
                            } else {
                                changed = updateRowsHeightState(rowIndex, height, $scope.dataSummary.limit.aggData);
                            }

                            if (changed) {
                                this.gridApi.refreshInMemoryRowModel();
                                this.gridApi.onGroupExpandedOrCollapsed();
                                this.rangeController.refreshBorders();
                            }
                        } else {

                            if (this.node.floating == "top") {
                                rowIndex = this.node.data["$$row_number"] - 1;
                            } else {
                                rowIndex = this.rowIndex + $scope.dataSummary.pinnedRowsCount;
                            }

                            var pageCache = this.gridApi.virtualPageRowModel.virtualPageCache;

                            if (isRowsSelectedResizing(this.rangeController, rowIndex)) {
                                updateDefaultRowsHeightState(this.rangeController, height, $scope.dataSummary.limit.pageSize);
                                pageCache.updateHeightForIndexes(this.rangeController.selectedRows, height);
                            } else {
                                this.node.rowHeight = height;

                                updateRowsHeightState(rowIndex, height, $scope.dataSummary.limit.pageSize);
                                pageCache.updateAllRowTopFromIndexes();
                            }

                            toggleTotals($scope);
                            this.gridApi.refreshView();
                            this.rangeController.refreshBorders();
                        }
                    }
                }

                function getNoFieldsColumnDef($scope) {
                    return {
                        colId: EMPTY_FIELDS_COL_ID,
                        headerName: "",
                        suppressMenu: true,
                        suppressMovable: true,
                        suppressResize: true,
                        suppressSorting: true,
                        cellRenderer: getNoFieldsCellRenderer($scope)
                    }
                }


                /// mutable
                function updatePinnedColDefsRange($scope, colDefs) {
                    for (var i = 0; i < colDefs.length; ++i) {
                        if (i < $scope.dataSummary.pinnedColsCount) {
                            colDefs[i].pinned = "left";
                        } else {
                            break;
                        }
                    }
                }

                function createColumnDefs($scope){
                    var colDefs = [];

                    // second add aggregation column
                    if (isAggregatedData($scope) || (isPivotTable($scope) && $scope.dataSummary.aggs.length)) {
                        const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;

                        var firstAgg = $scope.dataSummary.aggs[0],
                            oldColumn = $scope.gridOptions.columnApi.getColumn("$$aggregation") || {},
                            headerName = getAllAggregationPath($scope.dataSummary.aggs, colNameFormat);

                        if($scope.dataSummary.shows.length == 1) {
                            var col = $scope.dataSummary.shows[0];
                            headerName += ", " + col.op.name + " of " + col.name;
                        } else if($scope.dataSummary.shows.length == 0 && $scope.dataSummary.pivot.length > 0) {
                            col = $scope.dataSummary.pivot[$scope.dataSummary.pivot.length - 1];
                            headerName += ", COUNT of " + col.name;
                        }

                        const aggColDef = {
                            colId: "$$aggregation",
                            headerName: headerName,
                            rawHeaderName: headerName,
                            field: '$$aggregation',
                            suppressMovable: true,
                            suppressDefaultTitle: true
                        };

                        // uncomment for tree view
                        // colDefs.push(_.merge(aggColDef, _.pick(oldColumn, ['width', 'sortedAt'])));

                        $scope.dataSummary.aggs.forEach((agg, index) => {
                            headerName = ColumnsService.formatColumnName(colNameFormat, agg.selectedName);

                            const aggColDef = {
                                colId: "$$aggregation",
                                headerName: headerName,
                                rawHeaderName: headerName,
                                field: `$$aggregation${index}`,
                                suppressMenu: true,
                                suppressMovable: true,
                                suppressDefaultTitle: true,
                                treeLevel: index
                            };

                            colDefs.push(_.merge(aggColDef, _.pick(oldColumn, ['width', 'sortedAt'])));
                        });
                    }

                    function createColumnFromShow(s){
                        const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;
                        var key = getOpKey(s);
                        var sort = s.id.settings.sort;

                        var halign = 'right';
                        switch (s.col.type) {
                            case 'STRING':
                            case 'LOCATION_COUNTRY_CODES':
                            case 'LOCATION_USA_STATE_CODES':
                                if (!s.id.op || s.id.op === 'VALUE') {
                                    halign = 'left';
                                }
                                break;
                            case 'BOOLEAN':
                                halign = 'center';
                                break;
                        }

                        return {
                            colId: key,
                            field: key,
                            originalField: getOpKey({id: _.omit(s.id, ['pivot'])}),
                            headerName: s.col.name === s.col.originalField ? ColumnsService.formatColumnName(colNameFormat, s.col.originalField) : s.col.name,
                            headerPrefix: s.id.op ? toTitle(s.id.op) : null,
                            suppressSorting: s.col.type === 'LOCATION_LAT_LON',
                            minWidth: 10,
                            maxWidth: 2000,
                            pivotKeys: s.id.pivot,
                            suppressMenu: isEmbed($scope) || $scope.dataSummary.pivot.length,
                            suppressMovable: isEmbed($scope),
                            width: s.id.settings.width || undefined,
                            suppressSizeToFit: s.id.settings.width != null,
                            sort: sort ? sort.direction.toLowerCase() : null,
                            sortedAt: sort ? -sort.priority : null,
                            cellRenderer: getCustomCellRenderer($scope),
                            columnGroupShow: 'open',
                            halign: halign,
                            searchType: s.col.searchType
                        }
                    }

                    if (isPivotTable($scope)) {
                        var columnGroups = {},
                            columnGroupIdCounter = 0,
                            shows = getShowsWithCount($scope);

                        function setHeaderName(col, collapsedHeaderName){
                            col.expandedHeaderName = col.headerName = col.rawHeaderName;
                            col.collapsedHeaderName = '';

                            if (collapsedHeaderName !== undefined) {
                                col.collapsedHeaderName = collapsedHeaderName;
                            }
                        }

                        function createGrandTotalColumn() {
                            var grandTotalChildren = [];
                            var count = $scope.totals
                                ? $scope.totals.$$cluster_size
                                : $scope.data.data.$$cluster_size;

                            _.each(shows, function (s) {
                                var showCol = createColumnFromShow(s),
                                    pivotColId = showCol.colId,
                                    pivotCol = _.merge({}, showCol, {
                                        colId: pivotColId,
                                        field: pivotColId,
                                        originalField: showCol.field,
                                        suppressMovable: true
                                    });

                                grandTotalChildren.push(pivotCol);
                            });

                            var grandTotalColumn = {
                                groupId: "" + columnGroupIdCounter++,
                                rawHeaderName: "Grand Total",
                                count: count,
                                key: GRAND_TOTAL_COL_ID,
                                marryChildren: true,
                                level: 0,
                                suppressMovable: true
                            };
                            setHeaderName(grandTotalColumn);

                            grandTotalColumn.children = grandTotalChildren;

                            return grandTotalColumn;
                        }

                        function generatePivotColumns(node, columns, pivotKeys, level, parents) {
                            function generateLowLevelColumns() {
                                var kids = [];

                                _.each(shows, function (s) {
                                    var show = _.cloneDeep(s);
                                    show.id.pivot = pivotKeys;

                                    var showCol = createColumnFromShow(show),
                                        pivotColId = showCol.colId,
                                        pivotCol = _.merge({}, showCol, {
                                            colId: pivotColId,
                                            field: pivotColId,
                                            pivotKeys: pivotKeys
                                        });

                                    kids.push(pivotCol);
                                });

                                return kids;
                            }
                            var parent;
                            parents = parents.slice();
                            pivotKeys = pivotKeys.slice();
                            pivotKeys.push(node.key);
                            var columnName = pivotKeys.join('_');
                            var columnGroup = columnGroups[columnName],
                                pivot = $scope.dataSummary.pivot[level],
                                children;
                            if(columnGroup){
                                children = columnGroup.children;
                                parent = columnGroup;
                            } else {
                                children = [];

                                var count = (level == $scope.dataSummary.pivot.length - 1) ? node.data.$$cluster_size : 0;

                                var headerName;
                                if(node.key == null){
                                    headerName = 'Ø';
                                } else {
                                    headerName = $filter('formatCell')(node.key, pivot.col, pivot);
                                }
                                var newCol = {
                                    groupId: "" + columnGroupIdCounter++,
                                    rawHeaderName: headerName,
                                    key: node.key,
                                    count: count,
                                    marryChildren: true,
                                    children: children,
                                    level: level,
                                    columnName: columnName,
                                    columnGroupShow: 'open'
                                };

                                if (!$scope.dataSummary.pivotCollapsedState[columnName]) {
                                    newCol.openByDefault = true;
                                }

                                setHeaderName(newCol);

                                columnGroups[columnName] = newCol;

                                if (level > 0) {
                                    var pos = columns.length ? columns.length - 1 : 0;
                                    columns.splice(pos, 0, newCol);
                                } else {
                                    columns.push(newCol);
                                }


                                if (level != $scope.dataSummary.pivot.length - 1) {

                                    var totalGroupCol = {
                                        groupId: "" + columnGroupIdCounter++ +1,
                                        rawHeaderName: 'Total',
                                        key: node.key,
                                        count: node.data.$$cluster_size,
                                        marryChildren: true,
                                        children: [],
                                        level: level+1,
                                        isTotal: true
                                    };

                                    var showsCols = _.map(generateLowLevelColumns(), function(c) {
                                        return _.merge(c, {
                                            columnGroupShow: 'closed',
                                            colId: INSIDE_TOTAL_PREFIX + c.colId
                                        });
                                    });
                                    Array.prototype.push.apply(totalGroupCol.children, showsCols);

                                    setHeaderName(totalGroupCol);

                                    if ($scope.dataSummary.pivotCollapsedState[columnName]) {
                                        totalGroupCol.headerName = totalGroupCol.collapsedHeaderName;
                                    }

                                    if (isPivotShowTotalSelected(level+1, $scope)) {
                                        totalGroupCol.columnGroupShow = 'always-showing';
                                    } else {
                                        totalGroupCol.columnGroupShow = 'closed';
                                    }

                                    newCol.children.push(totalGroupCol);
                                }

                                parent = newCol;
                                _.each(parents, function(p){
                                    p.count += count;
                                    setHeaderName(p);
                                });

                                allPivotKeys.push(pivotKeys);
                            }
                            parents.push(parent);
                            _.each(node.children, function(node){
                                generatePivotColumns(node, children, pivotKeys, level + 1, parents);
                            });

                            if(!columnGroup && node.children.length === 0){
                                // todo refactor this with generateLowLevelColumns()
                                _.each(shows, function (s) {
                                    var showCol = createColumnFromShow(s),
                                        pivotColId = pivotKeys.join('_') + '_' + showCol.colId,
                                        pivotCol = _.merge({}, showCol, {
                                            colId: pivotColId,
                                            field: pivotColId,
                                            originalField: showCol.field,
                                            pivotKeys: pivotKeys
                                        });

                                    children.push(pivotCol);
                                });
                            }
                        }
                        var pivotColumns = [];
                        var allPivotKeys = [];
                        _.each($scope.headers.children, function(agg){
                            generatePivotColumns(agg, pivotColumns, [], 0, []);
                        });

                        if (isPivotShowTotalSelected(0, $scope)) {
                            pivotColumns.push(createGrandTotalColumn());
                        }

                        $scope.pivotColumns = pivotColumns;
                        $scope.allPivotKeys = allPivotKeys;

                        colDefs = colDefs.concat(pivotColumns);

                        updatePinnedColDefsRange( $scope, getFlattenColDefs(colDefs) );
                    } else {
                        var showCols = _.map($scope.dataSummary.shows, createColumnFromShow);
                        if(!showCols.length && !isAggregatedData($scope)){
                            showCols = [getNoFieldsColumnDef($scope)];
                        }
                        colDefs = colDefs.concat(showCols);
                        updatePinnedColDefsRange($scope, colDefs);
                    }

                    if ($scope.dataSummary.aggs.length) {
                        var aggColDef = _.find(colDefs, {colId: AGGREGATION_COL_ID});
                        var sort = $scope.dataSummary.aggs[0].id.settings.sort;
                        var sortedColDef;

                        if (!sort.field && !sort.isCount) {
                            aggColDef.sort = sort.direction.toLowerCase();
                            aggColDef.sortingOrder = ["asc", "desc"];
                        } else {
                            var searchKey;
                            var field = sort.field || CLUSTER_SIZE_COL_ID;

                            if (!sort.aggKeyPath || !sort.aggKeyPath.length) {
                                searchKey = field;
                            } else if (sort.aggKeyPath.length != $scope.dataSummary.pivot.length) {
                                searchKey = INSIDE_TOTAL_PREFIX + sort.aggKeyPath.join('_') + '_' + field;
                            } else {
                                searchKey = sort.aggKeyPath.join('_') + '_' + field;
                            }

                            sortedColDef = findColDefByKey(colDefs, searchKey);

                            if (sortedColDef) {
                                sortedColDef.sort = sort.direction.toLowerCase();
                            }
                        }
                    }

                    return colDefs;
                }

                function findColDefByKey(arr, key) {
                    var colDef;
                    for (var i = 0; i < arr.length; ++i) {
                        if (arr[i].children) {
                            colDef = findColDefByKey(arr[i].children, key);
                            if (colDef) {
                                return colDef;
                            }
                        } else {
                            if (arr[i].colId === key) {
                                return arr[i];
                            }
                        }
                    }
                }

                function getFlattenColDefs(colsDef) {
                    var arr = [];

                    for (var i = 0; i < colsDef.length; ++i) {
                        if (colsDef[i].children) {
                            arr = arr.concat( getFlattenColDefs(colsDef[i].children) );
                        } else {
                            arr.push(colsDef[i]);
                        }
                    }

                    return arr;
                }

                function updateShowTotals($scope) {
                    $scope.gridOptions.api.setColumnDefs(createColumnDefs($scope));
                    $scope.gridOptions.api.sizeColumnsToFit();

                    var grandTotalRow = getGrandTotalRow($scope);
                    if (isGrandTotalSelected($scope) && !grandTotalRow) {
                        generateGrandTotal($scope);
                        $scope.gridOptions.api.setRowData($scope.gridOptions.rowData);
                    } else if (!isGrandTotalSelected($scope) && grandTotalRow) {
                        _.remove($scope.gridOptions.rowData, grandTotalRow);
                        $scope.gridOptions.api.setRowData($scope.gridOptions.rowData);
                    }
                }

                function getGrandTotalRow($scope) {
                    var findObj = {};
                    findObj[GRAND_TOTAL_COL_ID] = true;
                    return _.find($scope.gridOptions.rowData, findObj);
                }

                function isPivotShowTotalSelected(level, $scope) {
                    if (level == null) {return false;}
                    var pivotArray = $scope.dataSummary.pivot;
                    return pivotArray && pivotArray[level] && pivotArray[level].id.settings.showTotal;
                }

                function isGrandTotalSelected($scope) {
                    return $scope.dataSummary.aggs.length && $scope.dataSummary.aggs[0].id.settings.showTotal && $scope.dataSummary.pivot.length;
                }

                function getAllAggregationPath(aggs, colNameFormat) {
                    var str = 'Aggregation: ';
                    _.forEach(aggs, function (agg, index) {
                        str += (ColumnsService.formatColumnName(colNameFormat, agg.selectedName) +(index+1 < aggs.length ? ' > ': ' '));
                    });

                    return str;
                }

                // todo refactoring
                function generateAggDataForGrid(params, $scope) {
                    return _.map(params.data, function(agg) {
                        var obj =  _.assign(agg.data, {
                            $$expandable: !!agg.children.length,
                            $$aggregation: agg.key,
                            $$children: [],
                            __treeLevel: params.treeLevel
                        });

                        var key = getAggKey($scope, obj.__treeLevel);
                        obj[key] = agg.key;

                        if (!params.parentData) {
                            params.parentData = {};
                        }
                        params.parentData[key] = agg.key;

                        var aggKeyPath = [];
                        for (var key in params.parentData) {
                            aggKeyPath.push(params.parentData[key]);
                        }

                        $scope.allAggKeys.push(aggKeyPath);

                        obj = _.merge(obj, params.parentData);

                        obj.$$open = !!$scope.dataSummary.rowsCollapsedState[aggKeyPath];

                        if (agg.children.length) {
                            obj.$$children = generateAggDataForGrid({
                                data: agg.children,
                                treeLevel: params.treeLevel+1,
                                parentData: _.cloneDeep(params.parentData)
                            }, $scope);
                        }
                        return obj;
                    });
                }

                function refreshGrid($scope) {
                    $scope.gridOptions.api.setRowData($scope.gridOptions.rowData);
                    // todo move to pivot columns definition
                    // if(isPivotTable($scope)){
                        setPivotOrder($scope.gridOptions.api.columnController,  $scope.dataSummary.pivotOrder);
                    // }
                    $scope.gridOptions.api.sizeColumnsToFit();
                }

                function getAgg($scope, index) {
                    var aggs = $scope.dataSummary.aggs.concat($scope.dataSummary.pivot);
                    return aggs[index];
                }

                function getAggKey($scope, index) {
                    return getOpKey(getAgg($scope, index));
                }

                function flattenTreeIntoTable(treeRoot, agg, pivot){
                    function flattenNode(node, level, pivotKeys, aggValues){
                        pivotKeys = pivotKeys.slice();
                        pivotKeys.push(node.key);
                        aggValues[getOpKey(pivot[level])] = node.key;
                        var keyPrefix = pivotKeys.length == 0 ? '' : (pivotKeys.join('_') + '_'),
                            mapped = _.mapKeys(node.data, function(v, k){
                                return keyPrefix + k;
                            });
                        _.merge(aggValues, mapped, aggValues);
                        if(level < pivot.length - 1){
                            _.each(node.children, function (child) {
                                flattenNode(child, level + 1, pivotKeys, aggValues);
                            })
                        }
                    }
                    var results = [];
                    if(agg) {
                        _.each(treeRoot.children, function (aggValue) {
                            var row = aggValue.data;
                            row[getOpKey(agg)] = aggValue.key;
                            _.each(aggValue.children, function (node) {
                                flattenNode(node, 0, [], row);
                            });
                            results.push(row);
                        });
                    } else {
                        var row = {};
                        _.each(treeRoot.children, function(node){
                            flattenNode(node, 0, [], row);
                        });
                        results.push(row)
                    }
                    return results;
                }

                function generateGrandTotal($scope) {
                    var obj = {};
                    obj[AGGREGATION_COL_ID] = obj[`${AGGREGATION_COL_ID}0`] = 'Grand Total';
                    obj[GRAND_TOTAL_COL_ID] = true;

                    if ($scope.totals) {
                        _.merge(obj, $scope.totals);
                    } else {
                        _.merge(obj, $scope.data.data);
                    }

                    $scope.grandTotal = obj;
                    $scope.gridOptions.rowData.push(obj);
                }

                function refreshRows($scope) {
                    if ($scope.dataSummary.aggs.length) {
                        $scope.gridOptions.rowData = generateAggDataForGrid({
                            data: $scope.data.children,
                            treeLevel: 0
                        }, $scope);

                        if (isGrandTotalSelected($scope)) {
                            generateGrandTotal($scope);
                        }

                        refreshGrid($scope);
                    }
                }

                function reinitGrid($scope){
                    if(isPivotTable($scope)){
                        initGrid({selector: $scope.gridId, mode: 'pivot'}, $scope);
                    } else if (isAggregatedData($scope)) {
                        initGrid({selector: $scope.gridId, mode: 'agg'}, $scope);
                    } else if(isRawData($scope)){
                        if($scope.gridOptions && $scope.gridMode === 'raw' && $scope.isIngestMode()) {
                            $scope.gridOptions.api.refreshCells();
                        } else {
                            initGrid({selector: $scope.gridId, mode: 'raw'}, $scope);
                        }
                    }
                }

                function setDatasource($scope, options = {}){
                    var promise = $q.defer();

                    $scope.$emit('data-request-started');
                    if(!options.initial) {
                        $scope.refreshAvailable = false;
                    }
                    options.initial = $scope.initialLoading;
                    $scope.initialLoading = false;
                    var loaderWithBackdrop = !!options.initial;

                    $scope.hideCollapsedTags = false;

                    if(isAggregatedData($scope) || isPivotTable($scope)) {
                        $scope.scrollId = null;

                        var cb = function (result) {
                            reinitGrid($scope);
                            $scope.data = result.data;
                            if(!_.isEmpty(result.data.filters)) {
                                setTimeout(() => updateFilters(result.data.filters, $scope, true), 0);
                            }
                            // don't ask me why https://trello.com/c/vEIFpOAP/1522-i-added-a-new-dataset-a-few-fixes
                            $scope.resultsOffset = result.data.children.length;
                            $scope.totalSize = result.count;
                            $scope.totals = result.totals;
                            $scope.treeRoot = result.aggs;
                            $scope.headers = result.headers;
                            $scope.inRequest = true;
                            $scope.externalId = result.externalId;
                            $scope.togglePageLoader(true, loaderWithBackdrop);
                            $scope.allAggKeys = [];
                            $scope.gridOptions.rowData = generateAggDataForGrid({
                                data: $scope.data.children,
                                treeLevel: 0
                            }, $scope);

                            recreateColumns($scope);

                            if (isGrandTotalSelected($scope)) {
                                generateGrandTotal($scope);
                            }

                            $scope.gridOptions.api.applyProperties({ isPivot: isPivotTable($scope) });
                            refreshGrid($scope);

                            pinnedRowNodes = [];
                            togglePinnedRows($scope, $scope.dataSummary.pinnedRowsCount, true);

                            $scope.inRequest = false;
                            $scope.togglePageLoader(false);

                            if (!isEmbed($scope)) {
                                $scope.updateShowMeAutocompleteList();
                                $scope.updateGroupByAutocompleteList()
                            }
                            $scope.$emit('DoRebuildCollapsedTags');
                            promise.resolve();
                        };

                        makeRequest(options, $scope, cb);
                    } else {

                        if (!isEmbed($scope)) {
                            $scope.updateShowMeAutocompleteList();
                            $scope.updateGroupByAutocompleteList();
                        }
                        $scope.scrollId = null;
                        makeRequest(_.merge({customFinish: true}, options), $scope, (firstLoadData) => {
                            reinitGrid($scope);
                            doRefreshRawShows(true, $scope);
                            if(!_.isEmpty(firstLoadData.filters)) {
                                setTimeout(() => updateFilters(firstLoadData.filters, $scope, true), 0);
                            }

                            var dataSource = {
                                sortModel: $scope.gridOptions.api.getSortModel(),
                                rowCount: null, // behave as infinite scroll
                                totalSize: firstLoadData.count,
                                search: $scope.dataSummary.search,
                                getRows: function (params) {
                                    console.log('asking for ' + params.startRow + ' to ' + params.endRow, params);
                                    options.from = params.startRow;
                                    var cb = function (data) {
                                        if (params.startRow == 0) {
                                            // reset list data
                                            $scope.resultsList = data;
                                            $scope.gridOptions.api.setColumnDefs(createColumnDefs($scope));
                                        }
                                        var lastRow = -1;
                                        $scope.resultsOffset = options.from + data.length;
                                        if (!isEmbed($scope) && $scope.totalSize < Constants.MIN_PAGE_SIZE) {
                                            lastRow = Constants.MIN_PAGE_SIZE;
                                        } else if ($scope.dataSummary.limit.rawData <= options.from + data.length) {
                                            lastRow = $scope.dataSummary.limit.rawData;
                                        } else if ($scope.totalSize <= options.from + data.length) {
                                            lastRow = $scope.totalSize;
                                        }
                                        params.successCallback(data, lastRow);
                                        $timeout(() => {
                                            if(params.startRow == 0){
                                                $scope.requestFinished = true;
                                                $scope.inRequest = false;
                                                $scope.togglePageLoader(false);
                                            }
                                        });
                                        if (params.startRow < $scope.dataSummary.pinnedRowsCount
                                          && (params.startRow + data.length) > $scope.dataSummary.pinnedRowsCount){
                                            togglePinnedRows($scope, $scope.dataSummary.pinnedRowsCount, true);
                                        }
                                        if ($scope.gridOptions.api.rangeController.allRowsSelected) {
                                            $scope.gridOptions.api.rangeController.selectAll();
                                        }

                                        if($scope.viewMode == VIEW_MODES.TABLE && params.startRow == 0) {
                                            $scope.gridOptions.api.sizeColumnsToFit();
                                        }

                                        if (params.startRow == 0) {
                                            promise.resolve();
                                        }
                                        $scope.$emit('DoRebuildCollapsedTags');
                                    };
                                    options = _.clone(options);
                                    options.getFromState = options.getFromState && params.startRow === 0;
                                    if (options.from == 0) {
                                        $scope.floatingTopRows = [];
                                        $scope.gridOptions.api.gridPanel.resetVerticalScrollPosition();
                                        onLoadMoreData($scope, firstLoadData, options);
                                        cb(_.map(firstLoadData.data.children, function(item){ return item.data }));
                                    } else {
                                        options.initial = false;
                                        loadMoreData($scope, options, cb);
                                    }
                                }
                            };

                            console.log('dataSource', dataSource);

                            $scope.gridOptions.api.setDatasource(dataSource);
                        })
                    }
                    return promise.promise;
                }

                function recreateColumns($scope, doFit) {
                    var columnDefs = createColumnDefs($scope);
                    $scope.gridOptions.columnDefs = columnDefs;
                    $scope.gridOptions.api.setColumnDefs(columnDefs);

                    if (doFit || isRawData($scope)) {
                        $scope.gridOptions.api.sizeColumnsToFit();
                    }
                }

                function makeRequest(options, $scope, cb) {
                    options = _.merge({retries: 5}, options);
                    var promise = $q.defer();

                    if (options.getFromState && window.tabsState && $scope.tabsSection.options.activeTab) {
                        var state = window.tabsState[$scope.tabsSection.options.activeTab.id];

                        if (state) {
                            $scope.inRequest = false;
                            $scope.togglePageLoader(false);
                            cb(state);
                            return;
                        }
                    }

                    if (!options.retry) {
                        if ($scope.currentRequest.cancelButtonPromise) {
                            $timeout.cancel($scope.currentRequest.cancelButtonPromise);
                        }
                        $scope.showCancelRequestButton = false;
                        $scope.currentRequest.cancelButtonPromise = $timeout(function () {
                            $scope.togglePageLoaderCancelButton($scope.cancelRequest);
                        }, 3000);
                    } else {
                        if ($scope.currentRequest.canceler.promise.$$state.status == 1) {
                            return;
                        }
                    }
                    $scope.currentRequest = {canceler: $q.defer()};

                    $scope.requestFinished = false;
                    $scope.inRequest = true;

                    $scope.togglePageLoader(true, !!options.initial);
                    var request = {
                        tableBookmarkId: $scope.tabId,
                        stateId: $scope.bookmarkStateId.stateId,
                        tableId: $scope.tableId,
                        scrollId: $scope.scrollId,
                        from: options.from || 0
                    };
                    if(isEmbed($scope)) {
                        // emulate server-side state by stripping wrappers
                        request.params = {
                            shows: _.map($scope.dataSummary.shows, 'id'),
                            aggs: _.map($scope.dataSummary.aggs, 'id'),
                            pivot: _.map($scope.dataSummary.pivot, 'id'),
                            filters: $scope.dataSummary.filters,
                            search: $scope.dataSummary.search,
                            limit: {
                                rawData: 1000,
                                aggData: 100,
                                pivotData: 100
                            },

                            advancedMode: $scope.dataSummary.advancedModeCheck,
                            advancedFilterQuery: $scope.dataSummary.advancedFilterQuery
                        };
                    }
                    const queryParams = _.get($scope.tabsSection, 'options.activeTab.state.queryParams');
                    if(queryParams) {
                        request.params = queryParams;
                    }
                    $http({
                        method: 'POST',
                        url: "/api/visualization/search",
                        timeout: $scope.currentRequest.canceler.promise,
                        data: request
                    }).then(function (res) {
                        console.log(`SEARCH QUERY: `, res.data.query.replace(/`/g, ""));
                        cb(res.data);
                        if(!options.customFinish) {
                            $scope.requestFinished = true;
                            $scope.inRequest = false;
                            $scope.togglePageLoader(false);
                        }
                        $scope.$emit('GridInitialized');
                        $scope.$emit('NewDataLoaded');
                    }, function (e) {
                        if (e && e.data && e.data.type && e.data.type == "ParseException") {
                            $scope.linterMessage = e.data;

                            console.group("ParseException: %O", e.data);
                            console.log("line: %c%i", "color: blue;", e.data.line - 1);
                            console.log("ch: %c%i", "color: blue;", e.data.column - 1);
                            console.groupEnd();

                            $scope.cmInstance.setValue($scope.dataSummary.advancedFilterQuery);
                            $scope.inRequest = false;
                            $scope.togglePageLoader(false);
                        }

                        if (!e || e.status != -1) {
                            if(options.retries == -1 || options.retries > 0) {
                                $timeout(() => makeRequest(
                                    _.merge(options, {
                                        retry: true,
                                        retries: options.retries > 0 ? options.retries - 1 : options.retries
                                    }), $scope, cb), 2000);
                            } else {
                                cc.notify({
                                    message: 'Error on our end',
                                    icon: 'warning',
                                    wait: 5
                                });
                                cb({count: 0, data: {children: []}});
                            }
                        }
                    });

                    return promise.promise;
                }

                function processTagChangedEvents(type, oldTags, newTags, $scope){
                    var added = _.difference(newTags, oldTags),
                        removed = _.difference(oldTags, newTags);
                    _.each(added, function(tag){
                        $scope.$emit('tags-changed', {type: type, op: 'add', tag: tag});
                    });
                    _.each(removed, function(tag){
                        $scope.$emit('tags-changed', {type: type, op: 'remove', tag: tag});
                    })
                }

                function resetShows(shows, $scope) {
                    var old = $scope.dataSummary.shows;
                    $scope.dataSummary.shows = shows;
                    processTagChangedEvents('show', old, shows, $scope);
                }

                function resetPivot(pivot, $scope) {
                    var old = $scope.dataSummary.pivot;
                    $scope.dataSummary.pivot = pivot;
                    processTagChangedEvents('pivot', old, pivot, $scope);
                }

                function resetAggs(aggs, $scope) {
                    var old = $scope.dataSummary.aggs;
                    $scope.dataSummary.aggs = aggs;
                    processTagChangedEvents('agg', old, aggs, $scope);
                }

                function doRefreshRawShows(suppressRefresh, $scope) {
                    if ($scope.isViewRawData) {
                        let selectedRawShows = _.filter($scope.rawShowMeList, function (s) {
                                return s.id.selected;
                            }),
                            shows = _.map(selectedRawShows, function (s) {
                                let show = _.find($scope.showMeList, function (show) {
                                    return getOpKey(show) === getOpKey(s);
                                });
                                // todo: Make sort works. Now it's just copies the value of the real show
                                s.id.sort = show.id.settings.sort;
                                return show;
                            });
                        resetShows(shows, $scope);
                        if(!suppressRefresh) {
                            doRefreshIfNeeded($scope);
                        }
                    }
                }

                function viewRaw(node, $scope, colId, column, clickInNormalNumber) {
                    const startTime = new Date();

                    function addPivotFilter() {
                        _.forEach($scope.dataSummary.pivot, function(pivot, idx) {
                            if (column.colDef.pivotKeys && column.colDef.pivotKeys[idx]) {
                                filter = filterToResults(pivot, column.colDef.pivotKeys[idx], $scope, true);
                                events.push({"@type": ".filter.FilterChangeEvent", tabId: $scope.tabId, filter: filter});
                            }
                        });

                        pivotAdded = true;
                    }

                    var isPivot = isPivotTable($scope);
                    var pivotAdded = false;
                    $scope.isViewRawData = true;
                    $scope.beforeViewRawDataSummary = _.cloneDeep($scope.dataSummary);

                    const events = [];
                    if (!node.data[GRAND_TOTAL_COL_ID]) {
                        const aggKeys = node.data;
                        const aggs = $scope.dataSummary.aggs.slice(0, node.level + 1);

                        [].push.apply(events, _.map(aggs, function(agg) {
                            const filter = filterToResults(agg.col, aggKeys[getOpKey(agg)], $scope, true);
                            return { "@type": ".filter.FilterChangeEvent", tabId: $scope.tabId, filter: filter };
                        }));
                    }

                    if(clickInNormalNumber) addPivotFilter();

                    if (colId) {
                        if(isPivot && !pivotAdded) addPivotFilter();

                        var show = _.find($scope.dataSummary.shows, {key: colId}),
                            filter = excludeFromResults(show.col, null, $scope, true);
                        events.push({"@type": ".filter.FilterChangeEvent", tabId: $scope.tabId, filter: filter});
                    }

                    const selectedRawShows = _.filter($scope.rawShowMeList, function(s) {
                          return s.id.selected;
                      }),
                      shows = _.map(selectedRawShows, s => {
                          const show = _.find($scope.showMeList, show => getOpKey(show) === getOpKey(s));
                          show.id.sort = s.sort;
                          return show;
                      });

                    resetShows(shows, $scope);
                    resetPivot([], $scope);
                    resetAggs([], $scope);
                    const eventId = BookmarkEventService.emit(".ViewRawEvent", { events }, $scope).id;
                    const selectedFilters = _.filter($scope.dataSummary.filters, 'selected');
                    startRefreshFilters(eventId, selectedFilters, $scope);
                    doRefreshIfNeeded($scope, startTime);
                }

                function drillIn(column, value, agg, $scope) {
                    const startTime = new Date();

                    var filter = filterToResults(column, value, $scope, true);
                    $scope.dataSummary.aggs.push(agg);
                    resetAggs($scope.dataSummary.aggs, $scope);
                    if ($scope.dataSummary.aggs.length == 1) {
                        resetShows([], $scope);
                    }
                    $timeout(function(){
                        if ($scope.dataSummary.aggs.length == 1) {
                            $scope.$broadcast('FocusOnShowMe');
                        }
                    });
                    var eventId = BookmarkEventService.emit(".DrillInEvent", {
                        events: [
                            {"@type": ".filter.FilterChangeEvent", tabId: $scope.tabId, filter: filter},
                            {"@type": ".aggs.AggAddEvent", tabId: $scope.tabId, key: agg.id}
                        ]}, $scope).id;
                    var selectedFilters = _.filter($scope.dataSummary.filters, 'selected');
                    startRefreshFilters(eventId, selectedFilters, $scope);
                    doRefreshIfNeeded($scope, startTime);
                }

                function excludeFromResults(column, value, $scope, suppressRequest) {
                    var filter = _.find($scope.dataSummary.filters, {field: column.field});
                    filter.selected = true;
                    filter.listMode = true;
                    var filterKey = _.find(filter.list, {key: value});
                    if (!filterKey) {
                        filter.list.push({selected: false, key: value, show: false});
                    } else {
                        _.extend(filterKey, {selected: false, show: false});
                    }
                    if(!suppressRequest) {
                        makeRequestRefreshFilters(filter, $scope);
                    }
                    return filter;
                }

                function filterToResults(column, value, $scope, suppressRequest) {
                    const filter = _.find($scope.dataSummary.filters, {field: column.field});
                    cc.resetOneFilter(filter, $scope);

                    filter.selected = true;
                    filter.listMode = true;
                    const filterKey = _.find(filter.list, {key: value});
                    if (filterKey) {
                        _.extend(filterKey, { selected: true, show: true });
                    } else {
                        filter.list.push({ selected: true, key: value, show: true });
                    }

                    if(!suppressRequest) {
                        makeRequestRefreshFilters(filter, $scope);
                    }
                    return filter;
                }

                function getSliderChangeCallback(filter) {
                    return function (sliderId, modelValue, highValue) {
                        if (!filter.linlog) {
                            filter.value1 = Math.exp(filter.value1exp);
                            filter.value2 = Math.exp(filter.value2exp);
                        }
                        filter.changed = true;
                    };
                }

                function getSliderEndCallback(filter, $scope) {
                    return function (sliderId, modelValue, highValue) {
                        if(filter.changed) {
                            makeRequestRefreshFilters(filter, $scope);
                            filter.changed = false;
                        }
                    };
                }

                function toTitle(str){
                    return str.split("_").join(" ").replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
                }

                function wrapShow(s, colNameFormat){
                    var opName = "<span class=\"show-me-list-oper\">" + (s.id.op ? toTitle(s.id.op) : '') + "</span>";
                    return _.merge(s, {
                        opName: opName,
                        showName: opName + " " + ColumnsService.formatColumnName(colNameFormat, s.col.name),
                        // showName: ColumnsService.formatColumnName(colNameFormat, s.col.name),
                        field: s.id.field,
                        key: getOpKey(s),
                        name: s.col.name,
                        type: s.col.type,
                        op: {
                            name: s.id.op,
                            val: s.id.op
                        },
                        operation: s.id.op != null,
                        showListView: s.id.op != null ? s.id.op : s.col.name,
                        removeFromUi: false
                    });
                }

                function wrapAgg(a, colNameFormat){
                    const nameFormatted = ColumnsService.formatColumnName(colNameFormat, a.col.name);
                    // var displayName = a.id.op
                    //     ? nameFormatted + ' <span class="show-me-list-oper">'+a.id.op+'</span>'
                    //     : nameFormatted;
                    var displayName = nameFormatted;
                    return _.merge(a, {
                        field: a.id.field,
                        key: getOpKey(a),
                        name: a.col.name,
                        displayName: displayName,
                        selectedName: a.col.name + (a.id.op ? " (" + a.id.op + ")" : ''),
                        type: a.col.type,
                        operation: a.id.op,
                        colName: a.col.name
                    });
                }

                function wrapFilter(f, $scope){

                    switch (f.col.type) {
                        case "DECIMAL":
                            _.merge(f, {
                                options: {
                                    id: f.col.type + f.col.field,
                                    floor: f.min,
                                    ceil: f.max,
                                    step: 0.01,
                                    precision: 10,
                                    onChange: getSliderChangeCallback(f),
                                    onEnd: getSliderEndCallback(f, $scope)
                                }
                            }, true);
                            break;
                        case "TIME":
                            _.merge(f, {
                                options: {
                                    id: f.col.type + f.col.field,
                                    floor: f.min,
                                    ceil: f.max,
                                    step: 0.01,
                                    precision: 10,
                                    onChange: getSliderChangeCallback(f),
                                    onEnd: getSliderEndCallback(f, $scope)
                                }
                            }, true);
                            break;
                        case "DATE":
                            const format = _.get(f, 'col.settings.format');
                            const options = {
                                fromDate: new Date(f.value1),
                                toDate: new Date(f.value2),
                                isFixedDateDropdownOpened: false
                            };

                            const isFixedDateEnabled = !!f.fixedDate;
                            const isTimePickerEnabled = format && format.type === "DATE_TIME";

                            if(isTimePickerEnabled) {
                                const { fromDate, toDate } = options;

                                let timeOptions = {
                                    displayFromTime: moment(fromDate).utc().format("h:mm a"),
                                    displayToTime: moment(toDate).utc().format("h:mm a")
                                };

                                _.assign(options, timeOptions);
                            }

                            _.merge(f, {
                                options: options,
                                datepickerOptionsFrom: {
                                    showWeeks: false,
                                    // maxDate: options.toDate,
                                    startingDay: 1
                                },
                                datepickerOptionsTo: {
                                    showWeeks: false,
                                    // minDate: options.fromDate,
                                    startingDay: 1
                                },
                                isFixedDateEnabled,
                                isTimePickerEnabled
                            });

                            if (!f.options.period && f.fixedDate) {
                                const period = _.find(AvailableFixedDates.allAvailableFixedDates, {type: f.fixedDate});
                                if (period) {
                                    f.options.period = period;
                                    f.options.fromDate = period.value1;
                                    f.options.toDate = period.value2;
                                    f.value1 = moment(period.value1).valueOf();
                                    f.value2 = moment(period.value2).valueOf();
                                }
                            }
                            break;
                    }
                    return f;
                }

                function startRefreshFilters(eventId, filters, $scope){
                    if ($scope.autoRefresh) {
                        if(filters.length > 0 && !$scope.filtersStatus.refreshing) {
                            _.set($scope, 'filtersStatus.refreshing', true);
                        }
                        if (eventId) {
                            console.log("start set event id " + eventId);
                            _.each(filters, filterToRefresh => filterToRefresh.lastRefreshEventId = eventId);
                            console.log("end set event id " + eventId);
                        }
                    }
                }

                function makeRequestRefreshFilters(filter, $scope){
                    const startTime = new Date();

                    const selectedFilters = _.filter($scope.dataSummary.filters, f => f !== filter && f.selected);
                    if(selectedFilters.length > 0) {
                        _.set($scope, 'filtersStatus.refreshing', true);
                    }
                    BookmarkEventService.emit(".filter.FilterChangeEvent", {filter: filter}, $scope, (eventId) => {
                        startRefreshFilters(eventId, selectedFilters, $scope);
                    });
                    doRefreshIfNeeded($scope, startTime);
                }

                function clearAllFilters($scope){
                    const startTime = new Date();

                    var eventId = BookmarkEventService.emit(".filter.FilterResetAllEvent", {}, $scope).id;
                    startRefreshFilters(eventId, $scope.dataSummary.filters, $scope);
                    doRefreshIfNeeded($scope, startTime);
                }

                function filterSearch(filter, $scope){
                    var eventId = BookmarkEventService.emit(".filter.FilterSearchEvent", {filter: filter}, $scope).id;
                    startRefreshFilters(eventId, [filter], $scope);
                    if(!$scope.autoRefresh){
                        _.set($scope, 'filtersStatus.refreshing', true);
                    }
                }

                function search(searchText, force, $scope){
                    const startTime = new Date();

                    const selectedFilters = _.filter($scope.dataSummary.filters, 'selected');

                    if(force && $scope.dataSummary.instantSearch) {
                        return -1;
                    }

                    BookmarkEventService.emit(".filter.SearchChangeEvent", {search: searchText, force: force}, $scope, (eventId) => {
                        if($scope.dataSummary.instantSearch || force) {
                            startRefreshFilters(eventId, selectedFilters, $scope);
                        }
                    });

                    if(!$scope.autoRefresh || ($scope.dataSummary.instantSearch || force)) {
                        doRefreshIfNeeded($scope, startTime);
                    }
                    if(($scope.dataSummary.instantSearch || force) && !$scope.autoRefresh) {
                        $scope.doHandleRefresh();
                    }
                }

                function toggleTotals ($scope, withTimeout) {

                    var data = [];
                    if ($scope.dataSummary.showTotals && !_.isEmpty($scope.totals)) {
                        data = [_.merge({'$$total': true}, $scope.totals)];
                    }
                    if($scope.floatingTopRows.length) {
                        data = data.concat($scope.floatingTopRows);
                    }

                    if (!isActualRawData($scope)){
                        // just update floatingTop and bodyRows

                        if (withTimeout) {
                            setTimeout(function() {
                                $scope.gridOptions.api.onGroupExpandedOrCollapsed();
                            }, 0);
                        } else {
                            $scope.gridOptions.api.onGroupExpandedOrCollapsed();
                        }
                    } else {
                        $scope.gridOptions.api.setFloatingTopRowData(data);
                    }
                }

                function isEmbed($scope){
                    return !!$scope.embed;
                }

                function refreshFilter(filterToUpdate, filter, $scope){
                    _.assign(filterToUpdate, filter);
                    wrapFilter(filterToUpdate, $scope);
                    setTimeout(function(){
                        $rootScope.$broadcast('reCalcViewDimensions');
                    }, 0)
                }

                function updateFiltersByColumn(col, $scope) {
                    const { filters } = $scope.dataSummary;

                    _.each(col, c => {
                        let columnFilters = _.filter(filters, f => c.field === f.field);
                        _.each(columnFilters, cf => { wrapFilter(cf, $scope) })
                    });

                    $timeout(() => {
                        $rootScope.$broadcast('reCalcViewDimensions')
                    });
                }

                function updateFilters(filters, $scope, forceLoader){
                    _.each(filters, function(filter){
                        var filterToUpdate = _.find($scope.dataSummary.filters, {field: filter.field});
                        if(filterToUpdate) {
                            refreshFilter(filterToUpdate, filter, $scope);
                        }
                    });
                    if(forceLoader) {
                        _.set($scope, 'filtersStatus.refreshing', false);
                    }
                }

                function wrapParams(state, params, $scope){
                    var result = {};
                    result.shows = _.map(params.shows, getOpPred($scope.showMeList, true));
                    result.aggs = _.map(params.aggs, getOpPred($scope.groupByList, true));
                    result.pivot = _.map(params.pivot, getOpPred($scope.groupByList, true));
                    result.filters = _.map(params.filters, (filter) => {
                        filter.list = _.filter(filter.list, f => f.docCount > 0 || f.selected);
                        filter.col = _.find(state.columnList, {field: filter.field});
                        return wrapFilter(filter, $scope);
                    });
                    result.search = params.search;
                    result.pivotOrder = params.pivotOrder;
                    result.advancedModeCheck = params.advancedMode;
                    result.advancedFilterQuery = params.advancedFilterQuery;
                    result.limit = params.limit;

                    return result;
                }

                function updateDatasummary($scope, params, state) {
                    var oldState = wrapParams(state, params, $scope);

                    $scope.dataSummary.shows = oldState.shows;
                    $scope.dataSummary.aggs = oldState.aggs;
                    $scope.dataSummary.pivot = oldState.pivot;
                    $scope.dataSummary.filters = oldState.filters;
                    $scope.dataSummary.search = oldState.search;
                    $scope.dataSummary.pivotOrder = oldState.pivotOrder;
                    $scope.dataSummary.advancedModeCheck = oldState.advancedModeCheck;
                    $scope.dataSummary.advancedFilterQuery = oldState.advancedFilterQuery;
                    $scope.dataSummary.limit = oldState.limit;

                    $scope.$emit('DoRebuildCollapsedTags');
                }

                function restoreShows(key, $scope){
                    if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length == 0) {
                        resetPivot([], $scope);
                        var shows = _.filter($scope.showMeList, function(s){
                            return s.id.op == null;
                        });
                        shows = _.take(shows, 10);
                        resetShows(shows, $scope);
                    } else {
                        var ss = $scope.dataSummary.shows.slice();
                        _.remove(ss, key);
                        resetShows(ss, $scope);
                    }
                }

                function restore(tab, gridId, $scope, options){
                    options = options || {};
                    function getByField(field){
                        return _.find(state.columnList, {field: field});
                    }

                    pinnedRowNodes = [];
                    var state = tab.state;
                    $scope.gridId = gridId;
                    $scope.tableId = tab.tableSchema.id;
                    if(!options.suppressReloadingData) {
                        $scope.initialLoading = true;
                    }

                    function presetDefaultStateIfNeeded() {
                        const { defaultState, currentState } = $scope.tabsSection.options.activeTab;
                        if(!$scope.firstRequestApplied && defaultState !== currentState ) {
                            $scope.firstRequestApplied = true;
                            $scope.presetDefaultState($scope.bookmarkStateId);
                            return true;
                        }
                        return false;
                    }

                    const checkFilterRefresh = _.debounce(() => {
                        var allFiltersRefreshed = _.every($scope.dataSummary.filters, f => !f.lastRefreshEventId);
                        if(allFiltersRefreshed) {
                            console.log("All filters have been refreshed")
                        } else {
                            console.log("it looks like some filters stuck", _.filter($scope.dataSummary.filters, f => f.lastRefreshEventId))
                        }
                    }, 5000);

                    if($scope.responseEventHandler) $scope.responseEventHandler.unsubscribe();
                    $scope.responseEventHandler =
                        WSocket.subscribe(`/vis/event-response/${tab.id}/${tab.currentState}` , function(e) {
                            switch (e.type) {
                                case 'FILTER_REFRESH':
                                    console.log('filters response >>> ', e);
                                    if (!e.filter) {
                                        break;
                                    }
                                    ScopeService.safeApply($scope, function () {
                                        var filterToUpdate = _.find($scope.dataSummary.filters, {field: e.filter.field});
                                        if (filterToUpdate) {
                                            refreshFilter(filterToUpdate, e.filter, $scope, e.srcEventId);
                                            if($scope.autoRefresh) {
                                                checkFilterRefresh();

                                                if (filterToUpdate.lastRefreshEventId == e.srcEventId) {
                                                    delete filterToUpdate.lastRefreshEventId;
                                                } else {
                                                    console.warn(filterToUpdate.lastRefreshEventId, "FILTER IDS NOT EQUALS ", e.srcEventId)
                                                }
                                                var allFiltersRefreshed = _.every($scope.dataSummary.filters, f => !f.lastRefreshEventId);
                                                if (allFiltersRefreshed) {
                                                    _.set($scope, 'filtersStatus.refreshing', false);
                                                }
                                            } else {
                                                $scope.dataSummary.filtersToRefresh =
                                                    _.without($scope.dataSummary.filtersToRefresh, e.filter.field);
                                                console.log(">>> " + $scope.dataSummary.filtersToRefresh);
                                                if($scope.dataSummary.filtersToRefresh.length == 0){
                                                    _.set($scope, 'filtersStatus.refreshing', false);
                                                }
                                            }
                                        }
                                    });
                                    break;
                                case 'FILTERS_TO_REFRESH':
                                    console.log('filters to refresh >>> ', e);
                                    $scope.dataSummary.filtersToRefresh = _.filter(e.fields, function(field){
                                        var filter = _.find($scope.dataSummary.filters, {field: field});
                                        return !filter.hidden && filter.selected;
                                    });
                                    break;
                                case 'REQUEST_APPLIED':
                                    if(presetDefaultStateIfNeeded()) {
                                        return;
                                    }
                                    $scope.refreshAvailable = false;
                                    var tab = $scope.tabsSection.options.activeTab;
                                    tab.state.refreshAvailable = false;
                                    tab.state.queryParams = _.cloneDeep(e.queryParams);
                                    tab.state.pendingQueryParams = _.cloneDeep(e.queryParams);
                                    setDatasource($scope);
                                    break;
                                case 'VIZ_STATE_CHANGED':
                                    if(presetDefaultStateIfNeeded()) {
                                        return;
                                    }
                                    if(e.instanceId && e.instanceId != cc.instanceGUID){
                                        console.log('state changed >>> ', e);
                                        $scope.$apply(function(){
                                            if(e.events){
                                                _.each(e.events, applyStateChangeEvent)
                                            } else {
                                                applyStateChangeEvent(e);
                                            }
                                        });
                                    }
                                    break;
                            }
                        });

                    function applyStateChangeEvent(e){
                        var tokens = e['@type'].split('.');
                        const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;

                        BookmarkEventService.suppressEmit(function() {
                            switch (tokens.pop()) {
                                case 'FilterChangeEvent':
                                    var filterToUpdate = _.find($scope.dataSummary.filters, {field: e.filter.field});
                                    refreshFilter(filterToUpdate, e.filter, $scope);
                                    break;
                                case 'ShowAddEvent':
                                    var col = getByField(e.key.field);
                                    var showsCopy = $scope.dataSummary.shows.slice(),
                                        to = e.toPosition == null ? showsCopy.length : e.toPosition;
                                    showsCopy.splice(to, 0, wrapShow({id: e.key, col: col}, colNameFormat));
                                    resetShows(showsCopy, $scope);
                                    break;
                                case 'ShowMoveEvent':
                                    var showsCopy = $scope.dataSummary.shows.slice();
                                    var show = _.remove(showsCopy, function (show) {
                                        return getOpKey({id: e.key}) == getOpKey(show);
                                    })[0];
                                    var to = e.toPosition++;
                                    if(isAggregatedData($scope)) to++;
                                    showsCopy.splice(e.toPosition, 0, show);
                                    if ($scope.dataSummary.pivot.length > 0) {
                                        resetShows(showsCopy, $scope);
                                    } else {
                                        var from = _.findIndex($scope.gridOptions.columnApi.getAllGridColumns(),
                                            function (col) {
                                                return col.colDef.field == getOpKey({id: e.key});
                                            });
                                        if (from > -1) {
                                            resetShows(showsCopy, $scope);
                                            $scope.gridOptions.columnApi.moveColumn(from, e.toPosition);
                                        }
                                    }
                                    break;
                                case 'ShowRemoveEvent':
                                    var showsCopy = $scope.dataSummary.shows.slice();
                                    _.remove(showsCopy, function (show) {
                                        return getOpKey({id: e.key}) == getOpKey(show);
                                    });
                                    resetShows(showsCopy, $scope);
                                    break;
                                case 'AggAddEvent':
                                    var col = getByField(e.key.field);
                                    var aggsCopy = $scope.dataSummary.aggs.slice(),
                                        to = e.toPosition == null ? aggsCopy.length : e.toPosition;
                                    aggsCopy.splice(to, 0, wrapAgg({id: e.key, col: col}, colNameFormat));
                                    resetAggs(aggsCopy, $scope);
                                    if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length == 1) {
                                        resetShows([], $scope);
                                    }
                                    break;
                                case 'AggMoveEvent':
                                    var aggsCopy = $scope.dataSummary.aggs.slice();
                                    var agg = _.remove(aggsCopy, function (agg) {
                                        return getOpKey({id: e.key}) == getOpKey(agg);
                                    })[0];
                                    aggsCopy.splice(e.toPosition, 0, agg);
                                    resetAggs(aggsCopy, $scope);
                                    break;
                                case 'AggRemoveEvent':
                                    var aggsCopy = $scope.dataSummary.aggs.slice();
                                    _.remove(aggsCopy, function (agg) {
                                        return getOpKey({id: e.key}) == getOpKey(agg);
                                    });
                                    resetAggs(aggsCopy, $scope);
                                    restoreShows(e.key, $scope);
                                    break;
                                case 'AggChangeLimitEvent':
                                    var agg = _.find($scope.dataSummary.aggs, {field: e.key.field});
                                    if (agg) {
                                        agg.id.settings.limit = e.key.settings.limit;
                                    }
                                    break;
                                case 'PivotAddEvent':
                                    var col = getByField(e.key.field);
                                    var pivotCopy = $scope.dataSummary.pivot.slice(),
                                        to = e.toPosition == null ? pivotCopy.length : e.toPosition;
                                    pivotCopy.splice(to, 0, wrapAgg({id: e.key, col: col}), colNameFormat);
                                    resetPivot(pivotCopy, $scope);
                                    if ($scope.dataSummary.aggs.length + $scope.dataSummary.pivot.length == 1) {
                                        resetShows([], $scope);
                                    }
                                    break;
                                case 'PivotMoveEvent':
                                    var pivotCopy = $scope.dataSummary.pivot.slice();
                                    var pivot = _.remove(pivotCopy, function (agg) {
                                        return getOpKey({id: e.key}) == getOpKey(agg);
                                    })[0];
                                    pivotCopy.splice(e.toPosition, 0, pivot);
                                    resetPivot(pivotCopy, $scope);
                                    break;
                                case 'PivotRemoveEvent':
                                    var pivotCopy = $scope.dataSummary.pivot.slice();
                                    _.remove(pivotCopy, function (show) {
                                        return getOpKey({id: e.key}) == getOpKey(show);
                                    });
                                    resetAggs(pivotCopy, $scope);
                                    restoreShows(e.key, $scope);
                                    break;
                            }
                        })
                    }

                    $scope.tabId = tab.id;
                    $scope.sourceInfoMessage = buildSourceInfo(tab);
                    $scope.bookmarkStateId = tab.bookmarkStateId;
                    $scope.allBookmarkStates = tab.allBookmarkStates;

                    const colNameFormat = $scope.tabsSection.options.activeTab.state.colNameFormat;

                    $scope.columns = state.columnList;
                    $scope.showMeList = _.map(state.showList, function (s) {
                        var col = getByField(s.field);
                        return wrapShow({id: s, col: col}, colNameFormat);
                    });
                    $scope.groupByList = _.map(state.aggList, function(a){
                        var col = getByField(a.field);
                        return wrapAgg({id: a, col: col}, colNameFormat);
                    });
                    $scope.rawShowMeList = _.map(state.rawShowList, function(s){
                        var col = getByField(s.field);
                        return wrapShow({id: s, col: col}, colNameFormat);
                    });
                    $scope.refreshAvailable = state.refreshAvailable;
                    $scope.autoRefresh = state.autoRefresh;
                    var queryParams = state.autoRefresh ? state.queryParams : state.pendingQueryParams;

                    if (!options.suppressReloadingData && !$scope.autoRefresh && $scope.refreshAvailable) {
                        $scope.dataSummary = wrapParams(state, state.queryParams, $scope);
                    } else {
                        $scope.dataSummary = wrapParams(state, queryParams, $scope);
                    }

                    $scope.dataSummary.highlightMatches = state.highlightMatches;
                    $scope.dataSummary.instantSearch = state.instantSearch;
                    $scope.dataSummary.rowsCollapsedState = state.rowsCollapsedState || {};
                    $scope.dataSummary.showTotals = state.showTotals;
                    $scope.dataSummary.pivotCollapsedState = state.pivotCollapsedState;
                    $scope.dataSummary.rowsHeight = state.rowsHeight;
                    $scope.dataSummary.defaultRowHeight = state.defaultRowHeight || DEFAULT_ROW_HEIGHT;
                    $scope.dataSummary.pinnedRowsCount = state.pinnedRowsCount;
                    $scope.dataSummary.pinnedColsCount = state.pinnedColsCount || DEFAULT_COLS_PINNED_COUNT;
                    $scope.dataSummary.filtersToRefresh = state.filtersToRefresh;
                    $scope.viewMode = state.viewMode;
                    SearchBarService.setSearch(queryParams.search);
                    resetAggs($scope.dataSummary.aggs, $scope); // init grid

                    if(!options.suppressReloadingData) {
                        setDatasource($scope, {retries: 0, initial: true, getFromState: options.getFromState}).then(function () {
                            if (!$scope.autoRefresh && $scope.refreshAvailable) {
                                $timeout(function() {
                                    updateDatasummary($scope, state.pendingQueryParams, state);
                                });
                            }
                        });
                    }

                    $scope.isViewRawData = !!state.beforeViewRawParams.aggs.length;
                    $scope.beforeViewRawDataSummary = wrapParams(state, state.beforeViewRawParams, $scope);

                    $scope.isShowFilters = state.showFilters;

                    if (!isEmbed($scope)) {
                        $scope.$broadcast('refresh-limit-settings-dropdown');
                        $scope.$emit('DoRebuildCollapsedTags');
                        $scope.$broadcast('reset-search-settings');
                    }

                    if($scope.isMobileView()) {
                        $scope.isShowFilters = false;
                    }

                    if($scope.isShowFilters) {
                        $scope.$broadcast('expand-visualization-filters');
                    } else {
                        $scope.$broadcast('collapse-visualization-filters');
                    }

                    _.each($scope.dataSummary.filters, filter => filter.col.name = ColumnsService.formatColumnName(colNameFormat, filter.col.name));

                    NotificationsUtils.closeAll();
                    if(state.notifications){
                        _.each(state.notifications, (e) => {
                            const type = e.type == 1 ? NotificationsUtils.NotificationType.ERROR : NotificationsUtils.NotificationType.SUCCESS;
                            const customDismissHandler = () => BookmarkEventService.emit('.NotificationCloseEvent', {messageId: e.id}, $scope);
                            NotificationsUtils.notify({ id: e.id, message: e.message }, { type, delay: -1, customDismissHandler });
                        });
                        state.notifications = [];
                    }
                }

                function selectDataSummaryBack($scope) {
                    const startTime = new Date();

                    if($scope.isViewRawData){
                        $scope.isViewRawData = false;
                        BookmarkEventService.emit(".BackFromViewRawEvent", {}, $scope);
                        _.assign($scope.dataSummary, $scope.beforeViewRawDataSummary);
                        resetAggs($scope.dataSummary.aggs, $scope);
                        doRefreshIfNeeded($scope, startTime);
                    }
                }

                function getClusterSize(data) {
                    var sum = 0;
                    _.forEach(data, function (el) {
                        sum += el['$$cluster_size'];
                    });
                    return sum;
                }

                function doRefreshIfNeeded($scope, startRefresh) {
                    const start = startRefresh || new Date();
                    const gridInitializationListener = $rootScope.$on("GridInitialized", () => {
                        gridInitializationListener();
                        $scope.$emit("LoadQueryTime", start);
                    });
                    if ($scope.autoRefresh) {
                        if(isEmbed($scope)){
                            setDatasource($scope);
                        } else {
                            BookmarkEventService.emit(".request.ApplyRequestEvent", {}, $scope);
                        }
                    } else {
                        $scope.$emit('DoRebuildCollapsedTags');
                        $scope.refreshAvailable = true;
                    }
                }


                /// mutable
                function smartEmit($scope, eventName, value) {
                    function getEventObjHandlers() {

                        function getChangePinnedCountColsEventObj(value) {
                            if (value !== undefined) {
                                $scope.dataSummary.pinnedColsCount = value;
                            }

                            return {
                                colsCount: $scope.dataSummary.pinnedColsCount
                            };
                        }

                        function getChangePinnedCountRowsEventObj(value) {
                            if (value !== undefined) {
                                $scope.dataSummary.pinnedRowsCount = value;
                            }

                            return {
                                rowsCount: $scope.dataSummary.pinnedRowsCount
                            };
                        }

                        var handlers = {};

                        handlers[EventNames.CHANGE_PINNED_COUNT.ROWS] = getChangePinnedCountRowsEventObj;
                        handlers[EventNames.CHANGE_PINNED_COUNT.COLS] = getChangePinnedCountColsEventObj;

                        return handlers;
                    }

                    var eventObjHandlers = getEventObjHandlers(),
                        handler;

                    if (handler = eventObjHandlers[eventName]) {
                        BookmarkEventService.emit(eventName, handler(value), $scope);
                    }
                }

                let currentDoc;
                function loadDatadoc (id, force){
                    if((currentDoc && currentDoc.id === id) || force) {
                        return Promise.resolve(currentDoc);
                    } else {
                        return $http.post('/api/files/get_file', {
                            path: 'id:' + id
                        }).success(doc => currentDoc = doc);
                    }
                }

                const getDatadocIdByShareId = (shareId) => {
                    return $http.get(`/api/files/get_file/${shareId}`).then(resp => {
                        return resp.data.datadocId;
                    })
                };

                // todo create separate service
                const isPublicAccessible = (shareId) => {
                    return $http.get(`/share/check/public/${shareId}`).then(resp => {
                        return resp.data.accessible;
                    })
                };

                return {
                    getDatadocIdByShareId,
                    isPublicAccessible,
                    loadDatadoc,
                    getCurrentDoc: () => currentDoc,

                    restore: restore,
                    setDatasource: setDatasource,
                    loadAggregationData: loadAggregationData,
                    loadMoreData: loadMoreData,
                    onShowsOrderChangePivot: onShowsOrderChangePivot,

                    resetShows: resetShows,
                    resetAggs: resetAggs,
                    resetPivot: resetPivot,

                    updateFilters: updateFilters,
                    updateFiltersByColumn: updateFiltersByColumn,
                    startRefreshFilters: startRefreshFilters,

                    getAggregationRequestSize: getAggregationRequestSize,

                    selectDataSummary: viewRaw,
                    selectDataSummaryBack: selectDataSummaryBack,
                    selectFromResults: filterToResults,
                    selectFromResultsRemove: excludeFromResults,
                    drillDown: drillIn,
                    toggleTotals: toggleTotals,

                    search: search,
                    makeRequestRefreshFilters: makeRequestRefreshFilters,
                    clearAllFilters: clearAllFilters,
                    filterSearch: filterSearch,
                    initGrid: initGrid,

                    getOpPred: getOpPred,

                    isRawData: isRawData,
                    isPivotTable: isPivotTable,
                    getOpKey: getOpKey,
                    updateShowTotals: updateShowTotals,
                    getMatchHighlightedStr: getMatchHighlightedStr,
                    recreateColumns: recreateColumns,
                    DEFAULT_ROW_HEIGHT: DEFAULT_ROW_HEIGHT,
                    refreshRows: refreshRows,
                    smartEmit: smartEmit,
                    doRefreshIfNeeded: doRefreshIfNeeded,
                    updateDatasummary: updateDatasummary,
                    doRefreshRawShows: doRefreshRawShows,
                    restoreShows: restoreShows,
                    updateColumnName,
                    buildSourceInfo,
                    wrapAgg,
                    wrapShow
                }
            }]
        );
    }
);
