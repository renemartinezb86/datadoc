define(['./module', 'common'], function (directives, common) {
    'use strict';
    directives.directive('objectSelect', ['ScopeService', function (ScopeService) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/object-select.html',
            scope: {
                placeholder: "=",
                selectedValue: "=",
                onUpdate: "=",
                isDisabled: "="
            },
            link: function($scope, elm, attr){
                var $input = $(elm).find('input');

                var temp;
                $input
                    .on('focus', function(){
                        ScopeService.safeApply($scope, function() {
                            temp = $scope.selectedValue;
                        })
                    })
                    .on('blur', function(){
                        ScopeService.safeApply($scope, function() {
                            if (temp && temp != $scope.selectedValue) {
                                $scope.onUpdate();
                                temp = undefined;
                            }
                        })
                    })
                    .on('keydown', function(event) {
                        ScopeService.safeApply($scope, function(){
                            if (event.which == 27) {
                                $scope.selectedValue = temp;
                                $input.blur();
                                event.preventDefault();
                                event.stopPropagation();
                            } else if(event.which == 13){
                                $input.blur();
                                event.preventDefault();
                                event.stopPropagation();
                            }
                        })
                    });
            }
        }
    }]);
});