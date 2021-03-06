/**
Copyright (c) 2015 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../metric_registry.js");
require("./responsiveness_metric.js");
require("../../model/user_model/idle_expectation.js");
require("../../value/numeric.js");
require("../../value/value.js");

'use strict';

global.tr.exportTo('tr.metrics.sh', function() {
  var LONG_TASK_MS = 50;

  var normalizedPercentage_smallerIsBetter =
    tr.v.Unit.byName.normalizedPercentage_smallerIsBetter;
  var timeDurationInMs_smallerIsBetter =
    tr.v.Unit.byName.timeDurationInMs_smallerIsBetter;

  function findLongTasks(ue) {
    var longTasks = [];
    // NB: This misses tasks that were associated with another UE,
    // since only unassociated events are vacuumed up into IdleExpectations.
    ue.associatedEvents.forEach(function(event) {
      if ((event instanceof tr.model.ThreadSlice) &&
          (event.duration > LONG_TASK_MS) &&
          event.isTopLevel)
        longTasks.push(event);
    });
    return longTasks;
  }

  function computeResponsivenessRisk(durationMs) {
    // Returns 0 when the risk of impacting responsiveness is minimal.
    // Returns 1 when it is maximal.
    // durationMs is the duration of a long idle task.
    // It is at least DEFAULT_LONG_TASK_MS.
    // The FAST_RESPONSE_HISTOGRAM was designed to permit both a 50ms idle task
    // when a Scroll Response begins, plus 16ms latency between the idle task
    // and the first frame of the scroll, without impacting the responsiveness
    // score.
    // Add 16ms to durationMs to simulate the standard (maximum ideal) scroll
    // response latency, and use the FAST_RESPONSE_HISTOGRAM to punish every ms
    // that the long idle task exceeds DEFAULT_LONG_TASK_MS.

    durationMs += 16;

    // computeDurationResponsiveness returns a normalized percentage that
    // represents the fraction of users that would be satisfied with a
    // Scroll Response that takes durationMs to respond.
    // The risk of impacting responsiveness is approximated as the long task's
    // impact on a hypothetical Scroll Response that starts when the long task
    // starts, and then takes the standard 16ms to respond after the long task
    // finishes.
    // We imagine a Scroll Response instead of a Load or another type of
    // Response because the Scroll Response carries the strictest expectation.
    // The risk of impacting responsiveness is framed as the fraction of users
    // that would be *un*satisifed with the responsiveness of that hypothetical
    // Scroll Response. The fraction of users who are unsatisfied with something
    // is equal to 1 - the fraction of users who are satisfied with it.
    return 1 - tr.metrics.sh.computeDurationResponsiveness(
        tr.metrics.sh.FAST_RESPONSE_HISTOGRAM, durationMs);
  }

  // This weighting function is similar to tr.metrics.sh.perceptualBlend,
  // but this version is appropriate for SmallerIsBetter metrics, whereas
  // that version is for BiggerIsBetter metrics.
  // (This would not be necessary if hazard were reframed as a BiggerIsBetter
  // metric such as "stability".)
  // Also, that version assumes that the 'ary' will be UserExpectations, whereas
  // this version assumes that the 'ary' will be scores.
  function perceptualBlendSmallerIsBetter(hazardScore) {
    return Math.exp(hazardScore);
  }

  // This metric requires only the 'toplevel' tracing category,
  // in addition to whatever categories are required to compute the
  // IdleExpectations (or rather the R/A/Ls that delineate the Idles).
  // This metric computes a hazard score for each Idle independently (instead of
  // grouping all long idle tasks together) because each Idle is different:
  // the Idle before a Load is usually very empty, whereas the Idle immediately
  // after a Load is usually still very active, since Loads end at a very early
  // end point (the first contentful paint) while many parts of the page are
  // still loading. (There may not necessarily be an Idle after a Load in
  // real-world traces, but there almost always is in telemetry.)
  function computeLongIdleTaskHazard(hazardScores, valueList, ue) {
    var longTaskScores = [];
    var durationValues = new tr.metrics.ValueList();

    findLongTasks(ue).forEach(function(longTask) {
      longTaskScores.push(computeResponsivenessRisk(longTask.duration));
      durationValues.addValue(new tr.v.NumericValue(
          ue.parentModel.canonicalUrlThatCreatedThisTrace,
          'long idle task duration',
          new tr.v.ScalarNumeric(
              timeDurationInMs_smallerIsBetter, longTask.duration),
          {description: 'Duration of a long idle task'}));
    });

    var options = {description: 'Risk of impacting responsiveness'};
    var groupingKeys = {};
    groupingKeys.userExpectationStableId = ue.stableId;
    groupingKeys.userExpectationStageTitle = ue.stageTitle;
    groupingKeys.userExpectationInitiatorTitle = ue.initiatorTitle;
    var diagnostics = {values: durationValues.valueDicts};

    var hazardScore = tr.b.Statistics.weightedMean(
        longTaskScores, perceptualBlendSmallerIsBetter);

    if (hazardScore === undefined)
      hazardScore = 0;

    hazardScores.push(hazardScore);

    valueList.addValue(new tr.v.NumericValue(
        ue.parentModel.canonicalUrlThatCreatedThisTrace,
        'long idle tasks hazard',
        new tr.v.ScalarNumeric(
            normalizedPercentage_smallerIsBetter, hazardScore),
        options, groupingKeys, diagnostics));
  }

  function hazardMetric(valueList, model) {
    var hazardScores = [];
    var hazardValues = new tr.metrics.ValueList();

    model.userModel.expectations.forEach(function(ue) {
      // Add normalized metrics to diagnostics.values.
      // TODO(memory): Add memory here.

      if (ue instanceof tr.model.um.IdleExpectation)
        computeLongIdleTaskHazard(hazardScores, hazardValues, ue);
    });

    var options = {description: 'Risk of impacting responsiveness'};
    var groupingKeys = {};
    var diagnostics = {values: hazardValues.valueDicts};

    var overallHazard = tr.b.Statistics.weightedMean(
        hazardScores, perceptualBlendSmallerIsBetter);

    if (overallHazard === undefined)
      overallHazard = 0;

    valueList.addValue(new tr.v.NumericValue(
        model.canonicalUrlThatCreatedThisTrace, 'hazard',
        new tr.v.ScalarNumeric(
            normalizedPercentage_smallerIsBetter, overallHazard),
        options, groupingKeys, diagnostics));
  }

  hazardMetric.prototype = {
    __proto__: Function.prototype
  };

  tr.metrics.MetricRegistry.register(hazardMetric);

  return {
    hazardMetric: hazardMetric,
    computeLongIdleTaskHazard: computeLongIdleTaskHazard
  };
});
