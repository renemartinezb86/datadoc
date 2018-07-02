define(['./module', 'moment'], function (filters, moment) {
    'use strict';

    return filters.filter('pickerFilter', ['$filter', function ($filter) {

        return function (value, filterName, numberFormat) {
            if(value + "" == "-9223372036854775808" || value === null){ // magic!
                return "<span class='null-value'>Ø</span>"
            }
            if (typeof(value) === "boolean") {
                return value ? "Yes" : "No";
            } else if (typeof value != 'undefined' && typeof filterName != 'undefined') {
                switch (filterName.type) {
                    case "number":
                        return numberFormat ? $filter('numberFormatFilter')(value, 1) : $filter('number')(value, 2);
                    case "percent":
                        return $filter('number')(value, 2) + "%";
                    case "currency":
                        if (Number(value) < 0) {
                            var newValue = $filter('number')(Math.abs(value), filterName.decimal);
                            if (filterName.negative == '-') {
                                return numberFormat ? "-" + filterName.symb + $filter('numberFormatFilter')(newValue, 1) : "-" + filterName.symb + newValue;
                            }
                            return numberFormat ? filterName.symb + "(" + $filter('numberFormatFilter')(newValue, 1) + ")" : filterName.symb + "(" + newValue + ")";
                        }
                        return numberFormat ? filterName.symb + "" + $filter('numberFormatFilter')(value, filterName.decimal) : filterName.symb + "" + $filter('number')(value, filterName.decimal);
                    case "financial":
                        return $filter('financialFilter')(Number(value));
                    case "date":
                        // in agg mode we receive timestamps (string), whether in raw mode it is ISO date string
                        if(value.indexOf("T") == -1){
                            if(value.indexOf("Z") != -1){
                                return moment(value, 'HH:mm:ssZ').format(filterName.format)
                            } else {
                                value = parseInt(value);
                            }
                        }
                        return moment(value).format(filterName.format);
                    case "lat-lon":
                        return $filter('locationLatLonFilter')(value);
                    case "codes":
                        return $filter('locationCodesFilter')(value);
                    default:
                        return numberFormat ? $filter('numberFormatFilter')(value, 1) : value;
                }
            } else if (typeof value != 'undefined') return value;
            else return '<span class="null-value">&Oslash;</span>';
        }
    }]);

});
