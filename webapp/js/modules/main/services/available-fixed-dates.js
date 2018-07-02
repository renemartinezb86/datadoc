define(['./module', 'lodash', 'moment'], function (services, _, moment) {
        services.service('AvailableFixedDates', [function () {

            const allAvailableFixedDates = [
                {
                    label: "Last 7 days",
                    type: 'last_7_days',
                    value1: moment().startOf('day').subtract(7, 'd').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "Last 14 days",
                    type: 'last_14_days',
                    value1: moment().startOf('day').subtract(14, 'd').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "Last 28 days",
                    type: 'last_28_days',
                    value1: moment().startOf('day').subtract(28, 'd').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "Last 30 days",
                    type: 'last_30_days',
                    value1: moment().startOf('day').subtract(30, 'd').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "Today",
                    type: 'today',
                    value1: moment().startOf('day').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "Yesterday",
                    type: 'yesterday',
                    value1: moment().startOf('day').subtract(1, 'd').toDate(),
                    value2: moment().endOf('day').subtract(1, 'd').toDate()
                },
                {
                    label: "This week",
                    type: 'this_week',
                    value1: moment().startOf('day').startOf('week').toDate(),
                    value2: moment().endOf('day').endOf('week').toDate()
                },
                {
                    label: "Last week",
                    type: 'last_week',
                    value1: moment().startOf('day').subtract(1, 'week').startOf('week').toDate(),
                    value2: moment().endOf('day').subtract(1, 'week').endOf('week').toDate()
                },
                {
                    label: "This month",
                    type: 'this_month',
                    value1: moment().startOf('day').startOf('month').toDate(),
                    value2: moment().startOf('day').endOf('month').toDate()
                },
                {
                    label: "Last month",
                    type: 'last_month',
                    value1: moment().startOf('day').subtract(1, 'month').startOf('month').toDate(),
                    value2: moment().endOf('day').subtract(1, 'month').endOf('month').toDate()
                },
                {
                    label: "This quarter",
                    type: 'this_quarter',
                    value1: moment().startOf('day').startOf('quarter').toDate(),
                    value2: moment().endOf('day').endOf('quarter').toDate()
                },
                {
                    label: "Last quarter",
                    type: 'last_quarter',
                    value1: moment().startOf('day').subtract(1, 'quarter').startOf('quarter').toDate(),
                    value2: moment().endOf('day').subtract(1, 'quarter').endOf('quarter').toDate()
                },
                {
                    label: "This year",
                    type: 'this_year',
                    value1: moment().startOf('day').startOf('year').toDate(),
                    value2: moment().endOf('day').endOf('year').toDate()
                },
                {
                    label: "Last year",
                    type: 'last_year',
                    value1: moment().startOf('day').subtract(1, 'year').startOf('year').toDate(),
                    value2: moment().endOf('day').subtract(1, 'year').endOf('year').toDate()
                },
                {
                    label: "Year to date",
                    type: 'year_to_date',
                    value1: moment().startOf('day').startOf('year').toDate(),
                    value2: moment().endOf('day').toDate()
                },
                {
                    label: "All Date Range",
                    type: 'reset_filter'
                }
            ];

            return {
                allAvailableFixedDates
            }
        }]);
    }
);