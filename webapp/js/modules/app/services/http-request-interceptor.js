define(['./module', '../../../utils'], function(module, utils) {
    module.factory('httpRequestInterceptor', function () {
        return {
            request: function (config) {
                config.headers['X_INSTANCE_ID'] = utils.instanceGUID;
                return config;
            }
        };
    });
});