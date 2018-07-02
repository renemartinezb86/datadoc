define(['./module'], function(module) {
    module.service('DatePatternService', [function () {
        function getDatePattern(formatType){
            switch(formatType){
                case 'DATE_1':
                    return 'M/D/YYYY';
                case 'DATE_2':
                    return 'MMM. D, YYYY';
                case 'TIME':
                    return 'h:mm:ss A';
                case 'DATE_TIME':
                    return 'M/D/YYYY h:mm:ss A';
                case 'DURATION':
                    return 'HH:mm:ss';
            }
        }

        return {
            getDatePattern
        }
    }])
});
