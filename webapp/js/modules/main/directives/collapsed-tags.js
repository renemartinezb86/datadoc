define(['./module', 'angular', 'lodash'], function (directives, angular, _) {
    'use strict';
    directives.directive('collapsedTags', ['$compile', '$filter', '$timeout', '$rootScope', 'FilterService', function ($compile, $filter, $timeout, $rootScope, FilterService) {
        return {
            restrict: 'A',
            link: function ($scope, $elm, $attr) {

                var generatedCollapsedTags = '';

                $scope.$watch(
                    function(scope) {
                        return generatedCollapsedTags;
                    },
                    function() {
                        rebuild();
                    }
                );

                function rebuild() {
                    $elm.html(generatedCollapsedTags);
                    $compile($elm.contents())($scope);
                    $scope.$emit('DoTableLayout');
                }

                $rootScope.$on('DoRebuildCollapsedTags', function () {
                    $scope.$emit('DoTableLayout');
                    $scope.getCollapsedTagsHtml();
                    rebuild();
                });


                 function getFiltersTags() {
                    var tags = [],
                        allWidth = 0;

                    if ($scope.isVisibleForRow()) {

                        if ($scope.dataSummary.search) {
                            var search = 'search = "'+$scope.dataSummary.search+'", ',
                                template = getCollapsedTagsTemplate(search),
                                width = getRenderedTemplateWidth(template);

                            allWidth += width;
                            tags.push({
                                width: width,
                                template: template
                            });
                        }

                        if ($scope.dataSummary.aggs[0] && $scope.dataSummary.aggs[0].box) {
                            var agg = $scope.dataSummary.aggs[0],
                                template = getCollapsedTagsTemplate(getBoxString(agg)),
                                width = getRenderedTemplateWidth(template);

                            allWidth += width;
                            tags.push({
                                width: width,
                                template: template
                            });
                        }

                        _.forEach($scope.dataSummary.filters, function (filter, index) {
                            if (FilterService.isFilterActive(filter)) {
                                var template = getCollapsedTagsTemplate(getFilterTemplate(filter)+', '),
                                    width = getRenderedTemplateWidth(template);

                                allWidth += width;

                                tags.push({
                                    width: width,
                                    template: template
                                });
                            }
                        });
                    }

                    // remove last comma
                    if (tags.length) {
                        tags[tags.length-1].template = tags[tags.length-1].template.slice(0, -9)+'</span>';
                    }

                    return {
                        tags: tags,
                        allWidth: allWidth
                    }
                }

                function getRenderedTemplateWidth(template) {
                    var renderedElement = $(template).appendTo(document.body),
                        width = renderedElement.width();
                    renderedElement.remove();
                    return width;
                }

                function getAggFilter(agg) {
                    return '<span '+(!agg.show ? 'class="filter-removed"': '')+'>'
                        +(agg.key ? '"'+agg.key+'"' : '"[Empty Value]"')
                        +'</span>';
                }

                function getListAggFilter(agg, type) {
                    var template = '<span '+(!agg.show ? 'class="filter-removed"': '')+'>"';

                    if (agg.key != null) {
                        switch (type) {
                            case 'DATE':
                                template += ($filter('date')(agg.key, 'mediumDate') + '');
                                break;
                            case 'BOOLEAN':
                                if (agg.key == 0) {
                                    template += 'No'
                                } else {
                                    template += 'Yes'
                                }
                                break;
                            default:
                                template += (agg.key + '');
                                break;
                        }
                    } else {
                        template += '[Empty value]';
                    }

                    template += '"</span>';

                    return template;
                }

                function getFilterTemplate(filter) {
                    var template = '<span>';


                    if (!filter.listMode) {
                        switch (filter.col.type) {
                            case 'LOCATION_LAT_LON':
                                var selectedFilters = $scope.getSelectedFilters(filter.list);
                                _.forEach(selectedFilters, function (agg, index) {
                                    template += getAggFilter(agg);

                                    if (index + 1 != selectedFilters.length) {
                                        template += '<span>' + (filter.and_or ? 'and' : 'or') + '</span>';
                                    }
                                });
                                break;
                            case 'DECIMAL':
                                template += '<span>' + filter.col.name + ' = '
                                    + $filter('formatCell', filter.value1, filter.col)
                                    + ' - '
                                    + $filter('formatCell', filter.value2, filter.col) + '</span>'
                                break;
                            case 'TIME':
                                template += '<span>' + filter.col.name + ' = ' + $filter('date')(filter.value1, 'HH:mm:ss', 'UTC') + ' - ' + $filter('date')(filter.value2, 'HH:mm:ss', 'UTC') + '</span>';
                                break;
                            case 'DATE':
                                template += '<span>' + filter.col.name + ' = ' + $filter('date')(filter.value1, 'mediumDate', 'UTC') + ' - ' + $filter('date')(filter.value2, 'mediumDate', 'UTC') + '</span>';
                                if( filter.options.period) {
                                    template += ' <i>(' + filter.options.period.label + ')</i>'
                                }
                                break;
                        }
                    } else {

                        template += '<span>'+filter.col.name+' = ';

                        var selectedFilters = FilterService.getSelectedFilters(filter.list);
                        _.forEach(selectedFilters, function (agg, index) {

                            template += getListAggFilter(agg, filter.col.type);


                            if (index + 1 != selectedFilters.length) {
                                template += '<span>' + (filter.and_or ? ' and ' : ' or ') + '</span>';
                            }
                        });

                        template += '</span>';
                    }


                    template += '</span>';

                    return template;
                }

                function getBoxString(agg) {
                    return agg.displayName
                        +' = ['
                        +(agg.box.top_left.lon).toFixed(2)
                        +','
                        +agg.box.top_left.lat.toFixed(2)
                        +'] - ['
                        +agg.box.bottom_right.lon.toFixed(2)
                        +','
                        +agg.box.bottom_right.lat.toFixed(2)
                        +']';
                }

                function getCollapsedTagsTemplate(text) {
                    return '<span class="collapsed-tags-tag">'+text+'</span>'
                }

                function getSortShowName(col, type, axis) {
                    var showName = [];
                    var sort = col.id.settings.sort;

                    if (type == 'shows') {
                        showName.push('<span>'+col.displayName+' '+sort.direction+'</span>');
                    } else {
                        showName.push(col.displayName);
                        var show = _.find($scope.dataSummary.shows, {key: sort.field});

                        if (sort.aggKeyPath) {

                            if (sort.isCount) {
                                showName.push(' Count in ');
                            } else if (show) {
                                showName.push(' '+show.showName+' in ');
                            }

                            if (sort.aggKeyPath.length) {
                                showName.push(sort.aggKeyPath.join(' > '));

                                if (sort.aggKeyPath.length != axis.length) {
                                    showName.push(' > Total');
                                }

                            } else {
                                showName.push(' Grand Total');
                            }

                        } else {
                            if (sort.isCount) {
                                showName.push(' Count');
                            } else if (sort.field && show) {
                                showName.push(' '+show.showName);
                            }
                        }

                        showName.push(' '+sort.direction);
                    }

                    return showName.join('');
                }

                function getSortItems () {
                    function getSortItem(agg, type, axis) {
                        return {
                            showName: getSortShowName(agg, type, axis)
                        }
                    }
                    var sortTagsArr,
                        model;

                    if ($scope.dataSummary.aggs.length || $scope.dataSummary.pivot.length) {
                        model = $scope.dataSummary.aggs.concat($scope.dataSummary.pivot);

                        sortTagsArr = _.map(model, function(tag) {
                            if (_.find($scope.dataSummary.aggs, tag)) {
                                return getSortItem(tag, 'aggs', $scope.dataSummary.pivot);
                            } else {
                                return getSortItem(tag, 'aggs', $scope.dataSummary.aggs);
                            }
                        });
                    } else {
                        model = _.sortBy(_.filter($scope.dataSummary.shows, function(show) {
                            return show.id.settings.sort;
                        }), 'id.settings.sort.priority');

                        sortTagsArr = _.map(model, function(tag) {
                            return getSortItem(tag, 'shows');
                        });
                    }

                    return sortTagsArr;
                }

                $scope.getCollapsedTagsHtml = function () {
                    var avaliableWidth = $elm.width();

                    var html = '';

                    var tags = [
                        {
                            key: "shows",
                            items: _.cloneDeep($scope.dataSummary.shows),
                            titleTemplate: "<span class='collapsed-tags-title-first'>Showing </span>",
                            tags: [],
                            alwaysShowing: 'No fields',
                            hide: $scope.hideCollapsedTags,
                            focusSelector: '#shows-select input'
                        },
                        {
                            key: "aggs",
                            items: _.cloneDeep($scope.dataSummary.aggs),
                            titleTemplate: "<span class='collapsed-tags-title'>broken down by </span>",
                            tags: [],
                            focusSelector: '#group-by-select input'
                        },
                        {
                            key: "pivot",
                            items: _.cloneDeep($scope.dataSummary.pivot),
                            titleTemplate: !$scope.dataSummary.aggs.length
                                ? "<span class='collapsed-tags-title'>broken down by </span>"
                                : "<span class='collapsed-tags-tag'>, </span>",
                            tags: [],
                            focusSelector: '#pivot-by input',
                            appendedToTag: ' (pivot)'
                        },
                        {
                            key: "filters",
                            items: _.cloneDeep($scope.dataSummary.filters),
                            titleTemplate: "<span class='collapsed-tags-title'>filtered by </span>",
                            tags: [],
                            focusSelector: '.show-me-for-tr td input',
                            customTagsCreator: getFiltersTags
                        },
                        {
                            key: "sort",
                            items: getSortItems(),
                            titleTemplate: "<span class='collapsed-tags-title'>sorted by </span>",
                            tags: [],
                            focusSelector: '.show-me-for-tr td input'
                        }

                    ];

                    _.forEach(tags, function(el, index) {
                        var items = el.items;

                        var length = items.length;
                        el.titleWidth = getRenderedTemplateWidth(el.titleTemplate);

                        if (length && !el.tags.length) {
                            var allTagsWidth = 0;

                            if (el.customTagsCreator) {

                                var customTagsCreated = el.customTagsCreator();

                                if (customTagsCreated.tags.length) {
                                    el.tags = customTagsCreated.tags;
                                    el.allTagsWidth = customTagsCreated.allWidth;
                                } else {
                                    delete tags[el.key];
                                }

                            } else {
                                _.forEach(items, function (tag, index) {
                                    var template = getCollapsedTagsTemplate(((tag.getShowName
                                            ? tag.getShowName()
                                            : tag.showName || tag.displayName)
                                        +(el.appendedToTag ? el.appendedToTag:'')+(index +1 != length ? ', ': '' ))),
                                        width = getRenderedTemplateWidth(template);

                                    allTagsWidth += width;

                                    el.tags.push({
                                        width: width,
                                        template: template
                                    });
                                });
                                el.allTagsWidth = allTagsWidth;
                            }

                        } else if (el.alwaysShowing) {
                            el.tags.push({
                                width: 10,
                                template: getCollapsedTagsTemplate(el.alwaysShowing)
                            });
                        }
                    });

                    tags = _.filter(tags, function (el, index) {
                        return index > 0 ? el.tags.length : true;
                    });

                    var widthForEachBlock = avaliableWidth / tags.length;

                    _.forEach(tags, function (el) {
                        if (el.allTagsWidth + el.titleWidth > widthForEachBlock) {
                            var removedElements = 0;
                            for (var i = el.tags.length - 1; i >= 0; --i) {
                                var tagWidth = el.tags[i].width;
                                el.tags.pop();
                                removedElements++;

                                el.allTagsWidth -= tagWidth;

                                if (el.allTagsWidth + el.titleWidth <= widthForEachBlock) {
                                    break;
                                }
                            }

                            var template = '<span class="collapsed-tags-tag"> ';

                            if (!el.tags.length) {
                                template += removedElements + ' column';
                            } else {
                                template += '& ' + removedElements + ' other';
                            }

                            template += (removedElements > 1 ? 's' : '' ) + '</span>';

                            el.tags.push({
                                width: 15,
                                template: template
                            })
                        }

                    });


                    if (tags.length == 1 && tags[0].hide) return;

                    tags[tags.length - 1].style = "width:100%; position: absolute;";

                    _.forEach(tags, function (el) {

                        html += '<span class="collapsed-tags-wrapper no-overflow" ';

                        if (el.style) {
                            html += 'style="'+el.style+'" ';
                        }

                        if (el.focusSelector) {
                            html += 'ng-mousedown="setShowCollapsedTags(false);setFocusElementBySelector(\''+el.focusSelector+'\', 0); $event.preventDefault();"';
                        }

                        html += '>'+el.titleTemplate;

                        _.forEach(el.tags, function(tag) {
                            html += tag.template
                        });
                        html += '</span>';

                    });

                    html += '</span>';

                    generatedCollapsedTags = html;
                    return generatedCollapsedTags;
                }

            }
        };
    }])
});
