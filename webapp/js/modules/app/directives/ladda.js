define(['./module', 'spin', 'ladda', 'lodash'], function (directives, spin, Ladda, _) {
    'use strict';
    directives.directive('ladda', ['$timeout', '$compile', function ($timeout, $compile) {
        return {
            restrict: 'A',
            priority: -1,
            scope: {
                ladda: '&',
                numericalProgress: '&laddaNumericalProgress'
            },
            link: function (scope, element, attrs) {
                // todo: Refactor
                const numericalProgressTemplate = `<span class="ladda-numerical-progress">{{numericalProgress()}}%</span>`;
                let laddaOption = {};

                function initNumericalProgress() {
                    let laddaSpinner = element.find('.ladda-spinner');
                    let progressElement = $(numericalProgressTemplate).prependTo(laddaSpinner);
                    return $compile(progressElement)(scope);
                }

                element.addClass('ladda-button');
                if (!_.isUndefined(attrs.laddaNumericalProgress)) {
                    $timeout(initNumericalProgress);
                }
                if (_.isUndefined(element.attr('data-style'))) {
                    element.attr('data-style', laddaOption.style || 'zoom-in');
                }
                if (_.isUndefined(element.attr('data-spinner-color')) && attrs.laddaSpinnerColor) {
                    element.attr('data-spinner-color', attrs.laddaSpinnerColor);
                }

                // ladda breaks childNode's event property.
                // because ladda use innerHTML instead of append node
                if (!element[0].querySelector('.ladda-label')) {
                    var labelWrapper = document.createElement('span');
                    labelWrapper.className = 'ladda-label';
                    angular.element(labelWrapper).append(element.contents());
                    element.append(labelWrapper);
                }

                // create ladda button
                var ladda = Ladda.create(element[0]);

                // add watch!
                scope.$watch(scope.ladda, function (loading) {
                    if (!loading && !angular.isNumber(loading)) {
                        ladda.stop();
                        // When the button also have the ng-disabled directive it needs to be
                        // re-evaluated since the disabled attribute is removed by the 'stop' method.
                        if (attrs.ngDisabled) {
                            element.attr('disabled', scope.$eval(attrs.ngDisabled));
                        }
                        return;
                    }
                    if (!ladda.isLoading()) {
                        ladda.start();
                    }
                    if (angular.isNumber(loading)) {
                        ladda.setProgress(loading);
                    }
                });
            }
        };
    }]);
});