define(['./module', 'angular'], function(module, angular) {
    module.service('FlowService', ['SourceService', function (SourceService) {

        function create(bookmark, source, columns, dataSummary){

            let input = {
                "id": 'INPUT_0',
                "label": source.name,
            };
            if(dataSummary.queryMode){
                input.type = "html.QueryInputNode";
                input.settings = {
                    "@class": ".DbQueryInputNodeSettings",
                    "uploadId": source.parentId ? source.parentId : source.id,
                    "queryId": source.queryId,
                    "query": dataSummary.query,
                    "columns": columns,
                    "transforms": []
                }
            } else if(dataSummary.tableMode || SourceService.isDbTableSource(source)){
                input.type = "html.TableInputNode";
                input.settings = {
                    "@class": ".DbTableInputNodeSettings",
                    "uploadId": source.parentId,
                    "tableId": source.tableId ? source.tableId : source.id,
                    "columns": columns,
                    "transforms": []
                }
            } else {
                input.type = "html.SourceInputNode";
                input.settings = {
                    "@class": ".InputNodeSettings",
                    "uploadId": source.id,
                    "columns": columns,
                    "transforms": []
                }
            }
            let flow = {
                "cells": [
                    input,
                    {
                        "id": 'OUTPUT',
                        "type": "html.OutputNode",
                        "label": 'Output',
                        "settings": {
                            "@class": ".OutputNodeSettings",
                            "bookmarkId": bookmark.id,
                            "columns": [],
                            "transforms": []
                        }
                    },
                    {
                        "type": "link",
                        "source": {
                            "id": 'INPUT_0'
                        },
                        "target": {
                            "id": 'OUTPUT'
                        },
                        "id": 'LINK_0'
                    }
                ]
            };

            return angular.toJson(flow);
        }

        function isQueryInputNode(node) {
            return node.type == "html.QueryInputNode";
        }

        function isTableInputNode(node) {
            return node.type == "html.TableInputNode";
        }

        return {
            create,
            isQueryInputNode,
            isTableInputNode
        };
    }]);
});