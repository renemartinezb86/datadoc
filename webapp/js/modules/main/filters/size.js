define(['./module'], function (filters) {
    'use strict';

    return filters.filter('size', function () {
        let units = {
            'default': {m: 1000, scale: ['','K','M','B','T','Qd','Qt']},
            'bytes': {m: 1024, scale: [' bytes',' KB',' MB',' GB',' TB',' PB']}
        };

        return function( bytes, precision, unitStr ) {

            if ( isNaN( parseFloat( bytes )) || ! isFinite( bytes ) ) {
                return '?';
            }
            let unit = units[unitStr || 'default'];
            let scale = 0;
            while ( bytes >= unit.m ) {
                bytes /= unit.m;
                scale ++;
            }
            bytes = scale == 0 ? bytes : bytes.toFixed( + precision )
            return bytes + unit.scale[scale];
        };
    });

});
