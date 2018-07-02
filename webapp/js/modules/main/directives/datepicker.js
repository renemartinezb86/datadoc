define(['./module', 'moment', 'angular'], function (module, moment, angular) {
    'use strict';

    var CaseApp = {};

    CaseApp.convertHex = function convertHex(hex, opacity) {
        hex = hex.replace('#', '');
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity / 100 + ')';
    };

    // capitalize first letter helper function
    CaseApp.cFL = function (string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    };

    CaseApp.Calendar = function (month, year, op) {
        this.month = month;
        this.year = year;
        this.op = op;
        this.html = '';
    };

    CaseApp.Calendar.prototype.generateHTML = function (scope, week) {
        var cal_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
            weekHighlight, weekClick,
            lastmonday, startingDay = moment([this.year, this.month, 1]).isoWeekday(),
            monthLength = cal_days_in_month[this.month],
            tempDate = moment(scope['custom' + CaseApp.cFL(this.op)]),
            d,
            weekBuffer = week ? ' class="highlight" ng-click="selectWeek($event,' + moment([this.year, this.month, 15]).unix() + ')"' : '';
        // compensate for leap year
        if (this.month == 1) { // February only!
            if ((this.year % 4 == 0 && this.year % 100 != 0) || this.year % 400 == 0) {
                monthLength = 29;
            }
        }

        var html = '<thead><tr><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th><th>Su</th></tr></thead><tbody><tr' + weekBuffer + '>';

        // fill in the days
        var day = 1, nextDay = 1;
        // this loop is for is weeks (rows)
        for (var i = 0; i < 9; i++) {
            // this loop is for weekdays (cells)
            for (var j = 1; j <= 7; j++) {
                if (day <= monthLength && (i > 0 || j >= startingDay)) {
                    weekHighlight = week ?
                        (moment([this.year, this.month, day]).isSame(tempDate.toISOString(), 'isoweek') ? 'selected' : '')
                        : (day == tempDate.date() && this.month == tempDate.month() && this.year == tempDate.year() ? 'selected' : '');

                    weekClick = week ? ('') : 'ng-click="selectDay(' + day + ', calLabel,\'' + this.op + '\')"';
                    html += '<td ' + weekClick + ' class="selectable ' + weekHighlight + '"><span class="label">' + day + '</span>';
                    day++;
                } else if (day > monthLength) {
                    if (this.month == 11) {
                        d = moment([this.year + 1, 0, day - monthLength])
                    } else {
                        d = moment([this.year, this.month + 1, day - monthLength])
                    }
                    html += '<td class="next-month ' + (week ? (d.isSame(tempDate.toISOString(), 'isoweek') ? 'selected' : '') : '' ) + '"><span class="label">' + nextDay + '</span>';
                    nextDay++;
                    day++;
                } else if (day < monthLength && j < startingDay) {
                    if (this.month == 0) {
                        d = moment([this.year - 1, 11, 1]).endOf('month').startOf('week');
                    } else {
                        d = moment([this.year, this.month - 1, 1]).endOf('month').startOf('week');
                    }
                    lastmonday = d.add(j, 'days').date();
                    html += '<td class="prev-month ' + (week ? (moment([this.year, this.month, day]).isSame(tempDate.toISOString(), 'isoweek') ? 'selected' : '') : '' ) + '"><span class="label">' + lastmonday + '</span>';
                }
                html += '</td>';
            }
            // stop making rows if we've run out of days
            if (day > monthLength) {
                break;
            } else {
                html += '</tr><tr' + weekBuffer + '>';
            }
        }
        html += '</tr></tbody>';

        this.html = html;
    };

    CaseApp.Calendar.prototype.getHTML = function () {
        return this.html;
    };


    module.directive('popoverMenu', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                scope.currentTab = 'range';
                scope.doSearch = function (min, max) {
                    scope.mappings.value1 = min * 1000;
                    scope.mappings.value2 = max * 1000;
                    scope.mappings.callback();
                }
            },
            scope: {
                mappings: '='
            },
            templateUrl: 'static/templates/include/datepicker/popover-main-template.html'
        }
    }]);

    module.directive('popoverMenuRange', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                var table = angular.element(element[0].querySelector('.day table'));
                scope.currentInput = 'min';
                scope.calLabel = 0;

                scope.customMin = scope.mappings['value1'];
                scope.customMax = scope.mappings['value2'];

                scope.currentRange = 'c';
                scope.last = false;
                scope.next = false;
                scope.now = moment();

                scope.getMonth = function (unixDate, op) {
                    var date = new Date(unixDate);
                    this.renderCal(new Date(date.getFullYear(), date.getMonth() + op, 1).getTime(), this.currentInput);
                };

                scope.renderCal = function (unixDate, op) {
                    if (!this.mappings.popoverRadio) {
                        this.currentInput = op;
                        this.mappings.popoverCal = true;
                        this.calLabel = unixDate;
                        var date = new Date(unixDate), newCal = new CaseApp.Calendar(date.getMonth(), date.getFullYear(), op);
                        newCal.generateHTML(this);
                        table.html(newCal.getHTML());
                        $compile(table.contents())(this);
                    }
                };

                scope.selectDay = function (day, unixDate, op) {
                    var date = new Date(unixDate);
                    date.setDate(day);
                    unixDate = date.getTime();
                    op == 'min' ? this.customMin = unixDate : this.customMax = unixDate;
                    this.renderCal(unixDate, op);
                    this.currentRange = 'c';
                    this.applyFilter();
                };

                scope.fixedInterval = function (interval, hours) {
                    var today = Math.round(new Date().getTime());
                    if (interval == 'l') {
                        this.customMin = scope.mappings['min'];
                        this.customMax = scope.mappings['max'];
                    } else {
                        this.customMin = today - hours * 3600 * 1000;
                        this.customMax = today;
                    }

                    this.mappings.popoverRadio = false;
                    this.currentRange = interval;
                    this.applyFilter();
                };

                scope.applyFilter = function (button) {
                    var from, to, now;
                    this.currentRange = button ? 'c' : this.currentRange;
                    if (this.mappings.popoverRadio) {
                        if (this.lastValue != '') {
                            now = this.now.clone();
                            from = now.subtract(this.lastValue, this.lastSelect);
                        } else from = this.now.clone();

                        if (this.nextValue != '') {
                            now = this.now.clone();
                            to = now.add(this.nextValue, this.nextSelect);
                        } else to = this.now.clone();

                        this.customMin = from.unix() * 1000;
                        this.customMax = to.unix() * 1000;
                    }

                    scope.$parent.doSearch(scope.customMin / 1000, scope.customMax / 1000);

                    this.mappings.popoverCal = false;
                    this.mappings.popover = false;
                };

                scope.toggleRadio = function () {
                    if (this.mappings.popoverRadio) {
                        this.mappings.popoverCal = false;
                    }
                    this.next = false;
                    this.last = false;
                };

                scope.dynamicSelect = function (type) {
                    if (event.target.tagName != 'LABEL') {
                        this[type] = !this[type];
                    }
                };

                scope.inputDisabled = function (type) {
                    if (!this[type]) {
                        this[type + 'Value'] = '';
                        return true;
                    } else return false;
                }
            },
            scope: {
                mappings: '=',
                facet: '@'
            },
            templateUrl: 'static/templates/include/datepicker/popover-range-template.html'
        }
    }]);

    module.directive('popoverMenuWeek', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                var table = angular.element(element[0].querySelector('.day table'));
                scope.calLabel = 0;
                scope.customMin = scope.mappings['value1'];
                scope.customMax = scope.mappings['value2'];

                scope.getMonth = function (unixDate, op) {
                    var date = new Date(unixDate);
                    this.renderCal(new Date(date.getFullYear(), date.getMonth() + op, 1).getTime(), this.currentInput);
                };

                scope.renderCal = function (unixDate) {
                    this.calLabel = unixDate;
                    var date = new Date(unixDate);
                    var newCal = new CaseApp.Calendar(date.getMonth(), date.getFullYear(), 'min');
                    newCal.generateHTML(this, true);
                    table.html(newCal.getHTML());
                    $compile(table.contents())(this);
                };

                scope.selectWeek = function (e, d) {
                    var weekStart, weekEnd, from, to, weekNo;
                    if (angular.element(e.target).hasClass('label')) {
                        weekStart = +e.target.parentNode.parentNode.childNodes[0].textContent;
                        weekEnd = +e.target.parentNode.parentNode.childNodes[6].textContent;
                        weekNo = e.target.parentNode.parentNode.rowIndex;
                    } else {
                        weekStart = +e.target.parentNode.childNodes[0].textContent;
                        weekEnd = +e.target.parentNode.childNodes[6].textContent;
                        weekNo = e.target.parentNode.rowIndex;
                    }
                    if (weekStart > weekEnd && weekNo == 1) {
                        from = moment.unix(d).date(weekStart).subtract(1, 'month').unix();
                        to = moment.unix(d).date(weekEnd).unix();
                    } else if (weekStart > weekEnd) {
                        from = moment.unix(d).date(weekStart).unix();
                        to = moment.unix(d).date(weekEnd).add(1, 'month').unix();
                    } else {
                        from = moment.unix(d).date(weekStart).unix();
                        to = moment.unix(d).date(weekEnd).unix();
                    }

                    this.customMin = from * 1000;
                    this.customMax = to * 1000;
                    scope.renderCal(this.customMin);
                    scope.$parent.doSearch(from, to);

                    this.mappings.popoverCal = false;
                    this.mappings.popover = false;
                };

                if (scope.calLabel == 0) {
                    scope.renderCal(scope.customMin);
                }
            },
            scope: {
                mappings: '=',
                facet: '@'
            },
            templateUrl: 'static/templates/include/datepicker/popover-week-template.html'
        }
    }]);

    module.directive('popoverMenuMonth', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                scope.customMin = scope.mappings['value1'];
                scope.customMax = scope.mappings['value2'];

                scope.calLabel = moment().unix();

                scope.getYear = function (unixDate, op) {
                    var date = moment.unix(unixDate);
                    op == 1 ? date.add(1, 'year') : date.subtract(1, 'year');
                    scope.calLabel = date.unix();
                };

                scope.isSelected = function (month) {
                    var then = moment.unix(this.calLabel).month(month), now = moment.unix(this.customMin);
                    return (then.month() == now.month() && then.year() == now.year());
                };

                scope.selectMonth = function (month) {

                    this.customMin = moment.unix(this.calLabel).month(month).startOf('month').unix();
                    this.customMax = moment.unix(this.calLabel).month(month).endOf('month').unix();
                    this.calLabel = this.customMin;

                    scope.$parent.doSearch(scope.customMin, scope.customMax);

                    this.mappings.popoverCal = false;
                    this.mappings.popover = false;

                }
            },
            scope: {
                mappings: '=',
                facet: '@'
            },
            templateUrl: 'static/templates/include/datepicker/popover-month-template.html'
        }
    }]);

    module.directive('popoverMenuQuarter', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                scope.calLabel = moment().unix();
                scope.customMin = scope.mappings['value1'];
                scope.customMax = scope.mappings['value2'];

                scope.getYear = function (unixDate, op) {
                    var date = moment.unix(unixDate);
                    op == 1 ? date.add(1, 'year') : date.subtract(1, 'year');
                    scope.calLabel = date.unix();
                };

                scope.isSelected = function (quarter) {
                    var then = moment.unix(this.calLabel).quarter(quarter), now = moment.unix(this.customMin);
                    return (then.quarter() == now.quarter() && then.year() == now.year());
                };

                scope.selectQuarter = function (quarter) {

                    this.customMin = moment.unix(this.calLabel).quarter(quarter).startOf('quarter').unix();
                    this.customMax = moment.unix(this.calLabel).quarter(quarter).endOf('quarter').unix();
                    this.calLabel = this.customMin;

                    scope.$parent.doSearch(scope.customMin, scope.customMax);

                    this.mappings.popoverCal = false;
                    this.mappings.popover = false;

                }
            },
            scope: {
                mappings: '=',
                facet: '@'
            },
            templateUrl: 'static/templates/include/datepicker/popover-quarter-template.html'
        }
    }]);

    module.directive('popoverMenuYear', ['$rootScope', '$compile', function ($rootScope, $compile) {
        return {
            restrict: "A",
            link: function (scope, element, attrs) {
                var startYear = moment(scope.mappings['min']).year();
                var endYear = moment(scope.mappings['max']).year();

                scope.years = [];

                for (var i = startYear; i <= endYear; i++) {
                    scope.years.push(i);
                }

                scope.selectYear = function (year) {
                    var now = moment();
                    this.customMin = now.year(year).startOf('year').unix();
                    this.customMax = now.year(year).endOf('year').unix();
                    scope.$parent.doSearch(this.customMin, this.customMax);

                    this.mappings.popoverCal = false;
                    this.mappings.popover = false;
                };

                scope.isSelected = function (year) {
                    var now = moment(this.mappings.value1);
                    return (year == now.year());
                }
            },
            scope: {
                mappings: '=',
                facet: '@'
            },
            templateUrl: 'static/templates/include/datepicker/popover-year-template.html'
        }
    }]);

// Bootstrap multi-select directive for quick filters
    module.directive('hidePopover', ['$document', function ($document) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                // click on this element will not hide popover
                element.on('click', '.period-selector, .radioCont, .movingRange, .custom-range-inputs, .custom-range-type, header.controls', function (e) {
                    e.stopPropagation();
                });

                $document.bind('click', function () {
                    scope.$apply(attrs.hidePopover);
                });
            }
        }
    }]);

});