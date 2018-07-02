define(['./module', 'lodash'], function(module, _) {
    module.service('BookmarkCommitService', ['$http', '$rootScope', '$timeout', 'WSocket', 'DataLoadingService',
        function ($http, $rootScope, $timeout, WSocket, DataLoadingService) {

        let bookmarkTasks = {},
            subscribed,
            subscriptions = {start: [], progress: [], complete: []};

        function getActiveTasks(options = {}){
            return $http.post('/api/flow/get_active_tasks')
                .then(function(response){
                    _.each(_.map(response.data, 'taskInfo'), task => {
                        let e = _.merge({taskId: task.id}, task.result);
                        applyFlowStart(e);
                        applyFlowProgress(e);
                    });

                    function handler(e) {
                        switch (e.type) {
                            case 'FLOW_EXEC_START':
                                applyFlowStart(e);
                                break;
                            case 'FLOW_EXEC_PROGRESS':
                                applyFlowProgress(e);
                                break;
                            case 'FLOW_EXEC_COMPLETE':
                                applyFlowComplete(e);
                                break;
                        }
                    }

                    const { isPublicChannel, resetCurrentDatadoc } = options;

                    const currentDatadocId = resetCurrentDatadoc ? null : _.get(DataLoadingService.getCurrentDoc(), 'id', null);
                    const flowTopic = currentDatadocId ? `/flow-events/${currentDatadocId}` : "/flow-events";
                    if(subscribed) {
                        WSocket.unsubscribe(flowTopic, handler)
                    }
                    WSocket.subscribe(flowTopic, handler, isPublicChannel);

                    console.log(`Subscribed to %c${isPublicChannel ? "public" : "private"}%c channel %c(${flowTopic})`,
                        `color: ${isPublicChannel ? "green": "red"}`, 'color: unset', `color: ${isPublicChannel ? "green": "red"}`);

                }).catch(err => console.error(err));
        }

        function applyFlowStart(e){
            let task = {progress: 0, taskId: e.taskId, bookmarkId: e.bookmarkId, sourceIds: e.sourceIds, status: "Calculating..."};
            bookmarkTasks[e.bookmarkId] = task;
            $timeout(function(){
                _.each(subscriptions.start, function(handler){
                    handler(task, e);
                })
            })
        }

        function applyFlowProgress(e){
            let outputNodeState = e.state['OUTPUT'];
            let progress;
            let status;
            let task = bookmarkTasks[e.bookmarkId];
            //todo fix this
            const allRowsDefined = outputNodeState.allRowsCount !== outputNodeState.processedRowsCount || outputNodeState.percentComplete > 0;
            switch(outputNodeState.state){
                case 'WAIT':
                    status = '';
                    progress = 0;
                    break;
                case 'RUNNING':
                    if(allRowsDefined) {
                        progress = outputNodeState.percentComplete ? parseFloat(outputNodeState.percentComplete.toFixed(0)) : 0;
                        status = null;
                    } else {
                        status = `${outputNodeState.processedRowsCount} rows ingested`;
                        progress = 0;
                    }
                    break;
                case 'FINISHED':
                    status = null;
                    progress = 100.;
                    break;
            }
            task.status = status;
            task.progress = progress > 100 ? 100 : Math.max(progress, 0);
            $timeout(() => _.each(subscriptions.progress, (handler) => handler(task, e)));
        }

        function applyFlowComplete(e){
            let task = bookmarkTasks[e.bookmarkId];
            $timeout(() => _.each(subscriptions.complete, (handler) => handler(task, e)));
            delete bookmarkTasks[e.bookmarkId];
        }

        let state = {
            get: function(bookmarkId){
                return bookmarkTasks[bookmarkId]
            },
            getBySource: function(sourceId){
                return _.find(_.values(bookmarkTasks), task => {
                    return _.includes(task.sourceIds, sourceId);
                })
            },
            commit: function(bookmarkId, userInitiated){
                let task = bookmarkTasks[bookmarkId];
                if(!task){
                    return $http.post('/api/flow/execute', { bookmarkId, userInitiated })
                        .then(taskId => {
                            applyFlowStart({taskId: taskId.data, bookmarkId});
                        })
                }
            },
            updateStatus: (bookmarkId, status) => {
                _.set(bookmarkTasks[bookmarkId], 'status', status);
            },
            ingest: function(source, options = {}){
                let embedded = options.embedded;
                return $http.post('/api/docs', {
                    name: source.name,
                    sourcePath: 'id:' + source.id,
                    embedded: options && _.isBoolean(embedded) ? embedded : true,
                    autoIngest: true
                }).success(datadoc => {
                    _.forEach(datadoc.lastFlowExecutionTasks, (taskId) => applyFlowStart({taskId}));
                })
            },
            cancel: function(bookmarkId){
                let task = bookmarkTasks[bookmarkId];
                if(task) {
                    task.cancelling = true;
                    return $http.post('/api/flow/cancel', {taskId: task.taskId});
                }
            },
            isCommitRunning: function(bookmarkId){
                return !!bookmarkTasks[bookmarkId];
            },
            isCommitCancelling: function(bookmarkId){
                return state.isCommitRunning(bookmarkId) && bookmarkTasks[bookmarkId].cancelling;
            },
            on: function(eventName, handler){
                subscriptions[eventName].push(handler);
            },
            off: function(eventName, handler){
                _.remove(subscriptions[eventName], function(h){
                    return h === handler;
                })
            },
            reset: (options = {}) => state.promise = getActiveTasks(options)
        };
        return state;
    }]);
});

