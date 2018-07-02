define(['./module', 'highcharts', 'chartCommons', 'leaflet', 'lodash', 'angular', 'common', 'latlon-geohash'], function (directives, Highcharts, chartC, L, _, angular, cc, Geohash) {
    directives.directive('vizChart', [function() {
        return {
            restrict: 'A',
            templateUrl: 'static/templates/include/viz-directives/viz-chart.html',
            controller: ['$scope', '$timeout', '$filter', '$compile', '$q', 'CodesService', '$http', 'ExportService', 'DataLoadingService', function($scope, $timeout, $filter, $compile, $q, CodesService, $http, ExportService, DataLoadingService) {
                var chart, map, mapChoropleth, mapMarkers;
                var defaultChartOptions = chartC.defaultChartOptions(false, $scope, $timeout, $filter, true);
                var bounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));
                var CHART_TYPES = chartC.CHART_TYPES;
                $scope.CHART_TYPE_OPTIONS = cc.getViewModeOptions();

                var ctrlNames = cc.getCtrlNames();

                var getZoom = function(event){
                    return event.target._zoom;
                };

                var getPrecisionForZoom = function(zoom){
                    if(zoom <= 3) {
                        return 1;
                    } else if (zoom <= 5) {
                        return 2;
                    } else if (zoom <= 7) {
                        return 3;
                    } else if (zoom <= 9) {
                        return 4;
                    } else if (zoom <= 11) {
                        return 5;
                    } else if (zoom <= 14) {
                        return 6;
                    } else if (zoom <= 18) {
                        return 7;
                    } else if (zoom <= 20) {
                        return 9;
                    } else {
                        return 10;
                    }
                };

                var getRectangle = function (zoom, bbox) {
                    if (zoom > 2) {
                        return {
                            top_left: {lat: bbox._northEast.lat, lon: bbox._southWest.lng},
                            bottom_right: {lat: bbox._southWest.lat, lon: bbox._northEast.lng}
                        }
                    }
                };

                var setZoom = _.debounce(function(event){
                    var codeType = $scope.colsTypes[$scope.vizSummary.xAxisShows[0].field].toLowerCase();
                    var agg = $scope.dataSummary.aggs[0];
                    if(agg) {
                        if (codeType == 'location_lat_lon') {
                            var zoom = getZoom(event),
                                precision = getPrecisionForZoom(zoom);
                            if (precision != $scope.dataSummary.aggs[0].precision) {
                                $scope.dataSummary.aggs[0].precision = precision;
                                agg.box = getRectangle(zoom, map.getBounds());
                                $scope.searching();
                            }
                        } else {
                            agg.box = undefined;
                        }
                    }
                }, 500);

                var setPan = _.debounce(function(event) {
                    var codeType = $scope.colsTypes[$scope.vizSummary.xAxisShows[0].field].toLowerCase();
                    var agg = $scope.dataSummary.aggs[0];
                    if (typeof agg != 'undefined') {
                        if (codeType == 'location_lat_lon') {
                            agg.box = getRectangle(getZoom(event), map.getBounds());
                            $scope.searching();
                        } else {
                            agg.box = undefined;
                        }
                    }
                }, 500);

                // todo restore
                // $('document').ready(function () {
                //     $timeout(function() {
                //         chart = new Highcharts.Chart(defaultChartOptions);
                //         map = new L.map('map-container',{
                //             maxBounds: bounds,
                //             maxBoundsViscosity: 1.0
                //         });
                //         L.Icon.Default.imagePath = '/static/img/leaflet';
                //         L.tileLayer('//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                //             maxZoom: 21,
                //             minZoom: 2,
                //             noWrap: false,
                //             errorTileUrl: '/static/img/blank.png'
                //         }).addTo(map);
                //         map.setView(new L.LatLng(0, 0), 2);
                //         map.on('zoomend', function(e){
                //             if($scope.dataSummary.aggs.length) {
                //                 setZoom(e);
                //             }
                //         }).on('dragend', function(e){
                //             if($scope.dataSummary.aggs.length) {
                //                 setPan(e);
                //             }
                //         })
                //     })
                // });

                // no support for categories?
                // http://api.highcharts.com/highcharts#series<pie>.data
                function transformNamedData(groups, columns, allData){
                    if(!columns.length){
                        return [];
                    }
                    var group = groups[0];
                    var aggIndex = chartC.getAggIndex(groups, $scope.dataSummary.aggs);
                    var col = _.find(columns, 'active') || columns[0];
                    return [{name: col.name, key: col.key, data: _(allData)
                        .filter(function(o) { return col.operation ? $scope.getTreeLevel(o) == aggIndex : true })
                        .map(function(o){
                            return {
                                name: (o.aggregation || o[group.field]),
                                y: +(o[col.key]),
                                o: o
                            }
                        })
                        .filter(function(o) { return o.y; })
                        .value()}]
                }

                function getYAxisData(columns) {
                    var yAxis = {};

                    if ($scope.vizSummary.enabledMultiAxis) {
                        var i = 0;

                        yAxis = _.map(columns, function (col) {
                            var name = chartC.getFullName(col);
                            var color = Highcharts.getOptions().colors[i];

                            return {
                                labels: {
                                    style: {
                                        color: color
                                    },
                                    useHtml: true
                                },
                                title: {
                                    text: name,
                                    style: {
                                        color: color
                                    }
                                },
                                opposite: !(i++ % 2)
                            };
                        });
                    }
                    return yAxis;
                }

                $scope.getTreeLevel = function(o){
                    return $scope.dataSummary.showAggregationTotal ? o.__treeLevel - 1 : o.__treeLevel;
                };

                function transformData(groups, columns, segments, allData){
                    // return empty series if still expanding
                    console.time('segmenting')
                    var aggIndex = chartC.getAggIndex(groups, $scope.dataSummary.aggs),
                        col = _.find(columns, 'active') || columns[0];
                    if(segments.length){
                        // get 10 top used segments
                        var segmentIndex = chartC.getAggIndex(segments, $scope.dataSummary.aggs);
                        var segmentData = _.filter(allData, {'__treeLevel': $scope.dataSummary.showAggregationTotal ? segmentIndex + 1 : segmentIndex});
                        var counts = _.countBy(segmentData, function(o){
                            return o[segments[0].key];
                        });
                        var topCounts = [];
                        _.forIn(counts, function(count, value){
                            topCounts.push({
                                name: value,
                                count: count
                            })
                        });
                        var useOther = false;
                        if(topCounts.length > 10){
                            useOther = true;
                        }
                        _.sortBy(topCounts, 'count');
                        topCounts = _.take(topCounts, 10);
                        if(useOther){
                            topCounts.push({name: '$$other'});
                        }
                        //console.log(topCounts);
                        var segmentsData = {};
                        _.each(topCounts, function(s){
                            segmentsData[s.name] = [];
                        });

                        var currentItem = {'$$other': {value: 0, o: {}}};
                        var copyCurrent = function(){
                            _.forIn(segmentsData, function(data, segment){
                                data.push(currentItem[segment]);
                            })
                        };

                        for(var i = 0; i < allData.length; i++){
                            var o = allData[i];
                            if($scope.getTreeLevel(o) == aggIndex && i > 0){
                                copyCurrent();
                                currentItem = {'$$other': {value: 0, o: {}}};
                            } else {
                                if($scope.getTreeLevel(o) == segmentIndex && col && o[col.key]){
                                    currentItem['$$other'].o[groups[0].key] = o[groups[0].key];
                                    var segment = o[segments[0].key],
                                        value = o[col.key];
                                    if(segmentsData[segment]){
                                        currentItem[segment] = {value: value, o: o};
                                    } else {
                                        currentItem['$$other'].value += value;
                                    }
                                }
                            }
                        }
                        if(i > 0) {
                            copyCurrent();
                        }
                        var a = _.map(topCounts, function (s) {
                            var name = s.name == '$$other' ? 'Other' : s.name;
                            return {
                                name: name,
                                key: segments[0].key,
                                data: _.map(segmentsData[s.name], function (o) {
                                    return {
                                        name: name,
                                        otherChart: s.name == '$$other',
                                        y: o ? parseFloat(o.value) : null,
                                        o: o ? o.o : null
                                    }
                                })
                            };
                        });
                        console.timeEnd('segmenting')
                        return a;
                    } else {
                        var i = 0;

                        return _.map(columns, function (col) {
                            var name = chartC.getFullName(col),
                                type = undefined;
                            switch($scope.vizSummary.seriesType[col.key]){
                                case CHART_TYPES.LINE:
                                    type = 'line';
                                    break;
                                case CHART_TYPES.AREA:
                                    type = 'area';
                                    break;
                                case CHART_TYPES.COLUMN:
                                    type = 'column';
                                    break;
                            }
                            var obj =  {
                                name: name,
                                type: type,
                                key: col.key,
                                data: _(allData)
                                    .filter(function (o) {
                                        return col.operation ? $scope.getTreeLevel(o) == aggIndex : true
                                    })
                                    .map(function (o) {
                                        return {
                                            name: name,
                                            y: o[col.key] ? parseFloat(o[col.key]) : null,
                                            o: o
                                        }
                                    })
                                    .value()
                            };

                            if ($scope.vizSummary.enabledMultiAxis) {
                                obj = _.merge(obj, { yAxis: i++ });
                            }
                            return obj;
                        });
                    }
                }

                function getCategories(groups, allData){
                    if(groups.length){
                        var aggIndex = chartC.getAggIndex(groups, $scope.dataSummary.aggs);
                        return _(allData).filter(function(o){
                            return $scope.getTreeLevel(o) == aggIndex;
                        }).map(function(o){
                            return (o[groups[0].field] || o.aggregation);
                        }).value();
                    }
                    return [];
                }

                function getCategoriesFromRawData(xAxisItems, allData, yAxisItems){
                    if($scope.vizSummary.chartType != CHART_TYPES.SCATTER && xAxisItems.length){
                        return _(allData).map(function(o){
                            return (o[xAxisItems[0].field] || o.aggregation);
                        }).uniq().value();
                    } else if($scope.vizSummary.chartType == CHART_TYPES.SCATTER) {
                        var str;
                        if($scope.dataSummary.aggs.length) {
                            str = [xAxisItems[0].showListView + " " + xAxisItems[0].name + " & " + yAxisItems[0].showListView + " " + yAxisItems[0].name]
                        } else {
                            str = [xAxisItems[0].showListView + " & " + yAxisItems[0].showListView];
                        }
                        return str;
                    }
                }

                function transformScatteredData(groups, columns, allData){
                    var categories = getCategoriesFromRawData(groups, allData, columns);

                    var obj = _.map(categories, function (cat) {
                        var col1 = groups[0], col2 = columns[0],
                            catData = _(allData).map(function (o) {
                                if(o[col1.key] && o[col2.key]) {
                                    return {
                                        x: parseFloat(o[col1.key].toFixed(2)),
                                        y: parseFloat(o[col2.key].toFixed(2)),
                                        o: o
                                    }
                                }
                            }).value();
                        _.remove(catData, function(o) {
                            return typeof o == 'undefined';
                        })
                        return {name: '' + cat, data: _.sortBy(catData, function(o) {
                            return o.x;
                        })}
                    });

                    if ($scope.vizSummary.regressionType != null) {
                        var col1 = groups[0], col2 = columns[0];
                        _.remove(allData, function(o) {
                            return o[col1.key] == null || o[col2.key] == null
                        })
                        var regressiveObj = _.map(categories, function (cat) {
                            var catData = _(allData).map(function (o) {
                                return [
                                    o[col1.key],
                                    o[col2.key]
                                ]
                            }).value();

                            // TODO: uncomment in vistualizationCtrl
                            var type = $scope.REGRESSION_TYPE_OPTIONS[$scope.vizSummary.regressionType].desc.toLowerCase();

                            var regData = regression(type, catData);

                            var data = _.sortBy(_.map(regData.points, function (o, i) {
                                return {
                                    x: !isNaN(o[0]) && angular.isNumber(o[0]) ? +o[0].toFixed(2) : o[0],
                                    y: !isNaN(o[1]) && angular.isNumber(o[1]) ? +o[1].toFixed(2) : o[1],
                                    o: allData[i]
                                }
                            }), 'x');

                            if(!data.length) return {name: 'Loading...'};

                            return chartC.calculateCoordsForRegressions(data, $scope.vizSummary.regressionType, regData, allData);
                        });

                        obj.push(regressiveObj[0]);
                    }

                    return obj;
                }

                $scope.resizeChart = function(){
                    if(!chart || !chart.xAxis) return;
                    if($scope.vizSummary.chartType != CHART_TYPES.TABLE && $scope.vizSummary.chartType != CHART_TYPES.LIST) {
                        if ($scope.vizSummary.chartType != CHART_TYPES.MAP && $scope.vizSummary.yAxisShows.length) {
                            var $parent = $(chart.container).parent();
                            chart.setSize($parent.width(), $parent.height(), false)
                        } else {
                            map.invalidateSize();
                        }
                    }
                }

                $scope.setActive = function(key) {
                    $scope.vizSummary.yAxisShows.forEach(function(el) {
                        el.active = el.key == key;
                    });
                }

                $scope.createChartTotals = function(){
                    // set active metric as first one if not set already
                    if ($scope.vizSummary.yAxisShows.length
                        && !_.some($scope.vizSummary.yAxisShows, {active: true})) {
                        $scope.setActive($scope.vizSummary.yAxisShows[0].key);
                    }

                    $scope.chartTotals = _.map($scope.vizSummary.yAxisShows, function (show) {
                        return $scope.totals ? {name: chartC.getFullName(show), key: show.key, show: show, total: $scope.totals[show.key]} : {};
                    })
                }

                function tooltipHTML() {
                    return '<div ng-mousemove="$event.stopPropagation()" class="custom-tooltip">\n    <div class="tooltip-header">\n        <span><strong ng-bind="chartTooltip.mapData.name"></strong> : {{chartTooltip.mapData.value}}</span>\n    </div>\n    <div>\n        <div class="dropdown-menu-right">\n            <div class="dropdown-submenu">\n                <div class="drill-in-menu-item" ng-click="$event.stopPropagation()"><strong>Drill in</strong> by</div>\n                <ul class="dropdown-menu drill-in-menu" ng-style="{\'border-color\': chartTooltip.color}">\n                    <li ng-repeat="intoColumn in filterList" ng-if="intoColumn.name != chartTooltip.byColumn.name">\n                        <a ng-click="drillDown(chartTooltip.byColumn, chartTooltip.byValue, intoColumn, true, chartTooltip.row)"\n                           class="drill-in-menu-item">\n                            {{humanize(intoColumn.name)}}</a>\n                    </li>\n                </ul>\n            </div>\n            <div class="drill-in-menu-item" ng-click="selectFromResults(chartTooltip.byColumn, chartTooltip.byValue, false, chartTooltip.row)">\n                <strong>Filter</strong> to value\n            </div>\n            <div class="drill-in-menu-item" ng-click="selectFromResultsRemove(chartTooltip.byColumn, chartTooltip.byValue, chartTooltip.row)">\n                <strong>Exclude</strong> this value\n            </div>\n            <div class="drill-in-menu-item" ng-click="openModalFromTooltip(chartTooltip)">\n                <strong>View</strong> data\n            </div>\n        </div>\n    </div>\n</div>';
                }

                function transformLatLonMapData(groups, columns, data) {
                    var popup = L.popup({closeButton: false, className: 'map-popup', maxWidth:500})
                        .setContent($compile(angular.element(tooltipHTML()))($scope)[0]);

                    return _(data).filter(function(o){
                        return o[groups[0].field];
                    }).map(function(o){
                        var coors;
                        if($scope.dataSummary.aggs.length){
                            coors = Geohash.decode(o[groups[0].field]);
                            coors = {lat: coors.lat, lon: coors.lon};
                        } else {
                            coors = {lat: o[groups[0].field][0], lon: o[groups[0].field][1]};
                        }
                        var marker = L.marker(new L.LatLng(coors.lat, coors.lon), {data: o});
                        marker.bindPopup(popup);
                        marker.on('click', function(e){
                            $scope.$apply(function(){
                                var key = _.find($scope.gridApi.grid.columns, {name: groups[0].field});
                                $scope.chartTooltip.popup = popup;
                                $scope.chartTooltip.viewData = false;
                                $scope.chartTooltip.values = _.map($scope.gridOptions.columnDefs, function(col){
                                    var value = o[col.name];
                                    return {name: col.displayName, value: value}
                                });
                                $scope.chartTooltip.row = key ? undefined : {entity: o};
                                $scope.chartTooltip.byColumn = key;
                                $scope.chartTooltip.byValue = o[groups[0].field];



                                var name = o.aggregation || o[$scope.vizSummary.xAxisShows[0].key];
                                if (Array.isArray(name) ) {
                                    name = name[0].toFixed(2) + ', ' + name[1].toFixed(2);
                                }

                                $scope.chartTooltip.mapData = {
                                    name: name,
                                    value: o[$scope.vizSummary.yAxisShows[0].key]
                                }
                            });
                            $timeout(function(){
                                popup.update();
                            })
                        });
                        return marker;
                    }).value();
                }

                function getCommonCountryCodesData(codeKey, valueKey, data) {
                    return _.map(data, function(el) {

                        var code = el[codeKey];
                        if (code.toUpperCase() != code) {
                            code = code.toUpperCase();
                        }

                        if (code.length != 3) {
                            code = CodesService.getReverseCode(code);
                        }

                        return {
                            code: code,
                            value: el[valueKey],
                            o: el,
                            key: codeKey
                        };
                    });
                }

                function transformAreasMapData(codeType, groups, columns, allData) {
                    var deferred = $q.defer(),
                        col = _.find(columns, 'active') || columns[0],
                        codeKey = groups[0].field,
                        valueKey = col.key,
                        keyType = 'id', mapType, data,
                        aggIndex = chartC.getAggIndex(groups, $scope.dataSummary.aggs);
                    switch(codeType){
                        case 'location_usa_state_codes':
                            mapType = 'us-states';
                            break;
                        case 'location_country_codes':
                            mapType = 'countries';
                            break;
                        default:
                            throw "Unknow map type: " + codeType;
                    }
                    data = _.filter(allData, function(o) { return col.operation ? $scope.getTreeLevel(o) == aggIndex : true })
                    if (codeType == 'location_country_codes') {
                        data = getCommonCountryCodesData(codeKey, valueKey, data);
                    } else {
                        data = _.map(data, function(el) {
                            return {
                                code: el[codeKey].toUpperCase(),
                                value: el[valueKey],
                                o: el,
                                key: codeKey
                            };
                        });
                    }
                    $http.get('static/geo/maps/' + mapType + '.geo.json', {cache : true})
                        .success(function(areasData){
                            // control that shows state info on hover
                            var info = L.control();

                            info.onAdd = function (map) {
                                this._div = L.DomUtil.create('div', 'map-info detailed');
                                this.update();
                                return this._div;
                            };

                            info.update = function (props) {
                                this._div.innerHTML = '<h4>' + col.showName + '</h4>' +  (props ?
                                    '<b>' + props.name + '</b><br />' + (props.value ? props.value : '-')
                                        : 'Hover over a ' + (codeType == 'location_country_codes' ? 'country' : 'state'));
                            };

                            // TODO: Uncomment this with tinycolor lib
                            var range = [], //cc.createColorRange(tinycolor('#FFEDA0'), tinycolor('#800026')),
                                minValue = round(_.min(data, 'value').value),
                                maxValue = round(_.max(data, 'value').value);
                            if(maxValue == minValue){
                                maxValue += 100;
                            }
                            var delta = maxValue - minValue;

                            function getColor(d) {
                                return d ? range[Math.floor(((d - minValue) / delta) * (range.length - 1))] : undefined;
                            }

                            function style(feature) {
                                return {
                                    weight: 2,
                                    opacity: 1,
                                    color: 'white',
                                    dashArray: '3',
                                    fillOpacity: feature.properties.value ? 0.7 : 0,
                                    fillColor: getColor(feature.properties.value)
                                };
                            }

                            function round(value){
                                if(value > 1) {
                                    var roundTo = 1,//parseInt(value).toString().length,
                                        c = Math.pow(10, roundTo);
                                    return Math.round(value / c) * c;
                                } else {
                                    return value;
                                }
                            }

                            function highlightFeature(e) {
                                var layer = e.target;

                                layer.setStyle({
                                    weight: 4,
                                    color: '#aaa',
                                    dashArray: ''
                                });

                                if (!L.Browser.ie && !L.Browser.opera) {
                                    layer.bringToFront();
                                }

                                info.update(layer.feature.properties);
                            }

                            function resetHighlight(e) {
                                geojson.resetStyle(e.target);
                                info.update();
                            }

                            function zoomToFeature(e) {
                                map.fitBounds(e.target.getBounds());
                            }

                            var popup = L.popup({closeButton: false, className: 'map-popup',maxWidth:500})
                                .setContent($compile(angular.element(tooltipHTML()))($scope)[0]);

                            function onEachFeature(feature, layer) {
                                layer.on({
                                    mouseover: highlightFeature,
                                    mouseout: resetHighlight,
                                    click: function(e){
                                        if(feature.properties.o) {
                                            $scope.$apply(function () {
                                                var key = _.find($scope.gridApi.grid.columns, {name: feature.properties.key});
                                                $scope.chartTooltip.popup = popup;
                                                $scope.chartTooltip.viewData = false;
                                                $scope.chartTooltip.color = '';
                                                $scope.chartTooltip.values = _.map($scope.gridOptions.columnDefs, function (col) {
                                                    var value = feature.properties.o[col.name];
                                                    return {name: col.displayName, value: value}
                                                });
                                                $scope.chartTooltip.row = key ? undefined : {entity: feature.properties.o};
                                                $scope.chartTooltip.byColumn = key;
                                                $scope.chartTooltip.byValue = feature.properties.o[feature.properties.key];
                                                $scope.chartTooltip.mapData = {
                                                    name: feature.properties.name,
                                                    value: feature.properties.value
                                                }
                                            });
                                            //zoomToFeature(e) todo restore??
                                        }
                                    }
                                });
                                if(feature.properties.value) {
                                    layer.bindPopup(popup);
                                }
                            }

                            // merge geojson with data by keyType
                            _.each(areasData.features, function (feature){
                                var key = feature[keyType],
                                    o = _.find(data, {code: key});
                                // todo this needs refactoring
                                _.merge(feature, {properties: {o: o ? o.o : undefined, key: o ? o.key : undefined, value: o ? o.value : undefined}});
                            });

                            var geojson = L.geoJson(areasData, {
                                style: style,
                                onEachFeature: onEachFeature
                            });

                            var legend = L.control({position: 'bottomright'});

                            legend.onAdd = function (map) {

                                var div = L.DomUtil.create('div', 'map-info legend'),
                                    grades = [],
                                    labels = [],
                                    from, to,
                                    total = 8;
                                var i, step = (maxValue - minValue) / total;
                                for(i = 0; i < total; i++){
                                    grades.push(round(minValue + i * step));
                                }
                                for (i = 0; i < grades.length; i++) {
                                    from = grades[i];
                                    to = grades[i + 1];
                                    labels.push(
                                        '<i style="background:' + getColor(from + 1) + '"></i> ' +
                                        from + (to ? '&ndash;' + to : '+'));
                                }

                                div.innerHTML = labels.join('<br>');
                                return div;
                            };
                            deferred.resolve([geojson, legend, info]);
                        });

                    return deferred.promise;
                }

                getAllRowsData = function(nodes) {
                    var arr = _.map(nodes, function (node) {
                        return _.omit(node, '$$children');
                    });


                    _.forEach(nodes, function (node) {
                        if (node.$$children.length) {
                            arr = arr.concat(getAllRowsData(node.$$children))
                        }
                    });

                    return arr;
                }

                $scope.updateChart = function (){
                    if($scope.popupData && $scope.popupData.is) return;

                    function applyChartType(type, groups, cols, segments, data, chartOptions){

                        function generateDataForPieChart(data) {
                            data[0].data = _.sortByOrder(data[0].data, ['y'], ['desc']);

                            if(data[0].data.length > 10) {
                                var otherData = data[0].data.slice(10);
                                data[0].data = data[0].data.slice(0, 10);

                                data[0].data.push({
                                    name: "Other",
                                    y: _.sum(otherData, function(n) {
                                        return n.y;
                                    }),
                                    otherChart: true,
                                    color: 'rgb(' + Math.floor(Math.random() * 200) + ', ' + Math.floor(Math.random() * 200) + ', ' + Math.floor(Math.random() * 200) + ')'
                                })
                            }

                            return data;
                        }

                        function applyNamedData(options) {
                            return _.merge({}, options, {
                                series: generateDataForPieChart(transformNamedData(groups, cols, data))
                            })
                        }

                        function applyData(options){
                            return _.merge({}, options, {
                                yAxis: getYAxisData(cols),
                                series: transformData(groups, cols, segments, data)
                            });
                        }

                        function applyDataWithCategories(options){
                            return _.merge({}, options, {
                                xAxis: {
                                    categories: getCategories(groups, data)
                                },
                                yAxis: getYAxisData(cols),
                                series: transformData(groups, cols, segments, data)
                            });
                        }

                        function applyScatteredData(options) {
                            var col1 = groups[0], col2 = cols[0];
                            return _.merge({}, options, {
                                xAxis: {
                                    title: {
                                        enabled: true,
                                        text: col1.name
                                    }
                                },
                                yAxis: {
                                    title: {
                                        text: col2.name
                                    }
                                },
                                series: transformScatteredData(groups, cols, data)
                            })
                        }

                        // clear map rectangle filter
                        if (type !== CHART_TYPES.MAP && !_.isEmpty($scope.dataSummary.aggs)) {
                            var agg = $scope.dataSummary.aggs[0];
                            if (agg.box) {
                                delete agg.box;
                                $scope.searching();
                            }
                        }

                        switch (type) {
                            case CHART_TYPES.COLUMN:
                                return _.merge({}, applyDataWithCategories(chartOptions), {
                                    chart: {
                                        type: 'column',
                                        zoomType: 'x',
                                        panning: true,
                                        panKey: 'shift'
                                    },
                                    plotOptions: {
                                        column: {
                                            stacking: segments.length ? 'normal' : null
                                        }
                                    }
                                });
                            case CHART_TYPES.BAR:
                                return _.merge({}, applyDataWithCategories(chartOptions), {
                                    chart: {
                                        type: 'bar',
                                        zoomType: 'x',
                                        panning: true,
                                        panKey: 'shift'
                                    },
                                    plotOptions: {
                                        series: {
                                            stacking: segments.length ? 'normal' : null
                                        }
                                    },
                                    scrollbar: {enabled: false},
                                    navigator: {enabled: false}
                                });
                            case CHART_TYPES.LINE:
                                return _.merge({}, applyData(chartOptions), {
                                    chart: {
                                        type: 'line',
                                        zoomType: 'x',
                                        panning: true,
                                        panKey: 'shift'
                                    },
                                    plotOptions: {
                                        line: {
                                            stacking: segments.length ? 'normal' : null
                                        }
                                    }
                                });
                            case CHART_TYPES.AREA:
                                return _.merge({}, applyData(chartOptions), {
                                    chart: {
                                        type: 'area',
                                        zoomType: 'x',
                                        panning: true,
                                        panKey: 'shift'
                                    },
                                    plotOptions: {
                                        area: {
                                            stacking: segments.length ? 'normal' : null
                                        }
                                    }
                                });
                            case CHART_TYPES.PIE:
                                return _.merge({}, applyNamedData(chartOptions), {
                                    chart: {
                                        type: 'pie'
                                    },
                                    plotOptions: {
                                        series: {
                                            allowPointSelect: true,
                                            cursor: 'pointer'
                                        }
                                    },
                                    scrollbar: {enabled: false},
                                    navigator: {enabled: false}
                                });
                            case CHART_TYPES.SCATTER:
                                return _.merge({}, applyScatteredData(chartOptions), {
                                    chart: {
                                        type: 'scatter',
                                        zoomType: 'x'
                                    }
                                });
                            case CHART_TYPES.TABLE:
                            case CHART_TYPES.LIST:
                                break;
                            default:
                                throw "Unknown chart type: " + type;
                        }
                    }

                    var groups = _.filter($scope.vizSummary.xAxisShows, function(s){
                        return s.field != '$$row_number';
                    });
                    var cols = $scope.vizSummary.yAxisShows;
                    var segments = $scope.vizSummary.segmentBy;

                    var data = $scope.dataSummary.aggs.length
                        ? $scope.getAllRowsData($scope.gridOptions.rowData)
                        : $scope.gridOptions.data;
                    if($scope.vizSummary.graphLimit > 0){
                        if($scope.dataSummary.aggs.length && $scope.vizSummary.xAxisShows.length){
                            var aggIndex = chartC.getAggIndex($scope.vizSummary.xAxisShows, $scope.dataSummary.aggs),
                                i = 0;
                            data = _.takeWhile(data, function(o){ return $scope.getTreeLevel(o) != aggIndex || i++ < $scope.vizSummary.graphLimit})
                        } else {
                            data = _.take(data, $scope.vizSummary.graphLimit);
                        }
                    }

                    if(!$scope.isAllowedDataForChartType($scope.vizSummary.chartType, $scope, $scope.colsTypes)){
                        $scope.chartDisabled = {
                            message: cc.getViewModeOptions()[$scope.vizSummary.chartType].e
                        };
                        $scope.inRequestViz = false;
                        return;
                    } else {

                        if ($scope.vizSummary.yAxisShows.length) {
                            $timeout(function () {
                                if($scope.controllerName != 'embedPopupCtrl') $scope.resizeChart();
                            }, 100);
                        }
                        $scope.chartDisabled = null;
                    }

                    $scope.isArray = function(str) {
                        return _.isArray(str);
                    };

                    $scope.linksArrayForList = function(arr) {
                        return cc.linksArrayForList(arr);
                    };

                    $scope.createChartTotals();
                    if($scope.vizSummary.chartType == CHART_TYPES.MAP){
                        var codeType = $scope.colsTypes[groups[0].field].toLowerCase();
                        if(codeType == 'location_lat_lon') {
                            var markers = transformLatLonMapData(groups, cols, data),
                                newMapMarkers;

                            if($scope.dataSummary.aggs.length) {
                                newMapMarkers = new L.MarkerClusterGroup({
                                    singleMarkerMode: true,
                                    disableClusteringAtZoom: 1,
                                    iconCreateFunction: function (cluster) {
                                        var markers = cluster.getAllChildMarkers(),
                                            childCount = markers[0] ? markers[0].options.data['$$cluster_size'] : 1;
                                        var c = ' marker-cluster-';
                                        if (childCount < 10) {
                                            c += 'small';
                                        } else if (childCount < 100) {
                                            c += 'medium';
                                        } else {
                                            c += 'large';
                                        }

                                        return new L.DivIcon({
                                            html: '<div><span>' + childCount + '</span></div>',
                                            className: 'marker-cluster' + c,
                                            iconSize: new L.Point(40, 40)
                                        });
                                    }
                                })
                            } else {
                                newMapMarkers = L.markerClusterGroup();
                            }
                            newMapMarkers.addLayers(markers);
                            if(mapChoropleth) {
                                _.each(mapChoropleth, function(l) {l.remove() });
                            }
                            if(mapMarkers) {
                                map.removeLayer(mapMarkers);
                            }
                            mapMarkers = newMapMarkers;
                            map.addLayer(mapMarkers);
                        } else {
                            transformAreasMapData(codeType, groups, cols, data)
                                .then(function(newMapChoropleth){
                                    if(mapChoropleth) {
                                        _.each(mapChoropleth, function(l) {l.remove() });
                                    }
                                    if(mapMarkers) {
                                        map.removeLayer(mapMarkers);
                                    }
                                    mapChoropleth = newMapChoropleth;
                                    _.each(mapChoropleth, function(l) { l.addTo(map) })
                                    // usa view bbox
                                    if(codeType == 'location_usa_state_codes') {
                                        map.setView([37.8, -96], 4);
                                    } else if(codeType == 'location_country_codes') {
                                        map.setView(new L.LatLng(0, 0), 2);
                                    }
                                });
                        }
                        $scope.inRequestViz = false
                    } else {
                        $scope.chartOptions = applyChartType($scope.vizSummary.chartType, groups, cols, segments, data, {});
                        var mergedOpt = _.merge({}, defaultChartOptions, $scope.chartOptions);
                        chart = new Highcharts.StockChart(mergedOpt);
                    }
                }

                $scope.onVizResultsResize = function (size) {
                    if($scope.vizSummary.chartType != CHART_TYPES.TABLE && $scope.vizSummary.chartType != CHART_TYPES.LIST) {
                        if ($scope.vizSummary.chartType != CHART_TYPES.MAP && $scope.vizSummary.yAxisShows.length) {
                            chart.setSize(size.width, size.height, false);
                        } else {
                            map.invalidateSize();
                        }
                    }
                };

                $scope.exportData = function(e, type) {
                    e.stopPropagation();
                    e.preventDefault();

                    if ($scope.exportPopup) {
                        $scope.exportPopup.isopen = !$scope.exportPopup.isopen;
                    }

                    if(type == "CSV" || type == "XLS") {
                        $scope.isExportRunning = true;

                        ExportService.prepareExport(type, $scope, true);
                    }
                    else chart.exportChart({type: type});
                };

                $scope.updateChartSize = function() {
                    if (chart) {
                        var $parent = $(chart.container).parent();
                        chart.setSize($parent.width(), $parent.height(), false)
                    }
                };

                $scope.isAllowedDataForChartType = chartC.isAllowedDataForChartType;

                $scope.toggleMultiAxis = function () {
                    $scope.vizSummary.enabledMultiAxis = !$scope.vizSummary.enabledMultiAxis;

                    $scope.updateChart();
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                };

                $scope.xAxisShowMeOnRemove = function (item) {
                    _.remove($scope.vizSummary.xAxisShows, {key: item.key});
                    $scope.chartDisabled = null;
                    $timeout(function () {
                        if ($scope.vizSummary.yAxisShows.length) $scope.resizeChart();
                    }, 100);
                    // DataLoadingService.refreshXAxisShows($scope);
                    $scope.updateChart();
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                };

                $scope.xAxisShowMeOnSelect = function (item) {
                    $scope.vizSummary.xAxisShows = [item];
                    $scope.updateChart();
                    if($scope.controllerName == ctrlNames.VIZ) {
                        // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                    }
                };

                $scope.yAxisShowMeOnRemove = function (item) {
                    _.remove($scope.vizSummary.yAxisShows, {key: item.key});
                    // DataLoadingService.refreshYAxisShows($scope);
                    $scope.updateChart();
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                };

                $scope.yAxisShowMeOnSelect = function (item) {
                    if($scope.vizSummary.chartType == CHART_TYPES.SCATTER) $scope.vizSummary.yAxisShows = [item];
                    $scope.updateChart();
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                };

                $scope.segmentByOnRemove = function (item) {
                    $scope.vizSummary.segmentBy = [];
                    $scope.updateChart();
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                };

                $scope.segmentByOnSelect = function (item) {
                    $scope.vizSummary.segmentBy = [item];
                    _.remove($scope.dataSummary.aggs, {key: item.key});
                    var xIndex = _.findIndex($scope.dataSummary.aggs, {key: $scope.vizSummary.xAxisShows[0].key});
                    $scope.dataSummary.aggs.splice(xIndex + 1, 0, item);
                    DataLoadingService.resetAggs($scope.dataSummary.aggs, $scope);
                    $scope.vizSummary.chartType = CHART_TYPES.COLUMN;
                    $scope.vizSummary.seriesType = {};
                    // if($scope.controllerName == ctrlNames.VIZ) stateSaver.saveGraphSettings();
                    $scope.saveColumnDefs();
                    $scope.expandOnDrillDown = true;
                    $scope.searching();
                };
            }]
        }
    }]);
});