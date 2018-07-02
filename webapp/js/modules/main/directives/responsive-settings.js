define(['./module'], function (directives) {
    'use strict';
    directives.directive('responsiveSettings', [function () {
        return {
            restrict: 'A',
            scope: true,
            link: function ($scope, $elm, $attrs) {
                const firstStep = 1248;
                const secondStep = 1024;

                const dropdownMenuTemplate = `<div class="dropdown-menu dropdown-menu-right settings-mobile-dropdown"></div>`;

                const settings = $elm.find('.settings');
                const settingsWrapper = $elm.find(".settings-wrapper");
                const dataFormat = $elm.find(".data-format");

                const otherFormatsSubmenu = $elm.find('.other-formats-submenu');
                const directions = Object.freeze({
                    left: 0,
                    right: 1
                });

                const firstStepQuery = window.matchMedia(`only screen and (max-width: ${firstStep}px)`);
                const secondStepQuery = window.matchMedia(`only screen and (max-width: ${secondStep}px)`);

                function resetDefaultSettings() {
                    $scope.showSettingsDropdownToggle = false;
                    $(settingsWrapper).detach().appendTo(settings);
                    dropdownMenu.remove();
                    dropdownMenu = null;
                    displayToTheSide(otherFormatsSubmenu, directions.left);
                }

                function displayToTheSide(submenu, direction) {
                    const rightDirectionClass = 'dropdown-menu-right';
                    if (direction === 0) {
                        submenu.removeClass(rightDirectionClass);
                    }
                    else if (direction === 1) {
                        submenu.addClass(rightDirectionClass);
                    }
                }

                function generateDropdown() {
                    return $(dropdownMenuTemplate).appendTo(settings).hide();
                }

                let dropdownMenu = generateDropdown();

                if (firstStepQuery.matches) {
                    $scope.showSettingsDropdownToggle = true;
                    $(settingsWrapper).detach().prependTo(dropdownMenu);
                    displayToTheSide(otherFormatsSubmenu, directions.right);

                    if (secondStepQuery.matches) {
                        $(dataFormat).detach().prependTo(dropdownMenu);
                        displayToTheSide(otherFormatsSubmenu, directions.left);
                    }
                }

                firstStepQuery.addListener(changed => {
                    if (changed.matches) {
                        if (!dropdownMenu)
                            dropdownMenu = generateDropdown();

                        $scope.showSettingsDropdownToggle = true;
                        $(settingsWrapper).detach().prependTo(dropdownMenu);
                        displayToTheSide(otherFormatsSubmenu, directions.right);
                    } else {
                        resetDefaultSettings();
                    }
                });

                secondStepQuery.addListener(change => {
                    if (change.matches) {
                        $(dataFormat).detach().prependTo(dropdownMenu);
                        displayToTheSide(otherFormatsSubmenu, directions.left);
                    } else {
                        $(dataFormat).detach().insertAfter($elm.children(":first"));
                        displayToTheSide(otherFormatsSubmenu, directions.right);
                    }
                });

                $scope.toggleSettingsDropdown = function () {
                    dropdownMenu.is(":visible")
                        ? dropdownMenu.css("display", "none")
                        : dropdownMenu.css("display", "flex");
                };
            }
        };
    }
    ]);
});