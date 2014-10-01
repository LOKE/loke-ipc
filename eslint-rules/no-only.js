/**
 * @fileoverview Rule to flag use of describe.only and it.only
 * @author Dominic Smith
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = function(context) {

  'use strict';

  return {

    MemberExpression: function(node) {
      var objectName = node.object.name,
          propertyName = node.property.name;

      if (['describe', 'it'].indexOf(objectName) !== -1 && !node.computed && propertyName && propertyName.match(/^only$/)) {
        context.report(node, 'Done\'t commit .{{property}}.', { property: propertyName });
      }

    }
  };

};
