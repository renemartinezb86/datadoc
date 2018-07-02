/**
 * UI Component For Creating Cron Job Syntax To Send To Server
 * @version v3.0.1 - 2016-07-18 * @link https://github.com/jacobscarter/angular-cron-jobs
 * @author Jacob Carter <jc@jacobcarter.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module('templates-angularcronjobs', ['cronselection.html']);

angular.module("cronselection.html", []).run(["$templateCache", function ($templateCache) {
    const template = `<div class="cron-wrap">
    <div class='schedule-status' style='display:flex'>
        <div class='highlighted-var refresh-settings-label'>Refresh settings:</div>
        <div class="cron-select-wrap" uib-dropdown>
            <span>
                <div ng-if="myFrequency" class="select-options">
                    <span ng-if="myFrequency.base >= 5">on the </span>
                    <div ng-if="myFrequency.base >= 5" class="cron-select-wrap">
                        <!-- If Multiple is Enabled -->
                        <!-- If Multiple is not Enabled -->
                        <div class="cron-select day-of-month-value" uib-dropdown><span uib-dropdown-toggle><u>{{myFrequency.dayOfMonthValues | cronNumeral}}</u></span>
                            <ul class='dropdown-menu tool-bar-dropdown flexible-space-dropdown timezone-dropdown'
                                role="menu"
                                uib-dropdown-menu>
                                <li ng-repeat="value in dayOfMonthValues"
                                    ng-click='changeSelect(value, "dayOfMonthValues")'>
                                    <a>{{value | cronNumeral}}</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <span ng-if="myFrequency.base == 6">of </span>
                    <!-- If Multiple is Enabled -->
                    <div ng-if="myFrequency.base == 6" class="cron-select-wrap">
                        <div class="cron-select month-value" uib-dropdown><span uib-dropdown-toggle><u>{{myFrequency.monthValues | cronMonthName}}</u></span>
                            <ul class='dropdown-menu tool-bar-dropdown flexible-space-dropdown timezone-dropdown'
                                role="menu"
                                uib-dropdown-menu>
                                <li ng-repeat="value in monthValues" ng-click='changeSelect(value, "monthValues")'>
                                    <a>{{value | cronMonthName}}</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <span ng-if="myFrequency.base >= 2">{{getLabelByBase(myFrequency)}} at </span>
                    <!-- If Multiple is Enabled -->
                    <div ng-if="myFrequency.base >= 3" class="cron-select-wrap" uib-dropdown>
                        <input type="text" class="input-time"
                               ng-click="selectText($event)"
                               ng-model="myFrequency.displayTime"
                               ng-enter="enterCallback()"
                               ng-model-options="{updateOn: 'change'}"
                               ng-change="onTimeChanged(myFrequency.displayTime, '{{myFrequency.displayTime}}')"
                               uib-dropdown-toggle>
                        <ul class='dropdown-menu tool-bar-dropdown flexible-space-dropdown timezone-dropdown time-helper-dropdown'
                            role="menu" uib-dropdown-menu>
                                <li ng-repeat="time in timeHelper" ng-click="onTimeChanged(time)">{{time}}</li>
                        </ul>
                    </div>
                    <!-- If Multiple is Enabled -->
                    <div ng-if="myFrequency.base === 2" class="cron-select-wrap">
                        <input class="minute-value"
                               type="number"
                               ng-click="selectText($event)"
                               ng-model='myFrequency.minuteValues'
                               ng-change='changeSelect(myFrequency.minuteValues, "minuteValues")'/></div>
                    <span ng-if="myFrequency.base == 2"> min past the hour</span>
                    <span ng-transclude="timezone"></span>
                    <span ng-if="myFrequency.base == 4">on </span>
                    <div ng-if="myFrequency.base == 4" class="cron-select-wrap">
                        <div class="cron-select day-value" uib-dropdown>
                            <input uib-dropdown-toggle
                                   class="schedule-select day-input"
                                   readonly
                                   ng-click="selectText($event)"
                                   onBlur="this.setSelectionRange(0, 0)"
                                   ng-value="myFrequency.dayValues | cronDayName"/>
                            <ul class='dropdown-menu tool-bar-dropdown flexible-space-dropdown timezone-dropdown'
                                role="menu"
                                uib-dropdown-menu>
                                <li ng-repeat="value in dayValues" ng-click='changeSelect(value, "dayValues")'>
                                    <i class="timezone-checkmark" ng-if="myFrequency.dayValues === value"></i>
                                    <div class="timezone-info">{{value | cronDayName}}</div>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <span class="caret-wrapper" tabindex="0" ng-click="toggleCronDropdown()"
                      click-out="hideCronDropdown()"
                      click-out-excluding-classes="['cron-main-dropdown']">
                <span ng-if="!myFrequency">never</span>
                    <span class="caret"></span>
                </span>
            </span>
            <ul class='timezone-dropdown cron-main-dropdown tool-bar-dropdown flexible-space-dropdown dropdown-menu dropdown-menu-right'
                role="menu" ng-show="cronDropdownOpened">
                <li ng-click='resetSelect(); hideCronDropdown()'>
                    <i class="timezone-checkmark" ng-if="!myFrequency"></i>
                    <div class="timezone-info">never</div>
                </li>
                <li ng-repeat="item in frequency | filter:{hidden: false}"
                    ng-click='changeSelect(item.value, "base"); hideCronDropdown()'>
                    <i class="timezone-checkmark" ng-if="myFrequency.base === item.value"></i>
                    <div class="timezone-info">{{item.label}}</div>
                </li>
            </ul>
        </div>
    </div>
</div>`;
    $templateCache.put("cronselection.html", template);
}]);

'use strict';

angular.module('angular-cron-jobs', ['templates-angularcronjobs']);

define(['moment', 'lodash'], function (moment, _) {
    angular.module('angular-cron-jobs').directive('cronSelection', ['cronService', function (cronService) {
        return {
            restrict: 'EA',
            replace: true,
            transclude: {
                timezone: '?timezone'
            },
            require: 'ngModel',
            scope: {
                ngModel: '=',
                config: '=',
                myFrequency: '=?frequency',
                timezone: '='
            },
            templateUrl: function (element, attributes) {
                return attributes.template || 'cronselection.html';
            },
            link: function ($scope, $el, $attr, $ngModel) {
                const TIME_FORMAT = "h:mma";
                const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

                var modelChanged = false;

                function retrieveHourDetailInfo() {
                    let cron = $scope.ngModel.replace(/\s+/g, ' ').split(' ');
                    let timePeriod = parseInt(cron[2]) >= 12 ? 'pm' : 'am';
                    let hours = ((parseInt(cron[2]) + 11) % 12 + 1);
                    return {hours, timePeriod};
                }

                $scope.getLabelByBase = function (frequency) {
                    let currentFrequency = $scope.frequency.find(freq => freq.value === frequency.base);
                    if (currentFrequency)
                        return currentFrequency.label;
                };

                $scope.enterCallback = function () {
                    let activeElement = angular.element(document.activeElement);
                    if (activeElement &&
                        (activeElement.hasClass("input-time") || activeElement.hasClass("schedule-select"))) {
                        activeElement.blur();
                    }
                };

                $scope.selectText = function(e) {
                    if(!e.target)
                        return;

                    e.target.select();
                };

                $scope.frequency = [{
                    value: 1,
                    label: 'each minute',
                    hidden: false
                }, {
                    value: 2,
                    label: 'hourly',
                    description: function () {
                        return `${this.label} at ${$scope.myFrequency.minuteValues} past the hour`;
                    },
                    hidden: false
                }, {
                    value: 3,
                    label: 'daily',
                    description: function () {
                        const {hours, timePeriod} = retrieveHourDetailInfo();
                        return `${this.label} at ${hours}${timePeriod} ${$scope.timezone}`;
                    },
                    hidden: false
                }, {
                    value: 4,
                    label: 'weekly',
                    description: function () {
                        const {hours, timePeriod} = retrieveHourDetailInfo();
                        return `${this.label} at ${hours}${timePeriod} ${$scope.timezone} on ${WEEK_DAYS[$scope.myFrequency.dayValues]}`;
                    },
                    hidden: false
                }, {
                    value: 5,
                    label: 'monthly',
                    hidden: false
                }, {
                    value: 6,
                    label: 'annually',
                    hidden: false
                }];

                $scope.timeHelper = initTimeHelper();

                function initTimeHelper(start, end) {
                    if (!start) {
                        start = "12:00am"
                    }
                    if (!end) {
                        end = "11:30pm"
                    }

                    var startTime = moment(start, TIME_FORMAT);
                    var endTime = moment(end, TIME_FORMAT);

                    if (!startTime.isValid() || !endTime.isValid()) {
                        console.error('Invalid argument format. Expected format like: "12:30am".');
                        return;
                    }

                    if (endTime.isBefore(startTime)) {
                        endTime.add(1, 'day');
                    }

                    var timeStops = [];

                    while (startTime <= endTime) {
                        timeStops.push(new moment(startTime).format(TIME_FORMAT));
                        startTime.add(30, 'minutes');
                    }
                    return timeStops;
                }

                $scope.toggleCronDropdown = function() {
                    $scope.cronDropdownOpened = !$scope.cronDropdownOpened;
                };

                $scope.hideCronDropdown = function() {
                    $scope.cronDropdownOpened = false;
                };

                $scope.$watch('ngModel', function (newValue) {
                    if (angular.isDefined(newValue) && newValue) {
                        modelChanged = true;
                        $scope.myFrequency = cronService.fromCron(newValue, $scope.allowMultiple);
                    } else if (newValue === '' || !newValue) {
                        $scope.myFrequency = undefined;
                    }
                });

                $scope.resetSelect = function () {
                    $scope.myFrequency = undefined;
                };

                $scope.onTimeChanged = function (time, oldTime) {
                    var formats = [TIME_FORMAT, "ha", "h"];
                    var m = moment(time, formats, true),
                        freq = $scope.myFrequency,
                        defaultTime = _.omit(moment(freq.time).toObject(), ['hours', 'minutes']);

                    m.set(defaultTime);

                    if (freq && !m.isValid()) {
                        freq.displayTime = oldTime;
                        return;
                    }

                    // If only hours were sent to the input, set time to "pm" by default
                    if (m.creationData().format === "h" && m.format('a') === "am") {
                        m.add(12, "hours");
                    }

                    freq.time = m.toDate();
                };

                $scope.changeSelect = function (value, type) {
                    if (typeof $scope.myFrequency === "undefined") {
                        $scope.myFrequency = cronService.fromCron("0 * * * * *", $scope.allowMultiple)
                    }
                    $scope.myFrequency[type] = value;
                };

                if (typeof $scope.config === 'object' && !$scope.config.length) {
                    if (typeof $scope.config.options === 'object') {
                        var optionsKeyArray = Object.keys($scope.config.options);
                        for (var i in optionsKeyArray) {
                            var currentKey = optionsKeyArray[i].replace(/^allow/, '');
                            var originalKey = optionsKeyArray[i];
                            if (!$scope.config.options[originalKey]) {
                                for (var b in $scope.frequency) {
                                    if ($scope.frequency[b].label === currentKey) {
                                        $scope.frequency[b].hidden = true;
                                    }
                                }
                            }
                        }
                    }
                    if (angular.isDefined($scope.config.allowMultiple)) {
                        $scope.allowMultiple = $scope.config.allowMultiple;
                    } else {
                        $scope.allowMultiple = false;
                    }
                }

                $scope.minuteValues = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
                $scope.hourValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                $scope.dayOfMonthValues =
                    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
                        29, 30, 31];
                $scope.dayValues = [0, 1, 2, 3, 4, 5, 6];
                $scope.monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

                $scope.$watch('myFrequency', function (n, o) {
                    if (n !== undefined) {
                        if (n && n.base && (!o || n.base !== o.base) && !modelChanged) {
                            setInitialValuesForBase(n);
                        } else if (n && n.base && o && o.base) {
                            modelChanged = false;
                        }
                        var newVal = cronService.setCron(n);
                        $ngModel.$setViewValue(newVal);
                    } else {
                        $ngModel.$setViewValue(undefined);
                    }
                }, true);

                function setInitialValuesForBase(freq) {
                    freq.base = parseInt(freq.base);

                    if (freq.base >= 2) {
                        freq.minuteValues = $scope.minuteValues[0];
                    }

                    if (freq.base >= 3) {
                        freq.hourValues = $scope.hourValues[$scope.hourValues.length - 1];
                    }

                    if (freq.base == 4) {
                        freq.dayValues = $scope.dayValues[0];
                    }

                    if (freq.base >= 5) {
                        freq.dayOfMonthValues = $scope.dayOfMonthValues[0];
                    }

                    if (freq.base == 6) {
                        freq.monthValues = $scope.monthValues[0];
                    }
                }
            }
        };
    }]).filter('cronNumeral', function () {
        return function (input) {
            switch (input) {
                case 1:
                    return '1st';
                case 2:
                    return '2nd';
                case 3:
                    return '3rd';
                case 21:
                    return '21st';
                case 22:
                    return '22nd';
                case 23:
                    return '23rd';
                case 31:
                    return '31st';
                case null:
                    return null;
                default:
                    return input + 'th';
            }
        };
    }).filter('cronMonthName', function () {
        return function (input) {
            var months = {
                1: 'January',
                2: 'February',
                3: 'March',
                4: 'April',
                5: 'May',
                6: 'June',
                7: 'July',
                8: 'August',
                9: 'September',
                10: 'October',
                11: 'November',
                12: 'December'
            };

            if (input !== null && angular.isDefined(months[input])) {
                return months[input];
            } else {
                return null;
            }
        };
    }).filter('cronDayName', function () {
        return function (input) {
            var days = {
                0: 'Sunday',
                1: 'Monday',
                2: 'Tuesday',
                3: 'Wednesday',
                4: 'Thursday',
                5: 'Friday',
                6: 'Saturday',
            };

            if (input !== null && angular.isDefined(days[input])) {
                return days[input];
            } else {
                return null;
            }
        };
    }).filter('cronTimeName', function () {
        return function (input) {
            if ((input < 10 || !input) && input !== null) {
                return '0' + input;
            } else {
                return input;
            }
        };
    });

    'use strict';

    angular.module('angular-cron-jobs').factory('cronService', function () {
        var service = {};
        var dayOfWeekAbbrs = {"MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 0};
        var TIME_FORMAT = "h:mma";

        service.setCron = function (n) {
            var cron = ['*', '*', '*', '*', '*'];

            if (n && n.base && n.base >= 2) {
                if (n.time.getMinutes() != n.minuteValues && n.base == 2) {
                    n.time.setMinutes(n.minuteValues);
                }
                var minutes = n.time.getMinutes();
                cron[0] = typeof minutes !== 'undefined' ? minutes : '*';
            }

            if (n && n.base && n.base >= 3) {
                var hours = n.time.getHours();
                cron[1] = typeof hours !== 'undefined' ? hours : "*";
            }

            if (n && n.base && n.base === 4) {
                cron[4] = _.map(_.isArray(n.dayValues) ? n.dayValues : [n.dayValues], function (d) {
                    return _.invert(dayOfWeekAbbrs)[d];
                });
            }

            if (n && n.base && n.base >= 5) {
                cron[2] = typeof n.dayOfMonthValues !== 'undefined' ? n.dayOfMonthValues : '*';
            }

            if (n && n.base && n.base === 6) {
                cron[3] = typeof n.monthValues !== 'undefined' ? n.monthValues : '*';
            }
            cron.unshift(0);
            return cron.join(' ');
        };

        service.fromCron = function (value, allowMultiple) {
            var cron = value.replace(/\s+/g, ' ').split(' ');
            cron.shift();
            var frequency = {base: '1', time: new Date(1970, 0, 1, 0, 0, 0)}; // default: every minute
            if (cron[0] === '*' && cron[1] === '*' && cron[2] === '*' && cron[3] === '*' && cron[4] === '*') {
                frequency.base = 1; // every minute
            } else if (cron[1] === '*' && cron[2] === '*' && cron[3] === '*' && cron[4] === '*') {
                frequency.base = 2; // every hour
            } else if (cron[2] === '*' && cron[3] === '*' && cron[4] === '*') {
                frequency.base = 3; // every day
            } else if (cron[2] === '*' && cron[3] === '*') {
                frequency.base = 4; // every week
            } else if (cron[3] === '*' && cron[4] === '*') {
                frequency.base = 5; // every month
            } else if (cron[4] === '*') {
                frequency.base = 6; // every year
            }

            if (cron[0] !== '*') {
                //preparing to handle multiple minutes
                if (allowMultiple) {
                    var tempArray = cron[0].split(',');
                    for (var i = 0; i < tempArray.length; i++) {
                        tempArray[i] = +tempArray[i];
                    }
                    frequency.minuteValues = tempArray;
                } else {
                    frequency.time.setMinutes(parseInt(cron[0]));
                    frequency.minuteValues = parseInt(cron[0]);
                }
            }
            if (cron[1] !== '*') {
                //preparing to handle multiple hours
                if (allowMultiple) {
                    var tempArray = cron[1].split(',');
                    for (var i = 0; i < tempArray.length; i++) {
                        tempArray[i] = +tempArray[i];
                    }
                    frequency.hourValues = tempArray;
                } else {
                    frequency.time.setHours(parseInt(cron[1]));
                    frequency.hourValues = parseInt(cron[1]);
                    frequency.displayTime = moment(frequency.time).format(TIME_FORMAT);
                }
            }
            if (cron[2] !== '*') {
                //preparing to handle multiple days of the month
                if (allowMultiple) {
                    var tempArray = cron[2].split(',');
                    for (var i = 0; i < tempArray.length; i++) {
                        tempArray[i] = +tempArray[i];
                    }
                    frequency.dayOfMonthValues = tempArray;
                } else {
                    frequency.dayOfMonthValues = parseInt(cron[2]);
                }
            }
            if (cron[3] !== '*') {
                //preparing to handle multiple months
                if (allowMultiple) {
                    var tempArray = cron[3].split(',');
                    for (var i = 0; i < tempArray.length; i++) {
                        tempArray[i] = +tempArray[i];
                    }
                    frequency.monthValues = tempArray;
                } else {
                    frequency.monthValues = parseInt(cron[3]);
                }
            }
            if (cron[4] !== '*') {
                //preparing to handle multiple days of the week
                if (allowMultiple) {
                    var tempArray = cron[4].split(',');
                    for (var i = 0; i < tempArray.length; i++) {
                        tempArray[i] = +tempArray[i];
                    }
                    frequency.dayValues = tempArray;
                } else {
                    frequency.dayValues = dayOfWeekAbbrs[cron[4]];
                }
            }
            return frequency;
        };
        return service;
    });
});
