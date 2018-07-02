define(['./module', 'lodash', 'moment', 'moment-duration-format'], function (directives, _, moment) {
    'use strict';
    directives.directive('queryEditor', ['$http', '$q', '$compile', 'IngestDataLoadingService', 'BookmarkEventService', "$uibModal",
        function($http, $q, $compile, IngestDataLoadingService, BookmarkEventService, $uibModal){
            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/query-editor.html',
                link: function($scope, $elm, $attrs) {

                    $scope.runQueryConfirmationModal = null;

                    const runModal = (forceQuery) => {
                        $scope.runQueryConfirmationModal = $uibModal.open({
                            templateUrl: 'static/templates/include/confirmation-modal.html',
                            controller: 'confirmationModalCtrl',
                            scope: $scope,
                            resolve: {
                                title: () => null,
                                description: () => "You have made manual changes to your data that would be overwritten by re-running this query. Are you sure you want to re-run this query?",
                                agree: () => $scope.runQuery.bind(null, forceQuery, true),
                                agreeButtonTitle: () => "Run Query"
                            },
                            animation: true,
                            size: 'md'
                        });
                        $scope.runQueryConfirmationModal.closed = () => $scope.runQueryConfirmationModal = null;
                    };

                    $scope.$on('ingest-run-query', (context, runQueryData) => {
                        const force = _.get(runQueryData, 'force');
                        const isNull = force === undefined || force === null;
                        $scope.runQuery(isNull ? true : force);
                    });
                    let el = $elm.find('.CodeMirror');
                    el.attr('v-resizable', '');
                    el.attr('v-resizable-id', 'query-editor-resize');
                    el.attr('v-resizable-min', '55');
                    el.attr('v-resizable-default', '210');
                    el.attr('v-resizable-max', '700');
                    el.attr('v-resizable-on-resize-finished', 'onResizeDone');
                    el.attr('v-resizable-on-resize', 'onResize');
                    $compile(el)($scope);
                    $scope.favoriteQueryDropdown = {
                        opened: false,
                        toggle: function(toggle){
                            if(typeof toggle === "undefined"){
                                toggle = !$scope.favoriteQueryDropdown.opened;
                            }
                            $scope.favoriteQueryDropdown.opened = toggle;
                        }
                    };
                    $scope.$on('open-query-editor', function() {
                        el[0].CodeMirror.focus();
                    });
                    $scope.onResizeDone = (element) => {
                        $scope.editorHeight = element.height;
                        BookmarkEventService.emit('.QueryEditorHeightChangeEvent', {height: element.height}, $scope);
                    };
                    $scope.onResize = _.throttle(() => $scope.previewGridOptions.api.doLayout(), 50);
                    $scope.runQuery = function(force = true, skipModal){
                        if($scope.currentQueryData.manualChangesPerformed && !skipModal) {
                            runModal(force);
                            return;
                        }

                        $scope.currentQueryData.queryRunning = true;
                        $scope.disableGridBeforeQuery();
                        let startTime = new Date().getTime();
                        $scope.currentQueryData.reset();
                        return $q.when($scope.updateIngestSettings(false, false, true, force, false)).then((response) => {
                            $scope.enableGridAfterQuery();
                            $scope.currentQueryData.successQuery = true;
                            $scope.currentQueryData.lastQueryTime = moment.duration(response.time, "milliseconds").format('m [min] s [s]', 2);
                            $scope.$emit('refresh-query-history');
                            $scope.currentQueryData.queryRunning = false;
                        }, e => {
                            $scope.enableGridAfterQuery();
                            if (e.status !== -1) {
                                $scope.currentQueryData.errorQuery = true;
                                IngestDataLoadingService.clear($scope);
                                $scope.currentQueryData.lastQueryErrorMessage = !e.data.message && _.first(e.data).code
                                    ? IngestDataLoadingService.getErrorMessage(_.first(e.data)).message
                                    : e.data.message;
                                $scope.$emit('refresh-query-history');
                            } else {
                                $scope.currentQueryData.canceledQuery = true;
                                let finishTime = new Date().getTime();
                                $scope.currentQueryData.lastQueryTime = moment.duration((finishTime - startTime), "milliseconds").format('m [min] s [s]', 2);
                            }
                            $scope.currentQueryData.queryRunning = false;
                        });
                    }
                }
            };
        }]);
});
