/**
 * attach filters to this module
 * if you get 'unknown {x}Provider' errors from angular, be sure they are
 * properly referenced in one of the module dependencies in the array.
 **/
define([
    './size',
    './financialFilter',
    './errorValueDescriptionFilter',
    './numberFilter',
    './locationCodesFilter',
    './locationLatLonFilter',
    './numberFormatFilter',
    './fixedIfFloatFilter',
    './formatCell',
    './groupByFilter',
    './pickerFilter',
    './searchFilterWithCallback'
], function () {});