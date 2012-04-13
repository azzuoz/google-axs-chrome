// Copyright 2012 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

goog.provide('cvox.ChromeVoxKbHandler');

goog.require('cvox.ChromeVox');
goog.require('cvox.ChromeVoxSearch');
goog.require('cvox.ChromeVoxUserCommands');
goog.require('cvox.KeyUtil');

/**
 * @fileoverview Handles user keyboard input events.
 *
 * @author clchen@google.com (Charles L. Chen)
 */
cvox.ChromeVoxKbHandler = {};

/**
 * Maps a key string in the form generated by KeyUtil.keyEventToString
 * (like "Ctrl+Alt+X") into the name of a command to execute.
 *
 * @type {Object}
 */
cvox.ChromeVoxKbHandler.keyToFunctionsTable = {};

/**
 * Holds the keyboard shortcuts corresponding to the commands populated in
 * PowerKey
 *
 * @type {Array}
 */
cvox.ChromeVoxKbHandler.powerkeyShortcuts = [];

/**
 * Loads the key bindings into the keyToFunctionsTable.
 *
 *  @param {Object} keyToFunctionsTable The key bindings table.
 */
cvox.ChromeVoxKbHandler.loadKeyToFunctionsTable = function(
    keyToFunctionsTable) {
  // TODO(dmazzoni): Set up externs properly instead of using window.
  window.console.log('Got keyToFunctionsTable');
  cvox.ChromeVoxKbHandler.keyToFunctionsTable = keyToFunctionsTable;
  cvox.ChromeVox.sequenceSwitchKeyCodes =
      cvox.ChromeVoxKbHandler.getSequenceSwitchKeys();
  cvox.ChromeVoxKbHandler.powerkeyShortcuts =
      cvox.ChromeVoxUserCommands.initPowerKey(
      cvox.ChromeVoxKbHandler.keyToFunctionsTable,
      cvox.ChromeVoxKbHandler.powerkeyActionHandler);
};

/**
 * Hanldes callbacks from PowerKey when user makes a selection.
 *
 * @param {string} completion The completion string selected by the user.
 * @param {number} index The index of the completion string.
 */
cvox.ChromeVoxKbHandler.powerkeyActionHandler = function(completion, index) {
  var keyStr = cvox.ChromeVoxKbHandler.powerkeyShortcuts[index];
  var functionName = cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr] ?
      cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr][0] : null;
  var func = cvox.ChromeVoxUserCommands.commands[functionName];
  if (func) {
    if (cvox.ChromeVoxSearch.isActive()) {
      cvox.ChromeVoxSearch.hide();
      cvox.ChromeVox.navigationManager.syncToSelection();
    }
    func();
  }
};

/**
 * Finds the keys that cause the switch to the sequential mode. For instance,
 * if the key->function table contains a shortcut Ctrl+Alt+J>L, then pressing
 * J and L one after the other while holding down Ctrl+Alt will generate the
 * shortcut Ctrl+Alt+J>L. In this case, J is the key that switches to the
 * sequential mode, indicating that the subsequent keys are a part fo the same
 * keyboard shortcut.
 *
 * @return {Object.<string, number>} A set containing the switch keys.
 */
cvox.ChromeVoxKbHandler.getSequenceSwitchKeys = function() {
  // Find the keys that act as a switch for sequential mode.
  var switchKeys = {};
  for (var key in cvox.ChromeVoxKbHandler.keyToFunctionsTable) {
    var tokens = key.split('+');
    if (tokens.length > 0) {
      var seqKeys = tokens[tokens.length - 1].split('>');
      if (seqKeys.length > 1) {
        switchKeys[seqKeys[0]] = 1;
      }
    }
  }
  return switchKeys;
};

/**
 * Checks if ChromeVox must pass the enter key to the browser.
 * For example, if the user has focus on an input field, link, button,
 * etc., then that takes precedence over anything else ChromeVox
 * might be doing and so it must pass the enter key to the browser.
 *
 * @return {boolean} True if an Enter key event must be passed to the browser.
 */
cvox.ChromeVoxKbHandler.mustPassEnterKey = function() {
  var activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }
  return (activeElement.isContentEditable) ||
         (activeElement.getAttribute('role') == 'textbox') ||
         (activeElement.tagName == 'INPUT') ||
         (activeElement.tagName == 'A' &&
             !cvox.DomUtil.isInternalLink(activeElement)) ||
         (activeElement.tagName == 'SELECT') ||
         (activeElement.tagName == 'BUTTON') ||
         (activeElement.tagName == 'TEXTAREA');
};

/**
 * Handles key down events.
 *
 * @param {Event} evt The key down event to process.
 * @return {boolean} True if the default action should be performed.
 */
cvox.ChromeVoxKbHandler.basicKeyDownActionsListener = function(evt) {
  // The enter key can be handled either by ChromeVox or by the browser.
  if (evt.keyCode == 13 && cvox.ChromeVox.isActive) {
    // If this is an internal link, try to sync to it.
    if (document.activeElement.tagName == 'A' &&
        cvox.DomUtil.isInternalLink(document.activeElement)) {
      var targetNode;
      var targetId = document.activeElement.href.split('#')[1];
      targetNode = document.getElementById(targetId);
      if (!targetNode) {
        var nodes = document.getElementsByName(targetId);
        if (nodes.length > 0) {
          targetNode = nodes[0];
        }
      }
      if (targetNode) {
        cvox.ChromeVox.navigationManager.syncToNode(targetNode);
        var currentDesc =
            cvox.ChromeVox.navigationManager.getCurrentDescription();
        cvox.ChromeVox.navigationManager.speakDescriptionArray(
            currentDesc, cvox.AbstractTts.QUEUE_MODE_FLUSH, null);
        return true;
      }
    }

    // If the user is focused on something that explicitly takes the
    // enter key, that has precedence. Always let the key through.
    if (cvox.ChromeVoxKbHandler.mustPassEnterKey()) {
      return true;
    }
    // The only time ChromeVox should consider handling the enter
    // key is if the navigation manager is able to act on the current item.
    if (!cvox.ChromeVox.navigationManager.canActOnCurrentItem()) {
      return true;
    }
    // Act on this element.
    return cvox.ChromeVoxUserCommands.commands['actOnCurrentItem']();
  }
  var keyStr = cvox.KeyUtil.keyEventToString(evt);
  var functionName = cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr] ?
      cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr][0] : null;
  // TODO (clchen): Disambiguate why functions are null. If the user pressed
  // something that is not a valid combination, make an error noise so there
  // is some feedback.
  if (functionName === null) {
    // The prefix key having been hit first can also serve as the Cvox modifier
    // being down.
    keyStr = keyStr.replace('Prefix>', 'Cvox+');
    functionName = cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr] ?
      cvox.ChromeVoxKbHandler.keyToFunctionsTable[keyStr][0] : null;
  }

  // If ChromeVox isn't active, ignore every command except the one
  // to toggle ChromeVox active again.
  if (!cvox.ChromeVox.isActive && functionName != 'toggleChromeVox') {
    return true;
  }

  // Ignore the left or right arrow key unless we are currently continuously
  // reading.
  if ((functionName == 'skipForward') || (functionName == 'skipBackward')) {
    if (!cvox.ChromeVoxUserCommands.keepReading) {
      return true;
    }
  } else if (functionName && cvox.ChromeVoxUserCommands.keepReading) {
    // Turn off continuous reading otherwise.
    cvox.ChromeVoxUserCommands.keepReading = false;
  }

  // This is the key event handler return value - true if the event should
  // propagate and the default action should be performed, false if we eat
  // the key.
  var returnValue = true;

  var func = cvox.ChromeVoxUserCommands.commands[functionName];
  if (func && (!cvox.ChromeVoxUserCommands.powerkey ||
      !cvox.ChromeVoxUserCommands.powerkey.isVisible())) {
    if (cvox.ChromeVoxSearch.isActive() && functionName != 'stopSpeech') {
      cvox.ChromeVoxSearch.hide();
      cvox.ChromeVox.navigationManager.syncToSelection();
    }
    returnValue = func();
  } else if (keyStr.indexOf(cvox.ChromeVox.modKeyStr) == 0) {
    if (cvox.ChromeVoxUserCommands.powerkey &&
        cvox.ChromeVoxUserCommands.powerkey.isVisible()) {
      // if PowerKey is visible, hide it, since modifier keys have no use when
      // PowerKey is visible.
      cvox.ChromeVoxUserCommands.hidePowerKey();
      returnValue = false;
    }
    // Modifier keys are active -- prevent default action
    returnValue = false;
  }

  // If the whole document is hidden from screen readers, let the app
  // catch keys as well.
  if (cvox.ChromeVox.entireDocumentIsHidden) {
    returnValue = true;
  }

  return returnValue;
};
