define(['./module', 'common', 'lodash', 'angular'], function(module, cc, _, angular) {
    module.service('FormatCellService', ['$http', function ($http) {
        const arrayCell = (value, preProcess = _.identity) => {
            return `[${value.map(preProcess).join(', ')}]`
        };

        return {
            arrayCell
        };
    }]);
});