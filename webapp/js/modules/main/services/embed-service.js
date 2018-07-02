define(['./module'], function (module) {
    module.service('EmbedService', ['$http', '$window', '$httpParamSerializer', function ($http, $window, $httpParamSerializer) {
        const api = {
            getURL: function ({uuid, title}) {
                return window.location.origin + '/embed?'
                    + $httpParamSerializer({ uuid, title });
            },
            preview: function (embed) {
                $window.open(api.getURL(embed), '_blank');
            }
        };
        return api;
    }]);
});