define(['./module', 'lodash'], function(module, _) {
    module.factory('SourceService', ['$http', '$rootScope', '$q', 'UserStateService', function ($http, $rootScope, $q, UserStateService) {

        let sources = [],
            DEFAULT_LIMIT = 50,
            currentOffset = 0,
            currentOrderBy = null,
            selectedFolder = null,
            selectedFolderId = null,
            finishedLoading = false,
            gettingSources;

        function getPromise(options = {}){
            gettingSources = true;
            let showTypes = UserStateService.get().showTypesOptions;
            let orderBy = options.sort || currentOrderBy;
            let offset = options.offset || 0;
            let limit = options.limit || DEFAULT_LIMIT;
            let untilIdFound = options.untilIdFound;
            let sourcesOnly = _.get(options, 'sourcesOnly', showTypes.sourcesOnly);
            let foldersOnly = _.get(options, 'foldersOnly', showTypes.foldersOnly);
            let datadocsOnly = _.get(options, 'datadocsOnly', showTypes.datadocsOnly);
            return $http.post('/api/files/list_files', {
                offset: offset,
                limit: limit,
                orderBy: orderBy,
                path: 'id:' + (selectedFolderId ? selectedFolderId : ''),
                withDatadocs: true,
                sourcesOnly,
                foldersOnly,
                datadocsOnly
            }).then(function(response){
                currentOrderBy = orderBy;
                currentOffset = offset;
                let newPage = response.data;
                if(currentOffset == 0){
                    sources = [];
                    finishedLoading = false;
                }
                currentOffset += limit;
                sources = sources.concat(newPage);
                if(newPage.length < limit){
                    finishedLoading = true;
                }
                if(untilIdFound){
                    let found = !!_.find(newPage, item => item.id == untilIdFound);
                    if(!found){
                        return getPromise(_.merge(options, {offset: currentOffset}));
                    }
                    return newPage
                }
                gettingSources = false;
                return newPage;
            }).catch(e => {
                gettingSources = false;
                throw e;
            })
        }

        function getIcon(u){
            if (u.type === 'file') {
                if(u.descriptor) {
                    if(_.any(['x-sharp', 'x-java', 'javascript', 'x-python', 'x-ruby', 'x-c++src', 'x-chdr', 'x-php'],
                            function(type){
                                return _.contains(u.descriptor.contentType, type);
                            }) ||
                        _.contains(['c', 'cpp', 'h', 'cs', 'java', 'js', 'rb', 'py', 'clj', 'php'],
                            u.descriptor.extension))
                        return 'code';
                    else if (u.descriptor.extension === 'pdf')
                        return 'pdf';
                    else if (_.startsWith(u.descriptor.contentType, 'image'))
                        return 'image';
                    else if (_.startsWith(u.descriptor.contentType, 'text'))
                        return 'text';
                    else if (_.startsWith(u.descriptor.contentType, 'video'))
                        return 'video';
                    else if (_.endsWith(u.descriptor.contentType, 'pdf'))
                        return 'pdf';
                }
                return 'file';
            } else if (u.type === 'doc'){
                return 'index-icon'
            } else if (u.type === 'folder') {
                return 'folder'
            } else if (u.type === 'ds' || u.type === 'composite-ds' || u.type === 'section-ds') {
                switch (u.descriptor.format) {
                    case 'XLS':
                    case 'XLSX':
                    case 'XLS_SHEET':
                    case 'XLSX_SHEET':
                        return 'excel';
                    case 'CSV':
                        return 'csv';
                    case 'JSON_ARRAY':
                    case 'JSON_OBJECT':
                        return 'json';
                    case 'MYSQL':
                    case 'POSTGRESQL':
                    case 'MSSQL':
                    case 'ORACLE':
                        return 'db';
                    case 'MYSQL_TABLE':
                    case 'POSTGRESQL_TABLE':
                    case 'MSSQL_TABLE':
                    case 'ORACLE_TABLE':
                        return 'query';
                    case 'MYSQL_QUERY':
                    case 'POSTGRESQL_QUERY':
                    case 'MSSQL_QUERY':
                    case 'ORACLE_QUERY':
                        return 'query';
                    case 'XML':
                        return 'xml';
                    case 'AVRO':
                        return 'text';
                    default:
                        return 'code'
                }
            } else if (u.type === 'new_query'){
                return 'query';
            } else {
                return '';
            }
        }

        function getSourcePath(source){
            return '/' + _.map(source.parentsPath, function(p){
                return p.name;
            }).join('/')
        }

        function isExcelSource(source){
            return source && source.descriptor
                && _.includes(['XLS', 'XLSX'], source.descriptor.format);
        }

        function isDbSource(source){
            return source && source.descriptor
                && source.descriptor.remote
                && source.descriptor.composite
        }

        function isDbQuerySource(source){
            return source && source.descriptor
                && source.descriptor.remote
                && source.descriptor.section
                && source.descriptor.format.toLowerCase().endsWith('query');
        }

        const retrieveDbRelatedData = (sourceId) => {
            return $http.get(`/api/files/related_source_data/${sourceId}`).then(({data}) => data);
        };

        function isDbTableSource(source){
            return source && source.descriptor
                && source.descriptor.remote
                && source.descriptor.section
                && source.descriptor.format.toLowerCase().endsWith('table');
        }

        var state = {
            retrieveDbRelatedData,
            getSourcePath,
            isExcelSource,
            isDbSource,
            isDbQuerySource,
            isDbTableSource,
            getIcon,
            getList: function(){
                return sources;
            },
            get: function(id){
                return _.find(sources, {id});
            },
            push: function(source){
                sources.push(source);
            },
            pushAll: function(ss){
                _.each(ss, function(source){ sources.push(source) })
            },
            upsert: function(source){
                var idx = _.findIndex(sources, {id: source.id});
                if(idx >= 0) {
                    sources.splice(idx, 1, source);
                } else {
                    sources.splice(0, 0, source);
                }
            },
            update: function(sourceId){
                return $http.post('/api/files/get_file', {
                    path: 'id:' + sourceId,
                    relatedDatadocs: true
                }).then(response => {
                    let source = response.data;
                    state.upsert(source);
                    return source;
                }, e => {
                    console.log('error while updating source', e);
                })
            },
            remove: function(source){
                return _.remove(sources, function(i){ return i.id == source.id; })
            },
            removeAll: function(ss){
                var ids = _.map(ss, 'id');
                return _.remove(sources, function(o){ return _.includes(ids, o.id)})
            },
            reset: function(options = {}){
                return state.promise = getPromise(
                    _.merge(options, {
                        offset: 0,
                        limit: options.keepSize ? currentOffset : DEFAULT_LIMIT
                    }));
            },
            nextPage: function() {
                if(finishedLoading){
                    return $q.when();
                }
                return getPromise({offset: currentOffset});
            },
            selectFolder: function(folderId) {
                selectedFolderId = folderId;
                if(folderId) {
                    return $http.post('/api/files/get_file', {path: folderId ? 'id:' + folderId : ''})
                        .then(function (res) {
                            selectedFolder = res.data;
                            return res.data;
                        });
                } else {
                    selectedFolder = null;
                    return $q.when(null);
                }
            },
            getSelectedFolder: function() {
                return selectedFolder;
            },
            gettingSources: function() {
                return !!gettingSources;
            }
        };

        $rootScope.$on('sign_out', function() {
            selectedFolder = null;
        });

        return state;
    }]);
});