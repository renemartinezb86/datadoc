define(['./module'], function(module) {
  module.constant('EventNames', {
    CHANGE_LIMIT_EVENT: {
      PIVOT: ".pivot.PivotChangeLimitEvent",
      AGGS: ".aggs.AggChangeLimitEvent"
    },
    CHANGE_SHOW_TOTAL: {
      PIVOT: ".pivot.PivotChangeShowTotalEvent",
      AGGS: ".aggs.AggChangeShowTotalEvent"
    },
    CHANGE_SORT_EVENT: {
      PIVOT: '.pivot.PivotChangeSortEvent',
      AGGS: '.aggs.AggChangeSortEvent'
    },
    CHANGE_PINNED_COUNT: {
        ROWS: '.rows.RowsPinnedCountChangedEvent',
        COLS: '.cols.ColsPinnedCountChangedEvent'
    }
  });
});