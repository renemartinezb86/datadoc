define(['./module'], function (directives) {
    'use strict';
    directives.directive('resizable', ['$document', '$localStorage', '$rootScope','$timeout', function ($document, $localStorage, $rootScope, $timeout) {
        return {
            restrict: 'EA',
            link: function ($scope, $elm, $attr) {
                const $wrapper = $($elm.closest('.resizable-wrapper').first()),
                    $sidebar = $($wrapper.find('.sidebar-wrapper').first()),
                    $handle = $($sidebar.find('.resize-handle-h').first()),
                    $content = $($wrapper.find('.page-content-wrapper').first());
                const options = $scope.$eval($attr.resizable);
                if(!options || !options.id){
                    throw "Please assign resize component ID through options";
                }
                const callback = options.minResizeCallback ? options.minResizeCallback : null;

                $scope.$storage = $localStorage.$default();
                const defaultSize = options.default ? options.default : options.min ? options.min : 300;

                let initialX;
                if(options.save) {
                    initialX = $scope.$storage[options.id];
                    if (initialX == null) {
                        $scope.$storage[options.id] = defaultSize;
                        initialX = defaultSize;
                    }
                } else {
                    if(options.hideOnInit) {
                        initialX = 0;
                    } else {
                        initialX = defaultSize;
                    }
                }
                resize(initialX, true);

                $handle.on('mousedown', function (event) {
                    event.preventDefault();
                    $document.on('mousemove', mousemove);
                    $document.on('mouseup', mouseup);
                    $scope.$broadcast('onResizeStart-' + options.id);
                });

                function resize(x){
                    if(options.right){
                        $content.css({'margin-right': x + 'px'});
                    } else {
                        //$content.css({'margin-right': -x + 'px'});
                        $wrapper.css({'padding-left': x + 'px'});
                    }
                    $sidebar.css("display", x <= 0 ? 'none': 'block');
                    $sidebar.css({'width': x + 'px'});
                    $rootScope.$broadcast('onResize-' + options.id, {x: x});
                }

                function tryToGuessX() {
                    let x = $scope.$storage[options.id]
                        ? $scope.$storage[options.id]
                        : $scope.$storage[options.id + "-beforeHide"];
                    if (typeof x === "undefined") {
                        x = defaultSize;
                    }
                    return x;
                }

                $scope.$on('expand-' + options.id, function () {
                    let x;
                    if (options.save) {
                        x = tryToGuessX();
                        $scope.$storage[options.id] = x;
                    } else {
                        x = defaultSize;
                    }
                    resize(x);
                });

                $scope.$on('collapse-' + options.id, function () {
                    resize(0);
                    if (options.save) {
                        if($scope.$storage[options.id] > 0) {
                            $scope.$storage[options.id + '-beforeHide'] = $scope.$storage[options.id];
                        }
                        $scope.$storage[options.id] = 0;
                    }
                });

                function restoreSidebarOpacityIfNeeded() {
                    let currentOpacity = parseFloat($sidebar.css('opacity'));
                    if(currentOpacity !== 1) {
                        $sidebar.css('opacity', 1);
                    }
                }

                function mousemove(event) {
                    let x;
                    if(options.right){
                        x = $(window).width() - event.pageX;
                    } else {
                        x = event.pageX - $handle.parent().offset().left;
                    }
                    if (options.max && x > options.max) {
                        x = parseInt(options.max);
                    }
                    if (options.min && x < options.min) {
                        if (callback) {
                            let maxOffset = options.min - (options.min / 2.5),
                                k = 1 / (options.min - maxOffset),
                                opacity = (event.pageX - maxOffset) * k;

                            $sidebar.css("opacity", opacity);

                            if (event.pageX < maxOffset) {
                                $scope.$evalAsync(() => callback());
                                resize(0);
                                mouseup();
                                if (options.save)
                                    $scope.$storage[options.id] = defaultSize;
                                return;
                            }
                        }
                        x = parseInt(options.min);
                    }
                    resize(x);
                    if (options.save) $scope.$storage[options.id] = x;
                }

                function mouseup() {
                    restoreSidebarOpacityIfNeeded();
                    $document.unbind('mousemove', mousemove);
                    $document.unbind('mouseup', mouseup);

                    const width = $sidebar.outerWidth(); // including 1px border
                    $rootScope.$broadcast('onResizeFinish-' + options.id, width);
                }
            }
        }
    }])
});
