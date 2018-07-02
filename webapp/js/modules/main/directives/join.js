define(['./module'], function (directives) {
    'use strict';
    directives.directive('join', function () {
        return {
            restrict: 'E',
            scope: {
                "model": '=',
                "uploads": '='
            },
            templateUrl: 'static/templates/include/join.html',
            link: function ($scope, elm) {

                $scope.joinTypes = [
                    {name: "INNER JOIN", value: 'INNER'},
                    {name: "LEFT OUTER JOIN", value: 'LEFT_OUTER'},
                    {name: "RIGHT OUTER JOIN", value: 'RIGHT_OUTER'},
                    {name: "FULL OUTER JOIN", value: 'FULL_OUTER'}
                ];

                $scope.getUploads = function(){
                    return _.map($scope.uploads, function(o){return o.id});
                };

                $scope.getUploadsLeft = function(include){
                    var all = $scope.getUploads();
                    var selected = _.map($scope.model.joins, function(o){return o.upload});
                    if($scope.model.from){
                        selected.push($scope.model.from);
                    }
                    var ids = _.difference(all, selected);
                    if(include){
                        ids.push(include);
                    }
                    var result = [];
                    _.forEach($scope.uploads, function(u){
                        if(_.includes(ids, u.id)){
                            result.push(u);
                        }
                    });
                    return result;
                };

                function getFullHeaders(upload){
                    if(!upload) return [];
                    var table = _.find($scope.uploads, {id: upload});
                    if(!table || !table.headers) return [];
                    return _.map(table.headers, function(h){ return {id: table.id + '.' + h, name: table.name + '.' + h}});
                }

                $scope.getLeftKeys = function(idx){
                    var headers = getFullHeaders($scope.model.from);
                    for (var i = 0; i < idx; i++) {
                        headers = headers.concat(getFullHeaders($scope.model.joins[i].upload))
                    }
                    return headers;
                };

                $scope.getRightKeys = function(idx){
                    return getFullHeaders($scope.model.joins[idx].upload);
                };

                $scope.addJoin = function(){
                    $scope.model.joins.push({});
                };

                $scope.deleteJoin = function(idx){
                    $scope.model.joins.splice(idx, 1);
                }
            }
        }
    });
});
