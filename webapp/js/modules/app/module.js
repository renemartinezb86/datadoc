/**
 * loads sub modules and wraps them up into the main module
 * this should be used for top-level module definitions only
 */
define([
    'angular',
    'lodash',
    'alertify',
    'common',
    'notifications-utils',
    'angular-ui-router',
    'angular-ui-bootstrap-tpls',
    'angular-storage',
    'angular-sanitize',
    'angular-animate',
    'jquery',
    'jquery-ui',
    'jquery-actual',
    'ocLazyLoad',
    'ocLazyLoad-uiRouterDecorator',
    'moment-timezone-with-data',

    'cached-templates/templates-app',
    'modules/app/directives/index',
    'modules/app/services/index',
    'intl-tel-input',
    'ng-intl-tel-input',
    'ng-intl-tel-input-util',
    'socialLogin'
], function (angular, _, alertify, cc, NotificationsUtils) {
    'use strict';

    return angular.module('app', [
        'ui.router',
        'ui.bootstrap',
        'ngStorage',
        'ngSanitize',
        'ngAnimate',
        'oc.lazyLoad',
        'oc.lazyLoad.uiRouterDecorator',
        'templates-app',
        'app.services',
        'app.directives',
        'ngIntlTelInput',
        'socialLogin'
    ]).config(['$provide', '$httpProvider', '$compileProvider', '$urlMatcherFactoryProvider', 'ngIntlTelInputProvider','socialProvider', function($provide, $httpProvider, $compileProvider, $urlMatcherFactoryProvider, ngIntlTelInputProvider, socialProvider){

        socialProvider.setGoogleKey("164608449514-5ev0q7e77gvl9k6nappm9gbaac6lal0q.apps.googleusercontent.com");
        ngIntlTelInputProvider.set({
            initialCountry: 'us',
            utilsScript: 'lib/intl-tel-input/build/js/utils.js'
        });

        const GUID_REGEXP = /^[a-f\d]{8}-([a-f\d]{4}-){3}[a-f\d]{12}$/i;
        $urlMatcherFactoryProvider.type('guid', {
            encode: angular.identity,
            decode: angular.identity,
            pattern: /[^/]+/,
            is: (item) => {
                return GUID_REGEXP.test(item);
            }
        });
        $compileProvider.debugInfoEnabled(false);

        $provide.factory('ErrorHttpInterceptor',['$q','$window',function ($q, $window){

            var notifierOpened = false;

            function notifyError (rejection){
                if(rejection.status === 401 &&
                    rejection.config.url != "/api/auth/login" &&
                    !notifierOpened){
                    notifierOpened = true;
                    alertify.alert(
                        "<h2 class='margin10'>" +
                        "<i class='fa fa-sign-out'></i>" +
                        "Your session has expired!" +
                        "</h2> " +
                        "<hr>" +
                        "<span class = 'margin10'>Please re-login to continue working.</span>", function(){
                            delete $window.localStorage.userInfo;
                            $window.location = "/#/login";
                            notifierOpened = false;
                        });
                }
            }

            return {
                'requestError': function (rejection) {
                    notifyError(rejection);

                    return $q.reject(rejection);
                },
                responseError: function (rejection) {
                    // show notification
                    notifyError(rejection);
                    // Return the promise rejection.
                    if(rejection.status === 502) {
                        window.location.reload();
                    }
                    return $q.reject(rejection);
                }
            };
        }]);

        $httpProvider.interceptors.push('httpRequestInterceptor');
        $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|data):/);
    }]).config(['$stateProvider','$urlRouterProvider', '$ocLazyLoadProvider', '$locationProvider', '$provide',
    function($stateProvider, $urlRouterProvider, $ocLazyLoadProvider, $locationProvider, $provide) {
        let isEmbed = window.location.pathname.match('embed');
        $urlRouterProvider.otherwise("/");

        $provide.decorator('$locale', ['$delegate', ($delegate) => {
            $delegate.DATETIME_FORMATS.SHORTDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // For Bootstrap DatePicker

            const shortMonthLowerCase = $delegate.DATETIME_FORMATS.SHORTMONTH.map(m => m.toLowerCase());
            shortMonthLowerCase.forEach(m => {
                $delegate.DATETIME_FORMATS.SHORTMONTH.push(m);
            });

            return $delegate;
        }]);

        $ocLazyLoadProvider.config({
            loadedModules: ['app'],
            asyncLoader: require
        });

        function loadTemplates(templatePaths, $templateRequest, $sce){
            var promises = [];
            _.forEach(templatePaths, function (t) {
                var path = angular.isString(t)
                    ? 'static/templates/include/' + t + '.html'
                    : t.path;

                var templateUrl = $sce.getTrustedResourceUrl(path);
                promises.push($templateRequest(templateUrl));
            });
            return promises;
        }

        if(!isEmbed){
            const visualizeResolver = {
                title: ['$lazyLoader', 'DataLoadingService', '$stateParams',
                    ($lazyLoader, DataLoadingService, $stateParams) => {
                        return DataLoadingService.loadDatadoc(parseInt($stateParams.id))
                            .then(doc => doc.data && doc.data.name)
                            .catch(err => {
                                if(err.status === 403) {
                                    throw new Error('Document Access Denied');
                                } else if(err.status === 404) {
                                    if(err.data.deleted) {
                                        throw new Error(`The datadoc <b>&nbsp${err.data.resourceName}&nbsp</b> has been deleted.`);
                                    } else {
                                        throw new Error(`There is no such datadoc with id <b>&nbsp${err.data.resourceId}&nbsp</b>`);
                                    }
                                } else if(err.status !== 200) {
                                    throw new cc.ErrorWithId(err.data.message, "datadoc_undefined_err", $stateParams.id);
                                }
                            })
                    }],
                commitState: ['title', 'BookmarkCommitService',
                    (title, BookmarkCommitService) => BookmarkCommitService.promise],
                websocket: ['commitState', 'WSocket', (commitState, WSocket) => WSocket.promise]
            };
            //todo generalize
            const sharedVisualizeResolver = {
                datadocId: ['$lazyLoader', 'DataLoadingService', '$stateParams',
                    async ($lazyLoader, DataLoadingService, $stateParams) => {
                        const datadocId = await DataLoadingService.getDatadocIdByShareId($stateParams.sharedId);
                        $stateParams.id = datadocId;
                        return datadocId;
                    }],
                title: ['datadocId', '$lazyLoader', 'DataLoadingService',
                    (datadocId, $lazyLoader, DataLoadingService) => {
                        return DataLoadingService.loadDatadoc(parseInt(datadocId))
                            .then(doc => doc.data && doc.data.name);
                    }],
                isAllowed: ['datadocId', 'title', '$http', 'DataLoadingService', '$stateParams',
                    async (datadocId, title, $http, DataLoadingService, $stateParams) => {
                    const accessible = await DataLoadingService.isPublicAccessible($stateParams.sharedId);
                    if (!accessible) {
                        throw new Error('Document Access Denied');
                    }
                }],
                commitState: ['isAllowed', 'BookmarkCommitService',
                    (isAllowed, BookmarkCommitService) => BookmarkCommitService.promise],
                websocket: ['commitState', 'WSocket', (commitState, WSocket) => WSocket.promise]
            };

            $stateProvider
                .state('auth', {
                    abstract: true,
                    lazyModule: 'app.login',
                    lazyFiles: 'modules/login/module',
                    lazyTemplateUrl: "/static/templates/auth/index.html",
                    omitAuth: true
                })
                .state('auth.login', {
                    url: "/login?state&param",
                    controller: "loginCtrl",
                    templateUrl: "/static/templates/auth/login.html",
                    omitAuth: true
                })
                .state('auth.register', {
                    url: "/register?state&param",
                    controller: "registerCtrl",
                    templateUrl: "/static/templates/auth/register.html",
                    omitAuth: true
                }).state('auth.confirm-register', {
                    url: "/confirm-register?email",
                    controller: "confirmRegisterCtrl",
                    templateUrl: "/static/templates/auth/confirm-register.html",
                    omitAuth: true
                })
                .state('auth.forgot-password', {
                    url: "/forgot-password",
                    controller: "forgotPasswordCtrl",
                    templateUrl: "/static/templates/auth/forgot-password.html",
                    omitAuth: true
                })
                .state('auth.reset-password', {
                    url: "/reset-password?token",
                    controller: "resetPasswordCtrl",
                    templateUrl: "/static/templates/auth/reset-password.html",
                    omitAuth: true
                })
                .state('main', {
                    url: '/',
                    lazyModule: 'app.main',
                    lazyFiles: 'modules/main/module',
                    lazyTemplateUrl: '/static/templates/main/index.html',
                    controller: "mainCtrl",
                    resolve: {
                        deps: ['$lazyLoader', 'UserStateService',
                            function ($lazyLoader, UserStateService) {
                                return UserStateService.promise;
                            }
                        ]
                    }
                })
                .state('main.landing', {
                    abstract: true,
                    controller: 'uploadsCtrl',
                    templateUrl: '/static/templates/main/main.html',
                    resolve: {
                        deps: ['$lazyLoader', '$templateRequest', '$q', '$sce',
                            'SourceService', 'UserStateService', 'WSocket',
                            'BookmarkCommitService',
                            function ($lazyLoader, $templateRequest, $q, $sce,
                                      SourceService,
                                      UserStateService, WSocket,
                                      BookmarkCommitService) {
                                var promises = [
                                    SourceService.promise,
                                    UserStateService.promise, WSocket.promise,
                                    BookmarkCommitService.promise];

                                var templates = [
                                    'main-page-ds-pane',
                                    'datadoc-pane',
                                    'sort-columns',
                                    'search-bar',
                                    'user-menu',
                                    'no-sources',
                                    'search-nav-popup',
                                    'search-item',
                                    'viz-pages/viz-status-bar',
                                    'viz-pages/ingest-status-bar',
                                    'viz-pages/viz',
                                    'viz-pages/ingest',
                                    { path: '/static/templates/main/user-settings.html'},
                                    { path: '/static/templates/main/uploads.html' },
                                    { path: '/static/templates/main/my-data.html' },
                                    { path: '/static/templates/main/search.html' }
                                ];

                                return $q.all(promises.concat( loadTemplates(templates, $templateRequest, $sce) ));
                            }
                        ]
                    }
                })
                .state('main.landing.my_data', {
                    url: 'my-data?f&openAddSourceModal',
                    templateUrl: '/static/templates/main/my-data.html',
                    resolve: {
                        deps: ['$lazyLoader', '$q', '$stateParams', 'SourceService', 'SortSectionColumnsService',
                                'UserStateService', '$rootScope',
                            function ($lazyLoader, $q, $stateParams, SourceService, SortSectionColumnsService,
                                      UserStateService, $rootScope) {
                                UserStateService.reset().then(userState => {
                                    const getSortFromOptions = options => {
                                        const column = _.find(options.columns, col => col.sort.direction);

                                        if(column.selected.sortDisabled) {
                                            return null;
                                        }

                                        return {
                                            field: column.selected.sortProperty,
                                            desc: column.sort.direction === 'DESC'
                                        };
                                    };

                                    const hasPreviousState = $rootScope.previousState && !$rootScope.previousState.abstract;
                                    const options = SortSectionColumnsService.genSortColumnsOptions({userState});
                                    const sort = getSortFromOptions(options);

                                    if (!hasPreviousState) {
                                        $stateParams.f = userState.selectedFolderId;
                                    }

                                    return SourceService.selectFolder($stateParams.f)
                                        .then(() => {
                                            const { datadocsOnly, foldersOnly, sourcesOnly } = userState.showTypesOptions;
                                            $rootScope.$broadcast('refresh-selected-folder');
                                            SourceService.reset({sort, datadocsOnly, foldersOnly, sourcesOnly})
                                        });
                                })
                            }
                        ]
                    },
                    params: {
                        forceRoot: false
                    }
                })
                .state('main.landing.user_settings', {
                    url: 'user-settings',
                    templateUrl: '/static/templates/main/user-settings.html'
                })
                .state('main.landing.search', {
                    url: 'search?s',
                    templateUrl: '/static/templates/main/search.html',
                    resolve: {
                        deps: ['$lazyLoader', '$q', '$stateParams', 'SearchService', 'SortSectionColumnsService', 'UserStateService', '$rootScope',
                            function ($lazyLoader, $q, $stateParams, SearchService, SortSectionColumnsService, UserStateService, $rootScope) {
                                UserStateService.promise.then(userState => {
                                    function updateSearchResults() {
                                        let options = SortSectionColumnsService.genSortColumnsOptions({userState}, true, $stateParams.s);
                                        let sort = getSortFromOptions(options);
                                        return SearchService.search($stateParams.s, {sort});
                                    }
                                    function getSortFromOptions(options) {
                                        let column = _.find(options.columns, col => col.sort.direction);
                                        return {
                                            field: column.selected.sortProperty,
                                            desc: column.sort.direction == 'DESC'
                                        };
                                    }
                                    updateSearchResults().then(() => {
                                            $rootScope.$broadcast('set-search-results');
                                        });
                                });
                            }
                        ]
                    }
                })
                .state('main.visualize', {
                    url: "visualize/:id?pid?autoingest&stateId&{pageMode:int}",
                    controller: 'visualizationCtrl',
                    templateUrl: '/static/templates/main/visualization.html',
                    params: {
                        preSave: false
                        // pageMode: 0
                        // Specify a default value if you only need to remember it only on the visualization page.
                    },
                    resolve: visualizeResolver,
                    skipDefaultStateChangeBehavior: true
                })
                .state('main.visualize-shared', {
                    url: "shared/{sharedId:guid}?pid?autoingest&stateId",
                    controller: 'visualizationCtrl',
                    templateUrl: '/static/templates/main/visualization.html',
                    resolve: sharedVisualizeResolver,
                    skipDefaultStateChangeBehavior: true
                })
        } else {
            $stateProvider
                .state('embed', {
                    url: '/',
                    lazyModule: 'app.main',
                    lazyFiles: 'modules/main/module',
                    templateProvider: ['$q', function ($q) {
                        var queryParams = function () {
                            // This function is anonymous, is executed immediately and
                            // the return value is assigned to QueryString!
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
                        }();
                        document.title = queryParams.title + ' - Datadocs';
                        return $q.when('<embed-widget uuid="' + queryParams.uuid + '"></embed-widget>');
                    }],
                    skipDefaultStateChangeBehavior: true,
                    omitAuth: true
                })
        }

    }]).run(['$q', '$templateCache', '$rootScope','$state', '$timeout', '$localStorage', 'User', '$window',
        function ($q, $templateCache, $rootScope, $state, $timeout, $localStorage, User, $window) {

        $rootScope.isOnline = navigator.onLine;
            $window.addEventListener("offline", function() {
                $rootScope.$apply(function() {
                    $rootScope.isOnline = false;
                });
            }, false);

            $window.addEventListener("online", function() {
                $rootScope.$apply(function() {
                    $rootScope.isOnline = true;
                });
            }, false);

            // show signed out modal when clearing browser data or user info
            $window.addEventListener("storage", function (event) {
                const isUserRemoved = event.key === User.storageKey && !event.newValue,
                    isStorageCleared = !event.key && _.isEmpty(event.storageArea);

                if (isUserRemoved || isStorageCleared) {
                    User.showSignedOutModal();
                }
            }, false);

        $rootScope.nextPageAfterLogin = null;

        $rootScope.$on('$stateChangeStart',
            function(event, toState, toParams, fromState){
                const authRequired = !toState.omitAuth;

                // Add "min-device-width" class to .application (body) only for the main section
                // CSS class reference in application.scss
                _.startsWith(toState.name, "main.landing")
                    ? document.body.classList.add("min-device-width")
                    : document.body.classList.remove("min-device-width");
                // Add "auth-page" class to .application (body) if the user isn't logged in
                _.startsWith(toState.name, "auth")
                    ? document.body.classList.add("auth-page")
                    : document.body.classList.remove("auth-page");

                if(authRequired && !User.isSignedIn()){
                    event.preventDefault();
                    $rootScope.nextPageAfterLogin = {
                        name: toState.name,
                        params: toParams
                    };
                    $timeout(function() {
                        // transform object to string like this: key1:val1:key2:val2
                        const param = _.flatten(_.compact(_.map(toParams, (val, key) => val ? [key, val] : null))).join(":");
                        $state.go('auth.login', {state: toState.name, param});
                        $rootScope.$broadcast('$stateChangeSuccess', fromState);
                    });
                } else if (User.isSignedIn() && toState.name === 'auth.login') {
                    event.preventDefault();
                    $timeout(function() {
                        $state.go('main');
                        $rootScope.$broadcast('$stateChangeSuccess', fromState);
                    })
                }
            });
        $rootScope.$on("$stateChangeError", function(event, toState, toParams, fromState, fromParams, error) {
            if (error.status === 401) {
                User.signOut().then(function(){
                    $state.go('auth.login');
                });
            } else {
                if (toState.name === 'main.visualize') {
                    $rootScope.$broadcast('cancelGoingToVisualization');
                    $state.go(User.isSignedIn() ? 'main.landing.my_data' : 'auth.login');
                }
                NotificationsUtils.notifyError(new NotificationsUtils.NotificationContent(error.errorId, error.message))
            }
        });

        function annotatedStateObject(state, $current) {
            state = _.extend({}, state);
            let resolveData = _.get($current, 'locals.resolve.$$values');

            if (resolveData) {
                state.params = resolveData.$stateParams;
                state.resolve = _.omit(resolveData, '$stateParams');
                state.includes = $current.includes;
            }

            return state;
        }

        function changeTitle(title){
            document.title = `${title} - Datadocs`;
        }

        $rootScope.$on('$titleChanged', function(e, title){ changeTitle(title) });
        $rootScope.$on('$stateChangeSuccess', function(event, toState, toParams, fromState) {
            document.title = "Datadocs";
            toState = annotatedStateObject(toState, $state.$current);
            $rootScope.previousState = fromState;

            if (_.get(toState, 'resolve.title')){
                $q.when(toState.resolve.title).then(changeTitle)
            }
        });
    }]);
});
