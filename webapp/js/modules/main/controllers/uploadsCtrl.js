define(['./module', 'angular', 'common', 'lodash', 'moment', 'KeyJS', 'notifications-utils'], function (controllers, angular, common, _, moment, KeyJS, NotificationsUtils) {
  'use strict';
  controllers.controller('uploadsCtrl', ['$scope', '$rootScope', '$http', '$compile', '$uibModal', '$sce',
    '$q', '$timeout', '$filter', 'WSocket', '$document', 'User', 'UserStateService', '$state', '$window',
    'SourceService', 'SortSectionColumnsService',
    'SortDirection', 'SearchBarService', 'SectionNamesService', 'SearchService',
    'HistoryService', 'UploaderService', 'BookmarkCommitService', 'UserEventService', 'ShareService',
    'RecentSourcesService', 'DbSourceService',
    function ($scope, $rootScope, $http, $compile, $uibModal, $sce, $q, $timeout, $filter, WSocket,
      $document, User, UserStateService, $state, $window, SourceService, SortSectionColumnsService,
      SortDirection, SearchBarService, SectionNamesService, SearchService, HistoryService, UploaderService,
      BookmarkCommitService, UserEventService, ShareService, RecentSourcesService, DbSourceService) {

      var SECTIONS = $scope.SECTIONS = SectionNamesService.SECTIONS;
      $scope.availableFileFormats = UploaderService.availableFileFormats.map(({extension}) => `.${extension}`).join(",");
      var COLUMN_NUMBERS = $scope.COLUMN_NUMBERS = {
        FIRST: 0,
        SECOND: 1,
        THIRD: 2
      };

      $scope.serverTimeDiff = 0;
      $scope.dataModelAPI = {};
      $scope.userState = {};
      $scope.activeSection = SECTIONS.MY_DATA;
      $scope.searchResultsDocs = [];
      $scope.searchResultsFiles = [];


      function sendCreateDatadocRequest(source, preSave) {
        return $http({
          method: 'POST',
          url: '/api/docs',
          data: {
            name: 'Untitled datadoc',
            sourcePath: source && ('id:' + source.id),
            preSave
          }
        });
      }

      /// <header panel actions>
      SearchBarService.callback = search;
      SearchBarService.suggestions = function (searchText) {
        return $http.post('/api/search/suggest', {s: searchText, limit: 10})
          .then(function(response) {
            var data = _.map(response.data, function(o){
              o.icon = $scope.getUploadIcon(o);
              return o;
            });
            if((searchText == '..' && $scope.selectedSourceFolder && $scope.selectedSourceFolder.parentsPath.length == 0)
              || (searchText.toLowerCase() == 'main' || searchText.toLowerCase() == 'root') && data.length < 10) {
              data.push({type: 'folder', icon: 'folder', name: 'Main (root folder)', id: null})
            }
            if(searchText == '..' && $scope.selectedSourceFolder && selectedSourceFolder.parentsPath.length > 0){
              var parent = $scope.selectedSourceFolder.parentsPath.slice(-1).pop();
              data.push({type: 'folder', icon: 'folder', name: parent.name, id: parent.id})
            }
            return data;
          })
      };

      function isSourceFolder(f){
        return f.parentsPath[0].name == 'Source';
      }

      function scrollToItem(id, offset = 0){
        var item = $('.sources-section .upload-item input.uid[value="' + id + '"]').closest('.main-page-ds-pane'),
          parent = item.parent(),
          position = item.position();

        if (parent && position) {
          parent.animate({
            scrollTop: position.top + parent.scrollTop() + offset
          }, 200);
        }
        $scope.selectedUploads = [SourceService.get(id)]
      }

      SearchBarService.suggestionSelected = function ($item){
        switch($item.entityType){
          case 'Datadoc':
            $scope.goToVisualization($item);
            break;
          default:
            var folder;
            if($item.type == 'folder'){
              folder = $item.id == null ? null : $item;
            } else {
              // folder = $item.parentId == null ? null : {type: 'folder', id: $item.parentId};
              $rootScope.$broadcast('create-index-from-upload', $item);
              return;
            }
            $scope.selectSourceFolder(folder).then(function(){
              if($item.type != 'folder') {
                $scope.currentSelectedUpload = $scope.getUploadById($item.id);
                $scope.selectedUploads = [$scope.currentSelectedUpload];
                $timeout(function() {
                  $scope.$broadcast('source-selection-changed');
                  scrollToItem($item.id)
                })
              } else {
                var section = $('.sources-section .index-list-wrapper');
                section.animate({scrollTop: 0}, 200);
              }
            });
            $scope.toggleActiveSection(SECTIONS.MY_DATA);
            break;

        }
        SearchBarService.setSearch('');
      };

      $scope.loadingResults = SearchService.isLoadingResults;

      $scope.$on('set-search-results', setSearchResults);

      function setSearchResults() {
        $timeout(() => {
          $scope.selectedUploads = [];
          if(SearchService.getSearchText()) {
            const searchResultFiles = _.map(SearchService.getList(), file => {
              file.ingestingProgress = _.get(SourceService.get(file.id), 'ingestingProgress');
              return file;
            });
            $scope.searchResultsFiles = searchResultFiles;
          } else {
            $scope.toggleActiveSection(SECTIONS.MY_DATA);
          }
          $scope.columnsSections.searchResultsSources =
            SortSectionColumnsService.genSortColumnsOptions($scope, true);
          $scope.searchInput.keepClosed = false;
        });
      }

      $scope.clearSearch = function () {
        SearchBarService.resetSearch();
      };

      function search(s){
        $scope.searchInput.keepClosed = true;
        $scope.toggleActiveSection(SECTIONS.SEARCH, true);
        $state.go('main.landing.search', {s: s}, {location: true});
      }
      /// </header panel actions>

      function isAllowFileDownload(u) {
        return u && u.descriptor && !u.descriptor.remote;
      }

      function isUploadSelected(u){
        return _.some($scope.selectedUploads, (upload) => upload.id === u.id);
      }

      $scope.highlightedUpload = {};

      function uploadHighlightStatus(u) {
        let checkItem = $scope.highlightedUpload.id === u.id;
        let isInSelected = !!_.find($scope.selectedUploads, (upload) => upload.id === u.id);
        if( checkItem && isInSelected){
          return 'selected'
        } else if(checkItem && !isInSelected){
          return 'non-selected'
        } else {
          return 'not-highlight'
        }
      }

      function isFolder(u) {
        return _.get(u, 'type') === 'folder';
      }

      function isDatadoc(u) {
        return _.get(u, 'type') === 'doc';
      }

      $scope.isDb = SourceService.isDbSource;

      $scope.isUploadSelected = function(u){
        return isUploadSelected(u);
      };

      $scope.uploadHighlightStatus = function(u){
        return uploadHighlightStatus(u);
      };

      $scope.isLandingPage = function () {
        return !!~$state.current.name.indexOf('main');
      };

      $scope.isIndexEditPage = function() {
        return $state.current.name == 'main.index-edit';
      };

      $scope.isBelongsToCurrentFolder = function(file){
        return (!file.parentId && !$scope.selectedSourceFolder)
          || $scope.selectedSourceFolder && (file.parentId === $scope.selectedSourceFolder.id);
      };

      $scope.isShowCompositeAsSingle = function(u){
        return u.type == 'composite-ds' && u.descriptor && (_.contains(['XLS', 'XLSX'], u.descriptor.format) && u.sections && u.sections.length == 1);
      };

      $scope.isShowSections = function(u){
        return u.expanded && !$scope.isShowCompositeAsSingle(u);
      };

      $scope.hasError = function(u){
        return u.descriptor && u.descriptor.valid === false;
      };

      $scope.isShowEditAction = function(){
        if($scope.selectedUploads.length != 1){
          return false;
        }
        var u = $scope.selectedUploads[0];
        return u && u.descriptor && _.contains(['MYSQL', 'MSSQL', 'POSTGRESQL', 'ORACLE'], u.descriptor.format);
      };

      $scope.isShowOpenAction = function() {
        return $scope.selectedUploads.length == 1;
      };

      $scope.isShowRenameAction = function(){
        return $scope.selectedUploads.length == 1;
      };

      $scope.isShowDownloadAction = function(){
        if($scope.selectedUploads.length != 1){
          return false;
        }
        var u = $scope.selectedUploads[0];
        return isAllowFileDownload(u);
      };

      $scope.isShowDownloadArchiveAction = function(withoutMultiplyChecking){
        return ($scope.selectedUploads.length == 1 && $scope.selectedUploads[0].type == 'folder') ||
          (!withoutMultiplyChecking && $scope.selectedUploads.length > 1 && _.every($scope.selectedUploads, function(u){
            return u && u.type == 'folder' || isAllowFileDownload(u)
          }));
      };

      $scope.isShowDeleteAction = function(){
        return $scope.selectedUploads.length > 0;
      };

      $scope.isShowOriginalName = function(u){
        return u.descriptor && $scope.isDb(u) && (u.name != $scope.getOriginalName(u));
      };

      $scope.isDbExternalDsTypeSelected = function(){
        return _.contains(['MySQL', 'PostgreSQL', 'Microsoft SQL Server', 'Oracle Database'], $scope.externalDsType);
      };
      /// </check functions>

      $scope.toggleActiveSectionWrapper = function(section) {
        if (section === SECTIONS.MY_DATA && $scope.selectedSourceFolder) {
          $scope.selectSourceFolder();
        } else {
          $scope.toggleActiveSection(section);
        }
      };

      const setActiveSection = (section) => {
        if (section == null) {
          section = $scope.activeSection;
        }
        if ($scope.activeSection != section && section != SECTIONS.SEARCH) {
          UserEventService.emit('.ActiveSectionChangeEvent', {activeSection: section}, $scope);
        }

        $scope.userState.activeSection = $scope.activeSection = section;
      };

      $scope.toggleActiveSection = function (section, suppressStateChange, ignoreFolder) {
        if ($scope.activeSection === SECTIONS.SEARCH && section !== SECTIONS.SEARCH) {
          SearchBarService.resetSearch();
        }
        setActiveSection(section);
        $scope.selectedUploads = [];
        if(!suppressStateChange) {
          if (section === SECTIONS.MY_DATA) {
            $state.go('main.landing.my_data', {f: $scope.selectedSourceFolder && !ignoreFolder ? $scope.selectedSourceFolder.id : null});
          } else {
            $state.go(SectionNamesService.getSectionNameFromSection(section));
          }
        }
      };

      $scope.editedSourceFolder = false;
      $scope.selectedUploads = [];
      $scope.lastSelectedUpload = false;
      $scope.pendingDownloads = [];

      $scope.checkingPendingDownloads = false;
      $scope.checkPendingDownloads = function(force){
        if(!$scope.checkingPendingDownloads || force) {
          $scope.checkingPendingDownloads = true;
          $http.get('/api/files/archive/pending')
            .success(function (data) {

              _.forEach($scope.pendingDownloads, function(d1){
                var found = false;
                _.forEach(data, function(d2){
                  if(d1.id == d2.id){
                    found = true;
                  }
                });
                // it's finished
                if(!found){
                  common.withIgnoreOnBeforeUnload($timeout, function(){
                    window.location.href = '/api/files/archive/download?requestId=' + d1.id
                  })

                }
              });
              $scope.pendingDownloads = data;
              if($scope.pendingDownloads.length) {
                $timeout(function () {
                  $scope.checkPendingDownloads(true);
                }, 5000)
              } else {
                $scope.checkingPendingDownloads = false;
              }
            });
        }
      };

      $scope.showNewFolderModal = function(){
        if($scope.activeSection !== SECTIONS.MY_DATA) {
          $scope.toggleActiveSection(SECTIONS.MY_DATA);
        }
        $timeout(() => {
          $scope.creatingSourceFolder = true;
          $scope.$broadcast('create-folder-new-source-folder', $scope.selectedSourceFolder);
        });
      };

      $scope.resetSelectedUpload = function(){
        $scope.selectedUploads = [];
        $scope.lastSelectedUpload = undefined;
        $scope.highlightedUpload = {};
      };

      $scope.createNewSourceFolder = function(name, parentId, callback){
        $scope.newSourceFolderLoading = true;
        $http.post('/api/files/create_folder', {path: (parentId ? 'id:' + parentId : '') + '/' + name})
          .then(res => {
            $scope.resetSources({keepSize: true})
              .then(() => {
                $scope.creatingSourceFolder = $scope.newSourceFolderLoading = false;
                $scope.singleClick(res.data);
                $timeout(() => {
                  scrollToItem(res.data.id, -104); // 2 rows
                  callback && callback(res.data);
                }, false);
              });
          })
          .catch(res => {
            $scope.creatingSourceFolder = $scope.newSourceFolderLoading = false;
            common.showError(res.data);
          });
      };

      $scope.isNewSourceFolderLoading = function() {
        return $scope.newSourceFolderLoading;
      };

      $scope.cancelSourceFolderCreate = function(){
        $scope.creatingSourceFolder = false;
      };

      $scope.getCurrentPageView = function() {
        return $state.current.name;
      };

      $scope.getUploads = function(){
        return SourceService.getList();
      };

      $scope.getSearchResults = function() {
        return SearchService.getList();
      };

      function getAllSortedUploads() {
        switch($scope.activeSection) {
          case SECTIONS.SEARCH: return $scope.searchResultsFiles;
          default: return $scope.getUploads();
        }
      }

      $scope.singleClick = function(f, e){
        var isCtrlKey = e && !e.shiftKey && (e.ctrlKey || e.metaKey),
          isShiftKey = e && e.shiftKey;

        let [selectedItems, lastSelectedItem, highlightedUpload] = [$scope.selectedUploads, $scope.lastSelectedUpload, $scope.highlightedUpload];

        if(isCtrlKey){

          if(e.which === KeyJS.UP || e.which === KeyJS.DOWN){
            highlightedUpload = f;
          } else {
            highlightedUpload = {};
            if (e.which === KeyJS.SPACEBAR) {
              highlightedUpload = f;
            }
            if(!isUploadSelected(f)){
              selectedItems.push(f);
            } else {
              _.remove(selectedItems, function(u){ return u.id == f.id})
            }
          }
          lastSelectedItem = f;
        } else if(isShiftKey) {
          highlightedUpload = {};
          //define file range from last selected to f, select it and unselect all others
          var allSorted = [];
          if(!lastSelectedItem){
            allSorted = [f];
            lastSelectedItem = f;
          } else {
            allSorted = getAllSortedUploads(f);
          }
          var lastSelected = lastSelectedItem;
          if(e.selectedBeforeLasso){
            lastSelected = e.lassoStartedFrom;
          }
          var indexOfSelected = _.findIndex(allSorted, function(u){ return u.id === f.id });
          var indexOfLastSelected = lastSelected ? _.findIndex(allSorted, function(u){ return u.id === lastSelected.id }) : 0;
          var first = Math.min(indexOfSelected, indexOfLastSelected),
            last = Math.max(indexOfSelected, indexOfLastSelected);

          let newRange = _.slice(allSorted, first, last + 1);
          if(e.selectedBeforeLasso){
            _.each(newRange, function(u){
              let bli = _.findIndex(e.selectedBeforeLasso, u);
              if(bli > -1){
                e.selectedBeforeLasso.splice(bli, 1);
              }
            });
            newRange.push(...e.selectedBeforeLasso);
          }
          selectedItems = newRange;
        } else {
          highlightedUpload = {};
          lastSelectedItem = f;
          selectedItems = [f];
        }

        // sync local obj and $scope
        $scope.currentSelectedUpload = f;
        $scope.lastSelectedUpload = lastSelectedItem;
        // $scope.savedLastSelectedUpload = lastSelectedItem;
        $scope.selectedUploads = selectedItems;
        $scope.highlightedUpload = highlightedUpload;
        let uploads = {
          selected:  $scope.currentSelectedUpload,
          allSelected: $scope.selectedUploads
        };

        if(!(isCtrlKey && (e.which === KeyJS.UP || e.which === KeyJS.DOWN))){
          $rootScope.$broadcast('source-selection-changed', uploads);
        }

        $scope.resetRenameSource();
      };

      $scope.onWrapperClick = function(){
        if(!$scope.isSelectionDragged.value){
          $scope.resetSelectedUpload();
        }
        $scope.isSelectionDragged.value = false;

        $rootScope.$broadcast('source-selection-changed')
      };

      $scope.selectSourceFolder = function(f){
        if(!f || f.type === 'folder') {
          return SourceService.selectFolder(f ? f.id : null)
            .then(folder => {
              $scope.selectedSourceFolder = folder;
              UserEventService.emit('.SelectedFolderChangeEvent', {folderId: folder ? folder.id : null}, $scope);
              $scope.toggleActiveSection(SECTIONS.MY_DATA);
            });
        }
      };

      $scope.getUploadIcon = SourceService.getIcon;

      $scope.dropFileCallback = function(event){
        var drop = $(event.target);
        var parentId = drop.find('input.uid').val();
        var newFolder = $scope.getUploadById(parentId);
        // can't drag folder into self
        if(newFolder && isUploadSelected(newFolder)){
          event.preventDefault();
          return;
        }
        doMoveSource($scope.selectedUploads.slice(), $scope.selectedSourceFolder, newFolder);
      };

      function getHistoryActionMessage(message){
        $scope.historyActionMessage = message;
        return $compile($(
          '<span>' +
          '<span style="flex-grow: 100">{{ historyActionMessage | limitTo : 100}}</span>' +
          '<a style="padding-left: 20px" ng-click="undoLastAction()">UNDO</a>' +
          '</span>'
        ))($scope);
      }

      $scope.undoLastAction = function (){
        HistoryService.undo();
      };

      $scope.redoLastAction = function (){
        HistoryService.redo();
      };

      var handleShortcuts = HistoryService.handleShortcuts($scope);
      $('body').on('keydown', handleShortcuts);
      $scope.$on('$destroy', function(){
        $('body').off('keydown', handleShortcuts);
      });

      function doMoveSource(files, oldFolder, newFolder){
        var ids = _.map(files, function(u){return 'id:' + u.id});
        function move(to){
          return $http.post('/api/files/move', { fromPaths: ids, toPath: to ? 'id:' + to.id : '' })
            .catch(common.showError)
        }
        HistoryService.do({
          redo: function () { return move(newFolder).then(function() { $scope.resetSources({keepSize: true}) }) },
          undo: function () { return move(oldFolder).then(function() { $scope.resetSources({keepSize: true}) }) },
          notify: getHistoryActionMessage(
            "Moved " + ids.length + " file" + (ids.length > 1 ? 's' : '')
            + " to " + (newFolder ? newFolder.name : 'Sources'))
        });
      }

      $scope.processRenderedSourceBreadcrumbs = function(){
        $(".breadcrumbs .item.item-link, .folders-path .item.item-link").droppable({
          accept: ".upload-item",
          hoverClass:"drop-active",
          drop: $scope.dropFileCallback,
          tolerance: 'pointer'
        });
      };

      $scope.isSelectionDragged = {value: false};

      $scope.getFilePath = SourceService.getSourcePath;

      $scope.selectParentSourceFolder = function(u){
        $scope.selectSourceFolder(u.parentsPath[u.parentsPath.length - 1]);
      };

      $scope.getFileSizeString = function (u) {
        if(u.descriptor && u.descriptor.size) {
          return $filter('size')(u.descriptor.size, 0, 'bytes');
        }
        return '—'
      };

      $scope.fileDetailsShareWithMessage = (source) => ShareService.fileDetailsShareWithMessage(source);
      $scope.isSharedWithAnyOne = (u) => {
        return !!_.get(u.sharedWithInfo, 'allSharedCount');
      };

      $scope.getSharedInfoTooltip = (u) => {
        const hideUsersCount = _.get(u.sharedWithInfo, 'hideCount');
        const sharedWith = _.get(u.sharedWithInfo, 'sharedWith');

        if($scope.isSharedWithAnyOne(u)) {
          return `${sharedWith.join('<br/>')} ${hideUsersCount > 0 ? `<br/> and ${hideUsersCount} more...` : ''}`
        } else {
          return `<span>Not shared with anyone yet</span>`
        }

      };

      $scope.getSharedInfo = (u) => {
        const sharedCount = _.get(u.sharedWithInfo, 'allSharedCount');
        if(sharedCount) {
          return `${sharedCount} member${sharedCount > 1 ? 's' : ''}`
        } else {
          return `Not shared`
        }
      };

      $scope.getDimensionsString = function (u) {
        if(u.descriptor) {
          if (u.descriptor.composite){
            let objName = u.descriptor.remote ? 'table' : 'sheet';
            return `${u.sectionsSize} ${objName}${u.sectionsSize > 1 ? 's' : ''}`
          } else {
            let rows = u.descriptor.rowsCount,
              rowsApprox = !!u.descriptor.rowsEstimatedCount,
              rowsStr = $filter('size')(rows, rowsApprox ? 0 : 1);
            return `${rowsStr} row${rows > 1 ? 's' : ''}`
          }
        }
      };

      // For context-menu
      $scope.mainMenuOptions = function(){
        return [
          ["Add Source", function() {
            return $scope.addDataSource()
          }],
          ["Add Folder", function() {
            return $scope.showNewFolderModal()
          }]
        ];
      };

      $scope.mainPageMainMenuOptions = function(){
        function getMainPageMenuOptionsTemplate(title, iconClass) {
          return '<div class="icon"> <div class="img ' + (iconClass || '') + '"></div> </div> <span class="text-content"> ' + title + ' </span>';
        }

        var items = [
          [ getMainPageMenuOptionsTemplate('Create datadoc', 'index-icon icon-small'), function() {
            return $scope.createIndex();
          }],
          [ getMainPageMenuOptionsTemplate('Add source', 'sources'), function() {
            return $scope.addDataSource();
          }],
          [ getMainPageMenuOptionsTemplate('Add folder', 'folder icon-small'), function() {
            return $scope.showNewFolderModal();
          }]
        ];

        return items;
      };


      $scope.getErrorDescription = function(u){
        if(u.descriptor && u.descriptor.errorString){
          if (_.contains(['MYSQL', 'MSSQL', 'POSTGRESQL', 'ORACLE'], u.descriptor.format)) {
            return '(disconnected)';
          }
        }
      };


      $scope.sourceContextMenuOptions = {
        dropdownMenuClass: 'main-page-dropdown-menu',
        dropdownItemClass: 'main-page-dropdown-menuitem',
        enabled: function(event){
          var o = $(event.originalEvent.target);
          var menuButton = o.closest('.menu-button');
          if(menuButton.length){
            return true;
          }
          var itemId = o.closest('.upload-item').find(".uid").val();
          var item = $scope.getUploadById(itemId, $scope.activeSection);
          if (event.which === 1 /* || event.originalEvent instanceof TouchEvent */) {
            if (isFolder(item)) {
              $scope.$apply(() => $scope.selectSourceFolder(item));
            } else if (isDatadoc(item)) {
              $scope.goToVisualization(item);
            } else {
              if($scope.isDb(item) && _.get(item, 'descriptor.valid') === false) {
                $scope.edit(item);
              } else {
                $scope.createIndex(item);
              }
            }
          }
          return event.type == 'contextmenu';
        },
      };

      $scope.showCreateNewDatadocModal = function(item) {
        $scope.currentFile = item;
        $scope.createNewDatadocModal = $uibModal.open({
          templateUrl: 'static/templates/include/create-datadoc-modal.html;',
          scope: $scope,
          animation: true,
          size: 'md'
        });
        $scope.$broadcast('disable-keyboard-navigation');
        $scope.createNewDatadocModal.closed
          .then(() => $scope.$broadcast('enable-keyboard-navigation'));
      };

      $scope.cancelNewDatadocModal = function() {
        delete $scope.currentFile;
        $scope.createNewDatadocModal.dismiss();
      };

      $scope.mainContextMenuOptions = {
        dropdownMenuClass: 'main-page-dropdown-menu landing-page-menu',
        dropdownItemClass: 'main-page-dropdown-menuitem'
      };

      function containsDocs(items){
        return _.some(items, item => isDatadoc(item))
      }

      $scope.openShareModal = (e, docId) => {
        e.preventDefault();
        e.stopPropagation();
        return ShareService.openShareModal(docId, $scope);
      };

      $scope.uploadedItemOptions = function(event, suppressSelect) {
        var menu = [], itemName;
        var uploadId = $(event.target).closest('.upload-item').find('.uid').val();
        var u = $scope.getUploadById(uploadId, $scope.activeSection);
        if(suppressSelect){
          $scope.singleClick(u, event);
        } else {
          if (!isUploadSelected(u)) {
            $scope.singleClick(u, event);
          }
        }

        function getDocItems(doc){
          let menu = [];
          menu.push(["<i class='fa fa-external-link icon'></i>Open in new tab", function(){
            event.stopPropagation();
            $scope.goToVisualization(doc, true);
          }]);

          menu.push(["<i class='fa  fa-share-alt icon'></i>Share Datadoc", function(){
            event.stopPropagation();
            ShareService.openShareModal(doc.id, $scope);
          }]);
          menu.push(["<i class='fa fa-font icon'></i>Rename", function(){
            return $scope.renameSource(doc);
          }]);
          menu.push(["<i class='fa fa-trash icon'></i>Delete", function(){
            event.stopPropagation();
            return $scope.showDeleteModal();
          }]);
          return menu;
        }

        function getSourceItems(sources){
          let menu = [];

          const isDbSource = $scope.isDb(sources[0]);

          if ($scope.isShowRenameAction()) {
            menu.push(['<i class="fa fa-font icon"></i>Rename', function () {
              return $scope.renameSource(sources[0]);
            }])
          }
          if ($scope.isShowEditAction()) {
            menu.push(['<i class="fa fa-wrench icon"></i>Connection Settings', function () {
              return $scope.edit(sources[0])
            }]);
          }
          if ($scope.isShowDownloadArchiveAction(true)) {
            menu.push(['<i class="fa fa-download icon"></i>Download', function () {
              return $scope.initArchiveDownload(sources);
            }])
          }
          if ($scope.isShowDownloadAction()) {
            menu.push(['<i class="fa fa-download icon"></i>Download', function () {
              return $scope.initDownload(sources[0]);
            }]);
          }
          if ($scope.isShowDeleteAction()) {
            itemName = `<i class="fa fa-trash icon"></i> ${isDbSource ? 'Remove Source' : 'Delete'}`;
            menu.push([itemName, function () {
              return $scope.showDeleteModal();
            }])
          }
          return menu;
        }

        let items = $scope.selectedUploads;
        if(items.length > 1){
          if(containsDocs(items)){
            menu.push(["<i class='fa fa-trash icon'></i>Delete", function(){
              event.stopPropagation();
              return $scope.showDeleteModal();
            }]);
          } else {
            menu = getSourceItems(items);
          }
        } else {
          if(isDatadoc(items[0])){
            menu = getDocItems(items[0]);
          } else {
            menu = getSourceItems(items);
          }
        }
        return menu;
      };

      $document.keydown(function(event){
        if(event.target.tagName != 'INPUT' && event.target.tagName != 'TEXTAREA') {
          if (event.which == 113) {
            $scope.$apply(function () {
              if ($scope.isShowRenameAction()) {
                $scope.renameSource($scope.selectedUploads[0]);
              }
            })
          } else if (event.which == 46) {

            $scope.$apply(function () {
              if ($scope.isShowDeleteAction()) {
                $scope.showDeleteModal();
              }
            })
          }
        }
      });

      $scope.initArchiveDownload = function(us){
        $http.post('/api/files/archive/prepare', {paths: _.map(us, function(u){ return 'id:' + u.id})})
          .success(function(data){
            $scope.pendingDownloads.push({id: data.requestId, finished: false});
            $scope.checkPendingDownloads();
          })
      };

      $scope.initDownload = function(u){
        common.withIgnoreOnBeforeUnload($timeout, function(){
          window.location.href = '/api/files/download?id=' + u.id;
        })
      };

      $scope.getOriginalName = function(u){
        if ($scope.isDb(u)) {
          return u.descriptor.params.dbName;
        }
      };

      $scope.setUploaderUrl = UploaderService.setUrl;
      $scope.resetUploaderUrl = function(){
        UploaderService.setUrl($scope.selectedSourceFolder ? $scope.selectedSourceFolder.id : undefined);
      };

      function showSourceModal(){
        $scope.resetUploaderUrl();
        $scope.sourceModal = $uibModal.open({
          templateUrl: 'static/templates/include/add-source.html',
          scope: $scope,
          animation: true,
          size: 'md'
        });
      }

      $scope.isShowNewSourceFolder = function(){
        return $scope.creatingSourceFolder;
      };
      $scope.isNoUploadsExist = function(){
        return SourceService.getList().length == 0 && !$scope.selectedSourceFolder && !$scope.isShowNewSourceFolder();
      };

      $scope.getUploadById = function(uid, section = $scope.activeSection){
        let upload;
        let uploads = $scope.getUploads();

        if (section === SECTIONS.SEARCH){
          uploads = $scope.searchResultsFiles;
        }

        _.each(uploads, function (u) {
          if (u.id === Number(uid)) {
            upload = u;
            return false;
          } else {
            if (u.sections) {
              let section = _.find(u.sections, s => s.id === uid);
              if (section) {
                upload = section;
                return false;
              }
            }
          }
        });
        return upload;
      };

      $scope.mapToQuery = function(s){
        return { id: s.id, name: s.name, query: s.descriptor.query, parentId: s.parentId, rowsExactCount: s.rowsExactCount}
      };

      $scope.externalDsError = {};
      $scope.edit = function(u){
        if($scope.isDb(u)){
          $scope.externalDsQueries = _(u.sections)
            .filter(function(s){ return _.contains(s.descriptor.format, '_QUERY') })
            .map($scope.mapToQuery)
            .value();

          $scope.isEditDs = true;
          $scope.externalDsConnected = u.descriptor.valid;
          switch(u.descriptor.format){
            case 'MYSQL':
              $scope.externalDsType = 'MySQL';
              break;
            case 'POSTGRESQL':
              $scope.externalDsType = 'PostgreSQL';
              break;
            case 'MSSQL':
              $scope.externalDsType = 'Microsoft SQL Server';
              break;
            case 'ORACLE':
              $scope.externalDsType = 'Oracle Database';
          }
          $scope.externalDsSelectedTables = _(u.sections)
            .filter(function(s){ return _.contains(s.descriptor.format, '_TABLE')})
            .map(function(t){ return {name: t.name}})
            .value();
          $scope.externalDsParams = u.descriptor.params;
          $scope.defaultExternalDsParams = _.cloneDeep($scope.externalDsParams);
          $scope.externalFileParams = {
            name: _.clone(u.name)
          };
          $scope.defaultExternalFileParams = _.cloneDeep($scope.externalFileParams);
          $scope.externalDsError.errors = null;
          $scope.externalDsValidConnection = u.descriptor.lastConnectionTestSuccessful;
          $scope.externalDsSaved = false;
          $scope.lastTestedConnectionString = $scope.getLastConnectionTimeString();
          showSourceModal();
        }
      };
      $scope.renameSource = function(u){
        $scope.uploadToRename = u;
        $scope.uploadToRename.newName = $scope.uploadToRename.name;
      };

      $scope.resetRenameSource = function(){
        $scope.uploadToRename = undefined;
      };

      $scope.doRenameSource = function(){
        let uploadId = $scope.uploadToRename.id,
          newName = $scope.uploadToRename.newName,
          oldName = $scope.uploadToRename.name;

        function rename(name){
          return $http.post('/api/files/move', { fromPaths: ['id:' + uploadId], toPath: name })
            .then(function(response){
              let upload = $scope.getUploadById(uploadId, $scope.activeSection);
              upload.name = response.data[0].name;
              $scope.resetRenameSource();
              $scope.resetSelectedUpload();
              $scope.resetSources({untilIdFound: uploadId}).then(() => {
                $timeout(() => scrollToItem(uploadId))
              });
            })
            .catch(common.showError)
        }

        HistoryService.do({
          redo: function () { return rename(newName) },
          undo: function () { return rename(oldName) },
          notify: getHistoryActionMessage(oldName + " renamed to " + newName)
        });
      };


      $scope.onExternalConnectionNameBlur = function() {
        if(!$scope.externalFileParams.name) {
          $scope.externalFileParams.name = $scope.selectedUploads[0].name;
        }
      };

      $scope.getFormatName = function(u){
        return u.entityType === 'Folder' ? '—' : u.entityType;
      };

      $scope.getLastConnectionTimeString = function() {
        if (!$scope.selectedUploads.length || !$scope.selectedUploads[0].descriptor) { return ''; }
        var now = new Date(Date.now()).getTime();

        if ($scope.serverTimeDiff < 0) {
          now += $scope.serverTimeDiff;
        } else {
          now -= $scope.serverTimeDiff;
        }

        return moment($scope.selectedUploads[0].descriptor.lastConnected).from(now);
      };
      $scope.disconnectedStringAvailable = () => !!$scope.selectedUploads[0].descriptor.disconnectedTime;

      $scope.getDisconnectedString = function() {
        if (!$scope.selectedUploads.length || !$scope.selectedUploads[0].descriptor) { return ''; }
        var now = new Date(Date.now()).getTime();

        if ($scope.serverTimeDiff < 0) {
          now += $scope.serverTimeDiff;
        } else {
          now -= $scope.serverTimeDiff;
        }
        const disconnectedTime = $scope.selectedUploads[0].descriptor.disconnectedTime;
        const disconnectedFromNow = moment(disconnectedTime).from(now);
        const disconnectedDay = moment(disconnectedTime).format('h:mm a on MMM d, YYYY');
        return `${disconnectedFromNow} at ${disconnectedDay}`;
      };

      $scope.addDataSource = function(){
        $scope.externalDsQueries = [];
        $scope.externalDsType = undefined;
        $scope.externalDsTypeToReplace = undefined;
        $scope.externalDsConnected = false;
        $scope.externalDsSaved = false;
        $scope.isEditDs = false;

        $scope.resetSelectedUpload();
        showSourceModal();
      };

      if ($state.params.openAddSourceModal) {
        $scope.addDataSource();
      }

      $scope.sourceForm = {};

      $scope.deleteUploadOptions = {};
      $scope.showDeleteModal = function(){
        function getDescription(){
          if(!$scope.selectedUploads.length){
            return "";
          } else if($scope.selectedUploads.length > 1){
            return $scope.selectedUploads.length + ' items';
          }
          return '"' + $scope.selectedUploads[0].name + '"';
        }

        $scope.deleteUploadOptions = {
          loading: true,
          deleting: false,
          descriptionText: getDescription(),
          multi: $scope.selectedUploads.length > 1,
          connectedToIndex: false
        };

        $http.post('/api/files/get_attached', _.map($scope.selectedUploads, 'id'))
          .success(function(result){
            $scope.deleteUploadOptions.loading = false;
            $scope.deleteUploadOptions.connectedToIndex = !_.isEmpty(result);
          });

        $scope.$broadcast('disable-keyboard-navigation');
        $scope.deleteModal = $uibModal.open({
          templateUrl: 'static/templates/include/delete-upload.html;',
          scope: $scope,
          animation: true,
          size: 'md',
          keyboard: true
        });
        $scope.deleteModal.closed.then(() => {
          $scope.$broadcast('enable-keyboard-navigation');
        });
      };
      $scope.cancelDeleteModal = function(){
        $scope.deleteModal.dismiss();
      };

      $scope.isSearchSection = function() {
        return $scope.activeSection === SECTIONS.SEARCH;
      };

      $scope.resetSearchResults = function(options = {}) {
        SearchService.search(SearchService.getSearchText(), options).then(setSearchResults());
      };

      $scope.delete = function(us){
        $scope.deleteUploadOptions.deleting = true;
        return $http.post('/api/files/delete', {
          paths: _.map(us, u => 'id:' + u.id)
        }).then(function(){
          $scope.deleteUploadOptions.deleting = false;
          $scope.selectedUploads.length = 0;
          HistoryService.clear();
          if($scope.activeSection === SECTIONS.SEARCH) {
            SearchService.search(SearchService.getSearchText()).then(() => {
              setSearchResults();
              $scope.deleteModal.dismiss();
            });
          } else {
            $scope.resetSources({keepSize: true}).then(() => {
              $rootScope.$broadcast('source-selection-changed', null, true);
              $scope.deleteModal.dismiss();
            });
          }
        }, function(e){
          $scope.deleteUploadOptions.deleting = false;
          common.showError(e);
          $scope.deleteModal.dismiss();
        })
      };

      $scope.removeUploads = function(uploadsToDelete){
        var deleteIds = _.map(uploadsToDelete, 'id');
        if(!_.remove($scope.getUploads(), function(u){ return _.includes(deleteIds, u.id)}).length) {
          _.forEach($scope.getUploads(), function (u) {
            if (u.sections) {
              _.remove(u.sections, function(u){ return _.includes(deleteIds, u.id)});
            }
          });
        }
        _.remove($scope.selectedUploads, function(u){ return _.includes(deleteIds, u.id)});
      };

      $scope.uploader = UploaderService.getUploader();
      $scope.uploaderOptions = {
        createFolderCallback: function(name, parentId, callback){
          if(!parentId){
            parentId = $scope.selectedSourceFolder ? $scope.selectedSourceFolder.id : undefined;
          }
          $scope.createNewSourceFolder(name, parentId, callback);
        }
      };
      $scope.$on('upload-item-success', function(e, data){
        let response = data.upload;
        if($scope.isBelongsToCurrentFolder(response)){
          SourceService.reset({keepSize: true});
        }
      });
      $scope.$on('upload-item-ingest-complete', function(e, data){
        let event = data.event;
        if (UploaderService.getUploader().queue.length == 1) {
          $rootScope.$broadcast('close-uploads-modal');
          $scope.goToVisualization({id: event.datadocId});
        }
      });

      function updateServerTimeDiff(res) {
        var serverTime = new Date(res.headers().date).getTime();
        var clientTime = new Date(Date.now()).getTime();
        $scope.serverTimeDiff = serverTime - clientTime;
      }

      $scope.updateExternalFormErrors = function(err) {
        $scope.externalDsError.errors = {};

        if (Array.isArray(err)) {
          _.forEach(err, function(e) {

            if (!e.field) {

              switch(e.code) {
                case 'db_auth_error':
                  $scope.sourceForm.user.$validators.invalidValue = function() {
                    $scope.sourceForm.password.$setValidity('invalidValue', true);
                    return true;
                  }
                  $scope.sourceForm.password.$validators.invalidValue = function() {
                    $scope.sourceForm.user.$setValidity('invalidValue', true);
                    return true;
                  }
                  $scope.sourceForm.user.$setValidity('invalidValue', false);
                  $scope.sourceForm.password.$setValidity('invalidValue', false);
                  break;
                case 'db_not_exists':
                  $scope.sourceForm.dbName.$validators.invalidValue = function() {
                    return true;
                  }
                  $scope.sourceForm.dbName.$setValidity('invalidValue', false);
                  break;
                case 'db_conn_refused':
                  $scope.externalDsError.errors.globalMessage = "We could not connect to '"+$scope.externalDsParams.dbName+"' with the above credentials";
                  return;
              }

              $scope.externalDsError.errors.globalMessage = e.message;

            }
          });
        } else {
          $scope.externalDsError.errors.globalMessage = _.get(err, 'message');
        }
      };

      $scope.testConnection = function(){
        function updateUploadItem(data) {
          var descriptor = data.descriptor;
          var selectedDescriptor = $scope.selectedUploads[0].descriptor;
          selectedDescriptor.lastConnected = descriptor.lastConnected;
          selectedDescriptor.errorString = null;
          $scope.externalDsValidConnection = selectedDescriptor.lastConnectionTestSuccessful = descriptor.lastConnectionTestSuccessful;
        }

        var id = $scope.externalDsParams.id;
        $scope.isExternalDsConnecting = true;

        const request = {
          path: (id ? 'id:' + $scope.selectedUploads[0].id : 'id:' + ($scope.selectedSourceFolder ? $scope.selectedSourceFolder.id : '')),
          connectionParams: $scope.externalDsParams
        };

        return DbSourceService.testConnection(request)
          .then(function(res) {
            return SourceService.update(res.data.id).then(() => {
              _.set($scope.externalDsError, 'errors.globalMessage ', null);
              updateServerTimeDiff(res);
              $scope.externalDsConnected = true;
              $scope.isExternalDsConnecting = false;
              updateUploadItem(res.data);
            });
          }, function(err) {
            $scope.externalDsConnected = false;
            $scope.isExternalDsConnecting = false;
          });
      };

      $scope.saveDataSourceCanceler = null;

      $scope.stopRemoteLinkUpsert = () => {
        $scope.isExternalDsSaving = false;
        $scope.saveDataSourceCanceler && $scope.saveDataSourceCanceler.resolve();
        $scope.saveDataSourceCanceler = null;
      };

      $scope.saveDataSource = function(){
        $scope.isExternalDsSaving = true;
        var id = $scope.externalDsParams.id;
        const upsertSource  = !!id ? DbSourceService.updateRemoteLink : DbSourceService.createRemoteLink;
        const cancelUpsertSource  = !!id ? DbSourceService.cancelUpdateRemoteLink : DbSourceService.cancelCreateRemoteLink;

        const request = {
          path: (id ? 'id:' + $scope.selectedUploads[0].id : 'id:' + ($scope.selectedSourceFolder ? $scope.selectedSourceFolder.id : '')),
          connectionParams: $scope.externalDsParams,
          fileParams: $scope.externalFileParams,
          includeTables: _.map($scope.externalDsSelectedTables, 'name')
        };

        $scope.saveDataSourceCanceler = $q.defer();
        $scope.saveDataSourceCanceler.promise.then(data => cancelUpsertSource(request));
        upsertSource(request, { timeout: $scope.saveDataSourceCanceler.promise }).success(function (data) {
          $scope.saveDataSourceCanceler = null;
          $scope.isExternalDsSaving = false;
          $scope.resetSources({keepSize: true}).then($scope.updateSelectedUploads);
          if (id) {
            $scope.defaultExternalDsParams = _.cloneDeep($scope.externalDsParams);
            $scope.defaultExternalFileParams = _.cloneDeep($scope.externalFileParams);
            $scope.externalDsParamsEdited = false;
          } else {
            $scope.externalDsSaved = true;
            $timeout(function() {
              $scope.closeSourceModal();
              $scope.createIndex(data);
            }, 1500);
          }

        }).error(function(e){
          $scope.isExternalDsSaving = false;
          $scope.updateExternalFormErrors(e);
        })
      };

      $scope.closeSourceModal = function(){
        $scope.sourceModal.dismiss();

        $scope.customUploadPath = null;
        $scope.externalDsParams = {};
        $scope.externalDsError.errors = {}
        $scope.isEditDs = false;
        $scope.externalDsSaved = false;
      };

      $scope.externalDsType = undefined;
      $scope.externalDsTypeToReplace = undefined;
      $scope.externalDsParams = {};
      $scope.externalFileParams = {};
      $scope.availableDsTypes = ['MySQL', 'PostgreSQL', 'Microsoft SQL Server', 'Oracle Database', 'File'];

      $scope.externalDsTypeSelected = function(type){
        if ($scope.externalDsType === type) { return; }

        $scope.sourceForm.$setUntouched();
        $scope.externalDsError.errors = {};
        $scope.externalDsType = type;
        $scope.externalDsParams = {};

        switch($scope.externalDsType){
          case 'MySQL':
            $scope.externalDsParams.protocol = 'mysql';
            $scope.externalDsParams.port = 3306;
            break;
          case 'PostgreSQL':
            $scope.externalDsParams.protocol = 'postgresql';
            $scope.externalDsParams.port = 5432;
            break;
          case 'Microsoft SQL Server':
            $scope.externalDsParams.protocol = 'sqlserver';
            $scope.externalDsParams.port = 1433;
            break;
          case 'Oracle Database':
            $scope.externalDsParams.protocol = 'oracle';
            $scope.externalDsParams.port = 1521;
            break;
          case 'File':
            $('#add-source-modal-file-picker').click();
        }
      };

      $scope.updateSelectedUploads = function() {
        for (var i = 0; i < $scope.selectedUploads.length; ++i) {
          var newUpload = $scope.getUploadById($scope.selectedUploads[i].id);
          $scope.selectedUploads[i] = newUpload;
        };
      }


      function onIngestComplete(t, e) {
        SourceService.update(_.min(e.sourceIds)).then(source => {
          $rootScope.$broadcast('source-updated', {source})
        });
        $scope.resetSources({keepSize: true});
      }

      BookmarkCommitService.reset({isPublicChannel: false, resetCurrentDatadoc: true});
      BookmarkCommitService.on('complete', onIngestComplete);

      $scope.$on('$destroy', function(){
        BookmarkCommitService.off('complete', onIngestComplete);
      });

      $scope.$watch("[externalDsParams, externalFileParams]", function(newParamsArr) {

        var newExternalDsParams = newParamsArr[0];
        var newExternalFileParams = newParamsArr[1];

        if (_.isEqual($scope.defaultExternalDsParams, newExternalDsParams)
          && (!$scope.isEditDs || _.isEqual($scope.defaultExternalFileParams, newExternalFileParams))) {

          $scope.externalDsParamsEdited = false;
        } else {
          $scope.externalDsParamsEdited = true;
        }

        $scope.externalDsConnected = false;
      }, true);

      function getUniqueName(coll, name){
        var pattern = /\s\(([0-9]+)\)/;
        var items = _.filter(coll, function(o){
          if(_.startsWith(o.name, name)){
            var tmp = o.name.substr(name.length);
            return pattern.test(tmp);
          }
        });
        var numbers = _.map(items, function(o){
          var tmp = o.name.substr(name.length);
          return parseInt(tmp.match(pattern).pop());
        });

        if(_.find(coll, {'name': name})){
          numbers.push(0);
        }
        if(numbers.length == 0) {
          return name;
        } else {
          numbers.sort();
          for(var i = 0; i < numbers.length; i++){
            if(!_.contains(numbers, i)){
              return i == 0 ? name : name + ' (' + i + ')';
            }
          }
        }
        return name + ' (' + numbers.length + ')';
      }

      $scope.$on('create-index-from-upload', function(e, source) {
        $scope.createIndex(source);
      });

      $scope.$on('update-ingesting-value', function (e, source) {
        if (source) {
          const items =  [ SourceService.get(source.id), _.find($scope.searchResultsFiles, {id: source.id}) ];
          _.each(items, item => {
            if (item && item.ingestingProgress !== source.ingestingProgress) {
              item.ingestingProgress = source.ingestingProgress;
            }
          })
        }
      });

      $scope.$on('delete-ingesting-value', function(e, sourceId) {
        if (sourceId) {
          let item = SourceService.get(sourceId);
          if (item) {
            delete item.ingestingProgress;
          }
        }
      });

      $scope.createIndex = function(source, autoIngest, preSaved, updateRecent){
        const preSave = (source && source.entityType !== "Datadoc") || preSaved;

        if(updateRecent) {
          RecentSourcesService.reset();
        }

        $rootScope.$broadcast("togglePageLoader-main-loader", {toggle: true, backdrop: true});
        $scope.toggleGoingToVizPage(true);
        return sendCreateDatadocRequest(source, preSave).success(function (data) {
          $scope.goToVisualization(data, null, autoIngest, preSave);
          return data;
        }).error(function (e) {
          $scope.toggleGoingToVizPage(false);
          common.showError(e);
        });
      };

      $scope.goToVisualization = function(index, newTab, autoIngest, preSave){
        if (newTab) {
          var url = $state.href('main.visualize', {id: index.id, preSave});
          window.open(url,'_blank');
        } else {
          $scope.toggleGoingToVizPage(true);
          if(autoIngest) {
            $state.go('main.visualize', {id: index.id, autoingest: true, preSave}, {
              location: 'replace'
            });
          } else {
            $state.go('main.visualize', {id: index.id, preSave})
          }
        }
      };

      $scope.goingToVizPage = false;
      $scope.toggleGoingToVizPage = function(value) {
        $scope.goingToVizPage = value;
      };

      $rootScope.$on('cancelGoingToVisualization', () => {
        $rootScope.$broadcast("togglePageLoader-main-loader", {toggle: false, backdrop: false});
        $scope.toggleGoingToVizPage(false);
      });

      $scope.$on('$destroy', function(){
        NotificationsUtils.closeAll();
      });

      $scope.getSourcesSelectedColumns = function(search) {
        return search
          ? $scope.columnsSections.searchResultsSources.getSelected()
          : $scope.columnsSections.sources.getSelected();
      };


      // prevent default context-menu
      document.body.addEventListener('contextmenu', function(e) {
        if (e.target.nodeName !== 'INPUT' && e.target.nodeName !== 'TEXTAREA') {
          e.preventDefault();
        }
      });

      /// <init>

      HistoryService.setMaxSize(1);

      $scope.resetSources = function(options = {}){
        $scope.isShowSourcesBackdrop = options.backdrop;
        $scope.isLoadingSources = true;
        return SourceService.reset(options).then(() => {$scope.isLoadingSources = false; $scope.isShowSourcesBackdrop = false;})
      };

      $scope.loadMoreSources = function(){
        $scope.isLoadingSources = true;
        $scope.isLoadMoreSources = true;
        return SourceService.nextPage().then(() => {$scope.isLoadingSources = false; $scope.isLoadMoreSources = false});
      };

      $scope.selectedSourceFolder = SourceService.getSelectedFolder();
      $scope.$on('refresh-selected-folder', () => $scope.selectedSourceFolder = SourceService.getSelectedFolder());
      $scope.setUploaderUrl();

      $scope.userState = UserStateService.get();
      $scope.columnsSections = {
        sources: SortSectionColumnsService.genSortColumnsOptions($scope),
        searchResults: SortSectionColumnsService.genSortColumnsOptions($scope, true),
        noResults: SortSectionColumnsService.genSearchResultsEmptyResultsSortColumnsOptions($scope)
      };

      let currentSection = SectionNamesService.getSectionFromSectionName($state.current.name);
      $scope.userState.activeSection = $scope.activeSection = currentSection;
      if(currentSection == SECTIONS.SEARCH){
        let searchText = SearchService.getSearchText();
        $timeout(function(){
          SearchBarService.setSearch(searchText);
          setSearchResults()
        });
      }

      $scope.changeUploadTypes = function (type) {
        let options = {};
        type.selected = !type.selected;

        _.each($scope.showUploadsTypes, t => {
          options[t.type] = t.selected;
          return options;
        });

        UserEventService.emit(".ShowTypesOptionsChangeEvent", options, $scope);
        UserStateService.reset().then(response => {
          $scope.userState = response;
          $scope.resetSources(options);
        });
      };

      let {datadocsOnly, foldersOnly, sourcesOnly} = $scope.userState.showTypesOptions;
      $scope.showUploadsTypes = [
        {
          name: "Datadocs",
          type: "datadocsOnly",
          selected: datadocsOnly
        },
        {
          name: "Folders",
          type: "foldersOnly",
          selected: foldersOnly
        },
        {
          name: "Sources",
          type: "sourcesOnly",
          selected: sourcesOnly
        },
      ];

      $scope.ngSelectSourcesSectionOptions = {
        itemSelector: '.upload-item',
        itemSelectorWrapper: '.main-page-ds-pane',
        getItemFn: $scope.getUploadById,
        selectedItemsKey: 'selectedUploads',
        lastSelectItem:'lastSelectedUpload',
        currentSelectedItem:'currentSelectedUpload',
        onClick: $scope.singleClick,
        loadMore: $scope.loadMoreSources,
        keyboardNavOptions: {
          onEnter: function(e, item) {
            if (item.type == 'folder') {
              $scope.$evalAsync(() => $scope.selectSourceFolder(item));
            } else if (item.type == 'doc') {
              $scope.$evalAsync(() => $scope.goToVisualization(item));
            }
          },
          onSelectAll: function(e) {
            $scope.$evalAsync(selectAllSources);
          },
          onEsc: function(e) {
            $scope.$evalAsync($scope.resetSelectedUpload);
          },
          onBack: function(e) {
            if ($scope.selectedSourceFolder) {
              $scope.$evalAsync(() => $scope.selectParentSourceFolder($scope.selectedSourceFolder))
            }
          },
          enableAutoSelect: true
        }
      };

      function selectAllSources() {
        $scope.selectedUploads.length = 0;
        $scope.selectedUploads.push(...$scope.getUploads());
      }

      $scope.createDatadocFromSource = function () {
        $scope.$broadcast("ingest-selected-source");
      };

      $scope.gettingSources = SourceService.gettingSources;

      /// </init>



      /********************************************/
      /********************************************/
      /*********  WEB SOCKET EVENTS  **************/
      /********************************************/
      /********************************************/

      $scope.socket = {
        client: null,
        stomp: null
      };

      WSocket.subscribe('/upload-events', function(e){

        // INSTANCE_ID is randomly generated for each application view (tabs, windows etc)
        // and is passed along with each request as a header (X_INSTANCE_ID).
        // Then INSTANCE_ID is passed back to client in event object,
        // so we can check if this instance is the emitter of the event and ignore it.
        // In case when no INSTANCE_ID is received along with event
        // then we should compare current user ID and user ID from event.
        if ((e.instanceId && e.instanceId !== common.instanceGUID)
          || (e.user !== User.getCurrent().id)) {

          switch (e.type) {
            case 'CREATE_FILE':
              if (e.file && $scope.isBelongsToCurrentFolder(e.file)) {
                $scope.$evalAsync(() => {
                  SourceService.push(e.file);
                });
              } else if (e.file) {
                let parent = $scope.getUploadById(e.file.parentId);
                if (parent && parent.sections) {
                  $scope.$evalAsync(() => {
                    parent.sections.push(e.file);
                  })
                }
              }
              break;
            case 'DELETE_FILE':
              if ($scope.isBelongsToCurrentFolder(e.file)) {
                let fileToDelete = $scope.getUploadById(e.file.id);
                $scope.$evalAsync(() => {
                  SourceService.remove(fileToDelete);
                });
              } else {
                $scope.$evalAsync(() => {
                  let parent = $scope.getUploadById(e.file.parentId);
                  if (parent && parent.sections) {
                    _.remove(parent.sections, s => s.id === e.file.id);
                  }
                });
              }
              break;
            case 'EDIT_FILE':
              if ($scope.isBelongsToCurrentFolder(e.oldFile)) {
                let fileToEdit = $scope.getUploadById(e.oldFile.id);
                if (e.file.parentId === e.oldFile.parentId) {
                  $scope.$evalAsync(() => {
                    // update file name
                    fileToEdit.name = e.file.name;
                  })
                } else {
                  $scope.$evalAsync(() => {
                    SourceService.remove(fileToEdit);
                  })
                }
              } else if ($scope.isBelongsToCurrentFolder(e.file)) {
                $scope.$evalAsync(() => {
                  SourceService.push(e.file);
                });
              }
              break;
          }
        }
      });

    }]);
});
