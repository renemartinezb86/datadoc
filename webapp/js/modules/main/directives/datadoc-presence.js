define(['./module', 'angular', 'lodash'], function (directives, angular, _) {
    'use strict';
    directives.directive('datadocPresence', ['User', '$timeout',
        function (User, $timeout) {
            return {
                restrict: 'E',
                templateUrl: 'static/templates/include/datadoc-presence.html',
                scope: {
                    presenceUsers: '=',
                },
                link: function ($scope, $element) {
                    const ANIMATION_DURATION = 800;
                    const COLORS = {
                        deepPink: "rgb(255, 0, 122)",
                        eucalyptus: "rgb(31, 161, 93)",
                        milanoRed: "rgb(166, 50, 50)",
                        elfGreen: "rgb(27, 136, 122)"
                    };
                    $scope.getUserInitials = User.getUserInitials;

                    function removeViewerById(viewerId) {
                        return _.remove($scope.presenceUsersCopy, p => p.userId === viewerId)
                    }

                    function isAlreadyViewing(viewerId) {
                        return _.some($scope.presenceUsersCopy, u => u.userId === viewerId)
                    }

                    function createUnknownViewer(user) {
                        if(!user)
                            return;

                        const randomColor = _.sample(COLORS);

                        return {
                            userId: user.userId,
                            fullName: user.fullName,
                            email: user.email,
                            color: randomColor,
                            image: user.avatarPath
                        };
                    }

                    $scope.presenceUsersCopy = _.chain($scope.presenceUsers)
                        .map(u => createUnknownViewer(u))
                        .value();

                    $scope.$watch("presenceUsers", (newValue, oldValue) => {
                        const isNewViewerJoined = _.size(oldValue) > _.size(newValue);
                        const oldIds = _.map(oldValue, "userId");
                        const newIds = _.map(newValue, "userId");

                        if (isNewViewerJoined) {
                            const removedViewerId = _.chain(oldIds)
                                .difference(newIds)
                                .head()
                                .value();

                            if (removedViewerId) {
                                const el = $element.find("#presence-" + removedViewerId);
                                el.addClass('removing');
                                $timeout(() => removeViewerById(removedViewerId), ANIMATION_DURATION);
                            }
                        } else {
                            const newViewerId = _.chain(newIds)
                                .difference(oldIds)
                                .head()
                                .value();

                            if (newViewerId && !isAlreadyViewing(newViewerId)) {
                                const newViewer = _.find(newValue, u => u.userId === newViewerId);
                                $scope.presenceUsersCopy.push(createUnknownViewer(newViewer));
                            }
                        }
                    }, true);
                }
            };
        }])
});