define(['./module'], function(module) {
    module.service('BrowserHistoryService', ['$state', '$rootScope', function ($state, $rootScope) {
        window.onpopstate = (event) => {
            if (_.get(event, 'state.customChange')) {
                $rootScope.$emit(event.state.resultEvent, event.state.data);
            }
        };
        const AVAILABLE_PAGES = {
            MAIN_DATA: {
                url: '#/my-data',
                page: 'main.landing.my_data'
            }
        };



        const push = (resultEvent, page, data = {}) => {
            const state = {
                customChange: true,
                resultEvent,
                data
            };
            window.history.replaceState(state, page);
            window.history.pushState(state, page);
        };

        const resetCurrentStateIfEquals = (resultEvent, resetTo) => {
            if(_.get(window.history.state, 'customChange') && _.get(window.history.state, 'resultEvent') === resultEvent) {
                window.history.replaceState({}, resetTo.page, resetTo.url);
                window.history.pushState({}, resetTo.page, resetTo.url);
            }
        };

        return {
            AVAILABLE_PAGES,
            push,
            resetCurrentStateIfEquals
        }
    }]);
});


