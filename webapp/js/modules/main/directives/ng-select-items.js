define(['./module', 'angular', 'jquery', 'lodash', 'KeyJS'], function (directives, angular, $, _, KeyJS) {
    'use strict';
    directives.directive('ngSelectItems', ['$rootScope', '$q', function ($rootScope, $q) {
        return {
            restrict: 'A',
            scope: true,
            link: function ($scope, $elm, $attrs) {
                const withoutClasses = ['.upload-item', '.dropdown', '.modal', 'main-page-file-details'];

                let isSelecting = false,
                    scrollInterval,
                    selectionStartCoors,
                    containerDimensions,
                    selectedBeforeLasso,
                    lassoStartedFrom,
                    isKeyboardNavigationEnabled = $attrs["enableKeyboardNavigation"];

                let options = $scope.$eval($attrs["ngSelectItems"]);

                let {   itemSelector,
                        itemSelectorWrapper,
                        getItemFn,
                        selectedItemsKey,
                        lastSelectItem,
                        currentSelectedItem,
                        onClick,
                        loadMore,
                        loadMoreOffsetFromBottom:offsetFromBottom=10,
                        keyboardNavOptions:navOptions} = options;

                if(loadMore){
                    let raw = $elm[0],
                        loading = false;
                    $elm.bind('scroll', function() {
                        if (!loading && (raw.scrollTop + raw.offsetHeight >= raw.scrollHeight * ((100 - (offsetFromBottom || 0)) / 100))) {
                            loading = true;
                            $scope.$apply(() => $q.when(loadMore()).then(() => loading = false));
                        }
                    });
                }

                function getItemId(el) {
                    return el.closest(itemSelector).find(".uid").val();
                }

                function getItemById(id) {
                    return getItemFn(id);
                }

                function getSelectedItems() {
                    return $scope.$eval(selectedItemsKey);
                }

                function getSelectedItem() {
                    return $scope.$eval(lastSelectItem);
                }

                function getCurrentSelectItem() {
                    return $scope.$eval(currentSelectedItem);
                }

                var $selection = $('<div class="selection"></div>');
                $selection.hide().appendTo($elm);

                var cancelSelection = function(){
                    isSelecting = false;
                    $selection.hide();
                    clearInterval(scrollInterval);
                };

                var clearSelection = function(event){
                    let el = $(event.originalEvent.target);

                    previousItem = null;

                    if (_.every(withoutClasses, (c) => !el.closest(c).length)) {
                        $scope.$apply(() => $scope.onWrapperClick());
                    }
                };
                var scrollAndSelect = function(event){
                    if(isSelecting) {
                        scrollContainer(event);
                        select(event);
                    }
                };
                var scrollContainer = function(event){
                    var top = $elm.offset().top,
                        bottom = top + $elm.height(),
                        pageY = event.pageY,
                        topDiff = top - pageY,
                        bottomDiff = pageY - bottom;

                    if(topDiff > 0){
                        clearInterval(scrollInterval);
                        scrollInterval = setInterval(function(){
                            var scrollTop = $elm.scrollTop();
                            $elm.scrollTop(scrollTop - topDiff / 10 - 100);
                            if(isSelecting) {
                                select(event);
                            }
                        });
                    } else if (bottomDiff > 0){
                        clearInterval(scrollInterval);
                        scrollInterval = setInterval(function(){
                            var scrollTop = $elm.scrollTop();
                            $elm.scrollTop(scrollTop + bottomDiff / 10 + 100);
                            if(isSelecting) {
                                select(event);
                            }
                        });
                    } else {
                        clearInterval(scrollInterval);
                    }
                };
                $scope.$on('disable-keyboard-navigation', function() {
                    document.body.removeEventListener('keyup', bodyKeyupFn);
                    document.body.removeEventListener('keydown', bodyKeydownFn);
                });
                $scope.$on('enable-keyboard-navigation', function() {
                    document.body.addEventListener('keydown', bodyKeydownFn);
                    document.body.addEventListener('keyup', bodyKeyupFn);
                });
                $scope.$on('cancel-selection', cancelSelection);
                $scope.$on('scroll-container', function(_, event){
                    scrollContainer(event)
                });

                $(window).on('mouseup', cancelSelection);
                $('body').on('mousedown', clearSelection).on('mousemove', scrollAndSelect);
                // increase responsibility of selection when mouse left browser window
                $(document).on('mouseleave', (e) => {
                    if(isSelecting) {
                        let dHeight = $(document).height();
                        if (e.clientY <= 0) {
                            scrollAndSelect(e);
                        } else if (e.clientY >= dHeight) {
                            scrollAndSelect(e);
                        }
                    }
                });


                $scope.$on('$destroy', function() {
                    $(window).off('mouseup', cancelSelection);
                    $('body').off('mousedown').off('mousemove');

                    if (isKeyboardNavigationEnabled) {
                        document.body.removeEventListener('keydown', bodyKeydownFn);
                        document.body.removeEventListener('keyup', bodyKeyupFn);
                    }
                });

                if (isKeyboardNavigationEnabled) {

                    if (!window.ngSelectItemsKeyPressed) {
                        window.ngSelectItemsKeyPressed = {}
                    }

                    document.body.addEventListener('keyup', bodyKeyupFn);
                    document.body.addEventListener('keydown', bodyKeydownFn);
                }

                function bodyKeyupFn(e) {
                    window.ngSelectItemsKeyPressed[e.which] = false;
                }

                function bodyKeydownFn(e) {
                    let n = e.target.nodeName;
                    if (n !== 'INPUT' && n !== 'TEXTAREA') {

                        if ((e.ctrlKey || e.metaKey) && e.which == KeyJS.A) {

                            if (navOptions.onSelectAll) {
                                e.preventDefault();
                                navOptions.onSelectAll(e);
                            }
                        }
                        // if key is not pressed
                        else if (!window.ngSelectItemsKeyPressed[e.which]) {

                            switch (e.which) {
                                case KeyJS.ESC:
                                    if (navOptions.onEsc) {
                                        navOptions.onEsc(e);
                                    }

                                    break;
                                case KeyJS.UP:
                                case KeyJS.DOWN:
                                    e.preventDefault();
                                    var items = getSelectedItems();
                                    var lastItem = getSelectedItem();
                                    var currentItem = getCurrentSelectItem();
                                    var el, itemId;

                                    if (items.length) {
                                        let lastSelectedItem;
                                        let uidValue;
                                        if (e.shiftKey || (e.ctrlKey || e.metaKey)) {
                                            lastSelectedItem = items[items.length - 1];
                                            uidValue = currentItem
                                        }
                                        else {
                                            lastSelectedItem = lastItem ? lastItem : items[0];
                                            uidValue = lastSelectedItem
                                        }
                                        el = $elm.find(`${itemSelector} .uid[value=${uidValue.id}]`);

                                        // do closest for normal moving in parent container items
                                        if (itemSelectorWrapper) {
                                            el = el.closest(itemSelectorWrapper);
                                        } else {
                                            el = el.closest(itemSelector);
                                        }

                                        // change "position"
                                        if (e.which === KeyJS.UP) {
                                            el = lastSelectedItem === items[0] && items.length > 1 ? el : el.prev();
                                        } else {
                                            el = _.includes(el.next()[0].classList, 'main-page-ds-pane') ? el.next() : el;
                                        }

                                        if (itemSelectorWrapper) {
                                            itemId = getItemId(el.find(itemSelector))
                                        } else {
                                            itemId = getItemId(el);
                                        }

                                        doOnClick(e, itemId);
                                        makeActiveVisible(el[0]);
                                    }
                                    // if not selected items
                                    else if(navOptions.enableAutoSelect) {
                                        el = $elm.find(`${itemSelectorWrapper || itemSelector} .uid`).get(0);
                                        itemId = $(el).attr("value");
                                        doOnClick(e, itemId);
                                        makeActiveVisible($(el).closest(itemSelectorWrapper || itemSelector)[0]);
                                    }

                                    break;
                                case KeyJS.ENTER:
                                    window.ngSelectItemsKeyPressed[e.which] = true;

                                    var items = getSelectedItems();
                                    if (items.length === 1) {
                                        if (navOptions.onEnter) {
                                            e.preventDefault();
                                            navOptions.onEnter(e, items[0]);
                                        }
                                    }

                                    break;

                                case KeyJS.BACKSPACE:
                                    window.ngSelectItemsKeyPressed[e.which] = true;

                                    if (navOptions.onBack) {
                                        e.preventDefault();
                                        navOptions.onBack(e);
                                    }

                                    break;
                                case KeyJS.SPACEBAR:
                                    if(e.ctrlKey || e.metaKey){
                                        e.preventDefault();
                                        var items = getSelectedItems();
                                        var lastItem = getSelectedItem();
                                        var currentItem = getCurrentSelectItem();
                                        var el, itemId;

                                        if (items.length) {
                                            let lastSelectedItem;
                                            let uidValue;
                                            lastSelectedItem = lastItem ? lastItem : items[0];
                                            uidValue = lastSelectedItem;
                                            el = $elm.find(`${itemSelector} .uid[value=${uidValue.id}]`);

                                            // do closest for normal moving in parent container items
                                            if (itemSelectorWrapper) {
                                                el = el.closest(itemSelectorWrapper);
                                            } else {
                                                el = el.closest(itemSelector);
                                            }

                                            if (itemSelectorWrapper) {
                                                itemId = getItemId(el.find(itemSelector))
                                            } else {
                                                itemId = getItemId(el);
                                            }

                                            doOnClick(e, itemId);
                                            makeActiveVisible(el[0]);
                                        }
                                        // if not selected items
                                        else if(navOptions.enableAutoSelect) {
                                            el = $elm.find(`${itemSelectorWrapper || itemSelector} .uid`).get(0);
                                            itemId = $(el).attr("value");
                                            doOnClick(e, itemId);
                                            makeActiveVisible($(el).closest(itemSelectorWrapper || itemSelector)[0]);
                                        }

                                    }
                                    break;

                            }
                        }

                    }
                }

                function doOnClick(e, itemId) {
                    if (itemId == null) return;

                    let item = getItemById(itemId);
                    if (item) {
                        $scope.$apply(function () {
                            onClick(item, e);
                        });
                    }
                }

                function makeActiveVisible(target) {
                    if (!target) {
                        return;
                    }

                    var offsetTop = target.offsetTop;
                    var offsetHeight = target.offsetHeight;
                    var parentOffsetHeight = target.parentNode.offsetHeight;
                    var parentScrollTop = target.parentNode.scrollTop;
                    var parentOffsetTop = 0;

                    // move down
                    if (offsetTop + offsetHeight > parentOffsetHeight + parentScrollTop + parentOffsetTop) {
                        target.parentNode.scrollTop = (offsetTop - parentOffsetHeight + offsetHeight) - parentOffsetTop;
                    }
                    // move up
                    else if (offsetTop < parentScrollTop) {
                        target.parentNode.scrollTop = offsetTop - parentOffsetTop;
                    }
                }

                let previousItem;

                function select(event){
                    const itemSize = 52;
                    const listOffset = 1; //number elements before selectable list
                    const elmScrollTop = $elm.scrollTop();
                    const elmHeight = $elm.height();
                    const elmWidth = $elm.prop("clientWidth"); // elm width without scrollbar
                    const elmOffsetTop = $elm.offset().top;
                    const offset = elmScrollTop / itemSize;
                    const total = Math.ceil((elmHeight + 1) / itemSize);
                    const currentItem = (event.pageY - elmOffsetTop) / itemSize + offset;
                    const maxItem = total + offset;
                    const itemIndex = Math.floor(Math.min(Math.max(1, currentItem + listOffset), maxItem));
                    const itemId = $elm.find(itemSelector+':nth(' + itemIndex + ') .uid').val();

                    if(itemId && (previousItem !== itemId)) {
                        let item = getItemById(itemId);
                        previousItem = itemId;

                        $scope.$apply(() => onClick(item, {
                            shiftKey: true,
                            selectedBeforeLasso: selectedBeforeLasso,
                            lassoStartedFrom: lassoStartedFrom
                        }));
                    }
                    let curPos = getInnerContainerCoors({x: event.pageX, y: event.pageY}),
                        top, bottom, right, left;
                    if(curPos.x - selectionStartCoors.x < 0){ // dragging to left
                        right = elmWidth - selectionStartCoors.x;
                        left = curPos.x;
                    } else {                                  // dragging to right
                        left = selectionStartCoors.x;
                        right = elmWidth - curPos.x;
                    }
                    if(curPos.y - selectionStartCoors.y < 0){ // dragging upward
                        bottom = elmHeight - selectionStartCoors.y;
                        top = curPos.y;
                    } else {                                  // dragging downward
                        top = selectionStartCoors.y;
                        bottom = elmHeight - curPos.y;
                    }
                    if(left <= 0){
                        left = 1;
                    }
                    if(right <= 0){
                        right = 1;
                    }
                    if(elmScrollTop === 0 && top < 0){
                        top = 0;
                    }
                    // sorry
                    if(((elmScrollTop + elmHeight) >= containerDimensions.scrollHeight)
                        && (elmHeight - (event.pageY - elmOffsetTop)) < 0){
                        bottom = -containerDimensions.scrollHeight + elmHeight;
                    }
                    $selection.css({
                        top: top + 'px',
                        left: left + 'px',
                        bottom: bottom + 'px',
                        right: right + 'px'
                    })
                }

                function isItemSelected(selected, i){
                    return !!_.find(selected, function(item){
                        return item.id === i.id;
                    })
                }

                $elm.mousedown(function(event) {
                    if(event.button === 0) {
                        let o = $(event.originalEvent.target);
                        let itemId = getItemId(o);
                        if(o.closest('.menu-button').length){
                            return;
                        }

                        if (itemId) {
                            let item = getItemById(itemId);
                            let selected = getSelectedItems();
                            selectedBeforeLasso = [];
                            if (!isItemSelected(selected, item)) {
                                if(!event.originalEvent.dragStarted) {
                                    showSelection(event);
                                    lassoStartedFrom = item;
                                }
                                $scope.$apply(() => {
                                    onClick(item, event.originalEvent);
                                    if(event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey) {
                                        selectedBeforeLasso = getSelectedItems().slice();
                                    }
                                });
                            } else {
                                if (event.originalEvent.ctrlKey || event.originalEvent.metaKey || event.originalEvent.shiftKey) {
                                    $scope.$apply(() => onClick(item, event.originalEvent));
                                } else {
                                    let onmouseup = function(){
                                        if(!$scope.isSelectionDragged.value) {
                                            $scope.$apply(() => onClick(item, event.originalEvent));
                                        }
                                        $elm.off('mouseup', onmouseup);
                                    };
                                    $elm.on('mouseup', onmouseup);
                                }
                            }
                        } else {
                            selectedBeforeLasso = null;
                            showSelection(event); // if no files loaded show selection too
                        }
                    }
                });

                function showSelection(event) {
                    isSelecting = true;
                    selectionStartCoors = getInnerContainerCoors({
                        x: event.pageX,
                        y: event.pageY
                    });
                    containerDimensions = {
                        width: $elm.width(),
                        height: $elm.height(),
                        scrollHeight: $elm.prop('scrollHeight')
                    };
                    $selection
                        .css({
                            left: selectionStartCoors.x + 'px',
                            top: selectionStartCoors.y + 'px',
                            bottom: '',
                            right: ''
                        })
                        .show();
                }

                function getInnerContainerCoors(coors){
                    return {
                        x: coors.x - $elm.offset().left,
                        y: coors.y - $elm.offset().top + $elm.scrollTop()
                    };
                }
            }
        };
    }])
});
