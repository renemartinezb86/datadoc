define(['./module'], function (module) {
    module.service('TimeZoneService', [function () {

        // Todo: make names like "Etc/GMT-8" or "Etc/GMT+8"
        const timeZones = [
            { abbr: "MIT", name: "Pacific/Midway", text: "Midway Islands Time", offset: "-1100", displayZone: "GMT-11:00" },
            { abbr: "HST", name: "US/Hawaii", text: "Hawaii Standard Time", offset: "-1000", displayZone: "GMT-10:00" },
            { abbr: "AST", name: "US/Alaska", text: "Alaska Standard Time", offset: "-0900", displayZone: "GMT-9:00" },
            { abbr: "PST", name: "US/Pacific", text: "Pacific Standard Time", offset: "-0800", displayZone: "GMT-8:00" },
            { abbr: "PNT", name: "America/Phoenix", text: "Phoenix Standard Time", offset: "-0700", displayZone: "GMT-7:00" },
            { abbr: "MST", name: "US/Mountain", text: "Mountain Standard Time", offset: "-0700", displayZone: "GMT-7:00" },
            { abbr: "CST", name: "US/Central", text: "Central Standard Time", offset: "-0600", displayZone: "GMT-6:00" },
            { abbr: "EST", name: "US/Eastern", text: "Eastern Standard Time", offset: "-0500", displayZone: "GMT-5:00" },
            { abbr: "IET", name: "US/East-Indiana", text: "Indiana Eastern Standard Time", offset: "-0500", displayZone: "GMT-5:00" },
            { abbr: "PRT", name: "America/Puerto_Rico", text: "Puerto Rico and US Virgin Islands Time", offset: "-0400", displayZone: "GMT-4:00" },
            { abbr: "CNT", name: "Canada/Newfoundland", text: "Canada Newfoundland Time", offset: "-0300", displayZone: "GMT-3:00" },
            { abbr: "AGT", name: "America/Buenos_Aires", text: "Argentina Standard Time", offset: "-0300", displayZone: "GMT-3:00" },
            { abbr: "BET", name: "Brazil/East", text: "Brazil Eastern Time", offset: "-0300", displayZone: "GMT-3:00" },
            { abbr: "CAT", name: "Atlantic/Cape_Verde", text: "Central African Time", offset: "-0100", displayZone: "GMT-1:00" },
            { abbr: "UTC", name: "Etc/Universal", text: "Universal Coordinated Time", offset: "0000", displayZone: "GMT+0:00" },
            { abbr: "GMT", name: "Etc/Greenwich", text: "Greenwich Mean Time", offset: "0000", displayZone: "GMT+0:00" },
            { abbr: "CET", name: "Europe/Berlin", text: "Central European Time", offset: "0100", displayZone: "GMT+1:00" },
            { abbr: "EET", name: "Europe/Kaliningrad", text: "Eastern European Time", offset: "0200", displayZone: "GMT+2:00" },
            { abbr: "ART", name: "Africa/Cairo", text: "Egypt Standard Time", offset: "0200", displayZone: "GMT+2:00" },
            { abbr: "EAT", name: "Africa/Juba", text: "Eastern African Time", offset: "0300", displayZone: "GMT+3:00" },
            { abbr: "MET", name: "Asia/Riyadh", text: "Middle East Time", offset: "0330", displayZone: "GMT+3:30" },
            { abbr: "NET", name: "Asia/Baku", text: "Near East Time", offset: "0400", displayZone: "GMT+4:00" },
            { abbr: "PLT", name: "Asia/Karachi", text: "Pakistan Lahore Time", offset: "0500", displayZone: "GMT+5:00" },
            { abbr: "IST", name: "Asia/Colombo", text: "India Standard Time", offset: "0530", displayZone: "GMT+5:30" },
            { abbr: "BST", name: "Asia/Dhaka", text: "Bangladesh Standard Time", offset: "0600", displayZone: "GMT+6:00" },
            { abbr: "VST", name: "Asia/Bangkok", text: "Vietnam Standard Time", offset: "0700", displayZone: "GMT+7:00" },
            { abbr: "CTT", name: "Asia/Macau", text: "China Taiwan Time", offset: "0800", displayZone: "GMT+8:00" },
            { abbr: "JST", name: "Asia/Tokyo", text: "Japan Standard Time", offset: "0900", displayZone: "GMT+9:00" },
            { abbr: "ACT", name: "Australia/Darwin", text: "Australia Central Time", offset: "0930", displayZone: "GMT+9:30" },
            { abbr: "AET", name: "Australia/Sydney", text: "Australia Eastern Time", offset: "0100", displayZone: "GMT+10:00" },
            { abbr: "SST", name: "Asia/Sakhalin", text: "Solomon Standard Time", offset: "0110", displayZone: "GMT+11:00" },
            { abbr: "NST", name: "Pacific/Auckland", text: "New Zealand Standard Time", offset: "0120", displayZone: "GMT+12:00" },
        ];
        return {
            getTimeZones: () => timeZones
        }
    }]);
});