define(['./module'], function (directives) {
    'use strict';
    directives.directive('focusOnShow', ['$timeout', function($timeout) {
        return {
            restrict: 'A',
            link: function($scope, $element, $attr) {
                if ($attr.ngShow){
                    $scope.$watch($attr.ngShow, function(newValue){
                        if(newValue){
                            $timeout(function(){
                                $element.focus();
                            }, 0);
                        }
                    })
                }
                if ($attr.ngHide){
                    $scope.$watch($attr.ngHide, function(newValue){
                        if(!newValue){
                            $timeout(function(){
                                $element.focus();
                            }, 0);
                        }
                    })
                }
            }
        };
    }])
});