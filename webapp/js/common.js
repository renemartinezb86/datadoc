define(['alertify', 'angular', /*'tinycolor',*/ "utils", 'lodash', 'moment'], function(alertify, angular, /*tinycolor,*/ utils, _, moment){

    alertify.set('notifier','position', 'bottom-left');

    var viewModes = {
        // COLUMN: 0,
        // BAR: 1,
        // PIE: 2,
        // LINE: 3,
        // AREA: 4,
        // MAP: 5,
        // SCATTER: 6,
        TABLE: 7,
        LIST: 8
    };

    function iterator(array) {
        var nextIndex = 0;

        return {
            next: function() {
                return nextIndex < array.length ?
                    {value: array[nextIndex++], done: false} :
                    {done: true};
            }
        };
    }

    var viewModeOptions = [
        {desc: 'Vertical Bar Chart', e: "Needs X-axis value to select this."},
        {desc: 'Horizontal Bar Chart', e: "Needs X-axis value to select this."},
        {desc: 'Pie Chart', e: "Needs X-axis value"},
        {desc: 'Line Chart'},
        {desc: 'Area Chart'},
        {desc: 'Geo Graph', e: "Needs 1 country or coordinate to select this."},
        {desc: 'Scatter Plot', e: "Needs numbers for X-axis value and Y-axis value to select this."},
        {desc: 'Table View'},
        {desc: 'List view'}
    ];

    var URL_REGEXP = /^(\s*(http|https|ftp|ftps|itmss)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/[^\s,;]*)?)$/g;

    function getCtrlNames() {
        return {
            VIZ: 'visualizationCtrl',
            EPOPUP: 'embedPopupCtrl',
            EMBED: 'embedCtrl'
        };
    }

    function isOverflow(el) {
        var cloneEl = $(el)
            .clone()
            .css({display: 'inline', width: 'auto', visibility: 'hidden'})
            .appendTo('body');

        return cloneEl.width() > $(el).width();
    }

    // dev helper
    var smartTimer = (function () {
        var timer;
        clearTimer();

        function getTime(key) {
            return timer[key].end - timer[key].start;
        }

        function start(key) {
            timer[key] = {
                start: Date.now()
            }
        }

        function stop(key) {
            if (!timer[key]) {
                start(key);
            }

            timer[key].end = Date.now();
        }

        function getTimer() {
            return timer;
        }

        function removeTimer(key) {
            delete timer[key];
        }

        function clearTimer() {
            timer = {};
        }

        function showAll() {
            console.group('smartTimer');

            _.map(timer, function(timeObj, key) {
                return {
                    name: key,
                    order: timeObj.end,
                    time: getTime(key)
                }
            }).sort(function(a, b) {
                return a.order - b.order;
            }).forEach(function(time) {
                console.log(time.name + ': ' + time.time);
            });

            console.groupEnd();
        }

        return {
            start: start,
            stop: stop,
            getTimer: getTimer,
            showAll: showAll,
            remove: removeTimer,
            clear: clearTimer
        }
    })();

    function getColumnType(column) {
        if(column.isList) {
            return '[...]';
        }
        switch (column.colType.toLowerCase()) {
            case 'string':
                return 'ABC';
            case 'boolean':
                return 'Y-N';
            case 'decimal':
                return '123';
            case 'date':
                return 'Jan';
            case 'time':
                return '11:00';
            case 'location_lat_lon':
            case 'location_usa_state_codes':
            case 'location_country_codes':
                return 'Loc';
            case 'array':
                return 'Arr';
            case 'object':
                return 'Obj';
        }
        return 'undef';
    }

    function getErrorString(e){
        if(_.isArray(e)){
            var errorString = "";
            _.forEach(e, function(error){
                if(!error.field && !error.message){
                    errorString += "<li>" + error.code + "</li>";
                } else if (error.field) {
                    errorString += "<li>" + error.field + ": " + error.defaultMessage + "</li>";
                } else if (error.message) {
                    errorString += "<li>" + error.message + "</li>";
                }
            });
            return "<ul>" + errorString + "</ul>";
        }
        return e.message;
    }

    var msgCounter = {};
    function show(type, msg, key, multiTemplate){
        if(!msgCounter[key]) {
            msgCounter[key] = {count: 0, msg: undefined};
        }
        msgCounter[key].count += 1;
        if(msgCounter[key].msg && multiTemplate){
            var s = _.template(multiTemplate)({count: msgCounter[key].count});
            msgCounter[key].msg.delay(3).setContent(s);
        } else {
            msgCounter[key].msg = alertify[type](msg);
            msgCounter[key].msg.callback = function() {
                msgCounter[key].count = 0;
                msgCounter[key].msg = undefined;
            };
        }
        return msgCounter[key].msg;
    }

    function estimateRemainingTime(before, after, interval) {
        if (interval == void 0) { interval = 1000; }

        var diff = after - before;
        var secOnPercent = (1 / diff) * interval;
        var res = (100 - after) * secOnPercent;

        if (!diff) {
            return "";
        }

        var duration = moment.duration(res, 'milliseconds');

        return duration.hours() + ":" + duration.minutes() + ":" + duration.seconds();
    }

    function isValidURL(str) {
        var pat = /^(https?|itmss|ftp):\/\//i;
        return pat.test(str);
    }

    function highlightURL(str) {
        return str.toString().replace(URL_REGEXP,
            '<a href="$1" target="_blank">$1</a>')
    }

    function onlyHighlightURL(str) {
        return str.toString().replace(URL_REGEXP,
            '<span class="highlighted-link">$1</span>')
    }

    function isURL(str) {
        return URL_REGEXP.test(str);
    }

    function getFullTemplateName(t){
        return 'static/templates/include/' + t + '.html';
    }

    function showError(error){
        return notify({message: error.message, icon: 'warning'});
    }

    function showWarning(warning){
        return notify({message: warning.message, icon: 'warning'});
    }

    function showSuccess(success){
        return notify({message: success.message, icon: 'success'});
    }

    function showNotification(message, wait, callback){
        return alertify.notify(message, wait, callback);
    }

    function closeAllNotifications() {
        alertify.dismissAll();
    }

    function notify(content){
        var $container = $('<div class="content">'),
            $el,
            wait = 10;

        function getNotificationClass() {
            if (content.icon) {
                switch (content.icon) {
                    case 'notification':
                        return 'fa-warning notification';
                    case 'success':
                        return 'fa-check-circle notification';
                    case 'warning':
                    default:
                        return 'fa-warning';
                }
            }
        }

        if(content.message){
            const iconClass = getNotificationClass();
            $el = $('<span><i class="fa fa-lg ' + iconClass + '"></i><span>' + content.message +'</span></span>');
            if(content.wait != undefined){
                wait = content.wait;
            }
        } else {
            $el = content;
        }
        $container.append($el);
        $container.append('<a class="close"><svg x="0px" y="0px" width="12px" height="12px" viewBox="0 0 10 10" focusable="false"><polygon class="a-s-fa-Ha-pa" fill="#FFFFFF" points="10,1.01 8.99,0 5,3.99 1.01,0 0,1.01 3.99,5 0,8.99 1.01,10 5,6.01 8.99,10 10,8.99 6.01,5 "></polygon></svg></a>')
        var msg = alertify.notify($container[0], 'notification', wait);
        if(!content.keepOthers) {
            msg.dismissOthers();
        }
        msg.ondismiss = function(e){
            var closing = !e || $(e.target).closest('.close').length > 0;
            if(closing) {
                if (content.ondismiss) {
                    content.ondismiss(e);
                }
            }
            return closing;
        };
        return msg;
    }

    function moveInArray(array, fromIndex, toIndex) {
        array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
        return array;
    }

    var renderContextMenu = function ($scope, event, options, model) {
        if (!$) {
            var $ = angular.element;
        }
        var contextMenuOptions = $scope.contextMenuOptions || {};

        $(event.currentTarget).addClass('context');
        var $contextMenu = $('<div>');
        $contextMenu.addClass('dropdown clearfix');
        var $ul = $('<ul>');
        $ul.addClass('dropdown-menu');

        if (contextMenuOptions.dropdownMenuClass) {
            $ul.addClass(contextMenuOptions.dropdownMenuClass);
        } else {
            $ul.addClass('context-menu');
        }

        $ul.attr({'role': 'menu'});
        $ul.css({
            display: 'block',
            position: 'absolute',
            left: event.pageX + 'px',
            top: event.pageY + 'px'
        });
        angular.forEach(options, function (item, i) {
            var $li = $('<li>');

            if (contextMenuOptions.dropdownItemClass) {
                $li.addClass(contextMenuOptions.dropdownItemClass);
            }

            if (item === null) {
                $li.addClass('divider');
            } else {
                var $a = $('<a>');
                $a.attr({tabindex: '-1', href: '#'});
                $a.css({
                    'display': 'flex',
                    'align-items': 'center'
                });
                var text = typeof item[0] == 'string' ? item[0] : item[0].call($scope, $scope, event, model);
                $a.html(text);
                $li.append($a);
                var enabled = angular.isDefined(item[2]) ? item[2].call($scope, $scope, event, text, model) : true;
                if (enabled) {
                    $li.on('click', function ($event) {
                        $event.preventDefault();
                        $scope.$apply(function () {
                            $(event.currentTarget).removeClass('context');
                            $contextMenu.remove();
                            item[1].call($scope, $scope, event, model);
                        });
                        if(contextMenuOptions.onClose) {
                            contextMenuOptions.onClose($event);
                        }
                    });
                } else {
                    $li.on('click', function ($event) {
                        $event.preventDefault();
                    });
                    $li.addClass('disabled');
                }
            }
            $ul.append($li);
        });
        $contextMenu.append($ul);
        var height = Math.max(
            document.body.scrollHeight, document.documentElement.scrollHeight,
            document.body.offsetHeight, document.documentElement.offsetHeight,
            document.body.clientHeight, document.documentElement.clientHeight
        );
        $contextMenu.css({
            width: '100%',
            height: height + 'px',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999
        });
        $(document).find('body').append($contextMenu);
        if(($('body').innerHeight() - $ul.position().top) <= $ul.innerHeight()) {
            $ul.css({top: ($ul.position().top - $ul.innerHeight())});
        }

        // check if $ul outside left
        var overflowX = $('body').innerWidth() - $ul[0].getBoundingClientRect().right;
        if (overflowX < 0) {
            $ul.css({left: ($ul.position().left + overflowX)});
        }

        $contextMenu.on("mousedown", function (e) {
            if ($(e.target).hasClass('dropdown')) {
                $(event.currentTarget).removeClass('context');
                $contextMenu.remove();
                if(contextMenuOptions.onClose) {
                    contextMenuOptions.onClose(e);
                }
            }
        }).on('contextmenu', function (event) {
            $(event.currentTarget).removeClass('context');
            event.preventDefault();
            $contextMenu.remove();
            if(contextMenuOptions.onClose) {
                contextMenuOptions.onClose(e);
            }
        });
    };

    function unscreen(s){
        return s.replace('\\\.', '.');
    }

    String.prototype.hashCode = function() {
        var hash = 0, i, chr, len;
        if (this.length === 0) return hash;
        for (i = 0, len = this.length; i < len; i++) {
            chr   = this.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    };

    var hashCode = function(stuff) {
        if (!stuff)
            return 0;
        if (stuff.hashCode)
            return stuff.hashCode();
        if (_.isObject(stuff)) {
            return JSON.stringify(stuff).hashCode();
        }
        throw "Can't calculate hash";
    };

    function getBodyWidth() {
        if (document.body) {
            return document.body.clientWidth;
        }

        if (window.innerHeight) {
            return window.innerWidth;
        }

        if (document.documentElement && document.documentElement.clientWidth) {
            return document.documentElement.clientWidth;
        }

        return -1;
    }

    function getBodyHeight() {
        if (document.body) {
            return document.body.clientHeight;
        }

        if (window.innerHeight) {
            return window.innerHeight;
        }

        if (document.documentElement && document.documentElement.clientHeight) {
            return document.documentElement.clientHeight;
        }

        return -1;
    }

    function linksArrayForList(arr) {
        var str = "[";
        _.forEach(arr, function(e, k) {
            str += "\"<a href=\"" + e + "\" target=\"_blank\">" + e + "</a>\"";
            if(k != arr.length - 1) str += ", ";
            else str += "]"
        });

        return str;
    }

    var numberOps = [
        {name: "", val: ""},
        {name: "Value", val: "terms"},
        {name: "Sum", val: "sum"},
        {name: "Count", val: "value_count"},
        {name: "Unique Count", val: "cardinality"},
        {name: "Avg", val: "avg"},
        {name: "Min", val: "min"},
        {name: "Max", val: "max"}
    ];
    var nonNumberOps = [
        {name: "", val: ""},
        {name: "Value", val: "terms"},
        {name: "Count", val: "value_count"},
        {name: "Unique count", val: "cardinality"}
    ];
    var dateOps = [
        {name: "HOUR", val: "hour"},
        {name: "DAY", val: "day"},
        {name: "MONTH", val: "month"},
        {name: "QUARTER", val: "quarter"},
        {name: "YEAR", val: "year"}
    ];

    function isResetShow(filter) {
        if(filter.listMode){
            if(filter.col.type === 'BOOLEAN' || filter.col.type === 'LOCATION_LAT_LON') {
                return _.some(filter.list, function (f) {
                        return f.selected || !f.show;
                    });
            } else {
                return filter.count > 10 || _.some(filter.list, function (f) {
                        return f.selected || !f.show;
                    });
            }
        } else {
            if(filter.col.type === 'DECIMAL') {
                return !filter.linlog || filter.changed
                    || filter.value1 != filter.min || filter.value2 != filter.max;
            } else {
                return filter.value1 != filter.min || filter.max != filter.value2;
            }
        }
    }

    function setChartDatepicker($scope) {
        var v = $scope.vizSummary.xAxisShows;
        if (v && v[0] && v[0].type && v[0].type === 'daterange') {
            var column = v[0];
            var filterColumn = _.find($scope.dataSummary.filters, {name: column.field});
            if (!filterColumn) {
                filterColumn = _.find($scope.filterList, {name: column.field});
                $scope.addFilter(filterColumn);
            } else $scope.chartDatepicker = true;
        } else {
            filterColumn = _.find($scope.dataSummary.filters, {type: 'daterange'});
            $scope.chartDatepicker = !!(filterColumn && isResetShow(filterColumn));
        }
    }

    function resetOneFilter(filter, $scope) {
        console.warn("Using deprecated function. Try using FilterService instead.");
        var type = filter.col.type;
        switch (type) {
            case 'STRING':
                filter.search = '';
                filter.and_or = false;
                filter.count = 10;
                filter.isload = false;
                _.forEach(filter.list, function (agg) {
                    agg.selected = false;
                    agg.show = true;
                });
                break;
            case 'DECIMAL':
                if (!filter.linlog) {
                    filter.linlog = true;
                    $scope.switchLinLog(filter);
                }
                break;
            case 'TIME':
                filter.value1 = filter.min;
                filter.value2 = filter.max;
                filter.changed = false;
                break;
            case 'DATE':
                filter.value1 = filter.min;
                filter.value2 = filter.max;
                // setChartDatepicker();
                break;
            case "LOCATION_LAT_LON":
                delete filter.box;
                break;
            case "BOOLEAN":
                filter.and_or = false;
                filter.isload = false;
                _.forEach(filter.list, function (agg) {
                    agg.selected = false;
                    agg.show = true;
                });
                break;
        }
    }

    function showRegressionCalculator(e, regData, $uibModal) {
        e.preventDefault();
        e.stopPropagation();

        var modalInstance = $uibModal.open({
            templateUrl: 'static/templates/include/regression-calculator.html',
            controller: 'regressionCalculatorCtrl',
            backdrop: 'static',
            size: 'md',
            resolve: {
                regData: function() {
                    return regData;
                }
            }
        });

        modalInstance.result.then(function () {
        }, function () {
        });
    }

    function onRegressionTypeSelected(type, $scope) {
        if ($scope.vizSummary.regressionType === type) return;
        $scope.vizSummary.regressionType = type;

        $scope.updateChart();
    }

    function queryParams() {
        var query_string = {};
        var query = window.location.search.substring(1);
        var vars = query.split("&");
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            // If first entry with this name
            if (typeof query_string[pair[0]] === "undefined") {
                query_string[pair[0]] = decodeURIComponent(pair[1]);
                // If second entry with this name
            } else if (typeof query_string[pair[0]] === "string") {
                var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
                query_string[pair[0]] = arr;
                // If third or later entry with this name
            } else {
                query_string[pair[0]].push(decodeURIComponent(pair[1]));
            }
        }
        return query_string;
    }

    class ErrorWithId extends Error {
        constructor(msg, type, id, options) {
            super(msg, options);
            this.id = id;
            this.type = type;
            this.errorId = `${id}_${type}`;
        }
    }

    const isDefined = (v) => {
        return v !== null && v !== undefined;
    };

    const toUpperCase = (val) => {
        if(val === null || val === undefined) {
            return val;
        }
        if(typeof val === 'string') {
            return val.toUpperCase();
        }
    };
    const coalesce = () => {
        return _.chain(arguments)
            .filter(_.identity)
            .first()
            .value();
    };

    return {
        coalesce,
        toUpperCase,
        ErrorWithId,
        show: show,
        randomGUID: utils.randomGUID,
        getFullTemplateName: getFullTemplateName,
        instanceGUID: utils.instanceGUID,
        URL_REGEXP: URL_REGEXP,
        showError: showError,
        showWarning: showWarning,
        showSuccess: showSuccess,
        showNotification: showNotification,
        closeAllNotifications: closeAllNotifications,
        notify: notify,
        highlightURL: highlightURL,
        onlyHighlightURL: onlyHighlightURL,
        isURL: isURL,
        moveInArray: moveInArray,
        renderContextMenu: renderContextMenu,
        getErrorString: getErrorString,
        showValidationErrors: function(errors){
            showError({error: getErrorString(errors)});
        },
        withIgnoreOnBeforeUnload: function($timeout, f){
            var tmp = window.onbeforeunload;
            window.onbeforeunload = null;
            f();
            $timeout(function(){
                window.onbeforeunload = tmp;
            })
        },
        typeNameMappings: {
            'DECIMAL': 'Number',
            'BOOLEAN': 'Boolean',
            'STRING': 'String',
            'DATE': 'Date'
        },
        splitPath: function(s){
            if(s.length < 1){
                return [s];
            }
            var res = [];
            var current = "";
            for(var i = 0; i < s.length; i++){
                if(i > 0 && s[i] === '.' && s[i-1] !== '\\'){
                    res.push(current);
                    current = "";
                } else {
                    current += s[i];
                }
            }
            res.push(current);
            return _.map(res, unscreen);
        },
        unscreen: unscreen,
        hashCode: hashCode,
        isValidURL: isValidURL,
        numberOps: numberOps,
        nonNumberOps: nonNumberOps,
        dateOps: dateOps,
        resetOneFilter: resetOneFilter,
        setChartDatepicker: setChartDatepicker,
        showRegressionCalculator: showRegressionCalculator,
        onRegressionTypeSelected: onRegressionTypeSelected,
        queryParams: queryParams,
        getCtrlNames: getCtrlNames,
        isResetShow: isResetShow,
        getBodyWidth: getBodyWidth,
        getBodyHeight: getBodyHeight,
        getViewModes: function(){
            return viewModes;
        },
        getViewModeOptions: function(){
            return viewModeOptions;
        },
        smartTimer: smartTimer,
        isOverflow: isOverflow,
        estimateRemainingTime: estimateRemainingTime,
        getColumnType: getColumnType,
        iterator,
        isDefined
    }
});