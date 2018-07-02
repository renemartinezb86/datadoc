define(['./module'], function (directives) {
    'use strict';
    directives.directive('infiniteScroll', [function () {
            return {
                restrict: 'A',
                scope: {
                    callback: '=infiniteScroll',
                    offsetFromBottom: '=infiniteScrollOffsetFromBottom'
                },
                link: function (scope, elm, attrs) {
                    var raw = elm[0];
                    elm.bind('scroll', function() {
                        if (raw.scrollTop + raw.offsetHeight >= raw.scrollHeight * ((100 - (scope.offsetFromBottom || 0)) / 100) && !scope.$parent.inRequest) {
                            scope.$apply(function(){
                                scope.callback()
                            });
                        }
                    });
                }
            };
        }
    ]);
});