define(['./module'], function (directives) {
    'use strict';
    directives.directive('datadocPane', ['$timeout', function ($timeout) {
        return {
            restrict: 'E',
            templateUrl: 'static/templates/include/datadoc-pane.html',
            link: function ($scope, $elm, $attr) {
                $elm = $elm.children().first();
                $scope.$watch('indexToRename', function(index){
                    if(index) {
                        $timeout(function(){
                            var input = $elm.find('.name-input');
                            if(input.length) {
                                input.focus();
                                input[0].setSelectionRange(0, input.val().length)
                            }
                        });
                    }
                });
            }
        }
    }]);
});
