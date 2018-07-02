define(['./module', 'common', 'lodash'], function (directives, common, _) {
    'use strict';
    directives.directive('uploads', ['$uibModal', '$http', '$state', '$rootScope', 'SourceService',
        'BookmarkCommitService', 'UploaderService', '$q', '$localStorage',
        function ($uibModal, $http, $state, $rootScope, SourceService, BookmarkCommitService,
                  UploaderService, $q, $localStorage) {
            return {
                restrict: 'E',
                scope: {

                },
                link: function ($scope, $elm, $attr) {
                    const calculateProgress = (tasks) => {
                        if(_.values(tasks).length > 1) {
                            const progressByRows = _.reduce(_.values(tasks), (acc, task) => {
                                acc.processedRows += task.processedRows;
                                acc.totalRows += task.totalRows;
                                return acc;
                            }, {processedRows: 0, totalRows: 0});
                            const totalRows = progressByRows.totalRows || 1;
                            return Math.round(progressByRows.processedRows / totalRows * 100);
                        } else {
                            const progress = _.get(_.first(_.values(tasks)), 'progress');
                            return Math.round(progress ? progress : 0);
                        }
                    };

                    if($state.current.name === 'main.visualize') {
                        return;
                    }
                    $scope.uploader = UploaderService.getUploader();
                    $scope.setUploaderUrl = UploaderService.setUrl;

                    $scope.goToVisualization = function(index, suppressStateChanging, preSave = false){
                        if(!suppressStateChanging) {
                            $state.go('main.visualize', {id: index.id, preSave})
                        }
                    };

                    const tryToReleaseReloadLock = () => {
                        if(!_.some($scope.uploader.queue, {verifying: true})) {
                            window.onbeforeunload = undefined;
                        }
                    };

                    $scope.getUploadItemStatus = function(item){
                        if(item.isDuplicate) {
                            return "File already exists."
                        }

                        if(item.isError){
                            if(item.errorMessage){
                                return item.errorMessage;
                            }
                            return 'Connection error'
                        }
                        if(item.stoppingIngest) {
                            return 'File added. Ingest canceled.';
                        }

                        if(item.isCancel){
                            return 'Upload cancelled'
                        }
                        return '';
                    };

                    $scope.getUploadItemIcon = function(item){
                        if(item.result && item.result.descriptor.format){
                            return SourceService.getIcon(item.result);
                        }
                        return item.icon;
                    };

                    $scope.getUploadsPopupTitle = function (){
                        let result = "";

                        const { errorCount, cancelCount, successCount } = $scope.uploader.queue.reduce((acc, el) => {
                            if(el.isError && !el.isDuplicate) acc.errorCount++;
                            else if(el.isCancel || el.stoppingIngest) acc.cancelCount++;
                            else if((el.ingesting === 'FINISHED' && ! el.isSchemaDefining) || el.isDuplicate) acc.successCount++;
                            return acc;
                        }, {errorCount: 0, cancelCount: 0, successCount: 0});
                        if(errorCount > 0) {
                            result += `${errorCount} failed. `
                        }
                        if(cancelCount > 0) {
                            result += `${cancelCount} canceled. `
                        }
                        if(successCount > 0) {
                            result += successCount ? successCount + " file" + (successCount > 1 ? "s" : "") + " added. " : "";
                        }


                        if ($scope.uploader.isUploading || $scope.uploader.isIngesting ||
                            $scope.uploader.isSchemaDefining || $scope.uploader.isVerifying) {
                            let inProgressCount = _.reduce($scope.uploader.queue, (count, item) => {
                                if ((item.isUploading || item.isReady || item.isSchemaDefining || item.verifying || item.ingesting === 'IN_PROGRESS')
                                    && (item.ingesting !== 'FINISHED' && !item.stoppingIngest && !item.isError && !item.isCancel)) {
                                    count++;
                                }
                                return count;
                            }, 0);

                            if (inProgressCount) {
                                result += inProgressCount + " uploading...";
                            }
                        }

                        return result;
                    };

                    $scope.showUploadsPopup = function (){
                        if(!$scope.uploadModal){
                            $scope.uploadModal = $uibModal.open({
                                templateUrl: '/static/templates/main/uploads.html',
                                scope: $scope,
                                animation: true,
                                size: 'md',
                                backdrop: false,
                                windowClass: 'popup-window bottom-right uploads-popup',
                                appendTo: $elm
                            });
                            $scope.uploadModal.closed.then(function(){
                                $scope.uploadModal = null;
                            })
                        }
                    };

                    $scope.showStopIngestModal = function(e, item) {
                        e.stopPropagation();
                        $scope.stopItem = item;
                        $scope.stopIngestModal = $uibModal.open({
                            templateUrl: 'static/templates/include/stop-ingest-modal.html',
                            scope: $scope,
                            animation: true,
                            size: 'md'
                        });
                    };

                    $scope.closeStopIngestModal = function() {
                        $scope.stopIngestModal.dismiss();
                    };

                    $scope.minimizeUploadsPopup = function (){
                        if(!$scope.uploadModal.minimized){
                            $scope.uploadModal.minimized = true;
                        }
                    };

                    $scope.maximizeUploadsPopup = function (){
                        if($scope.uploadModal.minimized){
                            $scope.uploadModal.minimized = false;
                        }
                    };

                    $scope.closeUploadCloseModal = function (cancel) {
                        $scope.uploadCloseModal.dismiss();
                        if(cancel) {
                            $scope.uploader.clearQueue();
                            $scope.uploadModal.dismiss();
                        }
                    };

                    $scope.closeUploadsPopup = function (){
                        if($scope.uploader.isUploading) {
                            $scope.uploadCloseModal = $uibModal.open({
                                templateUrl: '/static/templates/main/uploads-close.html',
                                scope: $scope,
                                animation: true,
                                size: 'md',
                                backdrop: false
                            });
                            return $scope.uploadCloseModal.closed;
                        } else {
                            $scope.uploader.queue = _.filter($scope.uploader.queue, ({ingesting, isCancel, isError}) => {
                                return !(ingesting === 'FINISHED' || ingesting === 'NO_INGEST' || isCancel || isError);
                            });
                            $scope.definedSchemaFilesCount = 0;
                            $scope.uploader.isSchemaDefining = false;
                            $scope.uploadModal.dismiss();
                        }
                    };

                    const presetOptions = (item, { props = {} } = {}) => {
                        for(let key in props) {
                            item[key] = props[key];
                        }
                    };

                    const uploadItem = (item, options) => {
                        let path = $scope.uploader.path;
                        if (options && ('parentFolder' in options)) {
                            path = (options.parentFolder ? 'id:' + options.parentFolder : '');
                        }
                        item.headers['Datadocs-API-Arg'] = JSON.stringify({path: path, fileSize: item.file.size});
                        item.icon = UploaderService.getFileType(item._file.name);

                        if(options && options.props) {
                            _.merge(item, options.props);
                            $scope.keepClosed = true;
                        } else {
                            $scope.uploader.uploadItem(item);
                            $scope.keepClosed = false;
                        }
                    };

                    // For NOT GCS uploaders - use parallel upload
                    if (!UploaderService.isGCSUploader) {
                        $scope.uploader.onAfterAddingFile = uploadItem;
                    } else {
                        $scope.uploader.onAfterAddingFile = presetOptions;
                    }

                    $scope.uploader.onAfterAddingAll = function(items, options){
                        // For GCS uploader - wait for waitBeforeStartUploading() executing first
                        const successItems = items.filter(item => !item.isError);
                        if (UploaderService.isGCSUploader) {
                            successItems.forEach(item => uploadItem(item, options));
                        }

                        if(!$scope.keepClosed) {
                            $scope.showUploadsPopup();
                        }
                        if(successItems.length) {
                            window.onbeforeunload = function () {
                                return "Uploads will be cancelled if you leave the page, are you sure?";
                            };
                        }

                        if($scope.sourceModal) {
                            $scope.closeSourceModal();
                        }
                    };

                    function checkFilesBeforeUpload(items) {
                        // todo: check Content-Type
                        _.each(items, item => {
                            switch (UploaderService.getFileType(item._file.name)) {
                                case "unknown":
                                    $scope.uploader._onCompleteItem(item);
                                    $scope.uploader._onErrorItem(item,
                                        [{
                                            code: 400,
                                            message: `Invalid extension`,
                                            description: `Acceptable formats are: ${UploaderService.availableFileFormatsAsString}`
                                        }],
                                        400);
                                    item.icon = "unknown";
                                    break;
                            }
                        });
                    }

                    const waitForGCSBeforeStartUploading = async items => {
                        // Show upload modal before receiving links for better UX
                        if (!$scope.keepClosed) {
                            $scope.showUploadsPopup();
                        }

                        if ($scope.sourceModal) {
                            $scope.closeSourceModal();
                        }

                        checkFilesBeforeUpload(items);

                        const {data: filesUploadData} =
                            await $http.post('/api/files/upload/prepare', {count: _.size(items)});
                        items.forEach((item, index) => {
                            const fileUpload = filesUploadData[index];
                            for (let key in fileUpload) {
                                item[key] = fileUpload[key];
                            }
                        });
                    }
                    // For GCS uploader - bulk request for GCS links/filenames before uploading
                    if (UploaderService.isGCSUploader) {
                        $scope.uploader.waitBeforeStartUploading = waitForGCSBeforeStartUploading;
                    }

                    $scope.uploader.onCompleteAll = function (){
                        checkIsSchemaDefining();
                        tryToReleaseReloadLock()
                    };

                    $scope.uploader.onCancelItem = function () {
                        let allCancelled = _.every($scope.uploader.queue, i => {
                            return (i.isCancel || i.isError)
                        });
                        if (allCancelled) {
                            $scope.uploader.isUploading = false;
                            window.onbeforeunload = undefined;
                        }
                    };

                    $scope.uploader.onBeforeUploadItem = function (item){
                        item.timeStamp = Date.now();
                        item.prevProgress = 0;
                    };

                    function checkUploaderIsIngesting() {
                        let ingestingItems = _.filter($scope.uploader.queue, item => {
                            if(item.ingesting && item.ingesting === 'IN_PROGRESS' && !item.stoppingIngest) {
                                return item;
                            }
                        });
                        $scope.uploader.isIngesting = _.size(ingestingItems) > 0
                    }

                    function onQuickIngestComplete(task, event) {
                        let item = _.find($scope.uploader.queue, function (item) {
                            return item.datadoc && (_.contains(item.datadoc.lastFlowExecutionTasks, task.taskId));
                        });
                        function handleIngestionFinish() {
                            item.ingesting = 'FINISHED';
                            $rootScope.$broadcast('upload-item-ingest-complete', {event, item});
                            checkUploaderIsIngesting();
                            $rootScope.$broadcast('delete-ingesting-value', item.datadoc.id);
                            console.log("FINISHED IN", Date.now() - item.timeStamp);
                        }
                        if(item && !item.stoppingIngest) {
                            item.tasks[task.taskId]['finished'] = true;
                            const allFinished = _.keys(item.tasks).length === item.tasksCount && _.every(_.values(item.tasks), 'finished');
                            if(allFinished) {
                                if(item.datadoc.gathererTask) {
                                    const handleGathererWait = () => {
                                        $http.post("/api/flow/get_state", {taskId: item.datadoc.gathererTask})
                                            .then(({data}) => {
                                                if(data.finished) {
                                                    handleIngestionFinish();
                                                } else {
                                                    setTimeout(handleGathererWait, 1000);
                                                }
                                            }).catch((err) => console.log(err));
                                    };
                                    handleGathererWait()
                                } else {
                                    handleIngestionFinish();
                                }
                            }
                        }
                    }

                    $scope.getUnderNameStatus = function (item) {
                        let transition = item.isUploaded && !item.ingesting && !item.isCancel && !item.verifying;

                        if (!item.isError && item.isUploading || transition) {
                            return `Part 1 of 3 - Uploading (${item.progress}%)...`;
                        } else if (item.verifying) {
                            return `Part 2 of 3 - Verifying file...`
                        } else if (item.ingesting && item.ingesting !== 'FINISHED' && !item.stoppingIngest) {
                            return `Part 3 of 3 - Saving to datadoc (${parseInt(item.ingestingProgress)}%)...`;
                        }
                    };

                    function onQuickIngestProgress(task, event) {
                        let item = _.find($scope.uploader.queue, function (item) {
                            return item.datadoc && _.contains(item.datadoc.lastFlowExecutionTasks, task.taskId);
                        }), props = {};

                        if(item && !item.stoppingIngest) {
                            const tasksCount = item.datadoc.lastFlowExecutionTasks.length;
                            (item.tasks || (item.tasks = {}));
                            item.tasksCount = tasksCount;

                            item.tasks[task.taskId] = {
                                progress: event.state.OUTPUT.percentComplete,
                                processedRows: event.state.OUTPUT.processedRowsCount,
                                totalRows: event.state.OUTPUT.allRowsCount
                            };


                            if(_.every(item.tasks, (task) => task.totalRows > 0)) {
                                const newIngestingProgress = calculateProgress(item.tasks);
                                if(item.ingestingProgress !== newIngestingProgress) {
                                    item.ingestingProgress = newIngestingProgress;

                                    if(item.ingestingProgress == 100) {
                                        item.ingestingProgress = 99;
                                    }
                                    props = {
                                        ingestingProgress: item.ingestingProgress,
                                        id: item.datadoc.id
                                    };
                                    $rootScope.$broadcast('update-ingesting-value', props);
                                }
                            }

                        }
                    }

                    $scope.clearItem = function(item) {
                        $scope.uploader.removeFromQueue(item);
                        $scope.definedSchemaFilesCount--;
                        if($scope.uploader.queue.length == 0) {
                            $scope.closeUploadsPopup();
                        }
                    };

                    $scope.definedSchemaFilesCount = 0;

                    const checkIsSchemaDefining = () => {
                        $scope.uploader.isSchemaDefining = $scope.uploader.queue.length >= ++$scope.definedSchemaFilesCount;
                    };

                    function createDatadoc(upload, preProcessionTime, autoIngest = true, preSave = false) {
                        return $http({
                            method: 'POST',
                            url: '/api/docs',
                            data: {
                                name: upload.name,
                                sourcePath: 'id:' + upload.id,
                                parentId: upload.parentId,
                                autoIngest,
                                preProcessionTime,
                                embedded: true,
                                preSave
                            }
                        });
                    }
                    $scope.uploader.onSuccessItem = async function(item, descriptor){
                        console.log(`Uploading took ${Date.now() - item.timeStamp} ms`);

                        checkIsSchemaDefining();
                        item.verifying = true;
                        $scope.uploader.isVerifying = true;

                        const canceler = $q.defer();
                        let post;
                        if(item.restoredIngest) {
                            item.verifying = false;
                            post = Promise.resolve({data: {file: item.result}});
                        } else if (UploaderService.isGCSUploader) {
                            const {md5Checksum: hash, id: fileId} = JSON.parse(descriptor);
                            const saveDescriptorOptions = {
                                sessionId: item.sessionId,
                                path: $scope.uploader.path || '',
                                fileName: item.file.name,
                                fileSize: item.file.size,
                                contentType: item.file.type,
                                hash,
                                fileId
                            };
                            post = $http.post('/api/files/upload/confirm', saveDescriptorOptions, {timeout: canceler.promise});
                        } else {
                            post = $http.post('/api/files/create-from-storage', descriptor, {timeout: canceler.promise});
                        }

                        item.cancel = canceler.resolve;
                        item.isSchemaDefining = true;
                        post.then(data => {
                            const endProcession = Date.now() - item.timeStamp;
                            const response = UploaderService.isGCSUploader ? data.data.file : data.data;
                            item.result = response;
                            item.isSchemaDefining = false;
                            if(!item.restoredIngest) {
                                $rootScope.$broadcast('upload-item-success', {item, upload: response});
                            }

                            function createIndexAndIngest(upload){
                                return createDatadoc(upload, endProcession).then(response => {
                                    item.verifying = false;
                                    tryToReleaseReloadLock()
                                    $scope.uploader.isVerifying = false;

                                    item.ingesting = 'IN_PROGRESS';
                                    item.ingestingProgress = item.ingestingProgress > 0 ? item.ingestingProgress : 0;
                                    $scope.uploader.isIngesting = true;

                                    let datadoc = response.data;
                                    SourceService.reset({keepSize: true});
                                    item.datadoc = datadoc;
                                });
                            }
                            if(response.descriptor) {
                                let composite = response.descriptor.composite,
                                    valid = response.descriptor.valid;
                            if (valid) {
                                if(composite) {
                                    if(response.sections.length > 0){
                                        let section = response.sections[0];
                                        if(section.descriptor.valid && !item.restoredIngest) {
                                            console.log('composite file uploaded, creating datadoc', response);
                                            return createIndexAndIngest(response)
                                        }
                                    }
                                } else if(!item.restoredIngest) {
                                    console.log('single file uploaded, creating datadoc', response);
                                    return createIndexAndIngest(response)
                                }
                            }
                                if(item.restoredIngest) {
                                    item.verifying = false;
                                    tryToReleaseReloadLock()
                                    $scope.uploader.isVerifying = false;
                                    item.ingesting = 'IN_PROGRESS';
                                    item.ingestingProgress = item.ingestingProgress > 0 ? item.ingestingProgress : 0;
                                    $scope.uploader.isIngesting = true;
                                } else {
                                    item.verifying = false;
                                    item.ingesting = 'NO_INGEST';
                                }
                            }
                        }).catch( (error) => {
                            checkIsSchemaDefining();
                            item.isCancel = true;
                            item.isUploading = false;
                            item.isSchemaDefining = false;
                            if(error.data) {
                                $scope.uploader._onErrorItem(item,
                                    [error.data], error.status,
                                    error.status)
                            } else {
                                // todo: if GCS uploader, delete item another way
                                $http.post("/api/files/delete_file_by_path", error.config.data.filePath);
                            }

                        });
                    };

                    $scope.uploader.onErrorItem = function(item, response, status, x){
                        item.isSchemaDefining = false;
                        item.verifying = false;
                        if(status == 400){
                            item.errorCode = response[0].code;
                            item.errorMessage = response[0].message;
                            item.errorDescription = response[0].description;
                        } else if(status == 409) {
                            item.isDuplicate = true;
                            const {resourceId: id, resourceName: name, message} = response[0];
                            item.errorMessage = message;
                            item.existsFileInfo = {id, name};
                        } else if (status == 500){
                            item.errorMessage = 'Could not ingest file';
                            item.errorDescription = response.message || response[0].message || response[0].errorDescription
                        }
                    };

                    $scope.stopIngest = (item) => {
                        item.stoppingIngest = true;
                        Promise.all(_.map(item.datadoc.lastFlowExecutionTasks, taskId => $http.post('/api/flow/cancel', {taskId})))
                            .then(() => {
                                item.ingesting = 'NO_INGEST';
                                item.resultMessage = "Datadoc creation stopped.";
                                checkUploaderIsIngesting();
                                $scope.closeStopIngestModal();
                            }).catch((err) => {
                            item.stoppingIngest = false;
                        });
                    };

                    $scope.openDatadoc = function(item) {
                        if(item && item.isDuplicate) {
                            createDatadoc(item.existsFileInfo, null, false, true).then(response => {
                                console.log("goToVisualization")
                                $scope.goToVisualization(response.data, false, true);
                            });
                        }

                        if(item && item.isUploaded && item.isSuccess && !item.stoppingIngest) {
                            if(item.ingesting == 'FINISHED' || item.ingesting == 'IN_PROGRESS') {
                                if(item.datadoc) {
                                    $scope.goToVisualization(item.datadoc);
                                }
                            } else if(item.ingesting === 'NO_INGEST') {
                                $rootScope.$broadcast('create-index-from-upload', item.result);
                            }
                        }
                    };
                    $scope.uploader.clearQueue();

                    $http.post('/api/flow/get_active_tasks')
                        .then(({data: tasks}) => {
                            if(tasks.length >= 1) {
                                const tasksByMainSource = _.groupBy(tasks, task => _.min(task.taskInfo.result.sourceIds));

                                const toAddToQueue = _.reduce(tasksByMainSource, (queueItems, tasks, sourceId) => {
                                    const [{ datadoc, upload }] = tasks;
                                    const ingestingProgress = calculateProgress(_.map(tasks, 'taskInfo'));

                                    const props = {
                                        prevProgress: ingestingProgress,
                                        progress: ingestingProgress,
                                        ingestingProgress,
                                        isSuccess: true,
                                        isUploaded: true,
                                        restoredIngest: true,
                                        result: upload,
                                        datadoc,
                                        ingesting: 'IN_PROGRESS',
                                    };

                                    $rootScope.$broadcast('update-ingesting-value', {
                                        ingestingProgress: props.ingestingProgress,
                                        id: datadoc.id
                                    });

                                    queueItems.files.push({
                                        name: upload.name,
                                        size: upload.descriptor.size
                                    });
                                    queueItems.options.push({props});

                                    return queueItems;
                                }, { files: [], options: [] });

                                $scope.uploader.addToQueue(toAddToQueue.files, toAddToQueue.options);
                            }
                        }).catch(err => console.error(err));

                    $scope.$on('close-uploads-modal', function() {
                        $scope.closeUploadsPopup();
                    });

                    BookmarkCommitService.on('complete', onQuickIngestComplete);
                    BookmarkCommitService.on('progress', onQuickIngestProgress);
                    $scope.$on('$destroy', function(){
                        BookmarkCommitService.off('complete', onQuickIngestComplete);
                        BookmarkCommitService.off('progress', onQuickIngestProgress);
                    });
                }
            }
    }])
});