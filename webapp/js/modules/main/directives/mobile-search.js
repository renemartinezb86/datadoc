define(['./module'], function (directives) {
    'use strict';
    directives.directive('mobileSearch', ["$compile", function ($compile) {
        return {
            restrict: 'A',
            scope: true,
            link: function ($scope, $element, $attrs) {

                $scope.mobileSearch = {
                    active: false,
                    value: ""
                };

                const searchButton = $element.find('.mobile-search-icon');
                const inputTemplate = `<input type="text" 
                                              ng-model="mobileSearch.value" 
                                              ng-enter="searchInputChange(mobileSearch.value, !dataSummary.instantSearch)" 
                                              class="mobile-search-input" autocorrect="off" autocapitalize="none">`;
                const closeButtonTemplate = `<div class="mobile-search-close" ng-click="resetAll()"></div>`;

                function appendSearchInput() {
                    let compiledInput = $compile(inputTemplate)($scope);
                    let compiledClose = $compile(closeButtonTemplate)($scope);
                    $element.parent().children(':first-child').hide(300);
                    $(compiledClose).appendTo($element);
                    return $(compiledInput).insertAfter(searchButton);
                }

                function removeSearchInput() {
                    $element.parent().children(':first-child').show(300);
                    $element.children().not(":first").remove();
                    searchInput = null;
                }

                $scope.resetAll = function () {
                    if($scope.dataSummary.search) {
                        $scope.resetSearch();
                    }
                    $scope.mobileSearch.active = false;
                    removeSearchInput();
                    $scope.mobileSearch.value = "";
                };

                let searchInput;
                searchButton.on('click', function () {
                    $scope.mobileSearch.active = true;
                    if (!searchInput) {
                        searchInput = appendSearchInput();
                        searchInput.focus();
                    }
                });
            }
        };
    }])
});
