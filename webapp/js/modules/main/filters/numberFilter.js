define(['./module', 'moment', 'lodash'], function (filters, moment, _) {
    'use strict';

    function formatNumber(value, format){
        if(value == undefined || value == null || !_.isNumber(value)){
            return value;
        }
        var withDecimalPlaces = value.toFixed(Math.max(0, ~~format.decimalPlaces));
        if(format.showThousandsSeparator){
            var re = '\\d(?=(\\d{3})+' + (format.decimalPlaces > 0 ? '\\.' : '$') + ')';
            return withDecimalPlaces.replace(new RegExp(re, 'g'), '$&,')
        }
        return withDecimalPlaces;
    }

    return filters.filter('numberFilter', ['$filter', 'DatePatternService', 'FormatToolbarService', function ($filter, DatePatternService, FormatToolbarService) {

        return function (value, format) {
            var formatted = value;
            switch (format.type) {
                case "TEXT":
                    formatted = value;
                    break;
                case "NUMBER":
                    formatted = formatNumber(value, format);
                    break;
                case "PERCENT":
                    formatted = formatNumber(value * 100, format) + "%";
                    break;
                case "FINANCIAL":
                    if (value < 0) {
                        var newValue = formatNumber(Math.abs(value), format);
                        formatted = "-" + format.currency + newValue;
                    } else {
                        formatted = format.currency + "" + formatNumber(value, format);
                    }
                    break;
                case "DATE_1":
                case "DATE_2":
                case "DATE_TIME":
                case "TIME":
                case "DURATION":
                    let pattern = DatePatternService.getDatePattern(format.type);
                    if(format.possibleMillisTimestamp){
                        formatted = moment(value).format(pattern);
                    } else {
                        formatted = moment.unix(value / 1000).format(pattern);
                    }
                    break;
                case "BOOLEAN_1":
                    formatted = FormatToolbarService.getBooleanByValue(value) ? "Yes" : "No";
                    break;
                case "BOOLEAN_2":
                    formatted = FormatToolbarService.getBooleanByValue(value) ? "TRUE" : "FALSE";
                    break;
            }
            return formatted;
        }
    }]);

});
