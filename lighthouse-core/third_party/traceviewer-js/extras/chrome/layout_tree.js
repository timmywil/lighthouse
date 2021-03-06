/**
Copyright (c) 2016 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("../../model/event_registry.js");
require("../../model/object_instance.js");

'use strict';

global.tr.exportTo('tr.e.chrome', function() {
  var ObjectSnapshot = tr.model.ObjectSnapshot;
  var ObjectInstance = tr.model.ObjectInstance;

  function LayoutTreeInstance() {
    ObjectInstance.apply(this, arguments);
  }

  LayoutTreeInstance.prototype = {
    __proto__: ObjectInstance.prototype,
  };

  ObjectInstance.register(LayoutTreeInstance, {typeName: 'LayoutTree'});

  function LayoutTreeSnapshot() {
    ObjectSnapshot.apply(this, arguments);
    this.rootLayoutObject = new tr.e.chrome.LayoutObject(this, this.args);
  }

  LayoutTreeSnapshot.prototype = {
    __proto__: ObjectSnapshot.prototype,
  };

  ObjectSnapshot.register(LayoutTreeSnapshot, {typeName: 'LayoutTree'});

  tr.model.EventRegistry.register(
      LayoutTreeSnapshot,
      {
        name: 'layoutTree',
        pluralName: 'layoutTrees',
        singleViewElementName: 'tr-ui-a-layout-tree-sub-view',
        multiViewElementName: 'tr-ui-a-layout-tree-sub-view'
      });

  return {
    LayoutTreeInstance: LayoutTreeInstance,
    LayoutTreeSnapshot: LayoutTreeSnapshot
  };
});
