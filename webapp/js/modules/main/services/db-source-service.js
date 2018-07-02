define(['./module'], function(module) {
    module.service('DbSourceService', ['$http', function ($http) {
        const createCancelableFunction = (f) => (request, options) => f(_.merge(request, {cancel: true}), options);

        const testConnection = (request, options) => $http.post('/api/files/test_connection', request, options);
        const cancelTestConnection = createCancelableFunction(testConnection);

        const createRemoteLink = (request, options) => $http.post('/api/files/create_remote_link', request, options);
        const cancelCreateRemoteLink = createCancelableFunction(createRemoteLink);

        const updateRemoteLink = (request, options) => $http.post('/api/files/update_remote_link', request, options);
        const cancelUpdateRemoteLink = createCancelableFunction(updateRemoteLink);

        return {
            testConnection,
            cancelTestConnection,
            createRemoteLink,
            cancelCreateRemoteLink,
            updateRemoteLink,
            cancelUpdateRemoteLink
        }
    }])
});
