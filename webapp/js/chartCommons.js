define([], function() {
    var CHART_TYPES = {
        COLUMN: 0,
        BAR: 1,
        PIE: 2,
        LINE: 3,
        AREA: 4,
        MAP: 5,
        SCATTER: 6,
        TABLE: 7,
        LIST: 8
    };
    var REGRESSION_TYPES = {
        LINEAR: 0,
        EXPONENTIAL: 1,
        LOGARITHMIC: 2,
        POWER: 3,
        POLYNOMIAL: 4
    };
    var REGRESSION_TYPE_OPTIONS = [
        {desc: 'Linear', value: REGRESSION_TYPES.LINEAR},
        {desc: 'Exponential', value: REGRESSION_TYPES.EXPONENTIAL},
        {desc: 'Logarithmic', value: REGRESSION_TYPES.LOGARITHMIC},
        {desc: 'Power', value: REGRESSION_TYPES.POWER},
        {desc: 'Polynomial', value: REGRESSION_TYPES.POLYNOMIAL}
    ];

    function getFullName(s){
        var name = s.name;
        if(s.operation && !s.renamed){
            name += ' (' + s.op.name + ')';
        }
        return name;
    }

    function getAggIndex(groups, aggs){
        var aggIndex = 0;
        if(groups.length){
            aggIndex = _.findIndex(aggs, {field: groups[0].field});
            if(aggIndex < 0){
                aggIndex = 0;
            }
        }
        return aggIndex;
    }

    function activateTooltip($scope, $timeout, p) {

        $scope.chartTooltip.resetTimeout();

        if(!p.options.otherChart) {
            var result = p.o;

            var field;
            if ($scope.vizSummary.xAxisShows[0].key != "$$row_number") {
                field = $scope.vizSummary.xAxisShows[0].key;
            } else {
                field = this.options.key || this.options.name.toLowerCase();
            }


            var key;
            if ($scope.gridApi) {
                key = _.find($scope.gridApi.grid.columns, {field: field});
            }

            $scope.chartTooltip.color = p.color;
            $scope.chartTooltip.point = p;
            $scope.chartTooltip.active = true;
            $scope.chartTooltip.viewData = false;
            $scope.chartTooltip.byColumn = key;
            $scope.chartTooltip.byValue = result[field];
            $scope.chartTooltip.row = key ? undefined : {entity: p.o};
            $scope.chartTooltip.values = _.map($scope.gridOptions.columnDefs, function(col){
                var value = p.o[col.name];
                return { name: col.displayName, value: value }
            });

            if ($scope.vizSummary.chartType === CHART_TYPES.SCATTER) {
                $scope.chartTooltip.isRegressionLine = p.series.userOptions.type === 'spline'
            } else {
                $scope.chartTooltip.isRegressionLine = false;
            }

            $scope.chartTooltip.headerData = [{
                key: p.name || p.series.name,
                value: p.y
            }];

            $scope.chartTooltip.activateVisible();
            $scope.chartTooltip.activateEvents();
            $scope.$apply();


            $timeout(function () {
                $scope.chartTooltip.updatePosition(p);
            });
        }
    }

    function defaultChartOptions(rawData, $scope, $timeout, $filter, activeClick) {
        return {
            chart: {
                renderTo: 'chart-container',
                events: {
                    load: function (e) {
                        if(!$scope.expandOnDrillDown) {
                            $scope.inRequestViz = false;
                        }
                    },
                    click: function (e) {
                        if (activeClick && $scope.chartType != $scope.chartTypes.SCATTER) return;

                        if (!$scope.chartTooltip.active && this.hoverPoint) {
                            e.stopPropagation();
                            activateTooltip.bind(this.hoverSeries, $scope, $timeout, this.hoverPoint)();
                        }
                    }
                },
                resetZoomButton: {
                    theme: {
                        fill: '#f8f8f8',
                        stroke: '#ccc',
                        style: {
                            color: '#333'
                        },
                        r: 1,
                        states: {
                            hover: {
                                fill: '#e7e7e7',
                                stroke: '#adadad',
                                style: {
                                    color: 'black',
                                    cursor: 'pointer'
                                }
                            }
                        }
                    }
                }
            },
            exporting: {
                enabled: false
            },
            title: {
                text: '',
                style: {
                    display: 'none'
                }
            },
            subtitle: {
                text: '',
                style: {
                    display: 'none'
                }
            },
            plotOptions: {
                series: {
                    point: {
                        events: {
                            mouseOver: function (e) {

                                if (!$scope.chartTooltip.active) {
                                    $scope.chartTooltip.resetTimeout();
                                    $scope.chartTooltip.value = null;

                                    var p = e.target,
                                        data = [],
                                        type = rawData ? rawData.vizSummary.chartType : $scope.vizSummary.chartType,
                                        mainValueKey = rawData
                                            ? rawData.vizSummary.xAxisShows[0].field
                                            : $scope.vizSummary.xAxisShows[0].field;

                                    if (type === CHART_TYPES.PIE) {
                                        data.push({
                                            key: (type === CHART_TYPES.PIE) ? p.name : p.series.name,
                                            value: p.y
                                        });
                                    } else if (type === CHART_TYPES.SCATTER) {
                                        var category = p.index;

                                        p.series.chart.series.forEach(function (item) {
                                            if (item.name == 'Navigator' || !item.data.length || !item.data[category] || !item.data[category].y) return;

                                            data.push({
                                                value: item.data[category].y,
                                                key: item.name,
                                                color: item.color
                                            });
                                        });

                                        // add header value
                                        $scope.chartTooltip.value = p.category;
                                    } else {

                                        if (rawData ? rawData.segmentBy.length : $scope.vizSummary.segmentBy.length) {

                                            var key = rawData ?
                                                rawData.yAxisShows[0].key :
                                                $scope.vizSummary.yAxisShows[0].key;
                                            var category = p.category;

                                            p.series.chart.series.forEach(function (item) {
                                                if (item.name == 'Navigator' || !item.data[category].options.y) return;

                                                data.push({
                                                    value: item.data[category].options.y,
                                                    key: item.name,
                                                    color: item.color
                                                });
                                            });

                                        } else {

                                            // add limit
                                            var shows = rawData ? rawData.yAxisShows.slice(0, 6) : $scope.vizSummary.yAxisShows.slice(0, 6);

                                            shows.forEach(function (el) {
                                                var searchName = (rawData ? rawData.aggs.length : $scope.dataSummary.aggs.length)
                                                    ? getFullName(el)
                                                    : el.name;

                                                var color = _.find(p.series.chart.series, {name: searchName});
                                                if (color) color = color.color;

                                                var filter = _.find($scope.gridOptions.columnDefs, {field: el.key});
                                                if (filter) filter = filter.customFilter;

                                                var value;
                                                // if (filter && filter.type) {
                                                //     value = $filter('pickerFilter')(p.o[el.key], filter);
                                                // } else {
                                                    value = p.o[el.key];
                                                // }

                                                data.push({
                                                    value: value,
                                                    key: el.showName,
                                                    color: color
                                                });
                                            });
                                        }
                                        
                                        $scope.chartTooltip.value = (mainValueKey == "$$row_number")
                                            ? p.category
                                            : p.o[mainValueKey];

                                        if (!$scope.chartTooltip.value) {
                                            $scope.chartTooltip.value = p.o.aggregation;
                                        }
                                    }

                                    $scope.chartTooltip.headerData = data;
                                    $scope.chartTooltip.color = e.target.color;
                                    $scope.chartTooltip.deactivateEvents();
                                    $scope.chartTooltip.activateVisible();

                                    $scope.$apply();

                                    $timeout(function () {
                                        $scope.chartTooltip.updatePosition(e.target);
                                    });
                                }
                            }
                        }
                    },
                    events: {
                        click: function (e) {
                            if (activeClick && $scope.chartType != $scope.chartTypes.SCATTER && $scope.controllerName != 'visualizationCtrl') return;

                            e.stopPropagation();
                            activateTooltip.bind(this, $scope, $timeout, e.point)();
                        },
                        mouseOut: function(e) {
                            if (!$scope.chartTooltip.active) {
                                $scope.chartTooltip.hidePromise = $timeout(function () {
                                    $scope.chartTooltip.hide();
                                }, 250);
                            }
                        }
                    }
                }
            },
            xAxis: {
                labels: {
                    formatter: function() {
                        if(!rawData && $scope.popupData && $scope.popupData.is || !$scope.gridApi) return;

                        var vr = [];
                        if (!rawData){
                            rawData = {
                                vizSummary: {},
                                dataSummary: {},
                                empty: true
                            };

                            if ($scope.gridApi) {
                                vr = $scope.gridApi.core.getVisibleRows();
                            }
                        }

                        var d = {
                            xAxisShows: rawData.vizSummary.xAxisShows || $scope.vizSummary.xAxisShows,
                            chartType: rawData.vizSummary.chartType || $scope.vizSummary.chartType,
                            columnDefs: $scope.gridOptions.columnDefs,
                            data: vr.length ? _.map(vr, 'entity') : $scope.gridOptions.data,
                            aggs: rawData.dataSummary.aggs || $scope.dataSummary.aggs
                        };
                        if (rawData.empty) rawData = null;



                        if (d.xAxisShows[0]) {

                            var key = d.xAxisShows[0].field,
                                type, val;

                            if (key == "$$row_number" || (d.chartType) == CHART_TYPES.SCATTER) {
                                val = this.value;
                            } else {

                                if(!_.find((d.columnDefs), {field: key}) && !_.find((d.aggs), {field: key})) return;

                                if (d.aggs.length == 0) {
                                    type = _.find(d.columnDefs, {field: key}).type;
                                } else {
                                    type = _.find(d.aggs, {field: key}).type;
                                }
                                var aggIndex = getAggIndex((d.xAxisShows), (d.aggs));
                                var allData = _.filter(d.data, function(o) {
                                    return o.__treeLevel == aggIndex;
                                });
                                var data = allData[this.value];
                                if (data) {
                                    val = data.aggregation || data[key];
                                    if (val != null) {
                                        if (type === 'daterange') {
                                            var operation = d.xAxisShows[0].operation;

                                            if(operation && operation == 'year') {
                                                val = $filter('date')(data[(d.xAxisShows[0].key)], 'y');
                                            } else {
                                                val = $filter('date')(val, 'MMM d, y');
                                            }
                                        }
                                    } else {
                                        val = "null"
                                    }
                                }
                            }
                            return val;
                        }
                    }
                }
            },
            navigator: {
                series: {
                    includeInCSVExport: false
                },
                xAxis: {
                    labels: {
                        formatter: function() {
                            return '';
                        }
                    }
                }
            },
            rangeSelector: {
                enabled: false
            },
            legend: {
                enabled: true,
                useHTML: true
            },
            yAxis: {},
            series: [],
            credits: {
                enabled: false
            },
            tooltip: {
                enabled: false
            }
        }
    }

    function chartTooltip(rawData, $scope, $timeout, modalClass) {
        return {
            // triggers
            visible: false,
            active: false,
            isEnableEvents: true,
            viewData: false,

            // data
            point: null,
            byColumn: null,
            byValue: null,
            color: null,
            headerData: [],
            hidePromise: null,
            direction: null,

            // methods
            showData: function(){
                $scope.chartTooltip.viewData = true;
                $timeout(function(){

                    if($scope.chartTooltip.popup) {
                        $scope.chartTooltip.popup.update();
                    }
                })
            },
            closeData: function(){
                $scope.chartTooltip.viewData = false;
                $timeout(function(){

                    if($scope.chartTooltip.popup) {
                        $scope.chartTooltip.popup.update();
                    }
                })
            },
            hide: function () {
                if (this.visible) {
                    var that = this;
                    $timeout(function(){
                        that.visible = false;
                        that.active = false;
                    })
                }
            },
            updatePosition: function (point) {
                var chartContainer = $('#chart-container');
                var offset = chartContainer.offset();
                var tooltip = $('.chart-tooltip');
                var left = offset.left + ((point.tooltipPos) ? point.tooltipPos[0] : point.plotX);
                var top = offset.top + ((point.tooltipPos) ? point.tooltipPos[1] : point.plotY);
                var arrowLeftPosition = (tooltip.width() / 2 - 10);

                if(!point.series) return;

                left += point.series.chart.plotLeft - 10;

                if ((rawData ? rawData.chartType : $scope.vizSummary.chartType) === CHART_TYPES.BAR) {

                    left -= ((tooltip.width() / 2)) - 10;
                    top = (top - tooltip.height() + 22);

                    if (!rawData && $scope.vizSummary.enabledMultiAxis) {
                        top += point.series.chart.plotTop - 40
                    }

                } else {
                    left -= ((tooltip.width() / 2) - 8);
                    top = (top - tooltip.height() - 10);
                }

                // check out on window
                var leftOutside =  ((left + tooltip.width()) - (chartContainer.width() + offset.left));
                var rightOutside =  (offset.left - left);

                if (leftOutside > 0) {
                    left -= leftOutside;

                    arrowLeftPosition += leftOutside;
                } else if (rightOutside > 0) {
                    left += rightOutside;

                    arrowLeftPosition -= rightOutside;
                }

                // check out on top
                if (top < tooltip.height()) {
                    top += (tooltip.height() + 35);
                    this.direction = 'top';
                } else {
                    this.direction = 'bottom';
                }


                if (modalClass) {
                    var modalOffset = $(modalClass+' .modal-body').offset();

                    left -= modalOffset.left;
                    top -= modalOffset.top - 65;
                }

                tooltip.css({ left: left, top: top });

                $('.chart-tooltip .arrow').css({ left: arrowLeftPosition });
            },
            activateEvents: function () {
                if (!this.isEnableEvents) {
                    $('.chart-tooltip').css('pointer-events', 'auto');
                    this.isEnableEvents = true;
                }
            },
            deactivateEvents: function () {
                if (this.isEnableEvents) {
                    $('.chart-tooltip').css('pointer-events', 'none');
                    this.isEnableEvents = false;
                }
            },
            activateVisible: function () {
                if (!this.visible) {
                    this.visible = true;
                }
            },
            resetTimeout: function () {
                if (this.hidePromise) {
                    $timeout.cancel($scope.chartTooltip.hidePromise);
                }
            }
        }
    }

    function isAllowedDataForChartType(type, $scope, colsTypes) {
        var groups = _.filter($scope.vizSummary.xAxisShows, function(s){
                return s.field != '$$row_number';
            }),
            cols = $scope.vizSummary.yAxisShows;
        switch (type){
            case CHART_TYPES.COLUMN:
                return true;
            case CHART_TYPES.BAR:
                return true;
            case CHART_TYPES.LINE:
                return true;
            case CHART_TYPES.AREA:
                return true;
            case CHART_TYPES.PIE:
                return groups.length > 0;
            case CHART_TYPES.MAP:
                if (groups.length > 0 && !$scope.vizSummary.hltd) {
                    var field = colsTypes[groups[0].field].toLowerCase();
                    return field == 'location_lat_lon' || !field.indexOf('location');
                }
                return false;
            case CHART_TYPES.SCATTER:
                return groups.length == 1 && cols.length == 1 && !$scope.vizSummary.hltd;
            case CHART_TYPES.TABLE:
            case CHART_TYPES.LIST:
                return true;
            default:
                throw "Unknown chart type: " + type;
        }
    }

    function calculateCoordsForRegressions(data, regressionType, regData, allData) {
        var minY = data[0].y;
        var maxY = data[data.length - 1].y;
        var plusY = (maxY - minY) / data.length;
        var minX = data[0].x;
        var maxX = data[data.length - 1].x;
        var plusX = (maxX - minX) / data.length;

        function calculateY(equation, x, i) {
            switch(regressionType) {
                case REGRESSION_TYPES.LINEAR:
                    return i == 0 ? minY : minY+=plusY;
                case REGRESSION_TYPES.EXPONENTIAL:
                    return equation[0] * Math.exp(equation[1] * x);
                case REGRESSION_TYPES.LOGARITHMIC:
                    return equation[0] + equation[1] * Math.log(x);
                case REGRESSION_TYPES.POWER:
                    return equation[0] * Math.pow(x, equation[1]);
                case REGRESSION_TYPES.POLYNOMIAL:
                    return equation[2] * Math.pow(x, 2) + equation[1] * x + equation[0];
            }
        }

        var forCalc = JSON.stringify({
            string: regData.string,
            equation: regData.equation,
            type: regressionType
        });

        return {name: regData.string + ' R²='+regData.r2.toFixed(2) + ' <a onclick=\'$scope.regressionCalculator(event, ' + JSON.stringify(forCalc) + ')\'>Calculate</a>', type: 'spline', data: (_.map(data, function(o, i) {
            return {
                x: parseFloat((i == 0 ? minX : minX+=plusX).toFixed(2)),
                y: parseFloat(calculateY(regData.equation, minX, i).toFixed(2)),
                o: allData[i]
            }
        })).concat([{x: parseFloat((minX+=plusX).toFixed(2)), y: parseFloat((calculateY(regData.equation, minX, data[data.length])).toFixed(2)), o: allData[allData.length - 1]}])}
    }

    function removeCalculate(str) {
        var startIndex = str.indexOf("<a onclick='$scope.regressionCalculator")
        var endIndex = str.indexOf("Calculate</a>");

        if(startIndex != -1 && endIndex != -1) {
            str = str.slice(0, startIndex);
        }
        return str;
    }

    return {
        CHART_TYPES: CHART_TYPES,
        REGRESSION_TYPES: REGRESSION_TYPES,
        REGRESSION_TYPE_OPTIONS: REGRESSION_TYPE_OPTIONS,
        getFullName: getFullName,
        getAggIndex: getAggIndex,
        defaultChartOptions: defaultChartOptions,
        chartTooltip: chartTooltip,
        isAllowedDataForChartType: isAllowedDataForChartType,
        calculateCoordsForRegressions: calculateCoordsForRegressions,
        removeCalculate: removeCalculate
    }
});