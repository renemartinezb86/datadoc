define(['./module', 'common', 'lodash', 'angular', 'notifications-utils'], function(module, cc, _, angular, NotificationsUtils) {
    module.service('ExportService', ['$http', 'WSocket', '$timeout', '$compile', '$state', function ($http, WSocket, $timeout, $compile, $state) {
        var service = this,
            $scope,
            modal;

        service.stop = function() {
            service.datadocId = null;
            $scope = null;
            modal = null;
        };

        function removeExport (e) {
            if(e.finished) {
                $http.post('/api/export/delete', {taskId: e.id})
            } else {
                $http.post('/api/export/cancel', {taskId: e.id});
            }
        }

        var downloader = {
            cancelAll: function () {
                _.each(downloader.pendingExports, function(e){removeExport(e)});
                downloader.pendingExports = {};
            },
            cancel: function(e){
                removeExport(e);
                delete downloader.pendingExports[e.id];
            },
            download: function (e){
                cc.withIgnoreOnBeforeUnload($timeout, function(){
                    window.location.href = '/api/export/download?requestId=' + e.id
                });
                removeExport(e);
                delete downloader.pendingExports[e.id];
            },
            allCompleted: function(){
                return _.every(_.values(downloader.pendingExports), {finished: true});
            },
            allInProgress: () => {
                return _.filter(_.values(downloader.pendingExports), e => !e.finished);
            },
            hasRunningExport:  (datadocId, format) => {
                return !!_.filter(_.values(downloader.pendingExports),
                        e => !e.finished && e.datadocId === datadocId && e.exportFormat === format)
                       .length;
            },
            selected: undefined,
            pendingExports: {}
        };

        /**
         * Prepare headers for request
         * @param shows         Columns that shows in grid
         * @param aggs          Aggregation columns
         * @param columns       Grid columns
         * @returns {Array.<T>} Headers array
         */
        function getShows (shows, aggs, columns){
            var headers = [].concat(shows),
                aggIndex = _.findIndex(headers, {agg: true});
            if(aggIndex > -1){
                headers.splice.apply(headers, [aggIndex, 1].concat(aggs));

                // add custom filter to columns
                _.each(headers, function(h){
                    var col = _.find(columns, {name: h.key});
                    if(col && col.customFilter){
                        h.customFilter = col.customFilter;
                    }
                });
            }
            return headers;//_.map(headers, function(h){return {key: h.key, name: h.name}});
        }

        /**
         * Request
         * @param datadocId       ID of datadoc.
         * @param tabIds        IDs of Table bookmarks.
         * @param format        XLS OR CSV
         * @param scope         Scope of controller
         * @param isModal       Is this request running from modal window
         * @returns {*}         HTTP promise
         */
        function prepareExport (datadocId, tabIds, format, scope, isModal, isEmbed) {
            window.onbeforeunload = function() {
                return 'Changes would not be saved';
            };
            subscribeToExportEvent();
            service.datadocId = datadocId;
            $scope = scope;
            modal = isModal;
            const hasRunningExport = downloader.hasRunningExport(datadocId, format);
            if(hasRunningExport) {
                NotificationsUtils.notify({
                    id: `already_run_export_${datadocId}`,
                    message: `You already have running exports for this datadoc and ${format} format. Please wait until it done. `
                })
                return;
            }
            var request = {
                '@class': 'com.dataparse.server.service.export.ExportTaskRequest',
                datadocId: datadocId,
                totalRowsCount: scope.totalSize,
                tableBookmarkIds: tabIds,
                externalId: scope.externalId,
                format: format
            };

            if (isEmbed) {
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

            return $http.post('/api/export/prepare', request).error(err => {
                NotificationsUtils.notify({id: 'prepare_export', message: err.message});
            });
        }

        function showExportNotification() {
            const notificationMessage = `Your export is being generated...`;
            const notificationContent = new NotificationsUtils.NotificationContent(service.datadocId, notificationMessage);
            NotificationsUtils.notify(notificationContent, {delay: 500, global: true});
        }

        function subscribeToExportEvent() {
            WSocket.subscribe('/export-events', function(e){
                switch (e.type) {
                    case 'EXPORT_START':
                        $timeout(function(){
                            downloader.pendingExports[e.taskId] = ({
                                id: e.taskId,
                                statistics: {
                                    requestReceivedTime: e.startDate
                                },
                                datadocId: service.datadocId,
                                exportFormat: e.exportFormat,
                                doNotShowNotification: setTimeout(showExportNotification, 500),
                                finished: false
                            });

                        });
                        break;
                    case 'EXPORT_PROGRESS':
                        $timeout(function () {
                            var item = downloader.pendingExports[e.taskId];
                            if (!item) return;

                            if (item.result) {
                                item.result.complete = e.complete;
                            } else {
                                item.result = {
                                    complete: e.complete
                                }
                            }
                        });
                        break;
                    case 'EXPORT_COMPLETE':
                        $timeout(function () {
                            var item = downloader.pendingExports[e.taskId];
                            if (!item) return;
                            clearTimeout(item.doNotShowNotification);
                            if (item.result) {
                                item.result.complete = 1;
                            }
                            item.finished = true;

                            downloader.selected = {id: e.taskId};

                            if(!$state.current.controller || modal) {
                                $scope.isExportRunning = false;
                            }
                            const allInProgress = downloader.allInProgress();

                            if(allInProgress.length > 0) {
                                showExportNotification();
                            } else {
                                window.onbeforeunload = undefined;
                                NotificationsUtils.closeNotification(service.datadocId);
                            }

                            downloader.download(downloader.selected);

                            WSocket.unsubscribe('/export-events');
                            service.stop();
                        });
                        break;
                }
            }, false, true);
        }

        function checkPendingExports($scope) {
            $http.get('/api/export/pending', {params: {datadocId: $scope.datadocId}})
                .success(function (data) {
                    $scope.downloader.pendingExports = _.reduce(data, (acc, e) => {
                        acc[e.id] = e;
                        return acc;
                    }, {});
                });
        }

        function getExportOptions(type) {
            switch(type) {
                case 'chart':
                    return [
                        {
                            name: 'Export as CSV',
                            type: 'CSV'
                        },
                        {
                            name: 'Export as Excel',
                            type: 'XLS'
                        },
                        {
                            name: 'Export as PNG',
                            type: 'image/png'
                        },
                        {
                            name: 'Export as JPEG',
                            type: 'image/jpeg'
                        },
                        {
                            name: 'Export as PDF',
                            type: 'application/pdf'
                        },
                        {
                            name: 'Export as SVG',
                            type: 'image/svg+xml'
                        }
                    ];
                case 'table':
                    return [
                        {
                            name: 'Export as CSV',
                            type: 'CSV'
                        },
                        {
                            name: 'Export as Excel',
                            type: 'XLS'
                        }
                    ]
            }
        }

        return {
            prepareExport,
            downloader,
            checkPendingExports,
            getExportOptions
        }
    }]);
});