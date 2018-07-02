define(['./module', 'moment', 'lodash', 'common', 'angular'], function (directives, moment, _, cc, angular) {
    directives.directive('ingestDbTables', ['$q', '$http', '$timeout', '$uibModal', '$rootScope',
        'IngestDataLoadingService', 'BookmarkEventService',
        function($q, $http, $timeout, $uibModal, $rootScope, IngestDataLoadingService, BookmarkEventService) {
            return {
                restrict: 'A',
                templateUrl: 'static/templates/include/ingest-db-tables.html',
                compile: function compile(el, attrs) {
                    return {
                        pre: function($scope, $el, $attrs){
                            $scope.filterId = $attrs.filterId;
                            $scope.savePaneWidth = 'true' === $attrs.saveWidth;
                            $scope.hideOnInit = 'true' === $attrs.hideOnInit;
                        },
                        post: function($scope, $el, $attrs){
                            $scope.onRenderFilters = _.debounce(function(){
                                $rootScope.$broadcast('reCalcViewDimensions');
                            }, 100);
                            $scope.$on('scroll-to-selected-table', () => {
                                $scope.scrollToItem();
                            });
                            $scope.scrollToItem = function() {
                                var container = $el.find('.table-list'),
                                    scrollTo = $el.find('#selected');
                                container.scrollTop(
                                    scrollTo.offset().top - container.offset().top + container.scrollTop()
                                );
                            };
                            $scope.selectTable = function(item) {
                                $scope.currentQueryData.successQuery = false;
                                $scope.currentQueryData.errorQuery = false;
                                $scope.loadSource(_.cloneDeep(item));
                            };
                        }
                    }
                }
            }
        }])
});