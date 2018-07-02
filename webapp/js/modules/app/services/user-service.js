define(['./module', 'jquery', 'lodash', 'moment'], function (module, $, _, moment) {
    module.factory('User', ['$http', '$window', '$q', '$rootScope', '$uibModal', function ($http, $window, $q, $rootScope, $uibModal) {

        let UserModel = {},
            networkModal,
            storageKey = "userInfo";

        const networkModalTemplate = `<form class="network-modal">
            <div class="modal-header">
                <h4 class="modal-title">Not connected</h4>
            </div>
            <div class="modal-body" id="modal-body">
                <div class="body-description">It looks like you are offline. Trying to reconnect...</div>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-primary-goog pull-right" ng-click="forceRefreshPage()">Retry</button>
            </div>
        </form>`; // Storing template here to prevent failure GET request

        function showSignedOutModal() {
            $uibModal.open({
                templateUrl: 'static/templates/include/signed-out-modal.html',
                scope: $rootScope,
                animation: true,
                windowClass: 'network-modal-window',
                backdrop: 'static',
                size: 'sm',
            });
        }

        function serializeToSession() {
            $window.localStorage[storageKey] = JSON.stringify(UserModel);
        }

        function deserializeFromSession() {
            if ($window.localStorage[storageKey]) {
                UserModel = JSON.parse($window.localStorage[storageKey]);
            }
        }

        function clearFromSession() {
            delete $window.localStorage[storageKey];
            UserModel = {};
        }

        function showNetworkModal() {
            return $uibModal.open({
                template: networkModalTemplate,
                scope: $rootScope,
                animation: true,
                windowClass: 'network-modal-window',
                backdrop: 'static',
                size: 'sm',
            });
        }

        async function guessUserTimezone() {
            let currentUser = await reinitialize();
            let timezone = currentUser.timezone;
            return timezone ? timezone : moment.tz.guess();
        }

        async function updateUserTimezone(timezone) {
            if (_.isEmpty(UserModel))
                return;

            if (!timezone) {
                timezone = await guessUserTimezone();
            }

            const response = await $http.post("/api/user/update_timezone", {timezone});
            console.log("Fetched user time zone:", response.data.timezone);
            UserModel.timezone = response.data.timezone;
            serializeToSession(UserModel);
            return UserModel;
        }

        $rootScope.forceRefreshPage = () => {
            $window.location.reload();
        };

        $rootScope.$watch('isOnline', online => {
            let connectionStatus = {};
            online
                ? connectionStatus = {msg: "established", online: true}
                : connectionStatus = {msg: "interrupted", online: false};

            console.log(`%cInternet Connection ${connectionStatus.msg}.`,
                `color: ${connectionStatus.online ? 'green' : 'red'}`);

            if (!online) {
                networkModal = showNetworkModal();
            } else if (networkModal) {
                networkModal.dismiss();
            }
        });

        deserializeFromSession();
        updateUserTimezone();

        function reinitialize() {
            return $http.get('/api/auth/current')
                .then(function (response) {
                    UserModel = response.data;
                    serializeToSession(UserModel);
                    return UserModel;
                });
        }

        return {
            storageKey,
            showSignedOutModal,
            reinitialize,
            signIn: function (login, password, anon) {
                return $http({
                    method: 'POST',
                    url: '/api/auth/login',
                    data: $.param({'login': login, 'password': password, 'anon': anon}),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(function (response) {
                    UserModel = response.data;
                    serializeToSession();
                    $rootScope.$broadcast('sign_in');
                    return UserModel;
                }).then(() => updateUserTimezone());
            },
            signOut: function () {
                clearFromSession();
                return $http({
                    method: 'POST',
                    url: '/api/auth/logout'
                }).then(function () {
                    $rootScope.$broadcast('sign_out');
                });
            },
            getUserInitials: (user = UserModel) => {
                const name = user.fullName || user.email || '';

                return _.chain(name)
                    .thru(name => name.split(' ')) // Lodash 3 doesn't have built-in split() method
                    .compact() // For empty parts
                    .take(2)
                    .reduce((initials, namePart) => initials += _.first(namePart).toUpperCase(), '')
                    .value();
            },
            isSignedIn: function () {
                return UserModel ? UserModel.id : undefined;
            },
            getCurrent: function () {
                return UserModel;
            }
        };
    }])
});