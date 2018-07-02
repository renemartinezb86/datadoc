define(['./module', 'common', 'lodash', 'joint', 'angular', 'angular-sortable-view', 'ui-grid-move-columns'], function (directives, common, _, joint, angular) {
    'use strict';

    directives.directive('dsModel', ['$http', '$location', '$filter', '$compile', '$q', '$sce', '$templateCache', '$templateRequest', '$timeout', '$uibModal', 'HistoryService', 'WSocket', '$localStorage', 'DatadocService', '$state', '$stateParams', 'gridUtil', 'uiGridColumnMenuService', function ($http, $location, $filter, $compile, $q, $sce, $templateCache, $templateRequest, $timeout, $uibModal, HistoryService, WSocket, $localStorage, DatadocService, $state, $stateParams, gridUtil, uiGridColumnMenuService) {

        var ViewType = {
            TABLE: 0,
            LIST: 1,
            NESTED: 2
        };

        var fromHistory = false;

        return {
            restrict: 'A',
            templateUrl: 'static/templates/include/ds-model.html',
            link: function ($scope, $elm, $attr) {
                $scope.ViewType = ViewType;
                $scope.isModelLoading = false;
                var graph, paper,
                    outputNodeOffsetX = 200;
                $scope.previewGridOptions = {
                    enableColumnResize: true,
                    columnDefs: [],
                    data: [],
                    onRegisterApi: function(gridApi) {
                        $scope.gridApi = gridApi;
                        // move field for display in settings
                        gridApi.colMovable.on.columnPositionChanged($scope, $scope.endSortFieldsGrid);
                        gridApi.colResizable.on.columnSizeChanged($scope, $scope.endResizeColumn);
                    }
                };

                var refreshView = function(){
                    if($scope.currentView == ViewType.LIST) {
                        refreshListView();
                    } else if($scope.currentView == ViewType.NESTED) {
                        refreshNestedView();
                    } else {
                        $scope.gridApi.core.refresh();
                        $scope.gridApi.grid.refresh();
                    }
                };

                var sortFields = false;
                $scope.endSortFields = function (oldPosition, newPosition) {
                    sortFields = true; // because "moveColumn" calls "endSortFieldsGrid" as callback
                    $scope.gridApi.colMovable.moveColumn(oldPosition, newPosition);
                    refreshView();
                };

                $scope.endSortFieldsGrid = function (colDef, oldPos, newPos) {
                    if (!sortFields) {
                        common.moveInArray($scope.previewGridOptions.columnDefs, oldPos, newPos);
                    }
                    _.each($scope.previewGridOptions.columnDefs, function(columnDef, index){
                        var settings = _.find($scope.selectedNode.model.get('settings').columns, function(col){
                            return col.name == columnDef.originalName;
                        });
                        if(settings) settings.index = index;
                    });
                    sortFields = false;

                    if (!fromHistory) {
                        pushEndSortFieldsGrid(oldPos, newPos);
                    }
                    fromHistory = false;

                };

                $scope.endResizeColumn = function (colDef, deltaChange) {
                    if (!fromHistory) {
                        pushEndResizeColumn(colDef.originalName, deltaChange);
                    }
                    fromHistory = false;
                };

                var indexUploads = {};
                $scope.errors = [];
                $scope.getWarningText = function(){
                    return $scope.errors.length + " warning" + ($scope.errors.length > 1 ? 's' : '');
                };
                $scope.flowExecutionState = {};

                $scope.isPreviewRunning = false;
                $scope.isValidationRunning = false;
                $scope.lastPreview = undefined;
                $scope.isCommitRunning = false;
                $scope.isIndexChanged = false;
                $scope.currentTask = undefined;

                $scope.highlightError = function(id, toggle){
                    if(id) {
                        var model = graph.getCell(id);
                        if (model) {
                            var view = model.findView(paper);
                            if (toggle) {
                                view.$box.addClass('hltd-error');
                            } else {
                                view.$box.removeClass('hltd-error');
                            }
                        }
                    }
                };

                $scope.inputNodeOptions = function(){
                    return [
                        ["Reveal Source", function(scope, e) {
                            $scope.showDsSearch();
                            $scope.search(e.targetNode.model.get('view').label);
                        }],
                        ["Remove Source", function(scope, e) {
                            e.targetNode.model.remove();
                        }]
                    ];
                };

                $scope.progressBar = {
                    remainingStr: '',
                    value: 0,
                    step: 0,
                    steps: 0,
                    viewMode: function(){
                        $scope.viewMode = true;
                    }
                };
                function startFlowStatePolling(taskId){
                    $scope.currentTask = taskId;
                    $http.post('/api/flow/get_state', {taskId: taskId})
                        .success(function(task){
                            $scope.flowExecutionState = task.result;
                            var step = 0;
                            var steps = 0;
                            _.each(graph.getElements(), function(cell){
                                if(task.result && task.result.state) {
                                    var node = task.result.state[cell.id];
                                    steps++;
                                    if (node) {
                                        var view = cell.findView(paper);
                                        if(node.state == 'FINISHED'){
                                            view.$box.addClass('finished');
                                            $scope.progressBar.remainingStr = '';
                                            step++;
                                        }
                                        else if (node.state == 'RUNNING') {
                                            view.$box.addClass('running');
                                            if(_.contains(['html.OutputNode', 'html.JoinNode'], cell.get('type'))){
                                                //view.$box.find('.progress-container').show();
                                                var complete = (node.percentComplete ? node.percentComplete.toFixed(0) : 0);

                                                // todo dev estimate checker
                                                // var remainingStr = common.estimateRemainingTime($scope.progressBar.value, complete, 2000);
                                                // if (remainingStr) {
                                                //     $scope.progressBar.remainingStr = remainingStr;
                                                // }

                                                $scope.progressBar.value = complete;


                                                //view.$box.find('.progress-container .progress-bar').css('width', complete);
                                                //view.$box.find('.progress-container .percent').text(complete)
                                            }
                                        } else {
                                            view.$box.removeClass('running');
                                            //view.$box.find('.progress-container').hide();
                                        }
                                    }
                                }
                            });
                            if(step < steps) step++;
                            $scope.progressBar.step = step;
                            $scope.progressBar.steps = steps;

                            if(task.finished){
                                $http.get('/api/tables/' + $scope.selectedTable.id)
                                    .success(function(data){
                                        var indexes = DatadocService.getList(),
                                            indexToUpdate = _.findIndex(indexes, {id: data.id});
                                        if(indexToUpdate){
                                            indexes.splice(indexToUpdate, 1, data);
                                        } else {
                                            DatadocService.push(data);
                                        }
                                        $timeout(function(){
                                            if(task.statistics.lastErrorRootCauseMessage){
                                                $scope.dsErrorTask = task;
                                                var content = $compile(angular.element(
                                                        "<div>{{dsErrorTask.statistics.lastErrorRootCauseMessage | limitTo : 100}}<br/>" +
                                                        "<a ng-click='showDsErrorModal()'>Details...</a></div>")
                                                )($scope);
                                                common.showNotification(content[0], 'error', 0)
                                            } else {
                                                $scope.progressBar.isFinished = true;
                                            }
                                            $scope.isCommitRunning = false;
                                            $scope.isCancelRunning = false;
                                            $scope.progressBar.step = 0;
                                            $scope.progressBar.steps = 0;
                                            $scope.progressBar.value = 0;
                                            $scope.selectedTable.committed = new Date();
                                            _.each(graph.getElements(), function(cell){
                                                var view = cell.findView(paper);
                                                view.$box.removeClass('finished');
                                                view.$box.removeClass('running');
                                                //view.$box.find('.progress-container').hide();
                                            });
                                        });
                                    })
                            } else {
                                $timeout(function(){
                                    startFlowStatePolling(taskId);
                                }, 2000)
                            }
                        })
                        .error(common.showError)
                }
                $scope.showDsErrorModal = function(message, stacktrace){
                    $scope.dsErrorModal = $uibModal.open({
                        templateUrl: 'static/templates/include/ds-error.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    })
                };
                $scope.closeDsErrorModal = function(){
                    $scope.dsErrorModal.dismiss();
                };

                $scope.api = {
                    load: function(newTable){
                        graph.clear();
                        HistoryService.clear();

                        $scope.errors = [];
                        indexUploads = {};
                        previewRequestId = common.randomGUID();
                        _.each(newTable.uploads, function(u){
                            indexUploads[u.id] = u;
                        });
                        if(newTable.flowJSON == null){
                            return true;
                        }
                        $scope.isModelLoading = true;
                        var graphModel = JSON.parse(newTable.flowJSON);
                        $timeout(function(){
                            graph.fromJSON(graphModel);
                            var cells = graph.getCells();
                            _.each(cells, function(cell){
                                var model = graph.getCell(cell.attributes.id);
                                var settings = cell.attributes.settings;
                                var view = model.findView(paper).$box;
                                if (!_.contains(['html.Link', 'html.OutputNode'], cell.attributes.type)){
                                    if(cell.get('type') == 'html.InputNode'){
                                        var u = indexUploads[cell.get('settings').uploadId];
                                        if(u) {
                                            cell.get('view').label = u.name;
                                            cell.findView(paper).updateBox();
                                        }
                                    }
                                    fillOpsTransformList(view, model.get('settings').transforms);
                                }
                                if(cell.attributes.type == 'html.JoinNode'){
                                    addJoinSettings(settings, model, view);
                                }
                            });
                            $scope.api.validate();
                            $scope.isModelLoading = false;
                        });

                        $http.post('/api/flow/get_active_task', {tableId: newTable.id})
                            .success(function(task){
                                if(task){
                                    $scope.isCommitRunning = true;
                                    startFlowStatePolling(task.id);
                                }
                            })
                            .error(common.showError);

                        return true;
                    },
                    onChange: function(){
                        if($scope.selectedTable && $scope.selectedTable.committed)
                            $scope.isIndexChanged = true;
                        $scope.progressBar.isFinished = false;
                        setUnloadRestriction();
                        $scope.api.validate();
                    },
                    validate: function(){
                        $scope.lastValidateParams = {flowJSON: serializeGraph()};
                        doValidate();
                    },
                    preview: function(){
                        $scope.lastPreviewParams = {requestId: previewRequestId, flowJSON: serializeGraph(), rootNode: $scope.selectedNode.model.id};
                        doPreview();
                    },
                    cancel: function(){
                        $http.post('/api/flow/cancel', {taskId: $scope.currentTask})
                            .success(function(){
                                $scope.isCommitCancelling = true;
                            })
                    },
                    configureRefresh: function(){
                        $scope.updateTable().then(function(){
                            $uibModal.open({
                                controller: 'refreshSettingsCtrl',
                                templateUrl: 'static/templates/include/refresh-settings.html',
                                resolve: {
                                    indexId: function(){
                                        return $scope.selectedTable.id
                                    },
                                    refreshSettings: function(){
                                        return angular.copy($scope.selectedTable.refreshSettings);
                                    },
                                    onSuccess: function(){
                                        return function(result){
                                            $scope.selectedTable.refreshSettings = result;
                                        }
                                    }
                                }
                            })
                        })
                    },
                    commit: function(){
                        if(!$scope.selectedTable
                            || !$scope.selectedTable.id){
                            common.showError({message: 'Please select index or create new one'});
                            return;
                        }
                        $scope.isCommitRunning = true;

                        $scope.updateTable().then(function(){
                            $http.post('/api/flow/execute', {tableId: $scope.selectedTable.id})
                                .success(function(taskId){
                                    startFlowStatePolling(taskId);
                                    $scope.isIndexChanged = false;
                                    setUnloadRestriction();
                                })
                                .error(function(e){
                                    common.showError(e);
                                    $scope.isCommitRunning = false;
                                    $scope.isCancelRunning = false;
                                })
                        })
                    },
                    clear: function(){
                        graph.clear();
                    },
                    resize: function(height){
                        if(!height){
                            height = $localStorage.workspaceH;
                        }
                        if(!height || height < 400){
                            height = 400;
                        }
                        if(paper) {
                            paper.setDimensions($elm.find('#worksheet').width(), height);
                        }
                    },
                    nodes: {
                        addSources: function(us, position, suppressHistory){
                            if(!$scope.selectedTable){
                                $scope.createIndex();
                            }
                            var items = [];
                            _.forEach(us, function(u){
                                if(u.type == 'composite-ds'){
                                    _.forEach(u.sections, function(s){
                                        var item = createInputSource(s, position);
                                        items.push(item);
                                    })
                                } else if(u.type == 'ds' || u.type === 'section-ds' || u.type == 'folder') {
                                    var item = createInputSource(u, position);
                                    items.push(item);
                                }
                            });
                            return $q.all(_.map(items, function(item){
                                return addToGraph(item);
                            })).then(function(items){
                                var tmp = [];
                                _.each(items, function(i){
                                    if(_.isArray(i)){
                                        tmp = tmp.concat(i);
                                    } else {
                                        tmp.push(i);
                                    }
                                });
                                if(!suppressHistory) {
                                    pushAddNodeEvent(tmp);
                                    $scope.api.onChange();
                                }
                                return tmp;
                            });
                        },
                        addJoin: function(position, suppressHistory){
                            var item = createItem(joint.shapes.html.JoinNode, {}, {
                                '@class': '.JoinNodeSettings',
                                conditions: [{leftKey: undefined, fn: 'EQ', rightKey: undefined}],
                                transforms: [],
                                columns: []
                            }, {
                                position: position,
                                inPorts: ['in1','in2'],
                                outPorts: ['out']
                            });
                            return addToGraph(item).then(function(item){
                                if(!suppressHistory) {
                                    $scope.api.onChange();
                                    pushAddNodeEvent(item);
                                }
                                return item;
                            });
                        },

                        addUnion : function(position, suppressHistory){
                            var item = createItem(joint.shapes.html.UnionNode, {}, {
                                '@class': '.UnionNodeSettings',
                                transforms: [],
                                columns: []
                            },{
                                position: position,
                                inPorts: ['in1'],
                                outPorts: ['out']
                            });
                            return addToGraph(item).then(function(item){
                                if(!suppressHistory) {
                                    $scope.api.onChange();
                                    pushAddNodeEvent(item);
                                }
                                return item;
                            });
                        },

                        addOutput : function(position, tableId){
                            var item = createItem(joint.shapes.html.OutputNode, {}, {
                                '@class': '.OutputNodeSettings',
                                tableId: tableId,
                                transforms: [],
                                columns: []
                            }, {
                                inPorts: ['in1'],
                                position: position
                            });
                            return addToGraph(item);
                        }
                    },
                    history : {
                        hasPrev: function(){
                            return HistoryService.canUndo();
                        },
                        hasNext: function(){
                            return HistoryService.canRedo();
                        },
                        undo : function(){
                            return HistoryService.undo();
                        },
                        redo : function(){
                            return HistoryService.redo();
                        }
                    }
                };

                function pushDeleteLinkEvent(item){
                    HistoryService.push({
                        redo: function () {
                            item.remove();
                            $scope.api.onChange();
                        },
                        undo: function () {
                            addToGraph(item).then(function(){
                                $scope.api.onChange();
                            });
                        }
                    })
                }

                function pushDeleteNodeEvent(item){
                    HistoryService.push({
                        redo: function(){
                            if($scope.selectedNode && item.cid == $scope.selectedNode.model.cid)
                                removeHighlight();
                            item.remove();
                            $scope.api.onChange();
                        },
                        undo: function(){
                            addToGraph(item).then(function(){
                                $scope.api.onChange();
                            });
                        }
                    });
                }

                function pushEditJoinSettingsEvent(item, lastSettings, currentSettings){
                    HistoryService.push({
                        undo: function(){
                            item.set('settings', lastSettings);
                            $scope.api.onChange();
                        },
                        redo: function(){
                            item.set('settings', currentSettings);
                            $scope.api.onChange();
                        }
                    });
                }

                function pushMoveNodeEvent(item, lastCellPosition, currentCellPosition){
                    HistoryService.push({
                        undo: function () {
                            item.model.position(lastCellPosition.x, lastCellPosition.y);
                            addHighlight(item);
                        },
                        redo: function () {
                            item.model.position(currentCellPosition.x, currentCellPosition.y);
                            addHighlight(item);
                        }
                    });
                }

                function pushAddNodeEvent(items){
                    items = _.isArray(items) ? _.filter(items, function(item){ return item.get('type') != 'html.OutputNode'}) : [items];
                    HistoryService.push({
                        undo: function () {
                            _.each(items, function (item) {
                                item.remove()
                            })
                        },
                        redo: function () {
                            _.each(items, function (item) {
                                addToGraph(item).then(function(){
                                    $scope.api.onChange();
                                })
                            })
                        }
                    });
                }

                function pushDisableFacets(settings) {
                    HistoryService.push({
                        redo: function () {
                            settings.disableFacets = !settings.disableFacets;
                            $scope.api.preview();
                        },
                        undo: function () {
                            settings.disableFacets = !settings.disableFacets;
                            $scope.api.preview();
                        }
                    });
                }

                function pushSetAsPk(oldPkeyCol, newPkeyCol) {
                    HistoryService.push({
                        redo: function () {
                            if(!newPkeyCol.pkey) {
                                var columns = $scope.selectedNode.model.get('settings').columns;
                                _.each(columns, function (column) {
                                    column.pkey = false
                                });
                            }
                            newPkeyCol.pkey = !newPkeyCol.pkey;
                            $scope.api.preview();
                        },
                        undo: function () {

                            var columns = $scope.selectedNode.model.get('settings').columns;
                            _.each(columns, function (column) {
                                column.pkey = false
                            });

                            if (oldPkeyCol) {
                                oldPkeyCol.pkey = !oldPkeyCol.pkey;
                            }
                            $scope.api.preview();
                        }
                    });
                }

                function pushRemoveErrors(colName) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.removeErrors = !settings.removeErrors;
                            $scope.api.preview();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.removeErrors = !settings.removeErrors;
                            $scope.api.preview();
                        }
                    });
                }

                function pushCoerceToType(colName, oldType, newType) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.filter = null;
                            settings.formatSymbol = null;
                            settings.decimalPlaces = null;
                            if (typeof newType === "function") {
                                newType(settings);
                            } else {
                                settings.type = newType;
                                $scope.api.preview();
                            }
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.filter = null;
                            settings.formatSymbol = null;
                            settings.decimalPlaces = null;
                            if (typeof oldType === "function") {
                                oldType(settings);
                            } else {
                                settings.type = oldType;
                                $scope.api.preview();
                            }
                        }
                    });
                }

                function pushSetDataFormat(colName, oldData, newData) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.filter = newData.filter;
                            settings.decimalPlaces = newData.decimalPlaces;

                            refreshPreviewFromCache();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.filter = oldData.filter;
                            settings.decimalPlaces = oldData.decimalPlaces;

                            refreshPreviewFromCache();
                        }
                    });
                }

                function pushUpdatePreviewFormat(colName, oldFormat, newFormat) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.formatSymbol = newFormat.formatSymbol;
                            settings.decimalPlaces = newFormat.decimalPlaces;
                            settings.filter = newFormat.filter;
                            refreshPreviewFromCache();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);

                            settings.formatSymbol = oldFormat.formatSymbol;
                            settings.decimalPlaces = oldFormat.decimalPlaces;
                            settings.filter = oldFormat.filter;
                            refreshPreviewFromCache();
                        }
                    });
                }

                function pushUpdateColumnName(oldColName, newColName) {
                    HistoryService.push({
                        redo: function () {
                            var column = _.find($scope.gridApi.grid.columns, {displayName: oldColName});
                            column.edited = false;
                            var columnSettings = _.find($scope.selectedNode.model.get('settings').columns, {name: column.colDef.originalName});
                            columnSettings.rename = newColName;
                            column.displayName = newColName;
                            $scope.api.preview();
                        },
                        undo: function () {
                            var column = _.find($scope.gridApi.grid.columns, {displayName: newColName});
                            column.edited = false;
                            var columnSettings = _.find($scope.selectedNode.model.get('settings').columns, {name: column.colDef.originalName});
                            columnSettings.rename = oldColName;
                            column.displayName = oldColName;
                            $scope.api.preview();
                        }
                    });
                }

                function pushUpdatePreviewAnnotation(colName, oldAnnotaion, newAnnotaion) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.annotation = newAnnotaion;
                            refreshPreviewFromCache();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.annotation = oldAnnotaion;
                            refreshPreviewFromCache();
                        }
                    });

                }

                function pushUpdateReplaceErrors(colName, oldReplace, newReplace) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.replaceErrors = newReplace;
                            $scope.api.preview();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.replaceErrors = oldReplace;
                            $scope.api.preview();
                        }
                    });
                }

                function pushDeleteReplaceErrors(colName, oldReplace, newReplace) {
                    HistoryService.push({
                        redo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.replaceErrors = newReplace;
                            $scope.api.preview();
                        },
                        undo: function () {
                            var settings = getCurrentSettingsByName(colName);
                            settings.replaceErrors = oldReplace;
                            $scope.api.preview();
                        }
                    });
                }

                function pushAddTransform(item, index) {
                    HistoryService.push({
                        redo: function () {
                            if(!$scope.isIndexChanged)
                                $scope.isIndexChanged = true;
                            $scope.transformHistory.push(item);
                            fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                            $scope.api.preview();
                        },
                        undo: function () {
                            if(!$scope.isIndexChanged)
                                $scope.isIndexChanged = true;
                            $scope.transformHistory.splice(index, 1);
                            fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                            $scope.api.preview();
                        }
                    });
                }

                function pushDeleteTransform(item, index) {
                    HistoryService.push({
                        redo: function () {
                            // delete transform
                            if(!$scope.isIndexChanged)
                                $scope.isIndexChanged = true;
                            $scope.transformHistory.splice(index, 1);
                            fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                            $scope.api.preview();

                        },
                        undo: function () {
                            // add transform
                            if(!$scope.isIndexChanged)
                                $scope.isIndexChanged = true;
                            $scope.transformHistory.push(item);
                            fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                            $scope.api.preview();
                        }
                    });
                }

                function pushEndSortFieldsGrid(oldPos, newPos) {
                    HistoryService.push({
                        redo: function () {
                            fromHistory = true;
                            $scope.gridApi.colMovable.moveColumn(oldPos, newPos);
                        },
                        undo: function () {
                            fromHistory = true;
                            $scope.gridApi.colMovable.moveColumn(newPos, oldPos);
                        }
                    });
                }

                function pushEndResizeColumn(colName, deltaChange) {
                    HistoryService.push({
                        redo: function () {
                            fromHistory = true;

                            var column = _.find($scope.gridApi.grid.columns, {displayName: colName});
                            column.width = column.width + deltaChange;
                            column.hasCustomWidth = true;

                            $scope.gridApi.core.refresh();
                            $scope.gridApi.grid.refresh();
                        },
                        undo: function () {
                            fromHistory = true;

                            var column = _.find($scope.gridApi.grid.columns, {displayName: colName});
                            column.width = column.width + (~deltaChange + 1);
                            column.hasCustomWidth = true;

                            $scope.gridApi.core.refresh();
                            $scope.gridApi.grid.refresh();
                        }
                    });
                }

                function pushSelectNode(oldNode, newNode) {
                    HistoryService.push({
                        redo: function () {
                            if (!newNode) return;

                            var sourceView;
                            if (newNode.model.get('type') == 'html.OutputNode') {
                                var link = graph.getConnectedLinks(newNode.model, {inbound: true})[0];
                                if(link)
                                    sourceView = paper.findViewByModel(graph.getCell(link.get('source').id));
                            }
                            $scope.selectedNode = (sourceView || newNode);
                            var updatePreview = actualSelectedNode == null || newNode.model.id != actualSelectedNode.model.id;
                            actualSelectedNode = newNode;
                            newNode.model.toFront();
                            if(updatePreview) {

                                removeHighlight();
                                addHighlight(newNode);
                                if($scope.selectedNode.model.get('type') != 'html.OutputNode') {
                                    $scope.transformHistory = $scope.selectedNode.model.get('settings').transforms;
                                    fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                                }
                                $scope.api.preview();
                            }
                        },
                        undo: function () {
                            if (!oldNode) return;

                            var sourceView;
                            if (oldNode.model.get('type') == 'html.OutputNode') {
                                var link = graph.getConnectedLinks(oldNode.model, {inbound: true})[0];
                                if(link)
                                    sourceView = paper.findViewByModel(graph.getCell(link.get('source').id));
                            }
                            $scope.selectedNode = (sourceView || oldNode);
                            var updatePreview = actualSelectedNode == null || oldNode.model.id != actualSelectedNode.model.id;
                            actualSelectedNode = oldNode;
                            oldNode.model.toFront();
                            if(updatePreview) {

                                removeHighlight();
                                addHighlight(oldNode);
                                if($scope.selectedNode.model.get('type') != 'html.OutputNode') {
                                    $scope.transformHistory = $scope.selectedNode.model.get('settings').transforms;
                                    fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                                }
                                $scope.api.preview();
                            }
                        }
                    });
                }

                function createInputSource(u, position){
                    var type, settings;
                    indexUploads[u.id] = u;
                    if(u.type == 'folder') {
                        type = joint.shapes.html.UnionFolderNode;
                        settings = {
                            '@class': '.UnionFolderNodeSettings',
                            folderId: u.id,
                            transforms: [],
                            columns: []
                        }
                    } else {
                        type = joint.shapes.html.InputNode;
                        settings = {
                            '@class': '.InputNodeSettings',
                            uploadId: u.id,
                            transforms: [],
                            columns: []
                        }
                    }
                    return createItem(type, {label: u.name}, settings, {
                        position: position,
                        outPorts: ['out']
                    });
                }

                var delta = 0;
                function createItem(itemType, view, settings, opts){
                    var options = _.merge({
                        position: { x: 100 + delta, y: 100 + delta },
                        size: { width: 75, height: 75 },
                        view: view,
                        settings: settings,
                        z: delta
                    }, opts);
                    delta += 20;
                    if(delta > 150){
                        delta = 0;
                    }
                    return new itemType(options);
                }

                function addToGraph(item){
                     var hasOutput = _.find(graph.getElements(), function(e){
                        return e.get('type') == 'html.OutputNode';
                    });
                    var emtpyGraph = graph.getElements().length == 0;
                    var isInput = item.get('type') == 'html.InputNode';
                    return $timeout(function(){
                        item.addTo(graph);
                        item.toFront();
                        if(isInput && !hasOutput) {
                            var outPosition = {x: item.position().x + outputNodeOffsetX, y: item.position().y};
                            return $scope.api.nodes.addOutput(outPosition, $scope.selectedTable.id).then(function (out) {
                                if(emtpyGraph) {
                                    var link = new joint.shapes.html.Link({
                                        source: {
                                            id: item.id,
                                            port: 'out'
                                        },
                                        target: {
                                            id: out.id,
                                            port: 'in1'
                                        }
                                    });
                                    graph.addCell(link);
                                    $scope.api.onChange();
                                    return [item, out];
                                 }
                               });
                        } else {
                            return item;
                        }
                    });
                }

                var modelToSwitch;
                function showJoinSettingsModal(model){
                    modelToSwitch = model;
                    $scope.joinSettingsModal = $uibModal.open({
                        templateUrl: 'static/templates/include/join-settings.html;',
                        scope: $scope,
                        animation: true,
                        size: 'lg'
                    });
                }
                $scope.cancelJoinSettings = function(){
                    $scope.joinSettingsModal.dismiss();
                };
                $scope.switchJoin = function(){
                    $scope.switchNodeType(modelToSwitch);
                    $scope.joinSettingsModal.dismiss();
                };
                $scope.joinTypeSelected = function(){
                    switch($scope.joinType){
                        case 'JOIN':
                            $scope.joinParam = {type: 'join'};
                            break;
                        case 'UNION':
                            $scope.joinParam = {type: 'union', text: 'Fields will be added together based on fields name.'};
                            break;
                    }
                };

                $scope.availableJoinTypes = ['JOIN', 'UNION'];
                $scope.joinType = undefined;
                $scope.joinTypes = [
                    {name: "INNER JOIN", value: 'INNER'},
                    {name: "LEFT OUTER JOIN", value: 'LEFT_OUTER'},
                    {name: "RIGHT OUTER JOIN", value: 'RIGHT_OUTER'},
                    {name: "FULL OUTER JOIN", value: 'FULL_OUTER'}
                ];

                // todo ????
                $scope.joinLeftDs = [];
                $scope.joinRightDs = [];
                $scope.joinSettings = undefined;
                $scope.joinNode = undefined;
                $scope.joinNodeBox = undefined;
                $scope.addJoinCondition = function(){
                    $scope.joinSettings.conditions.push({leftKey: undefined, fn: 'EQ', rightKey: undefined})
                };
                $scope.removeJoinCondition = function(idx){
                    $scope.joinSettings.conditions.splice(idx, 1);
                };
                $scope.getTransformColumnNames = function(transform){
                    return transform.columnName ? common.unscreen(transform.columnName) : _.map(transform.columnNames, common.unscreen).join(', ');
                };
                $scope.saveJoinSettings = function(){
                    if(modelToSwitch != $scope.joinNode){
                        $scope.switchNodeType(modelToSwitch);
                    }
                    var lastSettings = angular.copy($scope.joinNode.get('settings'));
                    var currentSettings = angular.copy($scope.joinSettings);
                    var node = $scope.joinNode;
                    $scope.joinNode.set('settings', $scope.joinSettings);
                    $scope.api.onChange();
                    pushEditJoinSettingsEvent(node, lastSettings, currentSettings);
                    addJoinSettings(currentSettings, $scope.joinNode, $scope.joinNodeBox);
                    $scope.joinSettingsModal.dismiss();
                };
                function addJoinSettings(settings, model, view){
                    var bottomContainer = view.find('.bottom-container');
                    bottomContainer.find('.join').remove();
                    _.each($scope.joinTypes, function(join){
                        if(join.value == settings.type) {
                            var type = bottomContainer.find('#type')[0];
                            type.textContent = join.name;
                            $(type).on('click', function(e){
                                e.stopPropagation();
                                configureNode({model: model, $box: view});
                            })
                        }
                    });
                    _.each(settings.conditions, function(item, index){
                        var add = '<span class="join"><span class="add-wrap">';
                        add += index == 0? 'On ' : 'And ';
                        add += '<a class="lnk">' + item.leftKey + ' = ' + item.rightKey + '</a></span></span>';
                        bottomContainer.append(add);
                    });
                    bottomContainer.find('.join').on('click', function (e) {
                        e.stopPropagation();
                        configureNode({model: model, $box: view});
                    });
                }

                var items, lastIcon;
                var pointer = $elm.find('.arrow');
                var previewWrapper = $elm.find('.data-preview-wrapper');
                $elm.find('.toolbar-icon').draggable({
                    helper: 'clone',
                    cancel: false
                });
                function dropNode(event, ui){
                    var o = $(ui.draggable[0]);
                    var position = {
                        x: event.pageX - $(event.target).offset().left - 37,
                        y: event.pageY - $(event.target).offset().top - 37
                    };
                    switch (o.attr('id')){
                        case 'join-button':
                            return $scope.api.nodes.addJoin(position, true);
                        default:
                            var uid = o.find('input.uid').val();
                            var u = $scope.getUploadById(uid);
                            return $scope.api.nodes.addSources([u], position, true);
                    }
                }
                $elm.find("#worksheet").droppable({
                    accept: ".upload-item,.toolbar-icon",
                    //activeClass: "active",
                    hoverClass: "drop-active",
                    over: function(event, ui){
                        lastIcon = ui.helper.html();
                        ui.helper.empty();
                        // start dragging right after dropping a node to a canvas
                        dropNode(event, ui).then(function(result){
                            items = _.isArray(result) ? result : [result];
                            _.each(items, function(item){
                                var type = item.get('type');
                                if(type != 'html.Link'
                                    && type != 'html.LinkSample') {
                                    item.findView(paper).$el.find('rect').mousedown();
                                }
                            })
                        });
                    },
                    out: function(event, ui){
                        if(items && lastIcon){
                            ui.helper.html(lastIcon);
                            _.each(items, function(item){
                                item.remove();
                            });
                            items = undefined;
                        }
                    },
                    drop: function(){
                        pushAddNodeEvent(items);
                        items = undefined;
                        $scope.api.onChange();
                    }
                });

                joint.shapes.html = {};
                joint.shapes.html.Element = joint.shapes.basic.Generic.extend(_.extend({}, joint.shapes.basic.PortsModelInterface, {
                    markup: '<g class="rotatable"><g class="scalable"><rect/></g><g class="inPorts"/><g class="outPorts"/></g>',
                    inPortMarkup: '<g class="port<%= id %>"><circle/></g>',
                    outPortMarkup: '<g class="port<%= id %>"><circle/></g>',
                    defaults: joint.util.deepSupplement({
                        type: 'html.Element',
                        size: { width: 100, height: 80 },
                        inPorts: [],
                        outPorts: [],
                        attrs: {
                            '.': { magnet: false },
                            rect: {
                                stroke: 'none', 'fill-opacity': 0, width: 150, height: 250,
                            },
                            circle: {
                                r: 8, //circle radius
                                magnet: true,
                                fill: 'transparent',
                                stroke: 'transparent'
                            },

                            '.inPorts circle': { magnet: 'passive', type: 'input'},
                            '.outPorts circle': { type: 'output'}
                        }
                    }, joint.shapes.basic.Generic.prototype.defaults),

                    getPortAttrs: function (portName, index, total, selector, type) {
                        var attrs = {};
                        var portClass = 'port' + index;
                        var portSelector = selector + '>.' + portClass;
                        var portCircleSelector = portSelector + '>circle';
                        attrs[portCircleSelector] = { port: { id: portName || _.uniqueId(type), type: type } };
                        attrs[portSelector] = { ref: 'rect', 'ref-y': (index + 0.5) * (1 / total) };
                        if (selector === '.outPorts') { attrs[portSelector]['ref-dx'] = 0; }
                        return attrs;
                    }
                }));

                joint.shapes.html.Link = joint.dia.Link.extend({
                    defaults: {
                        type: 'html.Link',
                        attrs: { '.connection': { 'stroke-width': 1, stroke: '#BBB' } },
                        router: {
                            'name': 'manhattan',
                            'args': {
                                startDirections: ['left', 'right'],
                                endDirections: ['left', 'right']
                            }
                        },
                        connector: { name: 'rounded', args: { radius: 10 }}
                        //smooth: true
                    },
                    markup: [
                        '<path class="connection"/>',
                        '<path class="connection-wrap"/>',
                        '<g class="labels"/>',
                        '<g class="link-tools" opacity="0"/>'
                    ].join(''),
                    toolMarkup: [
                        '<g class="link-tool">',
                        '<g class="tool-remove" event="remove">',
                        '<circle id="outer" r="11" fill="white"/>',
                        '<circle id="inner" r="9" fill="white"/>',
                        '<line id="line" x1="-5" x2="5" y1="0" y2="0" stroke="white" stroke-width="2" stroke-linecap="round"/>',
                        '<title>Remove link.</title>',
                        '</g>',
                        '</g>'
                    ].join('')
                });
                joint.shapes.html.LinkSample = joint.dia.Link.extend({
                    defaults: {
                        type: 'html.LinkSample',
                        attrs: { '.connection': { 'stroke-width': 1, stroke: '#CCC', 'stroke-dasharray': '3, 2' } },
                        router: {
                            'name': 'manhattan',
                            'args': {
                                startDirections: ['left', 'right'],
                                endDirections: ['left', 'right']
                            }
                        },
                        connector: { name: 'rounded', args: { radius: 10 }}
                    }
                });

                joint.shapes.html.InputNode = joint.shapes.html.Element.extend({
                    defaults: joint.util.deepSupplement({
                        type: 'html.InputNode'
                    }, joint.shapes.html.Element.prototype.defaults)
                });
                joint.shapes.html.UnionFolderNode = joint.shapes.html.Element.extend({
                    defaults: joint.util.deepSupplement({
                        type: 'html.UnionFolderNode'
                    }, joint.shapes.html.Element.prototype.defaults)
                });
                joint.shapes.html.OutputNode = joint.shapes.html.Element.extend({
                    defaults: joint.util.deepSupplement({
                        type: 'html.OutputNode'
                    }, joint.shapes.html.Element.prototype.defaults)
                });
                joint.shapes.html.JoinNode = joint.shapes.html.Element.extend({
                    defaults: joint.util.deepSupplement({
                        type: 'html.JoinNode'
                    }, joint.shapes.html.Element.prototype.defaults)
                });
                joint.shapes.html.UnionNode = joint.shapes.html.Element.extend({
                    defaults: joint.util.deepSupplement({
                        type: 'html.UnionNode'
                    }, joint.shapes.html.Element.prototype.defaults)
                });

                $scope.switchNodeType = function(model){
                    var position = model.attributes.position;
                    var type = model.attributes.type;
                    model.remove();
                    var factoryFn;
                    if(type == "html.JoinNode") {
                        factoryFn = $scope.api.nodes.addUnion;
                    } else if(type == "html.UnionNode") {
                        factoryFn = $scope.api.nodes.addJoin;
                    }
                    if(factoryFn){
                        factoryFn(position, true).then(function(item){
                            $scope.api.onChange();
                            HistoryService.push({
                                redo: function(){
                                    model.remove();
                                    addToGraph(item);
                                    $scope.api.onChange();
                                },
                                undo: function(){
                                    item.remove();
                                    addToGraph(model);
                                    $scope.api.onChange();
                                }
                            });
                        })
                    }
                };

                joint.shapes.html.LinkView = joint.dia.LinkView.extend({
                    updateToolsPosition: function () {

                        if (!this._V.labels) return this;

                        var scale = '';
                        var offset = this.getConnectionLength()/2;
                        var connectionLength = this.getConnectionLength();

                        if (!_.isNaN(connectionLength)) {

                            if (connectionLength < this.options.shortLinkLength) {
                                scale = 'scale(.5)';
                            }

                            var toolPosition = this.getPointAtLength(offset);

                            this._toolCache.attr('transform', 'translate(' + toolPosition.x + ', ' + toolPosition.y + ') ' + scale);

                            if (this.options.doubleLinkTools && connectionLength >= this.options.longLinkLength) {

                                var doubleLinkToolsOffset = this.options.doubleLinkToolsOffset || offset;

                                toolPosition = this.getPointAtLength(connectionLength - doubleLinkToolsOffset);
                                this._tool2Cache.attr('transform', 'translate(' + toolPosition.x + ', ' + toolPosition.y + ') ' + scale);
                                this._tool2Cache.attr('visibility', 'visible');

                            } else if (this.options.doubleLinkTools) {

                                this._tool2Cache.attr('visibility', 'hidden');
                            }
                        }

                        return this;
                    }
                });
                joint.shapes.html.LinkSampleView = joint.dia.LinkView.extend({});
                joint.shapes.html.ElementView = joint.dia.ElementView.extend({

                    initialize: function() {
                        _.bindAll(this, 'updateBox');
                        //this.listenTo(this.model, 'process:ports', this.update);
                        joint.dia.ElementView.prototype.initialize.apply(this, arguments);

                        this.$box = $(_.template(arguments[1])());
                        this.$box.append(
                            '<div class="progress-container">' +
                            '<div class="percent"></div>' +
                            '<div class="progress" style="margin-bottom: 0;">' +
                            '<div class="progress-bar" role="progressbar" style="width: 0"></div>' +
                            '</div>' +
                            '</div>');
                        var model = this.model;
                        if(model.get('type') != 'html.OutputNode') {
                            var template = $templateCache.get(common.getFullTemplateName('worksheet/ops-node'));
                            this.$box.append(template);
                        }
                        this.$box.find('.switch').on('click', function(){
                            $scope.switchNodeType(model);
                        });
                        this.$box.find('.delete').on('click', _.bind(function(){
                            if($scope.selectedNode && model.cid == $scope.selectedNode.model.cid)
                                removeHighlight();
                            model.remove.call(model);
                            pushDeleteNodeEvent(model)
                        }));
                        // Update the box position whenever the underlying model changes.
                        this.model.on('change', this.updateBox, this);
                        // Remove the box when the model gets removed from the graph.
                        this.model.on('remove', this.removeBox, this);

                        this.updateBox();

                        var settings = this.model.get('settings');
                        if(settings.uploadId) {
                            var u = indexUploads[settings.uploadId];
                            if(u.descriptor && _.contains(['CSV', 'XLS_SHEET', 'XLSX_SHEET'], u.descriptor.format)){
                                var startOnRowLabel = this.$box.find('.start-on-row');
                                var refreshStartOnRowLabel = function(row){
                                    startOnRowLabel.find('.lnk').text('Row ' + row);
                                };
                                if(startOnRowLabel.length > 0){
                                    var rowSpan = this.$box.find('.row-text');
                                    startOnRowLabel.show();
                                    rowSpan.show();
                                    refreshStartOnRowLabel(u.descriptor.settings.startOnRow);
                                    startOnRowLabel.find('.lnk')
                                        .on('click', function(){
                                            $scope.$apply(function(){
                                                if(u.descriptor.format == 'CSV'){
                                                    $scope.editCsvSettings(u, function(upload){
                                                        u.descriptor = upload.descriptor;
                                                        refreshStartOnRowLabel(upload.descriptor.settings.startOnRow);
                                                    });
                                                } else {
                                                    $scope.editXlsSettings(u, function(upload){
                                                        u.descriptor = upload.descriptor;
                                                        refreshStartOnRowLabel(upload.descriptor.settings.startOnRow);
                                                    });
                                                }
                                            });
                                        });
                                }
                                var useHeadersLabel = this.$box.find('.use-headers');
                                var refreshUseHeadersLabel = function(useHeaders){
                                    if(useHeaders){
                                        useHeadersLabel.find('.lnk').text('Use Headers');
                                    } else {
                                        useHeadersLabel.find('.lnk').text('Skip Headers')
                                    }
                                };
                                if(useHeadersLabel.length > 0) {
                                    useHeadersLabel.show();
                                    refreshUseHeadersLabel(u.descriptor.settings.useHeaders);
                                    useHeadersLabel.find('.lnk')
                                        .on('click', function () {
                                            $scope.$apply(function(){
                                                if(u.descriptor.format == 'CSV'){
                                                    $scope.editCsvSettings(u, function(upload){
                                                        u.descriptor = upload.descriptor;
                                                        refreshUseHeadersLabel(upload.descriptor.settings.useHeaders);
                                                    });
                                                } else {
                                                    $scope.editXlsSettings(u, function(upload){
                                                        u.descriptor = upload.descriptor;
                                                        refreshUseHeadersLabel(upload.descriptor.settings.useHeaders);
                                                    });
                                                }
                                            })
                                        });
                                }
                            }
                        }
                    },
                    render: function() {
                        joint.dia.ElementView.prototype.render.apply(this, arguments);
                        this.paper.$el.prepend(this.$box);
                        this.updateBox();
                        return this;
                    },
                    update: function(){
                        this.renderPorts();
                        joint.dia.ElementView.prototype.update.apply(this, arguments);
                    },
                    updateBox: function() {
                        // Set the position and dimension of the box so that it covers the JointJS element.
                        var bbox = this.model.getBBox();
                        // Example of updating the HTML with a data stored in the cell model.
                        this.$box.find('.lbl').text(this.model.get('view').label);
                        this.$box.css({ width: bbox.width, height: bbox.height, left: bbox.x, top: bbox.y, transform: 'rotate(' + (this.model.get('angle') || 0) + 'deg)', 'z-index': 100 + this.model.get('z')});
                    },
                    removeBox: function(evt) {
                        this.$box.remove();
                    },
                    renderPorts: function() {
                        var $inPorts = this.$('.inPorts').empty();
                        var $outPorts = this.$('.outPorts').empty();

                        var outPortTemplate = _.template(this.model.outPortMarkup);
                        var inPortTemplate = _.template(this.model.inPortMarkup);

                        _.each(_.filter(this.model.ports, function(p) { return p.type === 'in'; }), function(port, index) {
                            $inPorts.append(joint.V(inPortTemplate({ id: index, port: port })).node);
                        });
                        _.each(_.filter(this.model.ports, function(p) { return p.type === 'out'; }), function(port, index) {
                            $outPorts.append(joint.V(outPortTemplate({ id: index, port: port })).node);
                        });
                    }
                });

                joint.shapes.html.InputNodeView = joint.shapes.html.ElementView.extend({
                    initialize: function() {
                        var template = $templateCache.get(common.getFullTemplateName('worksheet/input-node'));
                        var args = Array.prototype.slice.call(arguments);
                        joint.shapes.html.ElementView.prototype.initialize.apply(this, args.concat([template]));
                    }
                });
                joint.shapes.html.UnionFolderNodeView = joint.shapes.html.ElementView.extend({
                    initialize: function() {
                        var template = $templateCache.get(common.getFullTemplateName('worksheet/union-folder-node'));
                        var args = Array.prototype.slice.call(arguments);
                        joint.shapes.html.ElementView.prototype.initialize.apply(this, args.concat([template]));
                    }
                });
                joint.shapes.html.OutputNodeView = joint.shapes.html.ElementView.extend({
                    initialize: function() {
                        var template = $templateCache.get(common.getFullTemplateName('worksheet/output-node'));
                        var args = Array.prototype.slice.call(arguments);
                        joint.shapes.html.ElementView.prototype.initialize.apply(this, args.concat([template]));
                    }
                });
                joint.shapes.html.JoinNodeView = joint.shapes.html.ElementView.extend({
                    initialize: function() {
                        var template = $templateCache.get(common.getFullTemplateName('worksheet/join-node'));
                        var args = Array.prototype.slice.call(arguments);
                        joint.shapes.html.ElementView.prototype.initialize.apply(this, args.concat([template]));

                        var that = this;
                        this.$box.find('.bottom-container').on('click', function (e) {
                            e.stopPropagation();
                            configureNode({model: that.model, $box: that.$box});
                        })
                    }
                });
                joint.shapes.html.UnionNodeView = joint.shapes.html.ElementView.extend({
                    initialize: function() {
                        var template = $templateCache.get(common.getFullTemplateName('worksheet/union-node'));
                        var args = Array.prototype.slice.call(arguments);
                        joint.shapes.html.ElementView.prototype.initialize.apply(this, args.concat([template]));
                    }
                });
                joint.dia.Worksheet = joint.dia.Paper.extend({
                    pointermove: function(evt) {
                        evt.preventDefault();
                        evt = joint.util.normalizeEvent(evt);
                        var localPoint = this.snapToGrid({ x: evt.clientX, y: evt.clientY });
                        if (this.sourceView) {

                            // Mouse moved counter.
                            this._mousemoved++;
                            this.sourceView.pointermove(evt, localPoint.x, localPoint.y);
                        }
                        this.trigger('pointermove', evt, localPoint.x, localPoint.y);
                    }
                });

                graph = new joint.dia.Graph;
                paper = new joint.dia.Worksheet({
                    el: $elm.find('#worksheet'),
                    gridSize: 10,
                    model: graph,
                    linkPinning: false,
                    snapLinks: {radius: 30},
                    interactive: function(cellView) {
                        if (cellView.model instanceof joint.dia.Link) {
                            // Disable the default vertex add functionality on pointerdown.
                            return { vertexAdd: false };
                        }
                        return true;
                    },
                    defaultLink: new joint.shapes.html.Link,
                    validateConnection: function(cellViewS, magnetS, cellViewT, magnetT, end, linkView) {

                        var links = graph.getLinks();
                        if(!_.contains(cellViewT.el.classList, 'UnionNode')){
                            for (var i = 0; i < links.length; i++)
                            {
                                if(linkView == links[i].findView(paper)) //Skip the wire the user is drawing
                                    continue;
                                if ( (( cellViewT.model.id  == links[i].get('source').id ) && ( magnetT.getAttribute('port') == links[i].get('source').port)) ||
                                    (( cellViewT.model.id  == links[i].get('target').id ) && ( magnetT.getAttribute('port') == links[i].get('target').port)) ){
                                    return false;
                                }
                            }
                        }
                        // Prevent linking from input ports.
                        if (magnetS && magnetS.getAttribute('type') === 'input') return false;
                        // Prevent linking from output ports to input ports within one element.
                        if (cellViewS === cellViewT) return false;
                        // Prevent linking to input ports.
                        return magnetT && magnetT.getAttribute('type') === 'input';
                    },
                    validateMagnet: function(cellView, magnet) {
                        var links = graph.getLinks();
                        // From a single port only one link can be spawned.
                        for (var i = 0; i < links.length; i++){
                            if( (( cellView.model.id  == links[i].get('source').id ) && ( magnet.getAttribute('port') == links[i].get('source').port) )||
                                (( cellView.model.id  == links[i].get('target').id ) && ( magnet.getAttribute('port') == links[i].get('target').port) ))
                                return false;
                        }
                        // Note that this is the default behaviour. Just showing it here for reference.
                        // Disable linking interaction for magnets marked as passive (see below `.inPorts circle`).
                        return magnet.getAttribute('magnet') !== 'passive';
                    }

                });

                $scope.api.resize();

                paper.on('blank:contextmenu', function(evt){
                    evt.preventDefault();
                });

                paper.on('cell:contextmenu', function(cellView, evt){
                    evt.preventDefault();
                    if(!cellView.model.isLink()) {
                        if(cellView.model.get('type') == 'html.InputNode'){
                            $scope.$apply(function () {
                                var options = $scope.inputNodeOptions();
                                event.targetNode = cellView;
                                common.renderContextMenu($scope, event, options);
                            });
                        }
                    }
                });

                function removeHighlight(){
                    $scope.columnsListMenu.isOpen = false;
                    $scope.transformHistory = undefined;
                    $scope.previewSettings = undefined;
                    $scope.previewGridOptions = {
                        enableColumnResize: true,
                        columnDefs: [],
                        data: []
                    };
                    pointer.hide();
                    _.each(graph.getElements(), function(e){
                        var view = paper.findViewByModel(e);
                        view.$box.removeClass('hltd');
                    });
                }
                function addHighlight(cellView){
                    var bbox = cellView.model.getBBox();
                    var color = cellView.$box.css('background-color');
                    cellView.$box.addClass('hltd');
                    var heightWithBottomContainer = cellView.$box.height() + cellView.$box.find('.bottom-container').height() + 15;
                    pointer.css('left', (bbox.x + bbox.width / 2) + 'px');
                    pointer.css('top', (bbox.y + heightWithBottomContainer) + 'px');
                    pointer.show();
                    pointer.find('.head .inner').css('border-color', 'transparent transparent ' + color + ' transparent');
                    pointer.find('.body').css('background-color', color);
                    previewWrapper.css('background-color', color);
                }

                //paper.on('blank:pointerclick', function(evt, x, y){
                //    removeHighlight();
                //    $scope.selectedNode = undefined;
                //    actualSelectedNode = undefined;
                //    refreshPreview({data: []});
                //});

                paper.on('cell:pointerclick', function(cellView, evt, x, y){
                    if (!cellView.model.isLink()) {
                        var sourceView;
                        if (cellView.model.get('type') == 'html.OutputNode') {
                            var link = graph.getConnectedLinks(cellView.model, {inbound: true})[0];
                            if(link)
                                sourceView = paper.findViewByModel(graph.getCell(link.get('source').id));
                        }
                        var oldNode = $scope.selectedNode;
                        $scope.selectedNode = (sourceView || cellView);
                        var updatePreview = actualSelectedNode == null || cellView.model.id != actualSelectedNode.model.id;
                        actualSelectedNode = cellView;
                        cellView.model.toFront();
                        if(updatePreview) {

                            removeHighlight();
                            addHighlight(cellView);
                            if($scope.selectedNode.model.get('type') != 'html.OutputNode') {
                                $scope.transformHistory = $scope.selectedNode.model.get('settings').transforms;
                                fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                            }
                            $scope.api.preview();
                            pushSelectNode(oldNode, $scope.selectedNode);
                        }
                    }
                });

                var lastPosition;
                paper.on('cell:pointerdown', function(cellView, evt, x, y){
                    if(!cellView.model.isLink()) {
                        lastPosition = cellView.model.position();
                    } else {
                        var targetParentEvent = evt.target.parentNode.getAttribute('event');
                        if (targetParentEvent) {
                            if (targetParentEvent === 'remove') {
                                pushDeleteLinkEvent(cellView.model);
                            }
                        }
                    }
                });
                paper.on('cell:pointerup', function(cellView, evt, x, y){
                    if(!cellView.model.isLink()) {
                        var lastCellPosition = lastPosition,
                            currentCellPosition = cellView.model.position();
                        if (lastCellPosition.x != currentCellPosition.x
                            || lastCellPosition.y != currentCellPosition.y) {
                            if(!items) {
                                pushMoveNodeEvent(cellView, lastCellPosition, currentCellPosition);
                            }
                        }
                        _.each(graph.getLinks(), function(link){
                            if(link.get('type') == 'html.LinkSample'){
                                link.remove();
                                var newLink = new joint.shapes.html.Link({
                                    source: link.get('source'),
                                    target: link.get('target')
                                });
                                graph.addCell(newLink);
                                var model = graph.getCell(newLink.get('target').id);
                                if(model.get('type') == 'html.JoinNode')
                                    getJoinNodeInPorts(model, evt);
                                $scope.api.onChange();
                            }
                        })
                    }
                    else if(cellView.targetView && cellView.targetView.model.get('type') == 'html.JoinNode'){
                        getJoinNodeInPorts(cellView.targetView.model, evt);
                    }
                });
                paper.on('cell:mouseover', function(cellView, evt){
                    if (!cellView.model.isLink()) {
                        cellView.$box.find('a.delete')
                            .css('color', '#CBCBCB')
                            .hover(function () {
                                $(this).css('color', '#CBCBCB').css('text-decoration', 'underline')
                            }, function () {
                                $(this).css('color', '#CBCBCB').css('text-decoration', 'none')

                            });
                    }
                });
                paper.on('cell:mouseout', function(cellView, evt){
                    if (!cellView.model.isLink()) {
                        cellView.$box.find('a.delete').css('color', 'transparent');
                    }
                });
                paper.off('cell:highlight');
                paper.off('cell:unhighlight');
                paper.on('cell:highlight', function(cellView, evt){
                    var portNumber = $(evt).attr('port');
                    if(portNumber == 'in1')
                    {
                        if(cellView.$box.find('.in-port-1').length)
                            cellView.$box.find('.in-port-1').addClass('highlight');
                        else
                            cellView.$box.find('.in-port').addClass('highlight');
                    }
                    else if(portNumber == 'in2')
                    {
                        cellView.$box.find('.in-port-2').addClass('highlight');
                    }
                });
                paper.on('cell:unhighlight', function(cellView, evt){
                    cellView.$box.find('.highlight').removeClass('highlight');
                });

                function getJoinNodeInPorts(model, e){
                    var links = graph.getConnectedLinks(model, {inbound: true});
                    if(links.length == 2 && _.all(links, function(link){ return link.get('type') == 'html.Link' } )) {
                        e.stopPropagation();
                        configureNode({model: model, $box: model.findView(paper).$box});
                    }
                }
                function getFreePorts(cell, opts){
                    var view = cell.findView(paper);
                    if(!view) return [];
                    var nonAvailablePorts = _(graph.getConnectedLinks(cell, opts))
                        .map(function(link){
                            var unlimitedInPort = false;
                            if(cell.get('type') == 'html.UnionNode'){
                                unlimitedInPort = true;
                            }
                            if(opts.outbound && (!unlimitedInPort && opts.inbound)) {
                                return [link.get('source').port, link.get('target').port];
                            } else if (opts.outbound){
                                return link.get('source').port;
                            } else if (!unlimitedInPort && opts.inbound) {
                                return link.get('target').port;
                            }
                        }).flatten().value();

                    return _(cell.ports).filter(function(port){
                        return ((opts.inbound && port.type === 'in') || (opts.outbound && port.type == 'out'))
                            && !_.contains(nonAvailablePorts, port.id);
                    }).map(function(port, idx){
                        var baseClass = port.type + 'Ports', className = 'port' + idx;
                        return {cell: cell, port: port, portView: view.$('.' + baseClass + '>.' + className)[0]}
                    }).value();
                }

                function tryCreateSampleLink(outPorts, inPorts){
                    var connected = false;
                    _.each(outPorts, function(outPort){
                        var bbox = joint.util.getElementBBox(outPort.portView);
                        var currentPortRect = joint.g.rect(bbox.x, bbox.y, bbox.width, bbox.height);
                        var currentPortCenter = currentPortRect.center();

                        _.each(inPorts, function(inPort){
                            bbox = joint.util.getElementBBox(inPort.portView);
                            var availablePortRect = joint.g.rect(bbox.x, bbox.y, bbox.width, bbox.height);
                            var availablePortCenter = availablePortRect.center();
                            var distance = currentPortCenter.distance(availablePortCenter);
                            if (distance < linkSampleThreshold) {
                                graph.addCell(new joint.shapes.html.LinkSample({
                                    source: {
                                        id: outPort.cell.id,
                                        port: outPort.port.id
                                    },
                                    target: {
                                        id: inPort.cell.id,
                                        port: inPort.port.id
                                    }
                                }));
                                connected = true;
                                return false;
                            }
                        });
                        if(connected){
                            return false;
                        }
                    });
                }

                var linkSampleThreshold = 140;
                paper.on('pointermove', function(evt, x, y){
                    if(items){
                        _.each(items, function(item){
                            var type = item.get('type');

                            if(type != 'html.Link'
                                && type != 'html.LinkSample') {
                                if(type == 'html.OutputNode'){
                                    item.position(x - 40 + outputNodeOffsetX, y - 40);
                                } else {
                                    item.position(x - 40, y - 40);
                                }
                            }
                        })
                    }
                });
                paper.on('cell:pointermove', function(cellView) {

                    // remove link to farther elements
                    var links = graph.getConnectedLinks(cellView.model);
                    _.forEach(links, function(link){
                        if(link.get('type') == 'html.LinkSample') {
                            var distance = paper.findViewByModel(link).getConnectionLength();
                            if (distance > linkSampleThreshold + 10) {
                                link.remove();
                            }
                        }
                    });
                    if(actualSelectedNode && actualSelectedNode.model.id == cellView.model.id){
                        addHighlight(cellView);
                    }

                    // create links to nearest elements from output port
                    var currentOutPorts = getFreePorts(cellView.model, {outbound: true});
                    var availableInPorts = _(graph.getElements())
                        .filter(function(cell){ return cell.id != cellView.model.id})
                        .map(function(cell){
                            return getFreePorts(cell, {inbound: true});
                        }).flatten().value();
                    tryCreateSampleLink(currentOutPorts, availableInPorts);

                    // create links from nearest elements to input port
                    var currentInPorts = getFreePorts(cellView.model, {inbound: true});
                    var availableOutPorts = _(graph.getElements())
                        .filter(function(cell){ return cell.id != cellView.model.id})
                        .map(function(cell) {
                            return getFreePorts(cell, {outbound: true});
                        }).flatten().value();
                    tryCreateSampleLink(availableOutPorts, currentInPorts);
                });

                graph.on('change:source change:target', function(link) {
                    if(link.get('type') != 'html.LinkSample') {
                        if (link.get('source').id && link.get('target').id) {
                            $scope.api.onChange();
                        }
                    }
                });
                graph.on('remove', function(cell){
                    if (!cell.isLink()) {
                        if($scope.selectedNode && cell.id == $scope.selectedNode.model.id) {
                            $scope.selectedNode = undefined;
                            actualSelectedNode = undefined;
                        }
                        var elements = graph.getElements();
                        if(elements.length == 1 && elements[0].get('type') == 'html.OutputNode'){
                            var out = elements[0];
                            if($scope.selectedNode)
                                removeHighlight();
                            out.remove();
                        }
                    }
                    $scope.api.onChange();
                });

                function configureNode(cellView) {
                    if(!cellView.model.isLink()){
                        var e = cellView.model;
                        if(e.get('type') == 'html.JoinNode') {

                            $scope.joinNode = e;
                            $scope.joinNodeBox = cellView.$box;
                            $scope.joinSettings = angular.copy(e.get('settings'));

                            var links = graph.getConnectedLinks(e, {inbound: true});
                            var leftL, rightL;
                            if (links[0] && links[0].get('target')) {
                                if (links[0].get('target').port == 'in1') {
                                    leftL = links[0];
                                } else {
                                    rightL = links[0];
                                }
                            }
                            if(links[1] && links[1].get('target')){
                                if(links[1].get('target').port == 'in0'){
                                    leftL = links[1];
                                } else {
                                    rightL = links[1];
                                }
                            }

                            if(leftL){
                                $http.post('/api/flow/columns', {flowJSON: serializeGraph(), rootNode: leftL.get('source').id})
                                    .success(function(data){
                                        $scope.joinLeftDs = data;
                                    })
                                    .error(common.showError);
                            }
                            if(rightL){
                                $http.post('/api/flow/columns', {flowJSON: serializeGraph(), rootNode: rightL.get('source').id})
                                    .success(function(data){
                                        $scope.joinRightDs = data;
                                    })
                                    .error(common.showError);
                            }
                            $scope.joinParam = {type: 'join'};
                            $scope.joinType = 'JOIN';
                            showJoinSettingsModal(e);
                        }
                        else if(e.get('type') == 'html.UnionNode'){
                            $scope.joinParam = {type: 'union', text: 'Fields will be added together based on fields name.'};
                            $scope.joinType = 'UNION';
                            showJoinSettingsModal(e);
                        }
                    }
                }

                function fillOpsTransformList(node, transforms) {
                    var nodeOps = node.find('.ops-node');
                    nodeOps.find('div.add').remove();
                    _.each(transforms, function (item, iter) {
                        var transform;
                        if (iter == 5) {
                            transform = '<div class="add"> + ' + (transforms.length - 5) + ' more ops</div>';
                            nodeOps.find('.ops-bottom-container').append(transform);
                        } else if (iter < 5) {
                            transform = '<div class="add">&bull; ' + item.title.toUpperCase() + ' for ' + $scope.getTransformColumnNames(item) + '</div>';
                            nodeOps.find('.ops-bottom-container').append(transform);
                        }
                    });
                    nodeOps.find('.ops-node-text')[0].textContent = transforms.length + ' Ops';
                    if (nodeOps.is(':hidden') && transforms.length)
                        nodeOps.show();
                    else if(!transforms.length)
                        nodeOps.hide();
                }

                $scope.transformHistory = [];
                $scope.addTransform = function(item){
                    if(!$scope.isIndexChanged)
                        $scope.isIndexChanged = true;
                    $scope.transformHistory.push(item);
                    fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                    $scope.api.preview();

                    var index = $scope.transformHistory.length - 1;
                    pushAddTransform(item, index);
                };

                $scope.deleteTransform = function(i){
                    var itemCopy = angular.copy($scope.transformHistory[i]);

                    if(!$scope.isIndexChanged)
                        $scope.isIndexChanged = true;
                    $scope.transformHistory.splice(i, 1);
                    fillOpsTransformList($scope.selectedNode.$box, $scope.transformHistory);
                    $scope.api.preview();

                    pushDeleteTransform(itemCopy, i);
                };

                $scope.updateColumnName = function(column){
                    column.edited = false;
                    var columnSettings = _.find($scope.selectedNode.model.get('settings').columns, {name: column.colDef.originalName});
                    var oldColName = column.displayName;
                    columnSettings.rename = column.rename;
                    column.displayName = column.rename;
                    $scope.api.preview();

                    // todo: retreive column name instead of object
                    pushUpdateColumnName(oldColName, column.displayName);
                };

                $scope.getCurrentSettingsByName = getCurrentSettingsByName;

                $scope.keydownColumnName = function(column, event){
                    if (event.which == 27) {
                        column.rename = column.displayName;
                        event.target.blur();
                        event.preventDefault();
                        event.stopPropagation();
                    } else if(event.which == 13){
                        column.edited = false;
                        event.target.blur();
                        event.preventDefault();
                        event.stopPropagation();
                    }
                };

                function getCurrentSettingsByName(originalName){
                    return _.find($scope.selectedNode.model.get('settings').columns, function(column){ return column.name == originalName})
                }

                function rowTransform(item){
                    return {
                        title: item.title,
                        icon: 'fa fa-fw',
                        action: function(){
                            var columnName = this.context.col.colDef.originalName;
                            $scope.addTransform(_.merge(item, {columnName: columnName}));
                        }
                    };
                }
                function addSeparator(){
                    return{
                        isSeparator: true
                    };
                }
                function renameColumn(){
                    return {
                        title: "Rename…",
                        icon: 'fa fa-fw',
                        action: function(){
                            var that = this;
                            this.context.col.edited = this;
                            this.context.col.rename = this.context.col.displayName;
                            $timeout(function(){ $('.data-preview').find('#' + that.context.col.grid.id + '-' + that.context.col.uid + '-new-name')[0].focus() });
                        }
                    }
                }
                function convertToListColumn(selected) {
                    return{
                        title: "Convert to list...",
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.showConvertToListModal(settings);
                        }
                    }
                }
                function preserveHistoryColumn(selected) {
                    function getIcon(selected) { return selected ? 'fa fa-fw fa-check' : 'fa fa-fw'; }
                    var m = {
                        title: "Preserve History…",
                        icon: getIcon(selected),
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.showPreserveHistoryModal(settings, m);
                        }
                    };
                    return m;
                }
                function annotateColumn(){
                    return{
                        title: "Annotate…",
                        icon: 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.showAnnotationModal(settings);
                        }
                    }
                }
                function distinctColumn(columns){
                    return{
                        title: "Deduplicate…",
                        icon: 'fa fa-fw',
                        action: function(){
                            $scope.showDistinctModal(columns, this.context.col.colDef.originalName);
                        }
                    }
                }
                function facets(isEnabled){
                    return{
                        title: "Disable facets",
                        icon: isEnabled? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            settings.disableFacets = !settings.disableFacets;
                            pushDisableFacets(settings);
                            $scope.api.preview();
                        }
                    }
                }
                function setAsPk(isPk){
                    return {
                        title: "Set As Primary Key",
                        icon: isPk ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            var previousPkeyColumn;

                            if(!settings.pkey) {
                                var columns = $scope.selectedNode.model.get('settings').columns;
                                _.each(columns, function (column) {
                                    if (column.pkey) {
                                        previousPkeyColumn = column;
                                    }
                                    column.pkey = false
                                });
                            }
                            settings.pkey = !settings.pkey;
                            $scope.api.preview();

                            pushSetAsPk(previousPkeyColumn, settings);
                        }
                    }
                }
                function formatCurrency(selected){
                    return{
                        title: "Currency…",
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.showFormatModal(settings);
                        }
                    }
                }
                function coerceToFormat(title, format, selected){
                    return{
                        title: title,
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function() {
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.setDataFormat(settings, format)
                        }
                    }
                }
                function deleteFormats(selected){
                    return{
                        title: "Automatic",
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.setDataFormat(settings)
                        }
                    }
                }
                function coerceToType(title, typeOrAction, selected){
                    return {
                        title: title,
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            settings.filter = null;
                            settings.formatSymbol = null;
                            settings.decimalPlaces = null;

                            var oldTypeOrAction = angular.copy(settings.type);
                            var newTypeOrAction = angular.copy(typeOrAction);

                            if (typeof typeOrAction === "function") {
                                typeOrAction(settings);
                            } else {
                                settings.type = typeOrAction;
                                if(settings.type.dataType == 'STRING') {
                                    settings.searchType = 'EDGE';
                                } else {
                                    settings.searchType = 'NONE'
                                }
                                $scope.api.preview();
                                pushCoerceToType(this.context.col.colDef.originalName, oldTypeOrAction, newTypeOrAction, settings);
                            }

                        }
                    }
                }

                function removeErrors(selected){
                    return {
                        title: 'Remove Errors',
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            settings.removeErrors = !settings.removeErrors;
                            $scope.api.preview();

                            pushRemoveErrors(settings.name);
                        }
                    }
                }

                function replaceErrors(selected){
                    return {
                        title: 'Replace Errors…',
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            $scope.showReplaceErrorsModal(settings);
                        }
                    }
                }

                function searchType(title, type, selected) {
                    return{
                        title: title,
                        icon: selected ? 'fa fa-fw fa-check' : 'fa fa-fw',
                        action: function(){
                            var settings = getCurrentSettingsByName(this.context.col.colDef.originalName);
                            settings.searchType = type;
                            refreshPreviewFromCache();
                        }
                    }
                }

                function getVisibility(originalName){
                    var settings = getCurrentSettingsByName(originalName);
                    return settings ? !settings.removed : true
                }

                $scope.getValueType = function(value){
                    if(value == null || value == undefined){
                        return 'null';
                    } else if (value.type && value.type == 'ERROR'){
                        return 'error';
                    }
                    return 'default';
                };

                $scope.isArray = function(value){
                    return _.isArray(value)
                };

                $scope.wrapArray = function(value){
                    return _.isArray(value) ? value : [value];
                };

                function getCellTemplate(field, settings){
                    field = field
                        // todo get rid of that
                        .split('<').join('&lt;')
                        .split('>').join('&gt;')
                        .split('\\').join('\\\\');
                    var basicTemplate = "";//common.uiGridBasicCellTemplate;
                    var params = { field: field, before: null, after: null, filters: null };
                    switch(settings.filter){
                        case 'financial':
                            params.filters = '| financialFilter';
                            break;
                        case 'currency':
                            params.before = settings.formatSymbol;
                            params.filters = '| number:' + (settings.decimalPlaces || 0);
                            break;
                        case 'number':
                            params.filters = '| number:' + settings.decimalPlaces;
                            break;
                        case 'percent':
                            params.after = '%';
                            params.filters = '| number: 2';
                            break;
                        case 'date':
                            params.filters = '| date: "MM/dd/yyyy"';
                            break;
                        case 'time':
                            params.filters = '| date: "h:mma"';
                            break;
                        case 'datetime':
                            params.filters = '| date: "MM/dd/yyyy HH:mm:ss"';
                            break;
                        case 'codes':
                            params.filters = '| locationCodesFilter';
                            break;
                        case 'lat-lon':
                            params.filters = '| locationLatLonFilter';
                            break;
                        case 'duration':
                            params.filters = '| date: "HH:mm:ss"';
                            break;
                    }
                    return basicTemplate(params);
                }

                var lastPreviewResponse, lastColumnDefs = [];
                function preparePreviewData(response){
                    if(response.descriptor && $scope.selectedNode){
                        var editable = $scope.selectedNode.model.get('type') != 'html.OutputNode';
                        var rowsCount = response.descriptor.rowsExactCount || response.descriptor.rowsEstimatedCount;
                        $scope.previewSettings = {
                            skippedCount: response.skippedCount,
                            name: actualSelectedNode.model.get('view').label || actualSelectedNode.$box.find('.icon-text').text(),
                            enableNestedView: _.contains(['JSON_ARRAY', 'JSON_OBJECT', 'XML'], response.descriptor.format),
                            columns: response.descriptor.columns.length,
                            removedColumns: _.countBy($scope.selectedNode.model.get('settings').columns, 'removed').true,
                            rows: Math.min(rowsCount, 1000),
                            editable: editable
                        };
                        $scope.currentQueryData.cachedPreviewData = response.cached;
                        if(!$scope.currentView || ($scope.currentView == ViewType.NESTED && !$scope.previewSettings.enableNestedView)){
                            $scope.currentView = ViewType.TABLE;
                        }
                        lastColumnDefs = [];
                        lastPreviewResponse = response;
                        var columnSettings = _.groupBy($scope.selectedNode.model.get('settings').columns, 'name');
                        var descriptorColumns = _.sortBy(response.descriptor.columns, 'settings.index');
                        _.each(descriptorColumns, function (column, index) {
                            var originalName = column.name,
                                displayName = column.settings.rename || column.settings.name || column.name,
                                menuItems = [],
                                formatSubItems = [];

                            if(!columnSettings[column.name]){
                                $scope.selectedNode.model.get('settings').columns.push(column.settings);
                                column.settings.type = column.type;
                                column.settings.name = originalName;
                            } else {
                                columnSettings[column.name] = column.settings;
                                if(!column.settings.type){
                                    column.settings.type = column.type;
                                }
                            }
                            column.settings.index = index;

                            if(!column.settings.searchType){
                                if(column.settings.type.dataType == 'STRING') {
                                    column.settings.searchType = 'EDGE';
                                } else {
                                    column.settings.searchType = 'NONE'
                                }
                            }

                            switch(column.settings.type.dataType.toLowerCase()){
                                case 'location_lat_lon':
                                    column.settings.filter = 'lat-lon';
                                    break;
                                case 'location_usa_state_codes':
                                case 'location_country_codes':
                                    column.settings.filter = 'codes';
                                    break;
                            }

                            switch(column.settings.type.dataType.toLowerCase()){
                                case 'double':
                                case 'integer':
                                    formatSubItems.push(deleteFormats(!column.settings.filter));
                                    formatSubItems.push(addSeparator());
                                    formatSubItems.push(coerceToFormat('Number', 'number', column.settings.filter == 'number'));
                                    formatSubItems.push(coerceToFormat('Percent', 'percent', column.settings.filter == 'percent'));
                                    formatSubItems.push(addSeparator());
                                    formatSubItems.push(formatCurrency(column.settings.filter == 'currency'));
                                    formatSubItems.push(coerceToFormat('Financial', 'financial', column.settings.filter == 'financial'));
                                    break;
                                case 'date':
                                    formatSubItems.push(deleteFormats(!column.settings.filter));
                                    formatSubItems.push(addSeparator());
                                    formatSubItems.push(coerceToFormat('Date', 'date', column.settings.filter == 'date'));
                                    formatSubItems.push(coerceToFormat('Time', 'time', column.settings.filter == 'time'));
                                    formatSubItems.push(coerceToFormat('Date time', 'datetime', column.settings.filter == 'datetime'));
                                    formatSubItems.push(coerceToFormat('Duration', 'duration', column.settings.filter == 'duration'));
                                    break;
                            }

                            menuItems.push({
                                title: "Data Type",
                                icon: 'fa fa-fw',
                                subItems: [
                                    coerceToType("String", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'STRING'}, column.settings.type.dataType == 'STRING'),
                                    coerceToType("Number (whole)", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'INTEGER'}, column.settings.type.dataType == 'INTEGER'),
                                    coerceToType("Number (decimal)", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'DOUBLE'}, column.settings.type.dataType == 'DOUBLE'),
                                    coerceToType("Date/Time…", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'DATE'}, column.settings.type.dataType == 'DATE'),
                                    coerceToType("Boolean", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'BOOLEAN'}, column.settings.type.dataType == 'BOOLEAN'),
                                    {
                                        title: "Geographic",
                                        icon: 'fa fa-fw ' + (_.contains(['LOCATION_LAT_LON', 'LOCATION_USA_STATE_CODES', 'LOCATION_COUNTRY_CODES'], column.settings.type.dataType) ? 'fa-check' : ''),
                                        subItems: [
                                            coerceToType("Coordinates", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'LOCATION_LAT_LON'}, column.settings.type.dataType == 'LOCATION_LAT_LON'),
                                            coerceToType("Country Code", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'LOCATION_COUNTRY_CODES'}, column.settings.type.dataType == 'LOCATION_COUNTRY_CODES'),
                                            coerceToType("State Code", {'@class': 'com.dataparse.server.service.parser.type.TypeDescriptor', dataType: 'LOCATION_USA_STATE_CODES'}, column.settings.type.dataType == 'LOCATION_USA_STATE_CODES')
                                        ]
                                    }
                                ]
                            });

                            if(formatSubItems.length){
                                menuItems.push({
                                    title: "Data Format",
                                    icon: 'fa fa-fw',
                                    subItems: formatSubItems
                                });
                            }
                            if(actualSelectedNode.model.get('type') == 'html.OutputNode') {
                                menuItems.push({
                                    title: "Search Type",
                                    icon: 'fa fa-fw',
                                    subItems: [
                                        searchType("Do not search on column", "NONE", column.settings.searchType == "NONE"),
                                        searchType("Edge search", "EDGE", column.settings.searchType == "EDGE"),
                                        searchType("Full inner search", "FULL", column.settings.searchType == "FULL")
                                    ]
                                });
                                menuItems.push(facets(column.settings.disableFacets));
                            }

                            menuItems.push(addSeparator());
                            if(column.settings.type.dataType == 'STRING'){
                                menuItems = menuItems.concat([
                                    rowTransform({title: 'Uppercase', '@class': '.column.UpperTransform'}),
                                    rowTransform({title: 'Lowercase', '@class': '.column.LowerTransform'}),
                                    rowTransform({title: 'CamelCase', '@class': '.column.CapitalCaseTransform'}),
                                    rowTransform({title: 'Clean whitespace', '@class': '.column.CleanWhitespaceTransform'})
                                ])
                            }
                            menuItems.push(distinctColumn(response.descriptor.columns));

                            menuItems = menuItems.concat([
                                convertToListColumn(column.settings.splitOn),
                                addSeparator(),
                                renameColumn(),
                                annotateColumn(),
                                {
                                    title: 'Handle Error',
                                    icon: 'fa fa-fw',
                                    subItems: [
                                        removeErrors(column.settings.removeErrors),
                                        replaceErrors(column.settings.replaceErrors)
                                    ]
                                }
                            ]);

                            if(column.settings.pkey || column.pkey
                                || _.contains(['STRING', 'INTEGER'], column.settings.type.dataType)){

                                column.settings.preserveHistory = null;
                                menuItems.push(setAsPk(column.settings.pkey))
                            }

                            if (!column.settings.pkey && !column.pkey && actualSelectedNode.model.get('type') == 'html.OutputNode') {
                                menuItems.push(preserveHistoryColumn(!!column.settings.preserveHistory));
                            }

                            lastColumnDefs.push({
                                name: 'fields[\'' + displayName + '\']',
                                field: 'fields[\'' + displayName + '\']',
                                visible: getVisibility(originalName),
                                cellClass: (column.settings.type.dataType == 'STRING' ? 'left' : 'right'),
                                originalName: originalName,
                                displayName: common.unscreen(displayName),
                                annotation: column.settings.annotation,
                                filter: column.settings.filter,
                                formatSymbol: column.settings.formatSymbol,
                                decimalPlaces: column.settings.decimalPlaces,
                                width: 'content',
                                enableHiding: false,
                                enableColumnMenu: $scope.previewSettings.editable,
                                enableColumnMoving: $scope.previewSettings.editable,
                                menuItems: menuItems,
                                // headerCellTemplate: common.getColumnHeaderDef(column.settings.type.dataType, column.settings.pkey, true),
                                cellTemplate: getCellTemplate(displayName, column.settings)
                            });
                        });
                    }
                    $scope.refreshCurrentView($scope.currentView);
                }

                function createTableView(response, columnDefs){
                    var data = response.data,
                        descriptor = response.descriptor;
                    if (data.length == 0) {
                        $scope.previewGridOptions.data.length = 0;
                    }
                    $scope.previewGridOptions.columnDefs = [];
                    if(descriptor && $scope.selectedNode) {
                        data = _.map(data, function(row){ return {fields: row}});
                    }
                    $timeout(function(){
                        $scope.previewGridOptions = {
                            enableColumnResize: true,
                            columnDefs: columnDefs,
                            data: data
                        };
                        $scope.gridApi.core.refresh();
                        $scope.gridApi.grid.refresh();
                    })
                }

                $scope.selectAllNone = true;
                $scope.selectAllNoneFields = function () {
                    $scope.selectAllNone = !$scope.selectAllNone;
                    _.each($scope.previewGridOptions.columnDefs, function(columnDef){
                        columnDef.visible = $scope.selectAllNone;
                        var settings = getCurrentSettingsByName(columnDef.originalName);
                        settings.removed = !columnDef.visible;
                    });
                    $scope.previewSettings.removedColumns = _.countBy($scope.selectedNode.model.get('settings').columns, 'removed').true;
                    $scope.previewSettings.columns = lastPreviewResponse.descriptor.columns.length - ($scope.previewSettings.removedColumns || 0);
                    refreshView();
                };
                $scope.switchVisibility = function(columnDef){
                    columnDef.visible = !columnDef.visible;
                    var settings = getCurrentSettingsByName(columnDef.originalName);
                    settings.removed = !columnDef.visible;
                    $scope.previewSettings.removedColumns = _.countBy($scope.selectedNode.model.get('settings').columns, 'removed').true;
                    $scope.previewSettings.columns = lastPreviewResponse.descriptor.columns.length - ($scope.previewSettings.removedColumns || 0);
                    refreshView();
                };
                $scope.columnsListMenu = {
                    isOpen: false,
                    appendTo: angular.element(document.querySelector('.data-preview-title')),
                    toggleMenu: function(){
                        $scope.columnsListMenu.isOpen = !$scope.columnsListMenu.isOpen
                    }
                };

                function addListCustomFilter(column, data){
                    switch(column.filter){
                        case 'financial':
                            return $filter('financial')(data);
                        case 'currency':
                            return column.formatSymbol + $filter('number')(data, (column.decimalPlaces || 0));
                        case 'number':
                            return $filter('number')(data, column.decimalPlaces);
                        case 'percent':
                            return $filter('number')(data, 2) + '%';
                        case 'date':
                            return $filter('date')(data, "MM/dd/yyyy");
                        case 'time':
                            return $filter('date')(data, "h:mma");
                        case 'datetime':
                            return $filter('date')(data, "MM/dd/yyyy HH:mm:ss");
                        case 'duration':
                            return $filter('date')(data, "HH:mm:ss");
                        default:
                            return data;
                    }
                }
                function refreshListView(){
                    var start = ($scope.listView.currentPagination - 1) * $scope.listView.maxPerPage;
                    fillListView(start, (start + $scope.listView.maxPerPage));
                }
                function refreshNestedView(){
                    var start = ($scope.nestedView.currentPagination - 1) * $scope.nestedView.maxPerPage;
                    fillNestedView(start, (start + $scope.nestedView.maxPerPage));
                }
                function fillListView(start, end){
                    $scope.listView.data = [];
                    var data = lastPreviewResponse.data.slice(start, end);
                    _.each(data, function(data){
                        var item = [];
                        _.each(lastColumnDefs, function(colDef){
                            //for xml's
                            var value = data[colDef.displayName] || data[colDef.originalName];
                            if(colDef.visible && value){
                                item.push({name: colDef.displayName, data: addListCustomFilter(colDef, value)});
                            }
                        });
                        if(item.length) {
                            $scope.listView.data.push(item);
                        }
                    });
                }
                function fillNestedView(start, end){
                    $scope.nestedView.data = _.map(lastPreviewResponse.data.slice(start,end), unflatten);
                }
                function makePagination(view){
                    view.pagination = [];
                    var start = 1;
                    var end = Math.min(Math.ceil(view.totalSize / view.maxPerPage), 500);

                    view.pagination.push(start);
                    if (view.currentPagination > start + 3) {
                        view.pagination.push("...");
                    }
                    for (var i = start + 1; i < end; ++i) {
                        if (Math.abs(i - view.currentPagination) <= 2) {
                            view.pagination.push(i);
                        }
                    }
                    if (view.currentPagination < end - 3) {
                        view.pagination.push("...");
                    }
                    if (end != start) {
                        view.pagination.push(end);
                    }
                }
                $scope.switchPaginate = function(view, pag){
                    view.currentPagination = pag;
                    makePagination(view);
                    var start = (view.currentPagination - 1) * view.maxPerPage;
                    if($scope.currentView == ViewType.LIST) {
                        fillListView(start, (start + view.maxPerPage));
                    } else if ($scope.currentView == ViewType.NESTED){
                        fillNestedView(start, (start + view.maxPerPage));
                    }
                };
                $scope.nestedView = {
                    data: [],
                    pagination: [],
                    currentPagination: 1,
                    maxPerPage: 10
                };

                $scope.listView = {
                    data: [],
                    pagination: [],
                    currentPagination: 1,
                    maxPerPage: 10
                };

                function unflatten(o){
                    if(!o) return null;
                    var result = {};
                    _.each(o, function(v, k){
                        // split by not screened dot
                        var path = common.splitPath(k);
                        addValueToPath(result, path, v);
                    });
                    return result;
                }

                function addValueToPath(target, path, value){
                    var key = path[0];

                    var newTarget;
                    if(!_.isArray(target)){
                        if(_.has(target, key)){
                            if(path.length > 1){
                                newTarget = target[key];
                            } else {
                                newTarget = target;
                            }
                        } else {
                            if(path.length > 1){
                                var m = {};
                                newTarget = m;
                                target[key] = m;
                            } else {
                                newTarget = target;
                            }
                        }
                    } else {
                        var m2 = {};
                        newTarget = m2;
                        target.push(m2);
                    }

                    if(path.length > 1){
                        addValueToPath(newTarget, path.slice(1), value);
                    } else {
                        if(!_.isArray(newTarget)){
                            var o = newTarget[key];
                            if(o == undefined){
                                newTarget[key] = value;
                            } else {
                                var l = [];
                                l.push(o);
                                l.push(value);
                                newTarget[key] = l;
                            }
                        } else {
                            newTarget.push(value);
                        }
                    }
                }

                $scope.refreshCurrentView = function(viewType) {
                    if(viewType != undefined) {
                        $scope.currentView = viewType;
                    }
                    if($scope.currentView == ViewType.LIST){
                        $scope.listView.totalSize = lastPreviewResponse.data.length;
                        $scope.listView.currentPagination = 1;
                        makePagination($scope.listView);
                        fillListView(0, $scope.listView.maxPerPage);
                    } else if ($scope.currentView == ViewType.NESTED) {
                        $scope.nestedView.totalSize = lastPreviewResponse.data.length;
                        $scope.nestedView.currentPagination = 1;
                        makePagination($scope.nestedView);
                        fillNestedView(0, $scope.nestedView.maxPerPage);
                    } else if ($scope.currentView == ViewType.TABLE) {
                        createTableView(lastPreviewResponse, lastColumnDefs);
                    }
                };

                $scope.dateFormatModalSettings = {
                    column: null,
                    pattern: null
                };
                $scope.showDateFormatModal = function(settings, originalType){
                    var pattern = settings.type.pattern || (originalType && originalType.pattern);
                    $scope.dateFormatModalSettings = {
                        column: settings,
                        pattern: pattern
                    };
                    $scope.dateFormatModal = $uibModal.open({
                        templateUrl: 'static/templates/include/date-format.html',
                        scope: $scope,
                        animation: true,
                        size: 'sm'
                    })
                };
                $scope.closeDateFormatModal = function(){
                    $scope.dateFormatModal.dismiss();
                };
                $scope.updateDateFormat = function(){
                    var oldType = angular.copy($scope.dateFormatModalSettings.column.type);

                    $scope.dateFormatModalSettings.column.type = {'@class': 'com.dataparse.server.service.parser.type.DateTypeDescriptor', dataType: 'DATE', pattern: $scope.dateFormatModalSettings.pattern}
                    $scope.dateFormatModal.dismiss();
                    $scope.api.preview();

                    var newType = angular.copy($scope.dateFormatModalSettings.column.type);
                    pushCoerceToType($scope.dateFormatModalSettings.column.name, oldType, newType);
                };

                $scope.replaceErrorsModalSettings = {
                    column: null,
                    typeNameText: null,
                    replaceErrors: null
                };
                $scope.showReplaceErrorsModal = function(settings){
                    $scope.replaceErrorsModalSettings.column = settings;
                    $scope.replaceErrorsModalSettings.typeNameText = common.typeNameMappings[settings.type.dataType];
                    $scope.replaceErrorsModalSettings.replaceErrors = settings.replaceErrors;
                    $scope.replaceErrorsModal = $uibModal.open({
                        templateUrl: 'static/templates/include/replace-errors.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    })
                };
                $scope.closeReplaceErrorsModal = function(){
                    $scope.replaceErrorsModal.dismiss();
                };
                $scope.updateReplaceErrors = function(){

                    var oldReplace = $scope.replaceErrorsModalSettings.column.replaceErrors;

                    $scope.replaceErrorsModalSettings.column.replaceErrors = $scope.replaceErrorsModalSettings.replaceErrors;
                    $scope.api.preview();
                    $scope.replaceErrorsModal.dismiss();

                    pushUpdateReplaceErrors($scope.replaceErrorsModalSettings.column.name, oldReplace, $scope.replaceErrorsModalSettings.column.replaceErrors);
                };
                $scope.deleteReplaceErrors = function(){

                    var oldReplace = $scope.replaceErrorsModalSettings.column.replaceErrors;

                    $scope.replaceErrorsModalSettings.column.replaceErrors = null;
                    $scope.replaceErrorsModalSettings.replaceErrors = null;
                    $scope.api.preview();
                    $scope.replaceErrorsModal.dismiss();

                    pushDeleteReplaceErrors($scope.replaceErrorsModalSettings.column.name, oldReplace, $scope.replaceErrorsModalSettings.column.replaceErrors);
                };

                $scope.annotationModalSettings = {
                    column: null,
                    annotation: null,
                    oldAnnotation: null
                };
                $scope.showAnnotationModal = function(settings){
                    $scope.annotationModalSettings.column = settings;
                    if($scope.annotationModalSettings.column.annotation) {
                        $scope.annotationModalSettings.oldAnnotation = $scope.annotationModalSettings.column.annotation;
                        $scope.annotationModalSettings.annotation = $scope.annotationModalSettings.column.annotation;
                    }
                    else $scope.annotationModalSettings.annotation = undefined;
                    $scope.annotationModal = $uibModal.open({
                        templateUrl: 'static/templates/include/preview-annotation.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    })
                };

                $scope.convertToListModalSettings = {
                    column: null,
                    separator: null,
                    oldSeparator: null
                };

                $scope.showConvertToListModal = function(settings){

                    $scope.convertToListModalSettings.column = settings;
                    if($scope.convertToListModalSettings.column.splitOn) {
                        $scope.convertToListModalSettings.oldSeparator = $scope.convertToListModalSettings.column.splitOn;
                        $scope.convertToListModalSettings.separator = $scope.convertToListModalSettings.column.splitOn;
                    }
                    else $scope.convertToListModalSettings.separator = ',';
                    $scope.convertToListModal = $uibModal.open({
                        templateUrl: 'static/templates/include/convert-to-list.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    });
                };

                $scope.closeConvertToListModal = function (settings) {
                    $scope.convertToListModal.dismiss();
                };

                $scope.closePreviewAnnotationModal = function(){
                    $scope.annotationModal.dismiss();
                };

                $scope.updatePreviewAnnotation = function(){
                    var oldAnnotation = $scope.annotationModalSettings.column.annotation;

                    $scope.annotationModalSettings.column.annotation = $scope.annotationModalSettings.annotation;
                    refreshPreviewFromCache();
                    $scope.annotationModal.dismiss();

                    pushUpdatePreviewAnnotation($scope.annotationModalSettings.column.name, oldAnnotation, $scope.annotationModalSettings.column.annotation);
                };

                $scope.deletePreviewAnnotation = function(){
                    $scope.annotationModalSettings.column.annotation = null;
                    refreshPreviewFromCache();
                    $scope.annotationModal.dismiss();
                };

                $scope.updateConvertToList = function() {
                    $scope.convertToListModalSettings.column.splitOn = $scope.convertToListModalSettings.separator;
                    $scope.api.preview();
                    $scope.convertToListModal.dismiss();
                };
                $scope.deleteConvertToList = function(){
                    $scope.convertToListModalSettings.column.splitOn = null;
                    $scope.api.preview();
                    $scope.convertToListModal.dismiss();
                };

                $scope.distinctModalSettings = {
                    columns: null,
                    selected: null,
                    notSelected: null,
                    selectedColumn: null,
                    add: function(){
                        if($scope.distinctModalSettings.selectedColumn) {
                            _.remove($scope.distinctModalSettings.notSelected, function (col) { return col.name == $scope.distinctModalSettings.selectedColumn.name });
                            $scope.distinctModalSettings.selected.push($scope.distinctModalSettings.selectedColumn);
                        }
                    },
                    remove: function(column){
                        _.remove($scope.distinctModalSettings.selected, function(col){ return col.name == column.name });
                        $scope.distinctModalSettings.notSelected.push(column);
                        $scope.distinctModalSettings.notSelected = _.sortBy($scope.distinctModalSettings.notSelected, "id");

                    }
                };
                $scope.showDistinctModal = function(columns, selectedColumnName){
                    $scope.distinctModalSettings.columns = columns;
                    $scope.distinctModalSettings.notSelected = [].concat(columns);
                    $scope.distinctModalSettings.selected = [];
                    $scope.distinctModalSettings.selectedColumn = _.find($scope.distinctModalSettings.notSelected, function(col){ return col.name = selectedColumnName})
                    $scope.distinctModalSettings.add();
                    $scope.distinctModal = $uibModal.open({
                        templateUrl: 'static/templates/include/preview-distinct.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    })
                };

                $scope.closePreviewDistinctModal = function(){
                    $scope.distinctModal.dismiss();
                };

                $scope.updatePreviewDistinct = function(){
                    if($scope.distinctModalSettings.selected.length) {
                        var columnNames = _.map($scope.distinctModalSettings.selected, function (column) {
                            return column.name;
                        });
                        $scope.addTransform({
                            title: 'Deduplicate',
                            '@class': '.table.DeduplicationTransform',
                            columnNames: columnNames
                        });
                    }
                    $scope.distinctModal.dismiss();
                    $scope.api.preview();

                    //pushUpdatePreviewDistinct(columnNames, );
                };

                $scope.setDataFormat = function(settings, filter) {
                    settings.formatSymbol = null;

                    var oldData = {
                        filter: angular.copy(settings.filter),
                        decimalPlaces: settings.decimalPlaces
                    };

                    if(!filter){
                        settings.filter = null;
                        settings.decimalPlaces = null;
                    } else {
                        settings.filter = filter;
                        settings.decimalPlaces = 2;
                    }
                    refreshPreviewFromCache();

                    var newData = {
                        filter: angular.copy(settings.filter),
                        decimalPlaces: settings.decimalPlaces
                    };

                    pushSetDataFormat(settings.name, oldData, newData);
                };

                $scope.formatModalSettings = {
                    column: null,
                    type: null,
                    typeSelected: null,
                    types: ['', '$', '€', '£'],
                    decimalPlaces: null,
                    decimalPlacesAvailable: _.range(11)
                };
                $scope.showFormatModal = function(settings) {
                    $scope.formatModalSettings.column = settings;
                    if ($scope.formatModalSettings.column.formatSymbol) {
                        $scope.formatModalSettings.type = $scope.formatModalSettings.column.formatSymbol;
                        $scope.formatModalSettings.typeSelected = $scope.formatModalSettings.column.formatSymbol;
                    }
                    if($scope.formatModalSettings.column.decimalPlaces)
                        $scope.formatModalSettings.decimalPlaces = Number($scope.formatModalSettings.column.decimalPlaces);

                    $scope.formatModal = $uibModal.open({
                        templateUrl: 'static/templates/include/preview-format.html',
                        scope: $scope,
                        animation: true,
                        size: 'sm'
                    })
                };
                $scope.closePreviewFormatModal = function(){
                    $scope.formatModal.dismiss();
                };
                $scope.updatePreviewFormat = function(){

                    var oldFormat = {
                        formatSymbol: angular.copy($scope.formatModalSettings.column.formatSymbol),
                        decimalPlaces: angular.copy($scope.formatModalSettings.column.decimalPlaces),
                        filter: angular.copy($scope.formatModalSettings.column.filter)
                    };

                    $scope.formatModalSettings.column.formatSymbol = $scope.formatModalSettings.type;
                    $scope.formatModalSettings.column.decimalPlaces = $scope.formatModalSettings.decimalPlaces == 0 ? '0' : $scope.formatModalSettings.decimalPlaces;
                    $scope.formatModalSettings.column.filter = 'currency';
                    refreshPreviewFromCache();
                    $scope.formatModal.dismiss();

                    var newFormat = {
                        formatSymbol: angular.copy($scope.formatModalSettings.column.formatSymbol),
                        decimalPlaces: angular.copy($scope.formatModalSettings.column.decimalPlaces),
                        filter: angular.copy($scope.formatModalSettings.column.filter)
                    };

                    pushUpdatePreviewFormat($scope.formatModalSettings.column.name, oldFormat, newFormat);
                };

                function getPreserveHistoryModalSettings() {
                    return {
                        retention: {
                            value: 1,
                            period: ['Hour', 'Day', 'Week'/*, 'Month'*/],
                            selectedPeriod: 'Hour'
                        }
                    }
                };

                $scope.showPreserveHistoryModal = function(settings, m) {
                    $scope.preserveHistoryModalSettings = getPreserveHistoryModalSettings();
                    $scope.preserveHistoryModalSettings.column = settings;
                    $scope.preserveHistoryModalSettings.m = m;

                    var ph = $scope.preserveHistoryModalSettings.column.preserveHistory;

                    if (ph) {
                        $scope.preserveHistoryModalSettings.retention.value = ph.retention.value;
                        $scope.preserveHistoryModalSettings.retention.selectedPeriod = ph.retention.period;
                    }

                    $scope.preserveHistoryModal = $uibModal.open({
                        templateUrl: 'static/templates/include/preserve-history.html',
                        scope: $scope,
                        animation: true,
                        size: 'md'
                    });

                };

                $scope.closePreserveHistoryModal = function () {
                    $scope.preserveHistoryModal.dismiss();
                };

                $scope.updatePreserveHistory = function () {
                    var settings = $scope.preserveHistoryModalSettings.column;
                    settings.preserveHistory = {
                        retention: {
                            value: $scope.preserveHistoryModalSettings.retention.value,
                            period: $scope.preserveHistoryModalSettings.retention.selectedPeriod
                        }
                    };

                    $scope.preserveHistoryModalSettings.m.icon = 'fa fa-fw fa-check';

                    $scope.preserveHistoryModal.dismiss();
                };

                $scope.deletePreserveHistory = function () {
                    $scope.preserveHistoryModalSettings.m.icon = 'fa fa-fw';
                    $scope.preserveHistoryModalSettings.column.preserveHistory = null;
                    $scope.preserveHistoryModal.dismiss();
                }

                $scope.selectedNode = null;
                var actualSelectedNode = null;
                var previewRequestId = null;
                function serializeGraph(){
                    return angular.toJson(graph.toJSON());
                }

                var refreshPreviewFromCache = function(){
                    var columns = $scope.selectedNode.model.get('settings').columns;
                    _.each(lastPreviewResponse.descriptor.columns, function(col){ col.settings = _.find(columns, {name: col.name}) });
                    preparePreviewData(lastPreviewResponse);
                };

                function doPreview(){
                    if (!$scope.isPreviewRunning) {
                        $scope.isPreviewRunning = true;
                        $http.post('/api/flow/preview', $scope.lastPreviewParams)
                            .success(function (response) {
                                preparePreviewData(response);
                                $scope.isPreviewRunning = false;
                                if($scope.lastPreviewParams){
                                    doPreview();
                                }
                            })
                            .error(function (e) {
                                $scope.isPreviewRunning = false;
                                //common.showValidationErrors(e);
                                if($scope.lastPreviewParams){
                                    doPreview();
                                }
                            });
                        $scope.lastPreviewParams = undefined;
                    }
                }

                function doValidate(){
                    if (!$scope.isValidationRunning) {
                        if(graph.getElements().length > 0) {
                            $scope.isValidationRunning = true;
                            $http.post('/api/flow/validate', $scope.lastValidateParams)
                                .success(function (data) {
                                    $scope.errors = data;
                                    $scope.isValidationRunning = false;
                                    if($scope.lastValidateParams){
                                        doValidate();
                                    }
                                })
                                .error(function (e) {
                                    $scope.isValidationRunning = false;
                                    common.showError(e);
                                    if($scope.lastValidateParams){
                                        doValidate();
                                    }
                                });
                            $scope.lastValidateParams = undefined;
                        } else {
                            $scope.errors = [];
                        }
                    }
                }


                function setUnloadRestriction() {
                    if (!$scope.selectedTable.committed || $scope.isIndexChanged) {
                        window.onbeforeunload = function () {
                            return "Data will be lost if you leave the page, are you sure?";
                        };
                    }
                    else window.onbeforeunload = undefined;
                }

                $scope.renameIndex = function(){
                    $scope.updateTable(true);
                };

                $scope.closeIndex = function(){
                    $scope.updateTable().then(function(){
                        $scope.selectedTable = undefined;
                        HistoryService.clear();
                        window.onbeforeunload = undefined;
                        $state.go('main');
                    });
                };

                $scope.updateTable = function (nameOnly) {
                    $scope.isUpdating = true;
                    var method = 'PUT',
                        url = '/api/tables/' + $scope.selectedTable.id;
                    return $q(function(resolve, reject){
                        if(!nameOnly) {
                            _.each($('body').find('.html.Link.link'), function (elm) {
                                $(elm).css({fill: 'transparent', stroke: 'transparent'});
                            });
                            html2canvas($elm.find('#worksheet')[0], {
                                onrendered: function (canvas) {
                                    var contentBBox = paper.getContentBBox();
                                    if (contentBBox.width > 0 && contentBBox.height > 0) {
                                        var ctx = canvas.getContext("2d");
                                        var delta = 20;
                                        var x1 = contentBBox.x - delta < 0 ? 0 : contentBBox.x - delta,
                                            y1 = contentBBox.y - delta < 0 ? 0 : contentBBox.y - delta,
                                            x2 = contentBBox.x + contentBBox.width + delta > canvas.width ? canvas.width : contentBBox.x + contentBBox.width + delta,
                                            y2 = contentBBox.y + contentBBox.height + delta > canvas.height ? canvas.height : contentBBox.y + contentBBox.height + delta;
                                        var width = x2 - x1,
                                            height = y2 - y1;

                                        // try to keep 2:1 aspect ratio and keep image centered
                                        if (width > height * 2) {
                                            // try to extend height if possible
                                            var errY = (width / 2 - height) / 2;
                                            if (y1 < errY) errY = y1;
                                            if (canvas.height - y2 < errY) errY = canvas.height - y2;
                                            if (errY > 0) {
                                                y1 -= errY;
                                                y2 += errY;
                                            }
                                        } else {
                                            // try to extend width if possible
                                            var errX = (height * 2 - width) / 2;
                                            if (x1 < errX) errX = x1;
                                            if (canvas.width - x2 < errX) errX = canvas.width - x2;
                                            if (errX > 0) {
                                                x1 -= errX;
                                                x2 += errX;
                                            }
                                        }
                                        width = x2 - x1;
                                        height = y2 - y1;

                                        var cut = ctx.getImageData(x1, y1, width, height);
                                        canvas.width = x2 - x1;
                                        canvas.height = y2 - y1;
                                        ctx.putImageData(cut, 0, 0);
                                        var img = canvas.toDataURL("image/png");
                                        $scope.selectedTable.previewImage = img && (img.length > 6) ? img : 'data:image/png;base64,';
                                    } else {
                                        $scope.selectedTable.previewImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=';
                                    }
                                    $scope.selectedTable.flowJSON = serializeGraph();
                                    $http({
                                        method: method,
                                        url: url,
                                        data: {
                                            name: $scope.selectedTable.name,
                                            flowJSON: $scope.selectedTable.flowJSON,
                                            previewImage: $scope.selectedTable.previewImage
                                        }
                                    }).success(function (data) {
                                        resolve(data);
                                        $scope.selectedTable.uploads = data.uploads;
                                        $scope.isUpdating = false;
                                    }).error(function (e) {
                                        reject(e);
                                        common.showError(e);
                                        $scope.isUpdating = false;
                                    });
                                }
                            });
                        } else {
                            $http({
                                method: method,
                                url: url,
                                data: {
                                    name: $scope.selectedTable.name
                                }
                            }).success(function (data) {
                                resolve(data);
                                $scope.selectedTable.uploads = data.uploads;
                                $scope.isUpdating = false;
                            }).error(function (e) {
                                reject(e);
                                common.showError(e);
                                $scope.isUpdating = false;
                            });
                        }
                    });
                };
                $scope.dropdownMenu = {
                    status: false,
                    mouseOverButton: false,
                    mouseOverList: false,
                    toggle: function () {
                        if (!$scope.dropdownMenu.mouseOverButton) {
                            $scope.dropdownMenu.mouseOverButton = true;
                            $timeout(function () {
                                if (!$scope.dropdownMenu.status && $scope.dropdownMenu.mouseOverButton)
                                    $scope.dropdownMenu.status = true;
                            }, 500)
                        }
                    },
                    close: function () {
                        $timeout(function () {
                            if (!$scope.dropdownMenu.mouseOverButton && !$scope.dropdownMenu.mouseOverList)
                                $scope.dropdownMenu.status = false;
                        }, 1000)
                    }
                };

                WSocket.subscribe('/upload-events', function(e){
                    var node = _.find(graph.getElements(), function(elm) {
                        return e.file.type && e.file.type != 'composite-ds' && _.contains(elm.get('settings'), e.file.id);
                    });
                    if(node) {
                        switch (e.type) {
                            case 'DELETE_FILE':
                                node.remove();
                                break;
                            case 'EDIT_FILE':
                                node.get('view').label = e.file.name;
                                node.findView(paper).updateBox();
                                break;
                        }
                    }
                });
                $scope.viewMode = false;
                $scope.$watch('viewMode', function(val){
                    if(val){
                        window.onbeforeunload = undefined;
                        $state.go('main.visualize', {id: $scope.selectedTable.id})
                    }
                });

                $scope.$on('add-source', function(event, params){
                    $scope.api.nodes.addSources(params.uploads);
                });

                $scope.onWorkspaceResize = function(){
                    $scope.api.resize($localStorage.workspaceH);
                };

                /// INITIALIZE
                HistoryService.clear();
                $(document).scrollTop(0);
                $(window).resize(function(){
                    $scope.api.resize();
                });

                var indexes = DatadocService.getList();
                $scope.selectedTable = _.find(indexes, {id: parseInt($stateParams.id)});
                $scope.api.load($scope.selectedTable);
                if($stateParams.new) {
                    $location.search('new', null).replace();
                    $timeout(function () {
                        $elm.find('#status-bar').find('.form-control.selected').select()
                    });
                }
            }
        }
    }])
});

