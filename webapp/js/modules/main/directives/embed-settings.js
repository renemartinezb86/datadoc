define(['./module', 'angular', 'common', /*'chartCommons',*/ 'angular-clipboard'],
function (controllers, angular, cc, /*chartC*/) {
    'use strict';

    controllers.directive('embedSettings', ['$timeout', '$rootScope', '$http', 'ExportService', '$compile', 'EmbedService', 'DataLoadingService',

        function ($timeout, $rootScope, $http, ExportService, $compile, EmbedService, DataLoadingService) {

            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/embed-settings.html',
                scope: true,
                link: function ($scope, $el, $attr) {
                    var $container = $el.find('#widget-container');
                    // $scope.REGRESSION_TYPE_OPTIONS = chartC.REGRESSION_TYPE_OPTIONS;
                    $scope.duplicateTab = false;
                    $scope.isEmbedUpdating = false;
                    var urlModes = {
                        URL: 0,
                        EMBED: 1
                    };
                    $scope.urlModes = urlModes;
                    $scope.selectedUrlMode = urlModes.URL;
                    $scope.getUrlText = function () {
                        if(!$scope.embedFormModel){
                            return "";
                        }
                        var url = EmbedService.getURL({uuid: $scope.embedFormModel.uuid, title: $scope.embedFormModel.title});
                        switch ($scope.selectedUrlMode) {
                            case urlModes.EMBED:
                                return '<iframe src="' + url
                                    + '" style="width: ' + $scope.embedFormModel.width + 'px; height: ' +
                                    $scope.embedFormModel.height + 'px;"></iframe>';
                            case urlModes.URL:
                                return url;
                        }
                    };

                    $scope.setDirty = function(){
                        $scope.dirty = true;
                    };

                    $scope.previewEmbed = function () {
                        return EmbedService.preview($scope.embedFormModel);
                    };
                    
                    $scope.onAllowViewRawChanged = function () {
                        $rootScope.$broadcast('allowViewRawChanged')
                    };

                    $scope.updateEmbed = function (form) {
                        if (form.$invalid) return;
                        if ($scope.embedFormModel.title == "") {
                            cc.showError({message: 'Please enter the title'});
                            return;
                        }
                        $scope.isEmbedUpdating = true;
                        $http.put('/api/docs/bookmarks/' + $scope.embedFormModel.tabId + "/embed", $scope.embedFormModel)
                            .success(function (result) {
                                $scope.dirty = false;

                                /*$rootScope.$broadcast('embed-settings-saved', result);
                                $rootScope.$broadcast('embed-settings-saved', {*/
                                $rootScope.$broadcast('embed-settings-saved', {
                                    settings: result,
                                    duplicateTab: $scope.duplicateTab
                                });
                                $scope.isEmbedUpdating = false;
                            });
                    };

                    $timeout(function () {
                        $el.find(".embed-url input[type=text]").click(function () {
                            $(this).select();
                        });
                    });

                    $scope.$on('open-embed-settings', function(e, data){
                        $scope.dirty = false;
                        $scope.embedFormModel = data.settings;
                        $container.html($compile(angular.element(
                            '<embed-widget uuid="' + $scope.embedFormModel.uuid + '" settings="embedFormModel"></embed-widget>')
                        )($scope));
                    });

                    $scope.$on('close-embed-settings', function(){
                        $container.empty();
                    })

                }
            }
        }])
});