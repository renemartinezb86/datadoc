define(['./module', 'angular', 'common'], function (controllers, angular, cc) {
    'use strict';
    controllers.controller('shareCtrl', ['$scope', '$rootScope', '$http', '$uibModalInstance', 'datadocId', 'shareWith', 'shareInfo', 'sharedStates', 'ShareService', 'User', '$timeout', 'SourceService',
        ($scope, $rootScope, $http, $uibModalInstance, datadocId, shareWith, shareInfo, sharedStates, ShareService, User, $timeout, SourceService) => {
            $uibModalInstance.rendered.then(() => $("#share-with-input").find(":input").focus());

            $scope.canShareWith = [];
            $scope.selectedShareWith = [];
            $scope.sharedStates = sharedStates;
            $scope.shareAttachedSources = false;
            $scope.selectedSharedState = getSelectedSharedState();
            $scope.generatedSharingLink = generateSharedLink();
            $scope.sharedInfo = shareInfo;
            $scope.isViewOnly = shareInfo.shareType === "VIEW";
            $scope.activeUser = User.getCurrent();
            $scope.shareEmail = "";
            $scope.isSharing = false;
            $scope.sharingLinkCreated = shareInfo.publicShared;
            $scope.selectedSharingLinkOption = 0;
            $scope.isShareInvalid = false;

            async function updateDatadoc(datadocId) {
                const datadoc = await SourceService.update(datadocId);
                $rootScope.$broadcast('source-updated', {source: datadoc});
                return datadoc;
            }

            function validateEmail(email) {
                const regExp = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                return regExp.test(email);
            }

            function getSelectedSharedState(stateId) {
                if (!stateId) {
                    stateId = shareInfo.sharedStateId;
                }
                return _.find($scope.sharedStates, state => state.uuid === stateId)
            }

            function generateSharedLink() {
                const shareUrlTemplate = shareInfo.shareUrlTemplate;
                return $scope.selectedSharedState
                    ? shareUrlTemplate + `?pid=${$scope.selectedSharedState.tabId}&stateId=${$scope.selectedSharedState.uuid}`
                    : shareUrlTemplate;
            }

            $scope.toggleShareAttachedSources = () => {
                $scope.shareAttachedSources = !$scope.shareAttachedSources;
            };

            $scope.shareDatadoc = function (shareMessage) {
                $scope.isSharing = true;
                const selectedEmails = _.map($scope.selectedShareWith.selected, 'email');
                const shareType = $scope.sharingRoles[$scope.selectedSharingRole.index].type;

                ShareService.shareDatadoc(datadocId, selectedEmails, shareType, shareMessage, $scope.shareAttachedSources).then((shareResult) => {
                    $scope.closeShareModal()
                    $scope.isSharing = false;
                    $scope.selectedShareWith.selected = null;
                    $scope.sharedInfo.sharedWith || ($scope.sharedInfo.sharedWith = []);
                    $scope.sharedInfo.sharedWith = $scope.sharedInfo.sharedWith.concat(shareResult.successfullyShared);
                    if (!_.isEmpty(shareResult.successfullyShared)) {
                        const emails = _.map(shareResult.successfullyShared, 'email');
                        cc.notify({
                            message: `Successfully shared with ${emails.length} ${emails.length > 1 ? 'users' : 'user'}.`,
                            icon: "success",
                            wait: 4
                        });
                    }

                    if (!_.isEmpty(shareResult.failedShared)) {
                        cc.notify({message: shareResult.failedShared.join("\n"), icon: "warning"});
                    }
                    updateDatadoc(datadocId);
                }).catch(({data: message}) => {
                    $scope.closeShareModal()
                    cc.notify({message, icon: "warning"});
                    $scope.isSharing = false;
                });
            };

            // todo: divide role dropdown into 2 different dropdowns
            $scope.sharingRoles = [
                {
                    display_title: 'Can edit',
                    title: "Admin",
                    description: "Can view or modify this document and has access to its source",
                    type: "ADMIN"
                },
                {
                    display_title: 'Can view',
                    title: 'Viewer',
                    description: "Can view this document and modify how it appears",
                    type: "VIEW"
                }
            ];

            $scope.selectedSharingRole = {index: 1, display_title: 'Can view'};

            $scope.checkIsShareValid = function ($selected) {
                $scope.isShareInvalid = _.some($selected, i => !i._isValid);
            };

            $scope.onSelectPerson = function($item, $model, $selected) {
                $scope.checkIsShareValid($selected);
                $scope.$broadcast("shareInputFocus")
            };

            $scope.onRemovePerson = function($item, $model, $selected) {
                $scope.checkIsShareValid($selected);
            };

            $scope.shareInputValidation = function ($item) {
                $item._isValid = validateEmail($item.email);
            };

            $scope.onBeforeChangeUserShare = (search) => {
                $scope.canShareWith = [];
                $scope.onChangeUserShare(search);
            };

            $scope.onChangeUserShare = _.debounce(async (search) => {
                const canShareWith = await ShareService.usersShareHint(datadocId, search);

                _.isEmpty(canShareWith)
                    ? $scope.canShareWith.push({ name: search, email: search, isNewTag: true })
                    : $scope.canShareWith = canShareWith;

                $scope.$evalAsync(); // To force $digest
            }, 500);

            const removeSharedUserAction = {
                title: 'Remove',
                type: "REMOVE"
            };
            $scope.sharedUserRoles = _.clone($scope.sharingRoles);
            $scope.sharedUserRoles.push(removeSharedUserAction);

            $scope.selectSharedUserRole = function (user, shareType) {
                const {userId, email} = user;
                //todo add exceptions handling
                switch (shareType) {
                    case "REMOVE":
                        _.remove($scope.sharedInfo.sharedWith, u => {
                            return email === u.email;
                        });
                        $http.delete(`/share/${datadocId}/${userId}`)
                            .then(() => updateDatadoc(datadocId));
                        break;
                    case "VIEW":
                    case "ADMIN":
                        $http.post(`/share/update`, {
                            userId,
                            datadocId: datadocId,
                            shareType
                        });
                        break;
                    default:
                        throw `There is no such share type: ${shareType}`
                }

                user.shareType = shareType;
            };

            $scope.getSharedUserRoleTitle = function (userRoleType) {
                return _.find($scope.sharedUserRoles, r => {
                    return r.type === userRoleType;
                }).title;
            };

            $scope.sharingLinkOptions = [
                {
                    type: 'ON',
                    title: 'Turn on',
                    description: 'Turning on sharing link',
                    display: 'Turned on',
                    disabled: !$scope.sharingLinkCreated
                },
                {
                    type: 'OFF',
                    title: 'Turn off',
                    description: 'Turning off sharing link',
                    display: 'Turned off',
                    disabled: false
                }
            ];

            $scope.selectSharedState = (state) => {
                $scope.selectedSharedState = getSelectedSharedState(state.uuid);
                $scope.generatedSharingLink = generateSharedLink();
                return ShareService.selectSharedState(datadocId, state.uuid);
            };

            $scope.toggleSharingLink = function () {
                $scope.sharingLinkCreated = !$scope.sharingLinkCreated;

                $scope.togglePublicShareLink(true).then(() => {
                    // todo implement as separate directive
                    $timeout(() => {
                        let input = $('.generated-link');
                        input.focus();
                        input[0].setSelectionRange(0, input.val().length);
                        document.execCommand('copy');
                    })
                }).catch(err => {
                    console.error(err);
                    $scope.sharingLinkCreated = true;
                })
            };

            $scope.handleLinkCopy = function () {
                cc.notify({
                    message: 'Link copied to clipboard.',
                    icon: 'success',
                    wait: 2
                })
            };

            $scope.togglePublicShareLink = (enable) => {
                return $http.post("/share/public", {datadocId: datadocId, enable});
            };

            $scope.handleSharingLinkOptions = function (option, index) {
                if (option.type === 'OFF') {
                    $scope.sharingLinkCreated = false;
                    $scope.togglePublicShareLink(false).catch(err => {
                        console.error(err);
                        $scope.sharingLinkCreated = true;
                    })
                }
            };

            $scope.selectSharingRole = function (title, index) {
                $scope.selectedSharingRole = {index, display_title: title}
            };

            $scope.shareCancel = function () {
                $scope.selectedShareWith.selected = null;
            };

            $scope.closeShareModal = () => {
                $uibModalInstance.dismiss();
            };
        }]);

});
