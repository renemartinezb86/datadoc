define(['./module'], function (filters) {
    'use strict';

    return filters.filter('financialFilter', ['$filter', function ($filter) {

        function format(value){
            return $filter('number')(value, 2);
        }

        return function (value) {
            if(value < 0){
                return '(' + format(-value) + ')';
            }
            return format(value);
        };
    }]);

});
