define(['./module', 'KeyJS', 'lodash'],
function (controllers, KeyJS, _) {
    'use strict';

    controllers.directive('sortSettingsDropdown', [
        function () {
            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/sort-settings-dropdown.html',
                link: function ($scope, $el, $attr) {

                    $scope.onKeyDownLimitInput = function(event, item) {
                        switch (event.which) {
                        case KeyJS.ENTER:
                        case KeyJS.ESC:
                        case KeyJS.TAB:
                            event.target.blur(item);
                        }
                    }

                    $scope.isShowTotalAvailable =
                        _.includes(_.map($scope.getShowTotalsArray(), 'id.field'), $scope.item.itemFromModel.id.field);
                }
            }
        }])
});