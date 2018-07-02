define(['./module', 'angular'], function (directives, angular) {
    'use strict';
    directives.directive('vResizable', ['$document', '$localStorage', '$timeout', '$rootScope', function ($document, $localStorage, $timeout, $rootScope) {
        return {
            restrict: 'A',
            link: function ($scope, $elm, $attr) {
                let $handle = angular.element('<div class="resize-handle"></div>'),
                    $scrollable,
                    onResize,
                    onResizeFinished,
                    nextElement,
                    options = $attr;

                options.id = $attr.vResizableId;
                if(!options || !options.id){
                    throw "Please assign resize component ID through options";
                }


                if(options.vResizableScrollableContainer) {
                    $scrollable = $(options.vResizableScrollableContainer);
                }

                if(options.vResizableOnResizeFinished) {
                    $timeout(function(){
                        onResizeFinished = $scope.$eval(options.vResizableOnResizeFinished);
                    });
                }
                if(options.vResizableOnResize) {
                    $timeout(function(){
                        onResize = $scope.$eval(options.vResizableOnResize);
                    });
                }

                $elm.after($handle);
                $scope.$storage = $localStorage.$default();

                $rootScope.$on('doWidgetResize', function () {
                    $(document).ready(function () {
                        if (options.vResizableStorageAttr) {
                            let y = $scope.$storage[options.vResizableStorageAttr];
                            if (y || y == 0) {
                                setHeight(y);
                                doCallback(onResizeFinished, $elm);
                            }
                        }
                    })
                });

                $handle.on('mousedown', function (event) {
                    event.preventDefault();

                    let elements = $('div[v-resizable]');

                    nextElement = null;
                    for (let i = 0; i < elements.length - 1; ++i) {
                        if (elements[i] == $elm[0]) {
                            nextElement = $(elements[i + 1]);
                            break;
                        }
                    }

                    $document.on('mousemove', mousemove);
                    $document.on('mouseup', mouseup);
                });

                $scope.$on('reset-' + options.id, function (e, height) {
                    let y = height;
                    if (options.vResizableMin && y < options.vResizableMin) {
                        if('vResizableMinSnap' in options){
                            y = 0;
                        } else if (options.vResizableDefault) {
                            y = parseInt(options.vResizableDefault);
                        } else {
                            y = parseInt(options.vResizableMin);
                        }
                    }
                    if (options.vResizableMax && y > options.vResizableMax) {
                        y = parseInt(options.vResizableMax);
                    }
                    setHeight(y)
                });

                function setHeight(y){
                    $elm.css({height: y + 'px'});
                }
                function mousemove(event) {
                    const parent = $elm.offsetParent();
                    const padding = parent.height() - $elm[0].offsetHeight;
                    let y = event.pageY - $elm.offset().top - padding;

                    if (options.vResizableMax && y > options.vResizableMax) {
                        y = parseInt(options.vResizableMax);
                    }
                    if (options.vResizableMin && y < options.vResizableMin) {
                        if('vResizableMinSnap' in options){
                            y = 0;
                        } else {
                            y = parseInt(options.vResizableMin);
                        }
                    }
                    if (nextElement) {
                        let newHeight = nextElement.height() - nextY;
                        if(newHeight < 0){
                            newHeight = 0;
                        }
                        nextElement.height(newHeight);
                        if(nextElement.attr('v-resizable-storage-attr')) {
                            $scope.$storage[nextElement.attr('v-resizable-storage-attr')] = newHeight;
                        }
                    }
                    setHeight(y);
                    if($scrollable) {
                        const bottom = $elm.offset().top + $elm.outerHeight();
                        if (bottom > $scrollable.height()) {
                            $scrollable.scrollTop($scrollable.scrollTop() + 20);
                        } else if(bottom < $scrollable.offset().top + 100){
                            $scrollable.scrollTop($scrollable.scrollTop() - 20);
                        }
                    }
                    if(options.vResizableStorageAttr) {
                        $scope.$storage[options.vResizableStorageAttr] = y;
                    }
                    doCallback(onResize, $elm);
                }
                function doCallback(callback, element){
                    if(callback) {
                        const args = [{width: element.outerWidth(), height: element.outerHeight()}];
                        callback.apply($scope, args);
                    }
                }
                function mouseup() {
                    $document.unbind('mousemove', mousemove);
                    $document.unbind('mouseup', mouseup);

                    $scope.$apply(function () {
                        doCallback(onResizeFinished, $elm);
                    });
                }
            }
        }
    }])
});
