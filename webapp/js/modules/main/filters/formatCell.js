define(['./module', 'moment', 'common'], function (filters, moment, cc) {

    'use strict';
    return filters.filter('formatCell', ['$filter', 'DataLoadingService', 'DatePatternService', 'FormatToolbarService', function ($filter, DataLoadingService, DatePatternService, FormatToolbarService) {

        const isBooleanFormat = (type) => {
            return ['BOOLEAN_1', 'BOOLEAN_2'].includes(type);
        };

        const formatBoolean = (value, type) => {
            const boolValue = !!FormatToolbarService.BOOLEAN_POSSIBLE_TYPES[value + ""];
            switch (type) {
                case 'BOOLEAN_1':
                    return boolValue ? "Yes" : "No";
                case 'BOOLEAN_2':
                    return boolValue ? "TRUE" : "FALSE";
            }
        };

        function formatValue(value, columnType, format, agg, strHandler, timezone){
            let content = value;
            if (value === null) {
                content = "<span class='null-value'>Ø</span>";
            } else if(typeof value !== "undefined" && isBooleanFormat(format.type)) {
                content = formatBoolean(value, format.type);
            } else if (typeof value !== "undefined") {
                switch(columnType){
                    case 'STRING':
                        if (strHandler) {
                            content = strHandler(value);
                        }
                        break;
                    case 'DATE':
                    case 'TIME':
                        let dateFormat,
                            showTimezone = false,
                            disableTimezoneConversion = true;
                        if (agg && columnType === 'DATE') {
                            switch (agg.id.op) {
                                case 'YEAR':
                                    dateFormat = 'YYYY';
                                    break;
                                case 'QUARTER':
                                    dateFormat = '\\QQ, YYYY';
                                    break;
                                case 'MONTH':
                                    dateFormat = 'MMMM, YYYY';
                                    break;
                                case 'DAY':
                                    dateFormat = 'YYYY-M-D';
                                    break;
                                case 'HOUR':
                                    dateFormat = 'YYYY-M-D HH:mm';
                                    showTimezone = true;
                                    disableTimezoneConversion = false;
                                    break;
                            }
                        } else {
                            if(!format){
                                // todo remove?
                                if(columnType === 'DATE'){
                                    dateFormat = 'M/D/YYYY HH:mm:ss';
                                    showTimezone = true;
                                    disableTimezoneConversion = false;
                                } else {
                                    dateFormat = 'HH:mm:ss';
                                    showTimezone = true;
                                    disableTimezoneConversion = false;
                                }
                            } else {
                                dateFormat = DatePatternService.getDatePattern(format.type, columnType);
                                showTimezone = format.type === "TIME" || format.type === "DATE_TIME";
                                disableTimezoneConversion = format.type === "DATE_1" || format.type === "DATE_2" || format.type === "DURATION";
                            }
                        }
                        if (timezone && showTimezone)
                            dateFormat += ` [${timezone}]`;

                        if (disableTimezoneConversion)
                            content = moment(value).utc().format(dateFormat);
                        else
                            content = moment(value).format(dateFormat);

                        break;
                    case 'DECIMAL':
                        content = $filter('numberFilter')(value, format);
                        break;
                }
            }
            return content;
        }

        return function (value, column, agg, search, strHandler, timezone) {
            let format = column.settings.format;
            let result;
            if(_.isArray(value)){
                result = `[${_.map(value, formatValue(value, column.type, format, agg, strHandler, timezone)).join(', ')}]`;
            } else {
                result = formatValue(value, column.type, format, agg, strHandler, timezone);
            }

            return result;
        }
    }]);

});
