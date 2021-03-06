/**
Copyright (c) 2012 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../base/base.js");

'use strict';

global.tr.exportTo('tr.model', function() {
  return {
    // Since the PID of the browser process is not known to the child processes,
    // we let them use "pid_ref = -1" to reference an object created in the
    // browser process.
    BROWSER_PROCESS_PID_REF: -1,

    // The default scope of object events, when not explicitly specified.
    OBJECT_DEFAULT_SCOPE: 'ptr'
  };
});
