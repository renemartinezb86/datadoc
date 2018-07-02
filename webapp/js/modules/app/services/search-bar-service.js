define(['./module'], function (module) {
    module.factory('SearchBarService', function () {
        this.callback = null;
        this.suggestions = null;
        this.suggestionSelected = null;
        this.resetSearch = function(){};
        this.setSearch = function(){};
        return this;
    });
});