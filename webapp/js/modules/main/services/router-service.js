define(['./module', 'common', 'lodash', 'angular'], function(module, cc, _, angular) {
    module.service('RouterService', ['$state', '$stateParams', function ($state, $stateParams) {
        const goToMainPage = (replaceLocation, data = {}) => {
            const options = {};
            if(replaceLocation) {
                options.location = 'replace';
            }
            $state.go('main.landing.my_data', data, options);
        };

        return {
            goToMainPage
        };
    }]);
});