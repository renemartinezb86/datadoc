
(function() {

    angular.module('ui.bootstrap.tagContextMenu', [])

        .service('CustomService', function () {
            "use strict";

            return {
                initialize: function (item) {
                    console.log("got here", item);
                }
            };

        })
        .directive('tagContextMenu', ["$parse", "$q", "CustomService", "$sce", "$compile", "$rootScope", function ($parse, $q, custom, $sce, $compile, $rootScope) {

            var contextMenus = [];
            var defaultItemText = "New Item";

            var removeContextMenus = function (level) {
                /// <summary>Remove context menu.</summary>
                while (contextMenus.length && (!level || contextMenus.length > level)) {
                    contextMenus.pop().remove();
                }
            };

            var $sortButton = $(`<div class="sort-button"
                uib-tooltip="{{alreadySorted 
                    ? 'Sorted alphabetically, click to Sort by column index' 
                    : 'Sorted by column index, click to sort alphabetically'}}"
                tooltip-placement="top-right"
                tooltip-popup-delay="250"
                tooltip-append-to-body="true"
                tooltip-class="main-page-tooltip tooltip-sort-button">`);

            var processTextItem = function ($scope, item, text, event, modelValue, $promises, nestedMenu, $) {
                "use strict";

                var $a = $('<a>');
                $a.css({
                    "padding-right": "8px",
                    "padding-left": "27px",
                    "position": "relative",
                    "overflow": "hidden",
                    "text-overflow": "ellipsis"
                });
                $a.attr({ tabindex: '-1', href: '#' });

                if (typeof item[0] === 'object') {
                    if (item[0].getPreHtml) {
                        var el = $(item[0].getPreHtml());

                        el.css({
                            "position": "absolute",
                            "left": "5px",
                            "top": "5px"
                        });
                        $a.append(el);
                    }

                    if (item[0].getTitleHtml) {
                        text = $(item[0].getTitleHtml());
                    } else {
                        text = item[0].title;
                    }
                } else if (typeof item[0] === 'string') {
                    text = item[0];
                } else if (typeof item[0] === "function") {
                    text = item[0].call($scope, $scope, event, modelValue);
                } else if (typeof item.text !== "undefined") {
                    text = item.text;
                }

                var $promise = $q.when(text);
                $promises.push($promise);
                $promise.then(function (text) {
                    if (nestedMenu) {
                        $a.css("cursor", "default");
                        $a.append($('<i style="float: right;margin-top: 5px;" class="fa fa-chevron-right"></i>'));
                    }
                    $a.append(text);
                });

                return $a;

            };

            var processItem = function ($scope, event, modelValue, item, $ul, $li, $promises, $q, $, level, parentEl) {
                /// <summary>Process individual item</summary>
                "use strict";
                // nestedMenu is either an Array or a Promise that will return that array.
                var nestedMenu = angular.isArray(item[1]) ||
                (item[1] && angular.isFunction(item[1].then)) ? item[1] : angular.isArray(item[2]) ||
                (item[2] && angular.isFunction(item[2].then)) ? item[2] : angular.isArray(item[3]) ||
                (item[3] && angular.isFunction(item[3].then)) ? item[3] : null;

                // if html property is not defined, fallback to text, otherwise use default text
                // if first item in the item array is a function then invoke .call()
                // if first item is a string, then text should be the string.

                var text = defaultItemText;

                if (typeof item[0] === 'function'
                    || typeof item[0] === 'string'
                    || typeof item[0] === "object"
                    || typeof item.text !== "undefined") {

                    if (item[0].id != null) {
                        $li.attr({ "tree-id": item[0].id });
                    }
                    text = processTextItem($scope, item, text, event, modelValue, $promises, nestedMenu, $);
                }
                else if (typeof item.html === 'function') {
                    // leave styling open to dev
                    text = item.html($scope);
                }
                else if (typeof item.html !== "undefined") {
                    // leave styling open to dev
                    text = item.html;
                }

                $li.append(text);




                // if item is object, and has enabled prop invoke the prop
                // els if fallback to item[2]

                var isEnabled = function () {
                    if (typeof item.enabled !== "undefined") {
                        return item.enabled.call($scope, $scope, event, modelValue, text);
                    } else if (typeof item[2] === "function") {
                        return item[2].call($scope, $scope, event, modelValue, text);
                    } else {
                        return true;
                    }
                };

                registerEnabledEvents($scope, isEnabled(), item, $ul, $li, nestedMenu, modelValue, text, event, $, level, parentEl);
            };

            var handlePromises = function ($ul, level, event, $promises) {
                /// <summary>
                /// calculate if drop down menu would go out of screen at left or bottom
                /// calculation need to be done after element has been added (and all texts are set; thus thepromises)
                /// to the DOM the get the actual height
                /// </summary>
                "use strict";
                $q.all($promises).then(function () {

                    var paddingInside = 8,
                        marginBottom = 10;

                    var topCoordinate = event.event
                        ? $(event.event.currentTarget).offset().top - paddingInside
                        : event.pageY;
                    var menuHeight = angular.element($ul[0]).prop('offsetHeight');
                    var winHeight = window.scrollY + event.view.innerHeight;
                    /// the 20 pixels in second condition are considering the browser status bar that sometimes overrides the element
                    // if (topCoordinate > menuHeight && winHeight - topCoordinate < menuHeight + 20) {
                    //     topCoordinate = event.pageY - menuHeight;
                    //     /// If the element is a nested menu, adds the height of the parent li to the topCoordinate to align with the parent
                    //     if(level && level > 0) {
                    //         topCoordinate += event.event.currentTarget.offsetHeight;
                    //     }
                    // } else if(winHeight <= menuHeight) {
                    //     // If it really can't fit, reset the height of the menu to one that will fit
                    //     angular.element($ul[0]).css({"height": winHeight - 5, "overflow-y": "scroll"});
                    //     // ...then set the topCoordinate height to 0 so the menu starts from the top
                    //     topCoordinate = 0;
                    // } else if(winHeight - topCoordinate < menuHeight) {
                    //     var reduceThresholdY = 5;
                    //     if(topCoordinate < reduceThresholdY) {
                    //         reduceThresholdY = topCoordinate;
                    //     }
                    //     topCoordinate = winHeight - menuHeight - reduceThresholdY;
                    // }

                    var leftCoordinate = event.pageX;
                    var menuWidth = angular.element($ul[0]).prop('offsetWidth');
                    var winWidth = event.view.innerWidth;
                    var rightPadding = 5;
                    if (leftCoordinate > menuWidth && winWidth - leftCoordinate - rightPadding < menuWidth) {
                        leftCoordinate = winWidth - menuWidth - rightPadding;
                    } else if(winWidth - leftCoordinate < menuWidth) {
                        var reduceThresholdX = 5;
                        if(leftCoordinate < reduceThresholdX + rightPadding) {
                            reduceThresholdX = leftCoordinate + rightPadding;
                        }
                        leftCoordinate = winWidth - menuWidth - reduceThresholdX - rightPadding;
                    }

                    $ul.css({
                        display: 'block',
                        position: 'absolute',
                        left: leftCoordinate + 'px',
                        top: topCoordinate + 'px',
                        "max-height": ((winHeight - topCoordinate) - marginBottom)+'px'
                    });
                });

            };

            var alreadySorted = false;
            var registerEnabledEvents = function ($scope, enabled, item, $ul, $li, nestedMenu, modelValue, text, event, $, level, parentEl) {
                /// <summary>If item is enabled, register various mouse events.</summary>
                if (enabled) {
                    var openNestedMenu = function ($event, parent_$li) {
                        removeContextMenus(level + 1);
                        /*
                         * The object here needs to be constructed and filled with data
                         * on an "as needed" basis. Copying the data from event directly
                         * or cloning the event results in unpredictable behavior.
                         */
                        /// adding the original event in the object to use the attributes of the mouse over event in the promises
                        var ev = {
                            pageX: event.pageX + $ul[0].offsetWidth - 1,
                            pageY: $ul[0].offsetTop + $li[0].offsetTop - 7,
                            view: event.view || window,
                            event: $event
                        };

                        /*
                         * At this point, nestedMenu can only either be an Array or a promise.
                         * Regardless, passing them to when makes the implementation singular.
                         */
                        $q.when(nestedMenu).then(function(promisedNestedMenu) {
                            renderContextMenu($scope, ev, promisedNestedMenu, modelValue, level + 1, null, parent_$li);
                        });
                    };

                    $li.on('click', function ($event) {
                        if($event.which == 1) {
                            $event.preventDefault();
                            $scope.$apply(function () {
                                if (nestedMenu) {
                                    openNestedMenu($event);
                                } else {
                                    // $(event.currentTarget).removeClass('context');
                                    // removeContextMenus();

                                    if (angular.isFunction(item[1])) {
                                        item[1].call($scope, $scope, event, modelValue, text, $li, parentEl);
                                    } else {
                                        item.click.call($scope, $scope, event, modelValue, text, $li);
                                    }
                                }
                            });
                        }
                    });

                    $li.on('mouseover', function ($event) {
                        $scope.$apply(function () {
                            if (nestedMenu) {
                                openNestedMenu($event, $li);
                                /// Implementation made by dashawk
                            } else {
                                removeContextMenus(level + 1);
                            }
                        });
                    });
                } else {
                    $li.on('click', function ($event) {
                        $event.preventDefault();
                    });
                    $li.addClass('disabled');
                }

            };

            var reCompileSortButton = function($scope) {
                $('.tooltip-sort-button').remove();
                $compile($sortButton)($scope);
                sortButtonCompiled = false;
            };

            var sortButtonCompiled = false;
            var renderContextMenu = function ($scope, event, options, modelValue, level, customClass, parentEl) {
                /// <summary>Render context menu recursively.</summary>
                if (!level) { level = 0; }
                if (!$) { var $ = angular.element; }
                $(event.currentTarget).addClass('context');

                var $ul;
                if ('$select' in $scope) {
                    $ul = $compile('<ul ng-hide="$select.open"></ul>')($scope);
                } else {
                    $ul = $('<ul>');
                }

                $ul.addClass('dropdown-menu');

                if (level === 0) {
                    $ul.addClass('ui-select-choices');
                } else {
                    $ul.addClass('context-submenu');
                }

                $ul.attr({ 'role': 'menu' });
                $ul.css({
                    display: 'block',
                    position: 'absolute',
                    left: event.pageX + 'px',
                    top: event.pageY + 'px'
                });

                var $promises = [];

                if($scope.showButton) {
                    if(!sortButtonCompiled) {
                        $compile($sortButton)($scope);
                    }
                    $ul.append($sortButton);
                }

                $scope.alreadySorted = alreadySorted;

                $sortButton.on('click', function() {
                    sortButtonCompiled = true;
                    var selectDeselect = [];
                    var sort;
                    _.each(options, function(value) {
                        if(value[0].name === undefined) {
                            selectDeselect = value;
                        }
                    });
                    sort = _.filter(options, function(o) { return o[0].name; });
                    if(!alreadySorted) {
                        sort = _.sortBy(sort, function(o) {
                                return o[0].name;
                            });
                        alreadySorted = true; //ASC
                    } else {
                        sort = _.sortBy(sort, function(o) {
                                return o[0].order;
                            });
                        alreadySorted = false; //original order
                    }
                    options.splice(0, options.length);
                    options.unshift(selectDeselect);
                    _.each(sort, function(value) {
                        options.push(value);
                    });
                    $sortButton.toggleClass('ascending', alreadySorted);
                    $scope.$emit('refresh-context-menu');
                    $scope.$emit('update-show-me-list', _.rest(options), alreadySorted);
                    reCompileSortButton($scope);
                });

                angular.forEach(options, function (item) {

                    var $li = $('<li>');
                    if (item === null) {
                        $li.addClass('divider');
                    } else if (typeof item[0] === "object" && !item[0].getPreHtml) {
                        custom.initialize($li, item);
                    } else {
                        processItem($scope, event, modelValue, item, $ul, $li, $promises, $q, $, level, parentEl);
                    }
                    $ul.append($li);
                });

                var height = Math.max(
                    document.body.scrollHeight, document.documentElement.scrollHeight,
                    document.body.offsetHeight, document.documentElement.offsetHeight,
                    document.body.clientHeight, document.documentElement.clientHeight
                );
                $(document).find('body').append($ul);

                handlePromises($ul, level, event, $promises);

                function removeOnScrollEvent(e) {
                    removeAllContextMenus(e);
                }

                function removeOnClickEvent(e) {
                    if(!$(e.target).hasClass("dropdown-menu")
                        && !$(e.target).parents().hasClass("dropdown-menu")) {
                        removeAllContextMenus(e)
                    }
                }


                function removeAllContextMenus(e) {
                    $(document.body).unbind('mousedown.contextmenu');
                    $(document).unbind('scroll.contextmenu');
                    if ( $(event.currentTarget).hasClass('context') ) {
                        $(event.currentTarget).removeClass('context');
                        removeContextMenus();
                    }
                }

                if(level === 0) {
                    $(document.body).bind('mousedown.contextmenu', removeOnClickEvent);
                    /// remove the menu when the scroll moves
                    $(document).bind('scroll.contextmenu', removeOnScrollEvent);
                }

                $scope.$on("$destroy", function () {
                    removeContextMenus();
                });

                contextMenus.push($ul);
            };

            function isTouchDevice() {
                return 'ontouchstart' in window  || navigator.maxTouchPoints; // works on most browsers | works on IE10/11 and Surface
            }

            return function ($scope, element, attrs) {
                var openMenuEvent = "click";
                if(attrs.tagContextMenuOn && typeof(attrs.tagContextMenuOn) === "string"){
                    openMenuEvent = attrs.tagContextMenuOn;
                }

                if(attrs.tagContextMenuUiSelectCursorPosition){
                    $scope.uiSelectCursorPosition = $scope.$eval(attrs.tagContextMenuUiSelectCursorPosition);
                }

                $rootScope.$on('refresh-context-menu', function() {

                    removeContextMenus();

                    if ($scope.lastEvent) {
                        $scope.$apply(function () {
                            $scope.options = $scope.$eval(attrs.tagContextMenu).options;
                            var customClass = attrs.tagContextMenuClass;
                            $scope.modelValue = $scope.$eval(attrs.model);
                            if ($scope.options instanceof Array) {
                                if ($scope.options.length === 0) { return; }
                                renderContextMenu($scope, $scope.lastEvent, $scope.options, $scope.modelValue, undefined, customClass);
                            } else {
                                throw '"' + attrs.tagContextMenu + '" not an array';
                            }
                        });
                    } else {
                        console.info('you must showing context menu, before refreshing');
                    }

                });

                element.on(openMenuEvent, function (event) {
                    if(!attrs.allowEventPropagation) {
                        event.stopPropagation();
                        event.preventDefault();
                    }

                    event.pageX = $(event.currentTarget).offset().left;
                    event.pageY = $(event.currentTarget).offset().top + $(event.currentTarget).height() + 8;


                    // Don't show context menu if on touch device and element is draggable
                    if(isTouchDevice() && element.attr('draggable') === 'true') {
                        return false;
                    }

                    $scope.$apply(function () {
                        $scope.options = $scope.$eval(attrs.tagContextMenu).options;
                        $scope.showButton = $scope.$eval(attrs.tagContextMenu).isShowButton;
                        var customClass = attrs.tagContextMenuClass;
                        $scope.modelValue = $scope.$eval(attrs.model);
                        $scope.lastEvent = event;
                        if ($scope.options instanceof Array) {
                            if ($scope.options.length === 0) { return; }
                            renderContextMenu($scope, event, $scope.options, $scope.modelValue, undefined, customClass);
                        } else {
                            throw '"' + attrs.tagContextMenu + '" not an array';
                        }
                    });
                });
            };
        }]);
})();