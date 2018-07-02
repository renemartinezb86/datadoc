define(['./module', 'lodash'], function (directives, _) {
    'use strict';
    directives.directive('mainPageFileDetails', ['SourceService', 'BookmarkCommitService', '$rootScope',
        function (SourceService, BookmarkCommitService, $rootScope) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/main-page-file-details.html',
            link: function ($scope, $elm, $attr) {
                $scope.fileDetails = {
                    isOpen: false,
                    current: null,
                    icon: null,
                    type: null,
                    location: null,
                    datadocs: [],
                    history: []
                };

                function onIngestStart (t, e) {
                    if($scope.fileDetails.current) {
                        if (_.includes(e.sourceIds, $scope.fileDetails.current.id)) {
                            $scope.fileDetails.ingesting = true;
                            $scope.fileDetails.ingestProgress = 0;
                        }
                    }
                }

                function onIngestComplete (t, e) {
                    if($scope.fileDetails.current) {
                        if (_.includes(e.sourceIds, $scope.fileDetails.current.id)) {
                            $scope.fileDetails.ingesting = false;
                            $scope.fileDetails.ingestProgress = 1;
                        }
                    }
                }

                function onIngestProgress (t, e) {
                    if($scope.fileDetails.current) {
                        if (_.includes(e.sourceIds, $scope.fileDetails.current.id)) {
                            $scope.fileDetails.ingesting = true;
                            $scope.fileDetails.ingestProgress = t.progress >= 100 ? 0.99 : t.progress / 100.;
                        }
                    }
                }

                function isDatadoc(u) {
                    return u.entityType == 'Datadoc';
                }

                BookmarkCommitService.on('start', onIngestStart);
                BookmarkCommitService.on('complete', onIngestComplete);
                BookmarkCommitService.on('progress', onIngestProgress);

                $scope.$on('$destroy', function(){
                    BookmarkCommitService.off('start', onIngestStart);
                    BookmarkCommitService.off('complete', onIngestComplete);
                    BookmarkCommitService.off('progress', onIngestProgress);
                });

                $rootScope.$on('source-updated', (e, data) => {
                    let source = data.source;
                    if($scope.fileDetails.current &&
                        (source.id === $scope.fileDetails.current.id)) {
                        $scope.fileDetails.current = source;
                    }
                });

                $scope.$on('source-selection-changed', (e, items, deleted) => {
                    if(items) {
                        if(!items.allSelected.length){
                            $scope.closeFileDetailsPanel();
                        } else {
                            $scope.fileDetails.isOpen = true;
                            changeFileDetails(items.selected);
                        }
                    } else if(deleted) {
                        $scope.closeFileDetailsPanel();
                    }
                });

                $scope.$on('ingest-selected-source', (e, data) => {
                    $scope.ingestSelectedSource(data);
                });

                function changeFileDetails (u) {
                    let task = BookmarkCommitService.getBySource(u.id);
                    if(task){
                        $scope.fileDetails.ingesting = true;
                        $scope.fileDetails.ingestProgress = task.progress;
                    } else {
                        $scope.fileDetails.ingesting = false;
                        $scope.fileDetails.ingestProgress = 0;
                    }
                    $scope.fileDetails.current = u;
                    // todo refactor
                    if(isDatadoc(u)) {
                        $scope.fileDetails.type = 'Datadoc';
                        $scope.fileDetails.icon = 'index-icon';
                        let folder = $scope.selectedDocFolder;
                        let parentsPath = [{name: 'My Data'}].concat(
                            folder ? folder.parentsPath.concat([{name: folder.name}]) : []);
                        $scope.fileDetails.location = SourceService.getSourcePath({parentsPath}).substring(1);
                        $scope.fileDetails.numSheets = null;
                        $scope.fileDetails.numTables = null;
                    } else {
                        $scope.fileDetails.icon = $scope.getUploadIcon(u);
                        $scope.fileDetails.type = $scope.getFormatName(u);
                        let folder = $scope.selectedSourceFolder;
                        let parentsPath =  [{name: 'My data'}].concat(
                            folder ? folder.parentsPath.concat([{name: folder.name}]) : []);
                        $scope.fileDetails.location = SourceService.getSourcePath({parentsPath}).substring(1);

                        $scope.fileDetails.numSheets = null;
                        $scope.fileDetails.numTables = null;
                        if (SourceService.isExcelSource(u)) {
                            $scope.fileDetails.numSheets = u.sectionsSize;
                        } else if (SourceService.isDbSource(u)) {
                            $scope.fileDetails.numTables = u.sectionsSize;
                        }
                        $scope.fileDetails.isDatabase = SourceService.isDbSource($scope.fileDetails.current);
                    }
                    $scope.fileDetails.isDatadoc = isDatadoc(u);
                }

                $scope.closeFileDetailsPanel = function () {
                    $scope.fileDetails.isOpen = false;
                    $scope.fileDetails.current = null;
                };

                $scope.startIngesting = function (source) {
                    $scope.fileDetails.ingesting = true;
                    $scope.fileDetails.ingestProgress = 0;
                    BookmarkCommitService.ingest(source)
                };

                $scope.ingestSelectedSource = function () {
                    if ($scope.fileDetails.current.type !== 'folder') {
                        if (SourceService.isDbSource($scope.fileDetails.current)) {
                            $scope.createIndex($scope.fileDetails.current);
                        } else {
                            $scope.createIndex($scope.fileDetails.current,
                                !$scope.fileDetails.current.relatedDatadocs.length);
                        }
                    }
                };

                $scope.cancelNewDatadocModal = function () {
                    $scope.createNewDatadocModal.dismiss();
                };

                $scope.createFromSourceNewDatadocModal = function () {
                    $scope.ingestSelectedSource();
                    $scope.createNewDatadocModal.dismiss();
                };
            }
        }
    }]);
});